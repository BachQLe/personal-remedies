/**
 * getCategoryRecipes (4.1, 4.2, 7.3): /suggest returns only the top 20 recipes,
 * which held 0 of 8 beverage recipes for Aging. Sunny's Beverage, Snack and
 * Dessert recipes and her R items join the list whatever their rank.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); });

const OVERLAY = [
  { foodItemID: 5028, name: 'Frozen Strawberries Smoothies', mealType: 'breakfast', alsoFits: ['beverage'], fineFoodGroup: 'l', sourceUrl: 'https://example.com/a' },
  { foodItemID: 5053, name: 'Guacamole', mealType: 'lunch', alsoFits: ['dinner', 'snack'], fineFoodGroup: 'l', sourceUrl: 'https://example.com/b' },
  { foodItemID: 5000, name: 'Shrimp and Grits', mealType: 'lunch', alsoFits: ['dinner'], fineFoodGroup: 'l', sourceUrl: 'https://example.com/c' },
];
const PIZZA = { foodItemID: 789, displayAs: 'Pizza', description: 'Pizza', coarseFoodGroup: 'i', fineFoodGroup: 'i2', isRecipe: true, mealTypes: ['lunch', 'dinner'] };

async function setup({ flagged = [PIZZA], suggest = [] } = {}) {
  const fetchGoodFor = vi.fn(async (id) => (id === 789
    ? { value: -1, description: 'Harmful', descriptionNumericID: 5, notes: '' }
    : { value: 1, description: 'Helpful', descriptionNumericID: 3, notes: 'FN Kitchen' }));
  vi.doMock('../nutridigm.js', () => ({
    fetchSuggest: vi.fn(async () => suggest), fetchGoodFor, fetchTopDoOrDonts: vi.fn(), fetchDetailed: vi.fn(),
    fetchReferences: vi.fn(async () => []), NutridigmAuthError: class extends Error {},
  }));
  vi.doMock('../../data/recipeOverlay.json', () => ({ default: OVERLAY }));
  vi.doMock('../localTables.js', () => ({
    getItemTable: vi.fn(() => [PIZZA]),
    getConditionTable: vi.fn(() => [{ healthConditionID: 203, description: 'Aging' }]),
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

  it('skips the /goodfor call for a recipe already in the top 20', async () => {
    const { adapter, fetchGoodFor } = await setup({
      flagged: [],
      suggest: [{ foodItemID: 5053, foodItemDisplayAs: 'Guacamole', descriptionNumericID: 2, notes: '' }],
    });
    const { recipes } = await adapter.getCategoryRecipes({ conditions: [203] });
    expect(fetchGoodFor.mock.calls.map((c) => c[0])).toEqual([5028]);
    expect(recipes.filter((r) => r.id === 5053)).toHaveLength(1);
  });

  it('includes R items by flag, with their real rating and meal types', async () => {
    const { adapter } = await setup();
    const { recipes } = await adapter.getCategoryRecipes({ conditions: [203] });
    expect(recipes.find((r) => r.id === 789)).toMatchObject({
      title: 'Pizza', numericId: 5, mealType: 'lunch', alsoFits: ['dinner'], isPreparedFood: true,
    });
  });

  it('adds no R items and makes no calls for them while no item is flagged', async () => {
    const { adapter, fetchGoodFor } = await setup({ flagged: [] });
    await adapter.getCategoryRecipes({ conditions: [203] });
    expect(fetchGoodFor.mock.calls.map((c) => c[0])).not.toContain(789);
  });
});
