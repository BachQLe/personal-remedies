/**
 * types.js — JSDoc @typedef definitions for the Remedi API surface.
 *
 * These types define the ONLY shapes screens may consume.
 * No numeric score (value / descriptionNumericID) is ever exposed here.
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
 *   fetch failed) — render nothing / a neutral state, NOT "0 studies". Only
 *   set on Foods produced by `assessFood` (via `assessFoodRaw`); absent
 *   elsewhere. See `getCachedRefCount`/`warmReferenceCount` in adapter.js
 *   for the rate-limit-safe way to opportunistically populate this outside
 *   of a full assessFood call (e.g. list-view trust signals).
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
 */

/**
 * @typedef {Object} Profile
 * @property {number[]} conditions - Array of healthConditionID values
 * @property {string[]} [dietary] - Dietary preferences
 * @property {string[]} [allergies] - Food allergies
 * @property {string[]} [medications] - Medications
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
 *   real recipes (fine group 'l'); lets consumers call assessFood/getIngredientReferences
 *   on the recipe itself. Absent on ghost/placeholder recipes.
 * @property {string} title - Recipe title
 * @property {TierOrPoor} [tier] - Reconciled tier for the requested conditions
 *   (from descriptionNumericID via numericIdToTier — never the raw numeric value)
 * @property {string} [photo] - Image URL
 * @property {string} [sourceName] - Attribution, e.g. "Food Network · Giada De Laurentiis"
 * @property {string} mealType - Breakfast/Lunch/Dinner/Snack (best-effort keyword guess for real recipes)
 * @property {Food[]} [ingredients] - Ingredient list as Foods
 * @property {string[]} [matchedConditions] - Display names of conditions this recipe helps
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
 * resolves to `null`, and consumers (FoodDetail's Food Facts section) must
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
 * getWorstFoods, assessFood, buildMealPlan, getAlternatives) can silently
 * retry with DEFAULT_DEV_CONDITIONS when the demo subscription key can't
 * score the profile's real condition IDs (401 NOTAUTHORIZEDHEALTHID).
 * When that retry happens, the result is flagged so the UI can show a
 * "Demo data" chip instead of pretending the numbers are personalized:
 *
 * - Object-returning functions (Assessment, DayPlan, SuggestionsResult):
 *   `usedFallback: boolean` is set directly as an enumerable property on
 *   the returned object. `assessFood` can also return `null` (no
 *   conditions) — callers must null-check before reading `usedFallback`.
 * - Array-returning functions (`getAlternatives` → Food[]): the array
 *   shape is preserved for existing consumers (`.map`, spread, etc.), and
 *   `usedFallback` is attached as a non-enumerable property via
 *   `Object.defineProperty` so it doesn't show up in JSON.stringify,
 *   spread, or Array iteration, but is still readable via
 *   `result.usedFallback` for callers that care.
 */

// This file is purely for documentation — no runtime exports needed.
export {};
