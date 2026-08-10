/**
 * nutrition.usda.test.js — Tier-2 (USDA) guard tests for the layered
 * resolver (src/api/nutrition.js, Task T3D), with the two committed USDA
 * tables MOCKED to simulate a filled-in state (today they ship empty — see
 * nutrition.test.js for the real-empty-table equivalence proof).
 *
 * Kept in its own file because `vi.mock` factories are hoisted to the top of
 * the file and apply for the file's whole lifetime — mixing mocked and
 * unmocked USDA-table tests in one file would make the unmocked ones see the
 * mocked tables too.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../data/usda/fdcMap.json', () => ({
  default: {
    items: {
      // has a serving-scaled nutrient entry
      501: { fdcId: 9001, matchedName: 'Peaches, yellow, raw', dataType: 'SR Legacy', matchScore: 1, manualOverride: false },
      // fdcId with per100g only (FDC had no usable portion)
      502: { fdcId: 9002, matchedName: 'Cod, cooked', dataType: 'Foundation', matchScore: 1, manualOverride: false },
      // maps to an fdcId that has no nutrients.json entry at all (fetch never completed)
      503: { fdcId: 9003, matchedName: 'Orphaned match', dataType: 'Foundation', matchScore: 0.9, manualOverride: false },
    },
  },
}));

vi.mock('../../data/usda/nutrients.json', () => ({
  default: {
    nutrients: {
      9001: {
        per100g: { calories: 39, protein: 0.9, carbs: 10, fat: 0.3 },
        perServing: { amount: 150, unit: 'g', calories: 58.5, protein: 1.35, carbs: 15, fat: 0.45 },
        portionSource: '1 medium',
      },
      9002: {
        per100g: { calories: 105, protein: 23, carbs: 0, fat: 1 },
        portionSource: 'none',
      },
    },
  },
}));

// Import AFTER the mocks so the module under test picks up the mocked data.
const { resolveNutrition } = await import('../nutrition.js');
const { estimateNutrition } = await import('../../data/nutritionEstimates.js');

describe('resolveNutrition — tier 2: USDA table hit', () => {
  it('prefers perServing when FDC provided a usable portion, basis:"perServing"', () => {
    const item = { id: 501, group: 'd' }; // would otherwise resolve via COARSE_GROUP_ESTIMATES.d
    const result = resolveNutrition(item);
    expect(result).toEqual({
      calories: 58.5,
      protein: 1.35,
      carbs: 15,
      fat: 0.45,
      estimated: false,
      source: 'usda',
      basis: 'perServing',
    });
  });

  it('falls back to per100g ONLY with an honest basis label when no perServing exists', () => {
    const item = { id: 502, fineGroup: 'b1' };
    const result = resolveNutrition(item);
    expect(result).toEqual({
      calories: 105,
      protein: 23,
      carbs: 0,
      fat: 1,
      estimated: false,
      source: 'usda',
      basis: 'per100g',
    });
  });

  it('USDA hit beats the estimate tier — real data wins over the food-group stand-in', () => {
    const item = { id: 501, group: 'd' }; // no fineGroup -> would resolve via COARSE_GROUP_ESTIMATES.d
    const estimate = estimateNutrition(item);
    const resolved = resolveNutrition(item);
    // Sanity: fineGroup 'd' isn't in FINE_GROUP_ESTIMATES, so this would
    // otherwise fall to the COARSE_GROUP_ESTIMATES.d stand-in — confirm the
    // USDA hit is NOT that stand-in.
    expect(estimate).not.toBeNull();
    expect(resolved.source).toBe('usda');
    expect(resolved.calories).not.toBe(estimate.calories);
  });

  it('a mapped foodItemID whose fdcId has no nutrients.json entry falls through to the estimate tier', () => {
    const item = { id: 503, fineGroup: 'b1' };
    const result = resolveNutrition(item);
    expect(result.source).toBe('estimate');
    expect(result.estimated).toBe(true);
  });

  it('an unmapped foodItemID falls through to the estimate tier', () => {
    const item = { id: 999, fineGroup: 'b1' };
    const result = resolveNutrition(item);
    expect(result.source).toBe('estimate');
  });

  it('recipe-panel data (tier 1) still wins over a USDA hit (tier 2)', () => {
    const item = {
      id: 501,
      kind: 'recipe',
      nutritionPerServing: { calories: 1, protein: 1, carbs: 1, fat: 1 },
    };
    const result = resolveNutrition(item);
    expect(result.source).toBe('panel');
    expect(result.calories).toBe(1);
  });
});
