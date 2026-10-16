/**
 * nutrition.js — layered nutrition resolver (Task T3D, REMEDI_MASTER_PLAN.md
 * 2.3/2.4).
 *
 * Resolves per-serving macros for a plan item by walking tiers, most to
 * least authoritative, falling through only when a tier has no data.
 * NEVER averages, defaults, or 0-fills a missing macro — a missing value is
 * always `null`, and an item with no data anywhere resolves to `null`, full
 * stop.
 *
 *   1. PANEL    — `item.nutritionPerServing` (Recipe field populated by the
 *      C1 content overlay from the source recipe's own FDA Nutrition Facts
 *      panel — real, per-serving, human-transcribed).
 *      -> `{ ...macros, estimated: false, source: 'panel' }`
 *   2. ESTIMATE — `estimateNutrition` (src/data/nutritionEstimates.js), the
 *      hand-labeled food-group/recipe-slot stand-in table. Pending product
 *      decision (checklist 2.4/2.5) — kept as the seam, not removed.
 *      -> `{ ...macros, estimated: true, source: 'estimate' }`
 *   3. `null`   — no tier had data. Never guess.
 *
 * USDA is cut (checklist 2.1/2.2, 9 Oct) — there is no USDA tier.
 *
 * Pure/core module — no DOM, no React. Callers render only the calorie
 * number (see `formatCalories` in calorieNeeds.js); protein/carbs/fat are
 * carried on the result but are never displayed.
 */

import { estimateNutrition } from '../data/nutritionEstimates.js';

/**
 * @typedef {Object} ResolvedNutrition
 * @property {number|null} calories
 * @property {number|null} protein
 * @property {number|null} carbs
 * @property {number|null} fat
 * @property {boolean} estimated - true only for estimate-tier hits.
 * @property {'panel'|'estimate'} source
 */

/**
 * Resolve per-serving nutrition for one plan item, most-authoritative tier
 * first. See the module header for the tier order.
 * @param {Object} item - Food/Recipe/PlanItem-shaped object. Recognized
 *   fields: `nutritionPerServing` (tier 1), plus whatever `estimateNutrition`
 *   reads (`fineGroup`/`group`/`kind`, tier 2).
 * @param {string} [slotKey] - Originating slot key (e.g. a plan day's slot,
 *   or `item.fromSlot`). Passed through unchanged to `estimateNutrition`,
 *   which only consults it for its recipe-slot fallback.
 * @returns {ResolvedNutrition|null}
 */
export function resolveNutrition(item, slotKey) {
  if (!item) return null;

  // Tier 1 — recipe source panel (real, per-serving, from the C1 overlay).
  const panel = item.nutritionPerServing;
  if (panel && typeof panel === 'object') {
    const { calories, protein, carbs, fat } = panel;
    // `?? null` on every field, not a bare destructure: recipeIngestion.js's
    // validator now allows `nutritionPerServing` to be present with
    // `calories` (or any other macro) absent — Mory's real recipe source
    // has no calorie column at all (see recipeIngestion.js's "NUTRITION
    // RELAXATION" note) — and this module's own contract (see header) is
    // that a missing value is always `null`, NEVER `undefined`. A bare
    // destructure would let `undefined` leak through here, and a caller
    // like NutritionFactsSheet templating `${resolved.calories} kcal`
    // without a dedicated null-check would render the literal string
    // "undefined kcal" instead of the app's honest "no data" treatment.
    return {
      calories: calories ?? null,
      protein: protein ?? null,
      carbs: carbs ?? null,
      fat: fat ?? null,
      estimated: false,
      source: 'panel',
    };
  }

  // Tier 2 — hand-labeled food-group / recipe-slot estimate.
  const estimate = estimateNutrition(item, slotKey);
  if (estimate) return { ...estimate, source: 'estimate' };

  // Tier 3 — nothing resolved anywhere. Never guess.
  return null;
}
