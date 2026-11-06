/**
 * calorieNeeds.test.js — Guard tests for src/api/calorieNeeds.js.
 *
 * Never fabricate a number: `planDayCalories` counts only items with a real
 * sourced calorie figure (`nutritionPerServing.calories`) and reports how many
 * it left out. No food-group or meal-slot estimates. Also pins
 * `formatCalories` (the plain "N" display format: no minus sign, no "~").
 */
import { describe, expect, it } from 'vitest';
import { planDayCalories, formatCalories } from '../calorieNeeds.js';

describe('formatCalories', () => {
  it('rounds and locale-formats, with no sign or tilde', () => {
    expect(formatCalories(450)).toBe('450');
    expect(formatCalories(449.6)).toBe('450');
  });

  it('adds thousands separators', () => {
    expect(formatCalories(1850.4)).toBe((1850).toLocaleString());
  });

  it('returns null for a non-finite input, never "NaN"', () => {
    expect(formatCalories(null)).toBeNull();
    expect(formatCalories(undefined)).toBeNull();
    expect(formatCalories(NaN)).toBeNull();
  });
});

describe('planDayCalories', () => {
  it('returns {total:0, counted:0, uncounted:0} for a missing/invalid slots object', () => {
    expect(planDayCalories(null)).toEqual({ total: 0, counted: 0, uncounted: 0 });
    expect(planDayCalories(undefined)).toEqual({ total: 0, counted: 0, uncounted: 0 });
    expect(planDayCalories('not an object')).toEqual({ total: 0, counted: 0, uncounted: 0 });
  });

  it('sums sourced calories only, and counts the items it leaves out', () => {
    const slots = {
      breakfast: [{ id: 1, kind: 'recipe', nutritionPerServing: { calories: 320 } }],
      lunch: [{ id: 2, kind: 'recipe' }], // no panel: never estimated
      snacks: [{ id: 3, kind: 'food', fineGroup: 'h1' }], // food group alone is not a source
      beverages: [{ id: 4, kind: 'recipe', nutritionPerServing: { protein: 5 } }], // panel without calories
    };
    expect(planDayCalories(slots)).toEqual({ total: 320, counted: 1, uncounted: 3 });
  });

  it('counts a sourced zero as data, not as missing', () => {
    expect(planDayCalories({ beverages: [{ id: 5, nutritionPerServing: { calories: 0 } }] }))
      .toEqual({ total: 0, counted: 1, uncounted: 0 });
  });

  it('ignores non-array slot values and null items without throwing', () => {
    const slots = { breakfast: null, lunch: [null, { id: 1, nutritionPerServing: { calories: 180 } }] };
    expect(planDayCalories(slots)).toEqual({ total: 180, counted: 1, uncounted: 0 });
  });
});
