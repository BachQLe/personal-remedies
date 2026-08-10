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
 */

import { estimateNutrition } from '../data/nutritionEstimates.js';

// ── Plan-day calorie total ───────────────────────────────────────────────────

/**
 * Sum estimated calories across a day's slot-based plan.
 *
 * Foods resolve through `estimateNutrition` (src/data/nutritionEstimates.js),
 * which keys off fine/coarse food group — the same estimate table already
 * used elsewhere in the app (NutritionFactsSheet, SchedulerView), so a food's
 * calorie contribution is consistent everywhere it's shown.
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

      const estimate = estimateNutrition(item, slotKey);
      if (!estimate) {
        uncounted += 1;
        continue;
      }

      total += estimate.calories;
      counted += 1;
    }
  }

  return { total, counted, uncounted };
}
