/**
 * types.js — JSDoc @typedef definitions for the Remedi API surface.
 *
 * These types define the ONLY shapes screens may consume.
 * Historically no numeric score (value / descriptionNumericID) was ever
 * exposed here. RELAXED July 2026 (user-approved) for the rating feature:
 * `Assessment` now carries score/verdict/numericId — see the Assessment
 * typedef below. All other shapes remain score-free.
 */

/**
 * @typedef {'Top' | 'Strong' | 'Good'} Tier
 * Represents a positive match tier (descriptionNumericID 1/2/3 internally).
 */

/**
 * @typedef {'poor'} PoorTier
 * Represents a negative match (descriptionNumericID 5/6/7 internally).
 */

/**
 * @typedef {Tier | PoorTier | null} TierOrPoor
 * null = neutral/no-data (descriptionNumericID 4).
 */

/**
 * @typedef {Object} Food
 * @property {number} id - Nutridigm foodItemID
 * @property {string} name - Normalized display name
 * @property {string} group - Coarse food group code (e.g. 'b', 'e')
 * @property {string} fineGroup - Fine food group code (e.g. 'b1', 'e')
 * @property {string} [groupLabel] - Real human-readable group label (fine
 *   group preferred, e.g. 'Fish & Seafood' for 'b1'), resolved via
 *   adapter.js `getGroupLabel`/`attachGroupLabel` from the cached
 *   /foodgroups dictionary. Only present on Foods produced by adapter
 *   functions that attach it (e.g. buildMealPlan, getSuggestions,
 *   getWorstFoods) — not guaranteed on every Food (e.g. searchFoods results
 *   from normalizeFood don't carry it, since resolution is async).
 * @property {Tier} [tier] - Assessment tier when assessed (optional)
 * @property {number|null} [referenceTotal] - Total reference count across
 *   conditions. `null` means unknown (at least one condition's /references
 *   fetch failed) — render nothing / a neutral state, NOT "0 studies". Set
 *   on Foods produced by `assessFood` (via `assessFoodRaw`) and by
 *   `getCategoryDetail` (via the shared `fetchReferenceTotal` helper);
 *   absent on Foods from other paths (e.g. searchFoods' normalizeFood).
 *   See `getCachedRefCount` in adapter.js for the cache-only way to
 *   opportunistically populate this outside of a full assessFood call
 *   (e.g. list-view trust signals).
 * @property {string} [notes] - Any advisory notes from the engine
 * @property {number} [rank] - 1-based position in a ranked list. Only set by
 *   `getTopDosAndDonts`, assigned AFTER recipe filtering so it matches the
 *   displayed order. Rank + list membership is the verdict on that surface —
 *   no tier accompanies it (/topdoordonts carries no tier data).
 * @property {boolean} [isLifestyle] - True when the item is a lifestyle/
 *   behavior entry (coarse group 'j', or fine group 'j1'/'x' — Exercise,
 *   Smoking, Sleep, etc.) rather than a food. Only set by
 *   `getTopDosAndDonts`, the one surface that keeps lifestyle items.
 */

/**
 * @typedef {Object} ConditionAssessment
 * @property {number} conditionId - healthConditionID
 * @property {string} conditionName - Human-readable condition name
 * @property {TierOrPoor} tier - Per-condition tier
 * @property {number} referenceCount - Number of supporting citations (0 if
 *   `referenceStatus` is 'error' — always check `referenceStatus` before
 *   treating this as "no studies exist" vs "couldn't check")
 * @property {string[]} citations - Full citation strings (cached 7d per
 *   (conditionId, foodId) via adapter.js `cachedReferences` — citations are
 *   static curated data, not user- or condition-set-dependent)
 * @property {'ok'|'error'} referenceStatus - 'error' when the /references
 *   fetch for this condition failed (network error, etc.) — the UI should
 *   show a "couldn't load studies" note instead of implying zero studies.
 */

/**
 * @typedef {Object} Assessment
 * @property {Food} food - The assessed food (`food.referenceTotal` is
 *   null if any perCondition entry has referenceStatus 'error')
 * @property {TierOrPoor} tier - Reconciled tier across all profile conditions
 * @property {ConditionAssessment[]} perCondition - Per-condition breakdown (positional)
 * @property {number|null} score - Raw reconciled /goodfor `value` for this
 *   food+profile. Intentionally relaxes the former never-expose-numeric-
 *   scores rule (user-approved July 2026) for the FoodDetailCard rating —
 *   don't surface it as a bare number elsewhere without a product decision.
 * @property {string|null} verdict - Reconciled /goodfor `description` — the
 *   7-step verdict label (e.g. "More Helpful").
 * @property {number|null} numericId - Reconciled /goodfor
 *   `descriptionNumericID` (1–7). Feeds `tier` (via `numericIdToTier` in
 *   adapter.js) and the FoodRating display (via `numericIdToRating` in
 *   src/utils/rating.js).
 */

