/**
 * getCategoryRecipes (4.1, 4.2, 7.3): /suggest returns only the top 20 recipes,
 * which held 0 of 8 beverage recipes for Aging. This adds Sunny's Beverage, Snack
 * and Dessert recipes and her R items that the top 20 left out.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); });

const OVERLAY = [
  { foodItemID: 5028, name: 'Frozen Strawberries Smoothies', mealType: 'breakfast', alsoFits: ['beverage'], fineFoodGroup: 'l', sourceUrl: 'https://example.com/a' },
  { foodItemID: 5053, name: 'Guacamole', mealType: 'lunch', alsoFits: ['dinner', 'snack'], fineFoodGroup: 'l', sourceUrl: 'https://example.com/b' },
  { foodItemID: 5000, name: 'Shrimp and Grits', mealType: 'lunch', alsoFits: ['dinner'], fineFoodGroup: 'l', sourceUrl: 'https://example.com/c' },
  { foodItemID: 5118, name: 'Un-beet-able Berry Smoothie', mealType: 'breakfast', alsoFits: ['beverage'], fineFoodGroup: 'l', sourceUrl: 'https://example.com/d' },
];
// Loaded in Nutridigm's dictionary. 5118 isn't yet: /goodfor would answer 400.
const LOADED = [5028, 5053, 5000].map((foodItemID) => ({ foodItemID, displayAs: `Recipe ${foodItemID}`, fineFoodGroup: 'l' }));
const PIZZA = { foodItemID: 789, displayAs: 'Pizza', description: 'Pizza', coarseFoodGroup: 'i', fineFoodGroup: 'i2', isRecipe: true, mealTypes: ['lunch', 'dinner'] };

class NutridigmAuthError extends Error {
  constructor(code, msg) { super(msg); this.name = 'NutridigmAuthError'; this.code = code; }
}

async function setup({ flagged = [PIZZA], suggest = [], fetchSuggest = async () => suggest, goodFor } = {}) {
  const fetchGoodFor = vi.fn(goodFor ?? (async (id) => (id === 789
    ? { value: -1, description: 'Harmful', descriptionNumericID: 5, notes: '' }
    : { value: 1, description: 'Helpful', descriptionNumericID: 3, notes: 'FN Kitchen' })));
  vi.doMock('../nutridigm.js', () => ({
    fetchSuggest: vi.fn(fetchSuggest), fetchGoodFor, fetchTopDoOrDonts: vi.fn(), fetchDetailed: vi.fn(),
    fetchReferences: vi.fn(async () => []), NutridigmAuthError,
  }));
  vi.doMock('../../data/recipeOverlay.json', () => ({ default: OVERLAY }));
  vi.doMock('../localTables.js', () => ({
    getItemTable: vi.fn(() => [PIZZA, ...LOADED]),
    getConditionTable: vi.fn(() => [
      { healthConditionID: 203, description: 'Aging' },
      { healthConditionID: 1, description: 'High Cholesterol' },
      { healthConditionID: 999, description: 'Gout' },
    ]),
    getGroupTable: vi.fn(() => []),
    getOverlayImageFile: vi.fn(() => undefined),
    getRecipeFlaggedItems: vi.fn(() => flagged),
  }));
  const adapter = await import('../adapter.js');
  return { adapter, fetchGoodFor };
}

describe('getCategoryRecipes', () => {
  it('adds beverage and snack recipes missing from the top 20, scored by /goodfor', async () => {
    const { adapter } = await setup({ flagged: [] });
    const { recipes } = await adapter.getCategoryRecipes({ conditions: [203] });
    expect(recipes.map((r) => r.id).sort()).toEqual([5028, 5053]);
    const smoothie = recipes.find((r) => r.id === 5028);
    expect(smoothie).toMatchObject({ title: 'Frozen Strawberries Smoothies', numericId: 3, mealType: 'breakfast', alsoFits: ['beverage'] });
  });

  it('leaves out a recipe not loaded in Nutridigm yet, and never asks /goodfor about it', async () => {
    const { adapter, fetchGoodFor } = await setup({ flagged: [] });
    const { recipes } = await adapter.getCategoryRecipes({ conditions: [203] });
    expect(recipes.map((r) => r.id)).not.toContain(5118);
    expect(fetchGoodFor.mock.calls.map((c) => c[0])).not.toContain(5118);
  });

  it('skips the /goodfor call for a recipe already in the top 20', async () => {
    const { adapter, fetchGoodFor } = await setup({
      flagged: [],
      suggest: [{ foodItemID: 5053, foodItemDisplayAs: 'Guacamole', descriptionNumericID: 2, notes: '' }],
    });
    const { recipes } = await adapter.getCategoryRecipes({ conditions: [203] });
    expect(fetchGoodFor.mock.calls.map((c) => c[0])).toEqual([5028]);
    expect(recipes.map((r) => r.id)).toEqual([5028]);
  });

  it('includes R items by flag, with their real rating and meal types', async () => {
    const { adapter } = await setup();
    const { recipes } = await adapter.getCategoryRecipes({ conditions: [203] });
    expect(recipes.find((r) => r.id === 789)).toMatchObject({
      title: 'Pizza', numericId: 5, mealType: 'lunch', alsoFits: ['dinner'], matchedConditions: [],
    });
  });

  it('keeps a row that fails to score, unrated, rather than dropping it', async () => {
    const { adapter } = await setup({ flagged: [], goodFor: async () => { throw new Error('boom'); } });
    const { recipes } = await adapter.getCategoryRecipes({ conditions: [203] });
    expect(recipes.find((r) => r.id === 5028)).toMatchObject({ title: 'Frozen Strawberries Smoothies', numericId: null });
  });

  it('scores the extras once, on the authorized set, when a condition is unauthorized', async () => {
    const { adapter, fetchGoodFor } = await setup({
      flagged: [],
      fetchSuggest: async (csv) => {
        if (csv.split(',').includes('999')) throw new NutridigmAuthError('NOTAUTHORIZEDHEALTHID', 'nope');
        return [];
      },
    });
    await adapter.getCategoryRecipes({ conditions: [203, 1, 999] });
    expect(fetchGoodFor.mock.calls.map((c) => c[1])).toEqual(['203,1', '203,1']);
  });

  it('adds no R items and makes no calls for them while no item is flagged', async () => {
    const { adapter, fetchGoodFor } = await setup({ flagged: [] });
    await adapter.getCategoryRecipes({ conditions: [203] });
    expect(fetchGoodFor.mock.calls.map((c) => c[0])).not.toContain(789);
  });
});
