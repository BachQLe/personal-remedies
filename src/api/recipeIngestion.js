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

/**
 * @type {ReadonlyArray<string>}
 * 'dessert' added Sept 2026 (user decision, verbatim: "Snacks and deserts
 * are going to be shown at once. But theyre going to have different tags.
 * So yeah add as another meal type.") — a FIRST-CLASS meal type, NOT an
 * alias/synonym for 'snack'. Mory's real 119-recipe source spreadsheet
 * codes 11 recipes as dessert ("Ds"). The UI groups dessert recipes
 * alongside snacks but tags them distinctly — that presentation decision
 * belongs to the UI layer (adapter.js / the screens), not here. This
 * module's only job is to accept 'dessert' as a valid `mealType`/`alsoFits`
 * member, exactly like any other meal type.
 */
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'beverage', 'dessert'];

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
 *
 * Required: `name`, `sourceUrl`, `mealType`, and `fineFoodGroup: 'l'`.
 * Everything else — `attribution`, `nutritionPerServing` (whole object, see
 * NUTRITION RELAXATION below), `rawIngredients`, `ingredientFoodItemIds`,
 * `servings`, `totalTimeMinutes` — is optional: valid if absent, but still
 * strictly type-checked when present, so a partially-populated content
 * pipeline row degrades to "field missing" rather than "field silently
 * wrong". `rawIngredients` is one exception worth calling out: absent means
 * "we don't have it yet" (fine), but an explicit `[]` is still rejected —
 * that shape only happens if the content pipeline broke.
 *
 * NUTRITION RELAXATION (Sept 2026, user-approved — Mory's real 119-recipe
 * source spreadsheet has NO calorie column at all, unlike the placeholder
 * schema this validator originally enforced): `nutritionPerServing` is now
 * optional AS A WHOLE, not just its `calories` sub-field — a row with no
 * macro data whatsoever (the common case for this source) is valid; never
 * fabricate a calorie value or fall back to a default when one is missing,
 * absent means unknown, all the way through to the UI (RecipeLinkSheet
 * renders no calorie line at all when it's absent — see
 * foodDetailCard.js's `resolveRecipePreview`). When the key IS present, it
 * must still be a plain object, and each of `calories`/`protein`/`carbs`/
 * `fat` — all individually optional — must be a finite number when
 * present. An explicit empty object (`nutritionPerServing: {}`) is
 * REJECTED, not accepted-but-pointless: same convention as
 * `rawIngredients` above — "we don't have this yet" is expressed by
 * omitting the key entirely, so an empty-but-present object can only mean
 * a content-pipeline bug (e.g. a spreadsheet transform that always emits
 * the key with nothing in it).
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
  if (row.attribution !== undefined && !isNonEmptyString(row.attribution)) {
    return { valid: false, reason: 'attribution, when present, must be a non-empty string' };
  }
  if (!MEAL_TYPES.includes(row.mealType)) {
    return { valid: false, reason: `mealType must be one of ${MEAL_TYPES.join(', ')}` };
  }
  if (row.alsoFits !== undefined && !isMealTypeArray(row.alsoFits)) {
    return { valid: false, reason: 'alsoFits, when present, must be an array of valid mealTypes' };
  }
  if (
    row.rawIngredients !== undefined &&
    (!isStringArray(row.rawIngredients) || row.rawIngredients.length === 0)
  ) {
    return { valid: false, reason: 'rawIngredients, when present, must be a non-empty string array' };
  }
  if (row.ingredientFoodItemIds !== undefined && !isNumberArray(row.ingredientFoodItemIds)) {
    return { valid: false, reason: 'ingredientFoodItemIds, when present, must be an array of numbers' };
  }
  if (row.servings !== undefined && (!isFiniteNumber(row.servings) || row.servings <= 0)) {
    return { valid: false, reason: 'servings, when present, must be a positive finite number' };
  }
  if (row.nutritionPerServing !== undefined) {
    const n = row.nutritionPerServing;
    if (!n || typeof n !== 'object' || Array.isArray(n)) {
      return { valid: false, reason: 'nutritionPerServing, when present, must be an object' };
    }
    if (Object.keys(n).length === 0) {
      return {
        valid: false,
        reason: 'nutritionPerServing, when present, must not be an empty object — omit the field entirely to mean "unknown"',
      };
    }
    if (n.calories !== undefined && !isFiniteNumber(n.calories)) {
      return { valid: false, reason: 'nutritionPerServing.calories, when present, must be a finite number' };
    }
    if (n.protein !== undefined && !isFiniteNumber(n.protein)) {
      return { valid: false, reason: 'nutritionPerServing.protein, when present, must be a finite number' };
    }
    if (n.carbs !== undefined && !isFiniteNumber(n.carbs)) {
      return { valid: false, reason: 'nutritionPerServing.carbs, when present, must be a finite number' };
    }
    if (n.fat !== undefined && !isFiniteNumber(n.fat)) {
      return { valid: false, reason: 'nutritionPerServing.fat, when present, must be a finite number' };
    }
  }
  if (row.dietaryTags !== undefined && !isStringArray(row.dietaryTags)) {
    return { valid: false, reason: 'dietaryTags, when present, must be a string array' };
  }
  if (
    row.totalTimeMinutes !== undefined &&
    (!isFiniteNumber(row.totalTimeMinutes) || row.totalTimeMinutes <= 0)
  ) {
    return { valid: false, reason: 'totalTimeMinutes, when present, must be a positive finite number' };
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
 * Every field below the required four (`sourceUrl`, and `overlayMealType`
 * from the required `mealType`) is copied onto the result ONLY when the
 * overlay row actually carries it — an absent optional field is OMITTED
 * from the joined object entirely, never set to `null`/`undefined`/`[]`.
 * This keeps "we don't have this yet" (key absent) distinguishable from "we
 * checked and it's empty" (key present, empty value) all the way through to
 * consumers like `getRecipesRaw`'s `if (!rawIngredients)` guard
 * (adapter.js), which an omitted key still satisfies. `dietaryTags` and
 * `alsoFits` are the one exception, kept at their pre-existing `?? []`
 * fill — they were already optional before this schema relaxation and nothing
 * here changes their contract.
 *
 * `nutritionPerServing` (Sept 2026 relaxation — see `validateOverlayRow`'s
 * NUTRITION RELAXATION note) is now itself one of the "only when present"
 * fields: a row with no macro data omits the key entirely from the joined
 * result rather than joining an object with a missing/undefined `calories`.
 * When the row does carry it, only the sub-fields the row actually has
 * (`calories`/`protein`/`carbs`/`fat`, independently) are copied — same
 * "omit, don't null-fill" rule as everything else here.
 *
 * @param {Array<import('./types.js').Recipe>} apiRecipes - Recipes already
 *   returned by the live API (each must carry its own foodItemID via `id`
 *   and/or `foodId`, and its own `numericId`/`tier`).
 * @returns {Array<import('./types.js').Recipe>} Same recipes, in the same
 *   order, enriched with overlay fields (`sourceUrl` always;
 *   `attribution`, `servings`, `nutritionPerServing` (whole object, with
 *   only its present sub-fields), `rawIngredients`, `ingredientFoodItemIds`,
 *   `totalTimeMinutes` only when the overlay row has them; `dietaryTags`/
 *   `alsoFits` always, `?? []` filled; `overlayMealType` always) where a
 *   matching row exists; recipes with no matching overlay row pass through
 *   unchanged (same object reference).
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

    const joined = {
      ...recipe, // recipe's own (API-sourced) fields are untouched, including numericId/tier/id/foodId
      sourceUrl: row.sourceUrl,
      dietaryTags: row.dietaryTags ?? [],
      alsoFits: row.alsoFits ?? [],
      overlayMealType: row.mealType,
    };
    if (row.attribution !== undefined) joined.attribution = row.attribution;
    if (row.servings !== undefined) joined.servings = row.servings;
    if (row.nutritionPerServing !== undefined) {
      // nutritionPerServing is now OPTIONAL on the overlay row as a whole
      // (Mory's real source data has no calorie column at all — see
      // validateOverlayRow's NUTRITION RELAXATION note), so this block, and
      // each macro within it, is copied over only when the row actually
      // carries it. `row.nutritionPerServing.calories` is never read
      // unconditionally here — that field can itself be absent even when
      // the object is present (e.g. a row transcribed with protein/carbs
      // but no calorie figure) — never fabricate/default a missing macro.
      const nutritionPerServing = {};
      if (row.nutritionPerServing.calories !== undefined) nutritionPerServing.calories = row.nutritionPerServing.calories;
      if (row.nutritionPerServing.protein !== undefined) nutritionPerServing.protein = row.nutritionPerServing.protein;
      if (row.nutritionPerServing.carbs !== undefined) nutritionPerServing.carbs = row.nutritionPerServing.carbs;
      if (row.nutritionPerServing.fat !== undefined) nutritionPerServing.fat = row.nutritionPerServing.fat;
      joined.nutritionPerServing = nutritionPerServing;
    }
    if (row.rawIngredients !== undefined) joined.rawIngredients = row.rawIngredients;
    if (row.ingredientFoodItemIds !== undefined) joined.ingredientFoodItemIds = row.ingredientFoodItemIds;
    if (row.totalTimeMinutes !== undefined) joined.totalTimeMinutes = row.totalTimeMinutes;
    return joined;
  });
}
