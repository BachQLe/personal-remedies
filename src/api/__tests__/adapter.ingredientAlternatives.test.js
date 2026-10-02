/**
 * adapter.ingredientAlternatives.test.js — Guards `getIngredientAlternatives`
 * (src/api/adapter.js), the data layer behind FoodDetailCard's per-ingredient
 * swap rows: one /suggest call scoped to the ingredient's fine food group,
 * run through the same safety gate as every other food-facing list, with the
 * ingredient itself never suggested back.
 *
 * Same mocking convention as adapter.substitutes.test.js: `vi.doMock` + a
 * fresh dynamic `import()` per test (module registry reset in beforeEach) so
 * each test gets an empty cache.js instance and its own fetchSuggest.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CONDITIONS = [9001];

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.doUnmock('../nutridigm.js');
  vi.doUnmock('../localTables.js');
  vi.doUnmock('../../data/recipeOverlay.json');
});

async function setupAdapter({ fetchSuggestImpl, itemTable = [] } = {}) {
  vi.doMock('../../data/recipeOverlay.json', () => ({ default: [] }));
  vi.doMock('../nutridigm.js', () => ({
    fetchSuggest: vi.fn(fetchSuggestImpl),
    fetchGoodFor: vi.fn(),
    fetchTopDoOrDonts: vi.fn(),
    fetchDetailed: vi.fn(),
    fetchReferences: vi.fn(),
    NutridigmAuthError: class NutridigmAuthError extends Error {},
  }));
  vi.doMock('../localTables.js', () => ({
    getItemTable: vi.fn(() => itemTable),
    getConditionTable: vi.fn(() => [{ healthConditionID: 9001, description: 'Test Condition' }]),
    getGroupTable: vi.fn(() => []),
    getOverlayImageFile: vi.fn(() => undefined),
  }));
  return import('../adapter.js');
}

const BEEF = { name: 'Beef', foodItemID: 9, suggestGroup: 'b2' };

describe('getIngredientAlternatives', () => {
  it('returns /suggest results for the ingredient\'s own fine group, best first', async () => {
    const calls = [];
    const { getIngredientAlternatives } = await setupAdapter({
      fetchSuggestImpl: async (csv, fineFoodGroup) => {
        calls.push([csv, fineFoodGroup]);
        return [
          { foodItemID: 129, foodItemDisplayAs: 'Pork liver', descriptionNumericID: 2 },
          { foodItemID: 16, foodItemDisplayAs: 'Beef liver', descriptionNumericID: 1 },
        ];
      },
    });

    const { alternatives, suggestGroup, usedFallback } = await getIngredientAlternatives(
      { conditions: CONDITIONS },
      BEEF
    );

    expect(calls).toEqual([['9001', 'b2']]);
    expect(suggestGroup).toBe('b2');
    expect(usedFallback).toBe(false);
    expect(alternatives.map((a) => a.name)).toEqual(['Beef liver', 'Pork liver']);
    expect(alternatives[0].numericId).toBe(1);
  });

  it('never suggests the ingredient itself back', async () => {
    const { getIngredientAlternatives } = await setupAdapter({
      fetchSuggestImpl: async () => [
        { foodItemID: 9, foodItemDisplayAs: 'Beef', descriptionNumericID: 3 },
        { foodItemID: 16, foodItemDisplayAs: 'Beef liver', descriptionNumericID: 1 },
      ],
    });

    const { alternatives } = await getIngredientAlternatives({ conditions: CONDITIONS }, BEEF);
    expect(alternatives.map((a) => a.id)).toEqual([16]);
  });

  it('drops harmful (numericId 5-7) and non-food items — same gate as every other list', async () => {
    const { getIngredientAlternatives } = await setupAdapter({
      fetchSuggestImpl: async () => [
        { foodItemID: 16, foodItemDisplayAs: 'Beef liver', descriptionNumericID: 1 },
        { foodItemID: 40, foodItemDisplayAs: 'Harmful thing', descriptionNumericID: 6 },
        { foodItemID: 41, foodItemDisplayAs: 'Smoking', descriptionNumericID: 1, fineFoodGroup: 'j1' },
      ],
    });

    const { alternatives } = await getIngredientAlternatives({ conditions: CONDITIONS }, BEEF);
    expect(alternatives.map((a) => a.id)).toEqual([16]);
  });

  it('honors the limit option', async () => {
    const { getIngredientAlternatives } = await setupAdapter({
      fetchSuggestImpl: async () =>
        Array.from({ length: 10 }, (_, i) => ({
          foodItemID: 100 + i,
          foodItemDisplayAs: `Food ${i}`,
          descriptionNumericID: 2,
        })),
    });

    const { alternatives } = await getIngredientAlternatives(
      { conditions: CONDITIONS },
      BEEF,
      { limit: 3 }
    );
    expect(alternatives).toHaveLength(3);
  });

  it('is honestly empty (no fetch) when the ingredient has no scoping group', async () => {
    const fetchSuggestImpl = vi.fn(async () => []);
    const { getIngredientAlternatives } = await setupAdapter({ fetchSuggestImpl });

    const result = await getIngredientAlternatives(
      { conditions: CONDITIONS },
      { name: 'Mystery', foodItemID: null, suggestGroup: null }
    );

    expect(result.alternatives).toEqual([]);
    expect(result.suggestGroup).toBeNull();
    expect(fetchSuggestImpl).not.toHaveBeenCalled();
  });

  it('is honestly empty (no fetch) when the profile has no conditions', async () => {
    const fetchSuggestImpl = vi.fn(async () => []);
    const { getIngredientAlternatives } = await setupAdapter({ fetchSuggestImpl });

    const result = await getIngredientAlternatives({ conditions: [] }, BEEF);
    expect(result.alternatives).toEqual([]);
    expect(fetchSuggestImpl).not.toHaveBeenCalled();
  });

  it('propagates a real API failure rather than reporting "no alternatives"', async () => {
    const { getIngredientAlternatives } = await setupAdapter({
      fetchSuggestImpl: async () => {
        throw new Error('network down');
      },
    });

    await expect(
      getIngredientAlternatives({ conditions: CONDITIONS }, BEEF)
    ).rejects.toThrow('network down');
  });
});