/**
 * @typedef {Object} Profile
 * @property {number[]} conditions - Array of healthConditionID values
 * @property {string[]} [dietary] - Dietary preferences
 * @property {string[]} [allergies] - Food allergies
 * @property {string[]} [medications] - Medications
 * @property {'adult'|'senior'} [ageBand] - Collected once during onboarding
 *   (RemediWelcome). Informational only — no calculation reads it. It exists
 *   to implicitly signal that the app does not address children. Distinct
 *   from the legacy `age` field below, which is dead.
 * @property {number} [heightCm] - Height in centimeters. Legacy biometric
 *   field from the removed Mifflin-St Jeor calorie-need feature (July 2026).
 *   No longer collected or read by any calculation — may still be present on
 *   profiles saved before the removal.
 * @property {number} [weightKg] - Weight in kilograms. Same legacy status as
 *   `heightCm`.
 * @property {number} [age] - Age in years. Legacy, same status as `heightCm`.
 * @property {'male'|'female'} [sex] - Biological sex. Legacy, same status as
 *   `heightCm`.
 * @property {'sedentary'|'light'|'moderate'|'active'|'very_active'} [activityLevel] -
 *   Self-reported activity level. Legacy, same status as `heightCm`.
 * @property {number} [calorieTarget] - Daily calorie target, defaults to
 *   2000. Fixed and user-editable from the Profile screen ("Daily calorie
 *   target" sheet) — replaces the removed Mifflin-St Jeor estimate as the
 *   number `estimatePlanDayCalories`'s plan total is compared against.
 */

/**
 * @typedef {Object} MealSlot
 * @property {string} slot - 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' | 'Beverages'
 * @property {Food[]} items - Foods in this meal slot
 * @property {Recipe[]} recipes - Recipes in this slot
 * @property {number} calories - Mock per-meal calorie estimate
 */

/**
 * @typedef {Object} DayPlan
 * @property {string} date - ISO date string
 * @property {MealSlot[]} meals - Meal slots for the day
 * @property {number} totalCalories - Mock daily total (default 2000)
 */

