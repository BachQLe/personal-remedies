/**
 * recipeIngestion.js — C1 recipe-overlay ingestion seam (Task T2C).
 *
 * Track C (see REMEDI_MASTER_PLAN.md) delivers ~150 MedlinePlus recipes as
 * JSON rows in src/data/recipeOverlay.json — editorial content (ingredients,
 * attribution, meal type, servings, nutrition-facts-panel macros) keyed by
 * Nutridigm foodItemID. This module is the ONLY path by which that content
 * reaches the app, and it is deliberately structurally incapable of
 * exposing a recipe the live API hasn't scored.
 *
 * SAFETY INVARIANT (Track B item 2 / REMEDI_MASTER_PLAN.md — the single
 * most safety-critical rule in this task): a recipe's entire safety story —
 * whether it's plan-eligible (`normalizePlanGroup` in adapter.js), whether
 * it's saveable (`saveGate.js`) — runs off `numericId`, which comes ONLY
 * from the live Nutridigm /suggest response (`descriptionNumericID`). The
 * overlay schema (see `RecipeOverlayRow` in types.js) has no numericId/tier
 * column at all, and `joinRecipeOverlay` below only ever enriches an object
 * the caller already obtained from the API — it can attach editorial fields
 * to a recipe, but it can never manufacture a new recipe or backfill a
 * numericId. An overlay row whose foodItemID isn't present among the
 * caller's `apiRecipes` is simply never surfaced.
 *
 * SCHEMA NOTE (frozen — see REMEDI_MASTER_PLAN.md "Recipe directions
 * text"): the overlay has no directions/instructions column and must never
 * gain one. Recipe directions are the source's copyrighted expression;
 * ingredients (a list of facts) plus a link back to the source
 * (`sourceUrl`) is the whole of what this app shows for preparation.
 *
 * House style follows src/api/localTables.js: the overlay JSON is statically
 * imported (Vite bundles it — reading it costs zero network calls at
 * runtime), and invalid rows are dropped with a console.warn rather than
 * thrown, so one bad row from the content pipeline degrades gracefully in
 * prod instead of white-screening the app.
 */

import overlayRaw from '../data/recipeOverlay.json';

/** @type {ReadonlyArray<string>} */
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'beverage'];

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}

function isHttpsUrl(v) {
  if (!isNonEmptyString(v)) return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
}

function isStringArray(v) {
  return Array.isArray(v) && v.every((s) => typeof s === 'string');
}

function isMealTypeArray(v) {
  return Array.isArray(v) && v.every((m) => MEAL_TYPES.includes(m));
}

function isNumberArray(v) {
  return Array.isArray(v) && v.every((n) => isFiniteNumber(n));
}

/**
 * Validate a single C1 overlay row against the frozen schema (see
 * `RecipeOverlayRow` in types.js). Structural + type checks only — no
 * business-rule enforcement beyond what's needed to keep downstream code
 * (`joinRecipeOverlay`, and eventually adapter.js) from misreading a field.
 * Deliberately does NOT check for a `directions`/`instructions` field —
 * the schema has none, so there is nothing to reject there; it simply
 * never gets read.
 * @param {*} row
 * @returns {{ valid: true } | { valid: false, reason: string }}
 */
export function validateOverlayRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return { valid: false, reason: 'row is not an object' };
  }
  if (!isNonEmptyString(row.name)) {
    return { valid: false, reason: 'name must be a non-empty string' };
  }
  if (!isHttpsUrl(row.sourceUrl)) {
    return { valid: false, reason: 'sourceUrl must be an https:// URL' };
  }
  if (!isNonEmptyString(row.attribution)) {
    return { valid: false, reason: 'attribution must be a non-empty string' };
  }
  if (!MEAL_TYPES.includes(row.mealType)) {
    return { valid: false, reason: `mealType must be one of ${MEAL_TYPES.join(', ')}` };
  }
  if (row.alsoFits !== undefined && !isMealTypeArray(row.alsoFits)) {
    return { valid: false, reason: 'alsoFits, when present, must be an array of valid mealTypes' };
  }
  if (!isStringArray(row.rawIngredients) || row.rawIngredients.length === 0) {
    return { valid: false, reason: 'rawIngredients must be a non-empty string array' };
  }
  if (!isNumberArray(row.ingredientFoodItemIds)) {
    return { valid: false, reason: 'ingredientFoodItemIds must be an array of numbers' };
  }
  if (!isFiniteNumber(row.servings) || row.servings <= 0) {
    return { valid: false, reason: 'servings must be a positive finite number' };
  }
  const n = row.nutritionPerServing;
  if (
    !n || typeof n !== 'object' ||
    !isFiniteNumber(n.calories) || !isFiniteNumber(n.protein) ||
    !isFiniteNumber(n.carbs) || !isFiniteNumber(n.fat)
  ) {
    return { valid: false, reason: 'nutritionPerServing must have numeric calories/protein/carbs/fat' };
  }
  if (row.dietaryTags !== undefined && !isStringArray(row.dietaryTags)) {
    return { valid: false, reason: 'dietaryTags, when present, must be a string array' };
  }
  if (!isFiniteNumber(row.totalTimeMinutes) || row.totalTimeMinutes <= 0) {
    return { valid: false, reason: 'totalTimeMinutes must be a positive finite number' };
  }
  if (row.fineFoodGroup !== 'l') {
    return { valid: false, reason: "fineFoodGroup must be 'l'" };
  }
  if (row.foodItemID !== undefined && !isFiniteNumber(row.foodItemID)) {
    return { valid: false, reason: 'foodItemID, when present, must be a finite number' };
  }
  return { valid: true };
}

