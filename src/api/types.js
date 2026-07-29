/**
 * types.js — JSDoc @typedef definitions for the Remedi API surface.
 *
 * These types define the ONLY shapes screens may consume.
 * Historically no numeric score (value / descriptionNumericID) was ever
 * exposed here. RELAXED July 2026 (user-approved) for the star-rating
 * feature: `Assessment` now carries score/verdict/numericId/stars — see the
 * Assessment typedef below. All other shapes remain score-free.
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
 *   elsewhere. See `getCachedRefCount` in adapter.js for the cache-only way
 *   to opportunistically populate this outside of a full assessFood call
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
 *   scores rule (user-approved July 2026) for the FoodDetailCard star
 *   rating — don't surface it as a bare number elsewhere without a product
 *   decision.
 * @property {string|null} verdict - Reconciled /goodfor `description` — the
 *   7-step verdict label (e.g. "More Helpful").
 * @property {number|null} numericId - Reconciled /goodfor
 *   `descriptionNumericID` (1–7). Feeds `tier` (via `numericIdToTier`) and
 *   `stars` (via `numericIdToStars`).
 * @property {number|null} stars - Star rating out of 5 for FoodDetailCard,
 *   from `numericIdToStars(numericId)` — {1:5, 2:4.5, 3:4, 4:3, 5:2,
 *   6:1.5, 7:1}, null outside 1–7.
 */

/**
 * @typedef {Object} Profile
 * @property {number[]} conditions - Array of healthConditionID values
 * @property {string[]} [dietary] - Dietary preferences
 * @property {string[]} [allergies] - Food allergies
 * @property {string[]} [medications] - Medications
 * @property {number} [heightCm] - Height in centimeters. Optional biometric
 *   (July 2026, calorie-needs feature) — always stored as metric even though
 *   the UI collects ft/in; see `ftInToCm`/`cmToFtIn` in api/calorieNeeds.js.
 *   Never required: every flow (including `estimateDailyNeed`) must degrade
 *   gracefully when absent.
 * @property {number} [weightKg] - Weight in kilograms. Same optionality and
 *   metric-storage rule as `heightCm`; UI collects lbs, see `lbsToKg`/
 *   `kgToLbs` in api/calorieNeeds.js.
 * @property {number} [age] - Age in years. Optional.
 * @property {'male'|'female'} [sex] - Biological sex, used only for the
 *   Mifflin-St Jeor BMR constant (+5 male / -161 female). Optional.
 * @property {'sedentary'|'light'|'moderate'|'active'|'very_active'} [activityLevel] -
 *   Self-reported activity level, mapped to a BMR multiplier in
 *   api/calorieNeeds.js. Optional — `estimateDailyNeed` defaults to 'light'
 *   when the other biometrics are present but this one isn't.
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
 * @property {string} [photo] - Image URL
 * @property {string} [sourceName] - Attribution, e.g. "Food Network · Giada De Laurentiis"
 * @property {string} mealType - Breakfast/Lunch/Dinner/Snack (best-effort keyword guess for real recipes)
 * @property {Food[]} [ingredients] - Ingredient list as Foods
 * @property {string[]} [matchedConditions] - Display names of conditions this recipe helps
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