/**
 * @typedef {Object} Recipe
 * @property {number|string} id - Recipe identifier (Nutridigm foodItemID for real recipes)
 * @property {number} [foodId] - Nutridigm foodItemID — same value as `id` for
 *   real recipes (fine group 'l'); lets consumers call assessFood/getFoodFacts
 *   on the recipe itself. Absent on ghost/placeholder recipes.
 * @property {string} title - Recipe title
 * @property {TierOrPoor} [tier] - Reconciled tier for the requested conditions
 *   (from descriptionNumericID via numericIdToTier — never the raw numeric value)
 * @property {number|null} [numericId] - Raw descriptionNumericID (1-7). Feeds
 *   `tier` and the FoodRating display; kept alongside `tier` because `tier`
 *   collapses 4 and "no data" to the same null.
 * @property {string} [photo] - Image URL
 * @property {string} [sourceName] - Attribution, e.g. "Food Network · Giada De Laurentiis"
 * @property {string} [sourceUrl] - Link to the original recipe (MedlinePlus,
 *   etc.), from the C1 content overlay (src/data/recipeOverlay.json, joined
 *   in via `joinRecipeOverlay` in src/api/recipeIngestion.js). Recipe
 *   DIRECTIONS are never republished — this link-out plus `ingredients`
 *   (facts) is the whole of what the app shows for a recipe's preparation.
 * @property {string} [attribution] - Source attribution string from the C1
 *   overlay, e.g. "MedlinePlus". Distinct from `sourceName`, which is parsed
 *   from the live API's `notes` field independently of the overlay. Optional:
 *   absent when the source row hasn't been given one yet.
 * @property {number} [servings] - Recipe yield, from the C1 overlay. Optional.
 * @property {{calories?:number, protein?:number, carbs?:number, fat?:number}} [nutritionPerServing] -
 *   Per-serving macros from the C1 overlay, when the overlay row carries
 *   any. Every sub-field, including `calories`, is transcribed by a human
 *   directly off the source recipe's own FDA Nutrition Facts panel — NEVER
 *   computed or estimated by this app. `calories` used to be the one
 *   guaranteed sub-field, but Mory's real 119-recipe source spreadsheet has
 *   NO calorie column at all (relaxed Sept 2026, user-approved — see
 *   RecipeOverlayRow's `nutritionPerServing` below), so `calories` is now
 *   independently optional same as `protein`/`carbs`/`fat`: a row can carry
 *   macros with no calorie figure, or no nutrition data whatsoever.
 *   CALORIE PROVENANCE (frozen): summing a recipe's calories from its
 *   ingredients is permanently impossible, not deferred — no table or API
 *   in this system maps a recipe to its own per-ingredient nutrition
 *   breakdown; `calories` here is the transcribed source number or it's
 *   absent — never a fabricated default. Whole object absent entirely for
 *   recipes with no C1 overlay match, or whose match has no nutrition data.
 * @property {string} mealType - Breakfast/Lunch/Dinner/Snack (best-effort keyword guess for real recipes)
 * @property {Array<{name: string, foodItemID?: number}>} [ingredients] -
 *   Real ingredient facts from the C1 overlay's `rawIngredients` (paired
 *   with `ingredientFoodItemIds` where a raw ingredient line was
 *   successfully matched to a Nutridigm food) — never fabricated, never
 *   invented quantities beyond what the source wrote. A recipe with no
 *   overlay match has no ingredients here, not guessed ones. Surfaced to
 *   FoodDetailCard as `realIngredients` (see recipeDetail.js) to keep it
 *   unambiguous alongside `topFoodsForConditions`, a same-shaped but
 *   unrelated "see also" rail.
 * @property {string[]} [matchedConditions] - Display names of conditions this recipe helps
 * @property {Array<'breakfast'|'lunch'|'dinner'|'snack'|'beverage'|'dessert'>} [alsoFits] -
 *   Additional meal types this recipe also fits, from the C1 overlay's
 *   `alsoFits` (see RecipeOverlayRow below) — multi-category placement.
 *   'dessert' (added Sept 2026, user decision) is a first-class meal type,
 *   not an alias of 'snack' — see `MEAL_TYPES` in recipeIngestion.js.
 * @property {string[]} [dietaryTags] - e.g. "gluten-free", "vegetarian",
 *   from the C1 overlay's `dietaryTags`.
 * @property {number} [totalTimeMinutes] - Total prep + cook time, from the
 *   C1 overlay. Absent for recipes with no C1 overlay match — never
 *   estimated/guessed by this app.
 */