/** @type {Array<Object>|null} Memoized validated overlay (built lazily on first read). */
let _validatedOverlay = null;

/**
 * Load + validate the C1 recipe overlay (src/data/recipeOverlay.json).
 * Invalid rows are dropped with a console.warn — dev-visible, never
 * throws — so a malformed row from the content pipeline can't take the app
 * down in prod. Synchronous + memoized, same pattern as
 * localTables.js's `getItemTable`.
 * @returns {Array<import('./types.js').RecipeOverlayRow>} valid rows only
 */
export function loadRecipeOverlay() {
  if (_validatedOverlay) return _validatedOverlay;
  const rows = Array.isArray(overlayRaw) ? overlayRaw : [];
  _validatedOverlay = rows.filter((row, i) => {
    const result = validateOverlayRow(row);
    if (!result.valid) {
      console.warn(`[recipeIngestion] dropping invalid overlay row at index ${i}: ${result.reason}`, row);
      return false;
    }
    return true;
  });
  return _validatedOverlay;
}

/**
 * The ONLY path by which C1 overlay content (ingredients, attribution,
 * nutrition facts, etc.) reaches a Recipe object. Enriches `apiRecipes` —
 * recipes the caller already got back from the live Nutridigm API, each
 * carrying its own foodItemID (`id`/`foodId`) and `numericId` — with the
 * matching overlay row's content, joined on foodItemID.
 *
 * Structurally incapable of minting a recipe the API didn't return: this
 * function only ever `.map()`s over `apiRecipes` and looks up a row to
 * merge in — never the reverse. An overlay row whose foodItemID has no
 * match in `apiRecipes` is silently unused; a row with no foodItemID at all
 * (a pre-scoring C1 draft — see `RecipeOverlayRow.foodItemID` in types.js)
 * can never match anything and is likewise unused. `apiRecipes` itself is
 * never filtered or added to — only mapped, 1:1, same length in and out.
 *
 * Safety fields — numericId, tier, id, foodId, or anything else that came
 * from the API — are NEVER read from the overlay row, even if a row
 * happened to carry a same-named field (the schema doesn't define one, but
 * this is enforced structurally, not just by schema). Every overlay field
 * copied onto the result below is picked explicitly by name; there is no
 * spread of the overlay row, so it is structurally impossible for a
 * malformed or malicious overlay row to introduce/overwrite a safety field.
 *
 * `mealType` precedence: deliberately NOT applied here. The overlay's
 * mealType is editorial truth (a human categorized the recipe against the
 * real source), whereas the existing `recipe.mealType` on an API recipe is
 * `guessMealType`'s keyword heuristic (adapter.js) — the overlay value
 * SHOULD win once both exist, but that's a decision about how adapter.js's
 * pipeline reconciles two mealType signals, which belongs with the
 * next-wave agent wiring this module into adapter.js. This function stays a
 * pure, side-effect-free join: it returns the overlay's editorial value
 * under `overlayMealType` (alongside the untouched `mealType` it inherited
 * from `apiRecipes`) rather than silently deciding the precedence itself.
 *
 * @param {Array<import('./types.js').Recipe>} apiRecipes - Recipes already
 *   returned by the live API (each must carry its own foodItemID via `id`
 *   and/or `foodId`, and its own `numericId`/`tier`).
 * @returns {Array<import('./types.js').Recipe>} Same recipes, in the same
 *   order, enriched with overlay fields (`sourceUrl`, `attribution`,
 *   `servings`, `nutritionPerServing`, `rawIngredients`,
 *   `ingredientFoodItemIds`, `dietaryTags`, `totalTimeMinutes`, `alsoFits`,
 *   `overlayMealType`) where a matching row exists; recipes with no
 *   matching overlay row pass through unchanged (same object reference).
 */
export function joinRecipeOverlay(apiRecipes) {
  if (!Array.isArray(apiRecipes)) return [];

  const overlay = loadRecipeOverlay();
  if (overlay.length === 0) return apiRecipes;

  const overlayByFoodItemId = new Map();
  for (const row of overlay) {
    if (row.foodItemID === undefined) continue; // pre-scoring draft — can never match
    overlayByFoodItemId.set(String(row.foodItemID), row);
  }
  if (overlayByFoodItemId.size === 0) return apiRecipes;

  return apiRecipes.map((recipe) => {
    const key = recipe?.foodId ?? recipe?.id;
    if (key == null) return recipe;

    const row = overlayByFoodItemId.get(String(key));
    if (!row) return recipe;

    return {
      ...recipe, // recipe's own (API-sourced) fields are untouched, including numericId/tier/id/foodId
      sourceUrl: row.sourceUrl,
      attribution: row.attribution,
      servings: row.servings,
      nutritionPerServing: {
        calories: row.nutritionPerServing.calories,
        protein: row.nutritionPerServing.protein,
        carbs: row.nutritionPerServing.carbs,
        fat: row.nutritionPerServing.fat,
      },
      rawIngredients: row.rawIngredients,
      ingredientFoodItemIds: row.ingredientFoodItemIds,
      dietaryTags: row.dietaryTags ?? [],
      totalTimeMinutes: row.totalTimeMinutes,
      alsoFits: row.alsoFits ?? [],
      overlayMealType: row.mealType,
    };
  });
}
