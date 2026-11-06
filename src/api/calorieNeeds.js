/**
 * calorieNeeds.js — Pure calorie helpers (no UI imports).
 *
 * Remedi is explicitly NOT a calorie tracker (no logging, no streaks, no
 * per-food badges — see docs/ product decisions, July 2026). This module only
 * answers "how much does a planned day add up to" at the coarsest grain: one
 * total for a day's plan, compared once against the user's editable
 * `Profile.calorieTarget` at plan creation — never as a running tally.
 *
 * Never fabricate a number: the total counts only items with a real sourced
 * calorie figure (a recipe's own per-serving panel, `nutritionPerServing`).
 * There are no food-group estimates; an item without a sourced number is left
 * out and counted, so the UI can say what the total doesn't include.
 *
 * @typedef {import('./types.js').Profile} Profile
 */

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
 * Sum the sourced calories across a day's slot-based plan.
 * @param {Object<string, import('../state/dailyPlan.js').PlanItem[]>} slotsObject -
 *   `DailyPlan.slots` — slotKey -> PlanItem[] (see src/state/dailyPlan.js).
 * @returns {{total: number, counted: number, uncounted: number}} `total` sums
 *   the `counted` items' sourced calories; `uncounted` items have no sourced
 *   number and are not in `total`.
 */
export function planDayCalories(slotsObject) {
  let total = 0;
  let counted = 0;
  let uncounted = 0;

  for (const items of Object.values(slotsObject && typeof slotsObject === 'object' ? slotsObject : {})) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item) continue;
      const calories = item.nutritionPerServing?.calories;
      if (Number.isFinite(calories)) {
        total += calories;
        counted += 1;
      } else {
        uncounted += 1;
      }
    }
  }

  return { total, counted, uncounted };
}