/**
 * @typedef {Object} RecipeOverlayRow
 * One row of the C1 MedlinePlus recipe content overlay
 * (src/data/recipeOverlay.json — see src/api/recipeIngestion.js). Pure
 * editorial/content data: NEVER carries a numericId, tier, or any other
 * safety-relevant field — those come exclusively from the live Nutridigm
 * API (`descriptionNumericID` via /suggest). `joinRecipeOverlay` enriches an
 * already-API-scored Recipe with these fields by matching `foodItemID`; it
 * can only ever attach content to a recipe the API returned, never invent
 * one (Track B item 2 / REMEDI_MASTER_PLAN.md).
 *
 * SCHEMA NOTE: deliberately has NO directions/instructions column, and must
 * never gain one — recipe directions are the source's copyrighted
 * expression. Ingredients (a list of facts) plus `sourceUrl` (link out) is
 * the frozen shape (REMEDI_MASTER_PLAN.md, "Recipe directions text").
 *
 * REQUIRED vs OPTIONAL (relaxed to match Mory's actual source data):
 * required are `name`, `sourceUrl`, `mealType`, and `fineFoodGroup` ('l').
 * Everything else on this typedef is optional: valid when absent ("we
 * don't have this yet"), but still strictly type-checked by
 * `validateOverlayRow` when present. The one deliberate exception is
 * `rawIngredients`: an explicit `[]` is still invalid (only "absent" means
 * unknown; an empty array would mean the content pipeline broke).
 * `nutritionPerServing` (see below) follows this same "absent fine,
 * explicit-empty invalid" shape as of Sept 2026 — see CALORIE PROVENANCE.
 * @property {string} name - Editorial recipe title, as given by the source
 * @property {string} sourceUrl - https:// link to the original recipe
 * @property {string} [attribution] - e.g. "MedlinePlus". Optional.
 * @property {'breakfast'|'lunch'|'dinner'|'snack'|'beverage'|'dessert'} mealType -
 *   Editorial meal-type categorization (ground truth) — distinct from
 *   `guessMealType`'s keyword heuristic in adapter.js, which is only a
 *   fallback for recipes the overlay hasn't reached. 'dessert' (added Sept
 *   2026, user decision, verbatim: "Snacks and deserts are going to be
 *   shown at once. But theyre going to have different tags. So yeah add as
 *   another meal type.") is a first-class meal type, NOT an alias of
 *   'snack' — see `MEAL_TYPES` in recipeIngestion.js.
 * @property {Array<'breakfast'|'lunch'|'dinner'|'snack'|'beverage'|'dessert'>} [alsoFits] -
 *   Additional meal types this recipe also fits (multi-category placement)
 * @property {string[]} [rawIngredients] - Ingredient lines as written by the
 *   source (facts, not the source's copyrighted expression — safe to
 *   republish; directions are not). Optional, but if present must be a
 *   NON-EMPTY string array — an explicit `[]` is rejected as invalid (a
 *   broken pipeline), whereas an absent key just means this row hasn't been
 *   enriched with ingredients yet.
 * @property {number[]} [ingredientFoodItemIds] - `rawIngredients` mapped to
 *   Nutridigm foodItemIDs. Optional.
 * @property {number} [servings] - Recipe yield. Optional.
 * @property {{calories?:number, protein?:number, carbs?:number, fat?:number}} [nutritionPerServing] -
 *   Per-serving macros, transcribed by a human directly off the source
 *   recipe's own FDA Nutrition Facts panel — NEVER computed/estimated by
 *   this app. OPTIONAL AS A WHOLE (relaxed Sept 2026, user-approved):
 *   Mory's real 119-recipe source spreadsheet has NO calorie column at
 *   all, so a row with no nutrition data whatsoever is valid — this is now
 *   the common case, not the exception the schema was originally frozen
 *   against. Every sub-field, including `calories`, is independently
 *   optional and, when present, transcribed the same way (never derived).
 *   An explicit empty object (`nutritionPerServing: {}`) is REJECTED by
 *   `validateOverlayRow`, same convention as `rawIngredients` above — omit
 *   the key entirely to mean "unknown", don't ship an empty placeholder
 *   object. CALORIE PROVENANCE (frozen): summing a recipe's calories from
 *   its ingredients is permanently impossible, not deferred — no table or
 *   API in this system maps a recipe to its own per-ingredient nutrition
 *   breakdown. `calories` is the transcribed source number or it (and
 *   possibly the whole object) is absent — never a fabricated default. The
 *   UI already degrades honestly on absence: RecipeLinkSheet renders no
 *   calorie line when `preview.calories` is null (see
 *   `resolveRecipePreview` in src/utils/foodDetailCard.js).
 * @property {string[]} [dietaryTags] - e.g. "gluten-free", "vegetarian"
 * @property {number} [totalTimeMinutes] - Total prep + cook time. Optional.
 * @property {'l'} fineFoodGroup - Always 'l' (recipes are Nutridigm food
 *   items in fine group 'l')
 * @property {number} [foodItemID] - Nutridigm foodItemID, assigned by
 *   Mory/Nutridigm AFTER ingestion + scoring — ABSENT on early drafts. A row
 *   with no `foodItemID` can never be joined to an API recipe (see
 *   `joinRecipeOverlay`) and is inert until scored.
 */

/**
 * @typedef {Object} PlanCandidate
 * Normalized item eligible to fill a Plan screen slot (see config.js
 * `PLAN_SLOTS` and adapter.js `getMealPlanSuggestions`). A thinner sibling of
 * Food/Recipe — only the fields the Plan screen actually renders, no
 * fabricated calories/macros.
 * @property {number} id - Nutridigm foodItemID (recipes use the same field —
 *   real Food Network recipes ARE food items, fine group 'l')
 * @property {string} name - Display name
 * @property {string} [image] - Image URL, resolved via `getIngredientImage`
 *   same as other food/recipe surfaces
 * @property {string} group - Coarse food group code
 * @property {string} fineGroup - Fine food group code (the /suggest group
 *   this candidate was fetched under)
 * @property {TierOrPoor} tier - 'Top'|'Strong'|'Good'|null. `null` = Neutral
 *   (numericId 4) — render no match claim. Harmful tiers (5-7) never appear
 *   here; candidates are pre-filtered to numericId 1-4.
 * @property {number} numericId - Raw descriptionNumericID (1-4 only)
 * @property {'food'|'recipe'} kind
 * @property {string} [sourceName] - Attribution (e.g. "Food Network ·
 *   Giada De Laurentiis") — recipes only
 * @property {string} [sourceUrl] - Link to the original recipe, from the C1
 *   content overlay — recipes only, present only with a real overlay match.
 * @property {string} [attribution] - Source attribution string from the C1
 *   overlay, e.g. "MedlinePlus" — recipes only, present only with a real
 *   overlay match. Distinct from `sourceName` (see Recipe typedef above).
 * @property {string|null} [substituteFineGroup] - Recipe-kind candidates
 *   only: the real fine food group of the recipe's primary ingredient
 *   (resolved via the C1 overlay), used by `getSlotSubstitutes` to scope
 *   substitutes — recipes' own `fineGroup` above is always the hardcoded 'l'
 *   recipe group, which can't scope real-food substitutes. `null` when
 *   unresolvable.
 */

