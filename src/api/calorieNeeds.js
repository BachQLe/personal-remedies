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
 * Internally consults `resolveNutrition` (src/api/nutrition.js) instead of
 * calling `estimateNutrition` directly, so a plan day's total incorporates a
 * recipe's own panel calories (USDA is cut — checklist 2.1/2.2) without any
 * call-site or timing change here.
 */

import { resolveNutrition } from './nutrition.js';

// ── Display format ───────────────────────────────────────────────────────────

/**
 * The ONE place a calorie number becomes display text: the rounded,
 * locale-formatted number with no sign or "~" prefix. Change the format here
 * and every calorie render site follows. Returns null for a non-finite input
 * so a missing value is never rendered as "NaN".
 * @param {number|null|undefined} n
 * @returns {string|null} e.g. "1,850"
 */
export function formatCalories(n) {
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : null;
}

// ── Plan-day calorie total ───────────────────────────────────────────────────

/**
 * Sum estimated calories across a day's slot-based plan.
 *
 * Foods resolve through `resolveNutrition` (src/api/nutrition.js), which
 * tries real per-serving data first (recipe panel) before falling back to
 * the same food-group estimate table used elsewhere in the app, so a food's
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
 * result through `formatCalories`. Replace this the moment real per-recipe
 * nutrition data exists — that is the intended seam.
 *
 * @param {Object<string, import('../state/dailyPlan.js').PlanItem[]>} slotsObject -
 *   `DailyPlan.slots` — slotKey -> PlanItem[] (see src/state/dailyPlan.js).
 * @returns {{total: number, counted: number, uncounted: number}} `total` is
 *   the sum of every resolvable item's estimated calories; `counted` /
 *   `uncounted` are item counts. `uncounted > 0` now means only that some item
 *   had no resolvable food group at all — callers should still render `total`
 *   via `formatCalories` and never imply it is measured.
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

      // 0-contribution-not-fabrication: a resolved item's OWN calories field
      // is never invented, but a missing one (a recipe panel with macros but
      // no calorie figure — never the estimate tier, which always has
      // calories) doesn't block the rest of the day's items from contributing
      // to the total.
      total += resolved.calories ?? 0;
      counted += 1;
    }
  }

  return { total, counted, uncounted };
}
