/**
 * calorieNeeds.js — Pure calorie-estimation helpers (no UI imports).
 *
 * Remedi is explicitly NOT a calorie tracker (no logging, no streaks, no
 * per-food badges — see docs/ product decisions, July 2026). This module
 * exists solely to answer "how much should I eat" at the coarsest possible
 * grain: one estimated total for a day's recommended plan, compared against
 * the user's fixed, editable `Profile.calorieTarget` (see types.js — defaults
 * to 2000, edited from the Profile screen). That comparison is meant to
 * render ONCE, as plan-level context (Phase 4, src/screens/plan/) — never as
 * a running tally.
 *
 * @typedef {import('./types.js').Profile} Profile
 *
 * T3D UPDATE: internally now consults `resolveNutrition` (src/api/nutrition.js)
 * instead of calling `estimateNutrition` directly, so a plan day's total
 * automatically incorporates real per-serving data (recipe panel / USDA)
 * once it exists, without any call-site or timing change here. With both the
 * USDA tables and the C1 nutrition overlay empty (today), `resolveNutrition`
 * falls through to the same `estimateNutrition` result on every item, so
 * this swap is behavior-identical right now — see the equivalence test in
 * src/api/__tests__/nutrition.test.js.
 */

import { resolveNutrition } from './nutrition.js';

// ── Plan-day calorie total ───────────────────────────────────────────────────

/**
 * Sum estimated calories across a day's slot-based plan.
 *
 * Foods resolve through `resolveNutrition` (src/api/nutrition.js), which
 * tries real per-serving data first (recipe panel, then USDA) before
 * falling back to the same food-group estimate table used elsewhere in the
 * app (NutritionFactsSheet), so a food's calorie contribution is consistent
 * everywhere it's shown.
 *
 * Recipes ARE counted, via `nutritionEstimates.js`'s per-slot stand-in table
 * (`RECIPE_SLOT_ESTIMATES`). This reverses the original decision to leave them
 * uncounted, and the tradeoff is worth stating plainly: there is still no
 * per-recipe calorie metadata anywhere in the app (the Nutridigm API returns
 * no nutrition fields — see the `NutritionFacts` typedef in types.js, where
 * `getNutritionFacts` is a stub that always resolves null), so these numbers
 * are coarse guesses, not vendor data. They are counted anyway because a
 * hand-picked recipe plan otherwise totals ~0 kcal, which made the number
 * useless on exactly the plans users care most about and would fire the
 * calorie-gap prompt against perfectly good weeks. Every surface renders the
 * result as "~N (estimated)". Replace this the moment real per-recipe
 * nutrition data exists — that is the intended seam.
 *
 * @param {Object<string, import('../state/dailyPlan.js').PlanItem[]>} slotsObject -
 *   `DailyPlan.slots` — slotKey -> PlanItem[] (see src/state/dailyPlan.js).
 * @returns {{total: number, counted: number, uncounted: number}} `total` is
 *   the sum of every resolvable item's estimated calories; `counted` /
 *   `uncounted` are item counts. `uncounted > 0` now means only that some item
 *   had no resolvable food group at all — callers should still render `total`
 *   as "~<total>" and never imply it is measured.
 */
export function estimatePlanDayCalories(slotsObject) {
  let total = 0;
  let counted = 0;
  let uncounted = 0;

  if (!slotsObject || typeof slotsObject !== 'object') {
    return { total, counted, uncounted };
  }

  for (const [slotKey, items] of Object.entries(slotsObject)) {
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      if (!item) continue;

      const resolved = resolveNutrition(item, slotKey);
      if (!resolved) {
        uncounted += 1;
        continue;
      }

      // Same 0-contribution-not-fabrication handling as resolveDayTotals: a
      // resolved item's OWN calories field is never invented, but a missing
      // one (only possible from a per100g USDA hit lacking Energy — never
      // happens via the estimate tier, which always has calories) doesn't
      // block the rest of the day's items from contributing to the total.
      total += resolved.calories ?? 0;
      counted += 1;
    }
  }

  return { total, counted, uncounted };
}
