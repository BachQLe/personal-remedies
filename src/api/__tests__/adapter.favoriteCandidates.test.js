/**
 * getFavoriteCandidates: the Meal Planner Implementation Notes (v11-20-26) rules end to end,
 * against a stubbed Nutridigm API and the real MP-DB (src/data/mpDb.json).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import mpDb from '../../data/mpDb.json';

beforeEach(() => { vi.resetModules(); });

class NutridigmAuthError extends Error {}

// Every MP-DB food is "loaded"; `rating(id)` picks its /goodfor numericId.
const ALL_IDS = [...Object.keys(mpDb.recipes), ...Object.keys(mpDb.more)].map(Number);
const ITEMS = [...new Set([...ALL_IDS, 6001, 6002])].map((foodItemID) => ({
  foodItemID, displayAs: `Food ${foodItemID}`, description: `Food ${foodItemID}`, coarseFoodGroup: 'x', fineFoodGroup: 'l',
}));

async function setup({ rating = () => 2, suggest = {} } = {}) {
  vi.doMock('../nutridigm.js', () => ({
    fetchSuggest: vi.fn(async (_c, group) => suggest[group] ?? []),
    fetchGoodFor: vi.fn(async (id) => ({ value: 1, description: 'x', descriptionNumericID: rating(id), notes: '' })),
    fetchTopDoOrDonts: vi.fn(), fetchDetailed: vi.fn(), fetchReferences: vi.fn(async () => []), NutridigmAuthError,
  }));
  vi.doMock('../localTables.js', () => ({
    getItemTable: vi.fn(() => ITEMS),
    getConditionTable: vi.fn(() => [{ healthConditionID: 203, description: 'Aging' }]),
    getGroupTable: vi.fn(() => []),
    getOverlayImageFile: vi.fn(() => undefined),
    getRecipeFlaggedItems: vi.fn(() => []),
  }));
  const { getFavoriteCandidates } = await import('../adapter.js');
  const { recipes } = await getFavoriteCandidates({ conditions: [203] });
  const inSlot = (type) => recipes.filter((r) => [r.mealType, ...r.alsoFits].includes(type));
  return { recipes, inSlot };
}

describe('getFavoriteCandidates', () => {
  it('caps every meal at the Limit (20)', async () => {
    const { inSlot } = await setup();
    for (const type of ['breakfast', 'lunch', 'dinner', 'snack', 'beverage']) {
      expect(inSlot(type).length).toBeLessThanOrEqual(20);
    }
    expect(inSlot('lunch').length).toBe(20);
  });

  it('lunch and dinner share a pool; none of it is negative', async () => {
    const { inSlot } = await setup({ rating: (id) => (id % 2 ? 6 : 2) });
    expect(inSlot('lunch').map((r) => r.id)).toEqual(inSlot('dinner').map((r) => r.id));
    expect(inSlot('lunch').every((r) => r.numericId <= 4)).toBe(true);
  });

  it('neutral passes for breakfast and desserts, but not for snacks (MP-More / /suggest)', async () => {
    const { inSlot } = await setup({ rating: () => 4 });
    expect(inSlot('breakfast').length).toBeGreaterThan(0);
    // Only MP-Recipes desserts can appear: every snack-only (MP-More) row needs a helpful rating.
    expect(inSlot('snack').every((r) => mpDb.recipes[r.id]?.meals.includes('ds'))).toBe(true);
  });

  it('ranks a /suggest L/D recipe, drops one MP-Recipes does not list, and carries kcal + URL', async () => {
    const { recipes } = await setup({
      suggest: { l: [
        { foodItemID: 5035, foodItemDisplayAs: 'Salmon', descriptionNumericID: 1, notes: '' },
        { foodItemID: 5011, foodItemDisplayAs: 'Yogurt Cake (deletion candidate)', descriptionNumericID: 1, notes: '' },
      ] },
    });
    expect(recipes.find((r) => r.id === 5011)).toBeUndefined();
    expect(recipes.find((r) => r.id === 5035)).toMatchObject({
      numericId: 1, sourceUrl: mpDb.recipes[5035].url, nutritionPerServing: { calories: 446 },
    });
  });

  it('never lists the same smoothie recipe twice (5023/5028/5030 share a URL)', async () => {
    const { recipes } = await setup();
    expect(recipes.filter((r) => [5023, 5028, 5030].includes(r.id))).toHaveLength(1);
  });
});