/**
 * @typedef {Object} FoodGroup
 * @property {string} foodGroupID - Group code (e.g. 'b', 'b1')
 * @property {string} description - Human-readable label
 * @property {boolean} isFineFoodGroup
 * @property {boolean} isCoarseFoodGroup
 */

/**
 * @typedef {Object} HealthCondition
 * @property {number} healthConditionID
 * @property {string} description
 * @property {string} longDescription
 * @property {string} AKA
 * @property {string} ICD10
 */

/**
 * @typedef {Object} SuggestionCategory
 * @property {string} group - Food group code
 * @property {string} label - Human-readable group label
 * @property {Food[]} foods - Best foods in this category
 */

/**
 * @typedef {Object} SuggestionsResult
 * @property {SuggestionCategory[]} categories
 * @property {boolean} [usedFallback] - True if this result came from the
 *   DEFAULT_DEV_CONDITIONS retry (see adapter.js withConditionFallback)
 *   rather than the profile's actual conditions.
 */

/**
 * @typedef {Object} CategoryDetailResult
 * Result shape for `getCategoryDetail(profile, coarseGroup, listType)` —
 * powers the category drill-down sheet from the Best & Worst tab, backed by
 * the Nutridigm /detailed endpoint.
 *
 * IMPORTANT: unlike other Food-producing adapter calls, items here never
 * carry a `tier`. /detailed's raw response has no descriptionNumericID (and
 * no group fields — `group` on each Food is the coarseGroup that was
 * requested, injected client-side, not read off the raw item). The
 * `listType` you fetched (helpful/neutral/harmful) IS the verdict — do not
 * invent or infer a tier badge on top of it, and never surface the raw
 * `value` field from the API response.
 * @property {import('./types.js').Food[]} items - Foods in this
 *   group+listType, in API order (no client-side re-sorting).
 * @property {boolean} usedFallback - True if this result came from the
 *   DEFAULT_DEV_CONDITIONS retry rather than the profile's actual conditions.
 */

/**
 * @typedef {Object} NutritionFacts
 * Intended FUTURE shape for per-food nutrition facts — NOT produced today.
 *
 * A July-2026 probe of the live Nutridigm API (/fooditems, /goodfor,
 * /detailed) found no nutrition-fact fields anywhere in the payloads, so
 * `getNutritionFacts(foodId)` in adapter.js is a typed stub that always
 * resolves to `null`, and consumers (FoodDetailCard's Food Facts section) must
 * render NOTHING nutritional on null — no placeholder tables, per the
 * never-fabricate-data rule. If Nutridigm ever exposes nutrient data,
 * implement against this shape.
 * @property {Array<{ label: string, value: string }>} facts - Ordered
 *   label/value pairs (e.g. { label: 'Fiber', value: '3 g' }) — display
 *   strings, never bare numeric scores.
 */

/**
 * ── `usedFallback` propagation ──────────────────────────────────────────────
 *
 * Every adapter function wrapped in `withConditionFallback` (getSuggestions,
 * getWorstFoods, assessFood, buildMealPlan) can silently
 * retry with DEFAULT_DEV_CONDITIONS when the demo subscription key can't
 * score the profile's real condition IDs (401 NOTAUTHORIZEDHEALTHID).
 * When that retry happens, the result is flagged so the UI can show a
 * "Demo data" chip instead of pretending the numbers are personalized:
 *
 * - Object-returning functions (Assessment, DayPlan, SuggestionsResult):
 *   `usedFallback: boolean` is set directly as an enumerable property on
 *   the returned object. `assessFood` can also return `null` (no
 *   conditions) — callers must null-check before reading `usedFallback`.
 * - Array-returning functions (Food[]): the array shape is preserved for
 *   existing consumers (`.map`, spread, etc.), and `usedFallback` is
 *   attached as a non-enumerable property via `Object.defineProperty` so
 *   it doesn't show up in JSON.stringify, spread, or Array iteration, but
 *   is still readable via `result.usedFallback` for callers that care.
 */

// This file is purely for documentation — no runtime exports needed.
export {};
