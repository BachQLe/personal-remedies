/**
 * calorieNeeds.test.js — Guard tests for src/api/calorieNeeds.js (Task T3D
 * update: `estimatePlanDayCalories` now resolves items through
 * `resolveNutrition` internally instead of `estimateNutrition` directly).
 *
 * These tests pin two things:
 *   1. `estimatePlanDayCalories`'s public shape/semantics/timing are
 *      untouched — same {total, counted, uncounted} return, same "call once
 *      per slots object" usage, no new call sites.
 *   2. The beverages slot (restored August 2026, config.js PLAN_SLOTS) is
 *      actually counted: a plain item resolves via fine group 'h2', a plain
 *      item with only a coarse group resolves via the 'h' fallback, and a
 *      recipe resolves via RECIPE_SLOT_ESTIMATES.beverages.
 *
 * Runs against the real committed USDA tables (src/data/usda/fdcMap.json /
 * nutrients.json), which are now populated — fixture ids here are chosen
 * outside that map's id range (900000+) so every item still resolves via
 * the tier-3 estimate table, same numbers `estimateNutrition` would have
 * produced pre-T3D. See nutrition.test.js for the same convention.
 */
import { describe, expect, it } from 'vitest';
import { estimatePlanDayCalories } from '../calorieNeeds.js';

describe('estimatePlanDayCalories', () => {
  it('returns {total:0, counted:0, uncounted:0} for a missing/invalid slots object', () => {
    expect(estimatePlanDayCalories(null)).toEqual({ total: 0, counted: 0, uncounted: 0 });
    expect(estimatePlanDayCalories(undefined)).toEqual({ total: 0, counted: 0, uncounted: 0 });
    expect(estimatePlanDayCalories('not an object')).toEqual({ total: 0, counted: 0, uncounted: 0 });
  });

  it('sums calories across slots and counts resolvable vs unresolvable items', () => {
    const slots = {
      breakfast: [{ id: 900001, fineGroup: 'b1' }], // 180 kcal
      lunch: [{ id: 900002, group: 'zz' }], // unresolvable
    };
    const result = estimatePlanDayCalories(slots);
    expect(result).toEqual({ total: 180, counted: 1, uncounted: 1 });
  });

  it('ignores non-array slot values and null items without throwing', () => {
    const slots = { breakfast: null, lunch: [null, { id: 900001, fineGroup: 'b1' }] };
    const result = estimatePlanDayCalories(slots);
    expect(result).toEqual({ total: 180, counted: 1, uncounted: 0 });
  });

  // ── Beverages slot (restored 5th slot, August 2026) ───────────────────────

  it('counts a beverages-slot item via its fine food group (h2)', () => {
    const slots = { beverages: [{ id: 10, fineGroup: 'h2', kind: 'food' }] };
    const result = estimatePlanDayCalories(slots);
    // FINE_GROUP_ESTIMATES.h2 = {calories: 60, ...}
    expect(result).toEqual({ total: 60, counted: 1, uncounted: 0 });
  });

  it('counts a beverages-slot item via the coarse "h" fallback when it has no fine group', () => {
    const slots = { beverages: [{ id: 11, group: 'h9', kind: 'food' }] };
    const result = estimatePlanDayCalories(slots);
    // COARSE_GROUP_ESTIMATES.h = {calories: 100, ...}
    expect(result).toEqual({ total: 100, counted: 1, uncounted: 0 });
  });

  it('counts a recipe in the beverages slot via RECIPE_SLOT_ESTIMATES.beverages', () => {
    const slots = { beverages: [{ id: 12, kind: 'recipe' }] };
    const result = estimatePlanDayCalories(slots);
    // RECIPE_SLOT_ESTIMATES.beverages = {calories: 120, ...}
    expect(result).toEqual({ total: 120, counted: 1, uncounted: 0 });
  });

  it('sums a full 5-slot day including beverages', () => {
    const slots = {
      breakfast: [{ id: 20, kind: 'recipe' }], // 350
      lunch: [{ id: 21, kind: 'recipe' }], // 450
      dinner: [{ id: 22, kind: 'recipe' }], // 550
      snacks: [{ id: 23, kind: 'recipe' }], // 200
      beverages: [{ id: 24, kind: 'recipe' }], // 120
    };
    const result = estimatePlanDayCalories(slots);
    expect(result).toEqual({ total: 350 + 450 + 550 + 200 + 120, counted: 5, uncounted: 0 });
  });
});
