/**
 * The same item must show the same rating wherever it appears (Mory's 30 Oct
 * review, 2.1). Live repro for Aging + High Cholesterol: /suggest gives Fiber
 * descriptionNumericID 2, /goodfor gives 3, both with value 1.05. The lists
 * come from /suggest and the card from /goodfor, hence 2 stars vs 1.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); });

const FIBER = 1099;
const SUGGEST_ROW = { foodItemID: FIBER, foodItemDisplayAs: 'Fiber', description: 'More Helpful', descriptionNumericID: 2, value: 1.05, notes: '' };

async function setup({ goodFor, suggest = [SUGGEST_ROW] }) {
  class NutridigmAuthError extends Error {
    constructor(code, msg) { super(msg); this.name = 'NutridigmAuthError'; this.code = code; }
  }
  const fetchGoodFor = vi.fn((foodId, csv) => goodFor(foodId, csv, NutridigmAuthError));
  const fetchReferences = vi.fn(async () => ['A study']);
  vi.doMock('../nutridigm.js', () => ({
    fetchSuggest: vi.fn(async () => suggest), fetchGoodFor, fetchTopDoOrDonts: vi.fn(), fetchDetailed: vi.fn(),
    fetchReferences, NutridigmAuthError,
  }));
  vi.doMock('../localTables.js', () => ({
    getItemTable: vi.fn(() => [{ foodItemID: FIBER, description: 'Fiber', displayAs: 'Fiber', coarseFoodGroup: 'k', fineFoodGroup: 'k1' }]),
    getConditionTable: vi.fn(() => [
      { healthConditionID: 203, description: 'Aging' },
      { healthConditionID: 1, description: 'High Cholesterol' },
    ]),
    getGroupTable: vi.fn(() => []),
    getOverlayImageFile: vi.fn(() => undefined),
    getRecipeFlaggedItems: vi.fn(() => []),
  }));
  const adapter = await import('../adapter.js');
  return { adapter, fetchGoodFor, fetchReferences };
}

const goodForAgingAndCholesterol = async (_id, csv) => ({
  '203,1': { value: 1.05, description: 'Helpful', descriptionNumericID: 3, notes: '' },
  203: { value: 0.6, description: 'Helpful', descriptionNumericID: 3, notes: '' },
  1: { value: 1.5, description: 'More Helpful', descriptionNumericID: 2, notes: '' },
}[csv]);

describe('rating consistency between lists and the food card', () => {
  it('rates a fine-group row the same as the card for a multi-condition profile', async () => {
    const { adapter } = await setup({ goodFor: goodForAgingAndCholesterol });
    const profile = { conditions: [203, 1] };
    const { items } = await adapter.getFineGroupSuggestions(profile, 'k1');
    const card = await adapter.assessFood(FIBER, profile);
    expect(items[0].numericId).toBe(3);
    expect(card.numericId).toBe(3);
  });

  it('rates a recipe row the same as the card for a multi-condition profile', async () => {
    const { adapter } = await setup({ goodFor: goodForAgingAndCholesterol });
    const profile = { conditions: [203, 1] };
    const { recipes } = await adapter.getRecipes(profile);
    expect(recipes[0].numericId).toBe(3);
  });

  it('makes no extra /goodfor calls for a single condition, where the endpoints agree', async () => {
    const { adapter, fetchGoodFor } = await setup({ goodFor: goodForAgingAndCholesterol });
    await adapter.getFineGroupSuggestions({ conditions: [203] }, 'k1');
    expect(fetchGoodFor).not.toHaveBeenCalled();
  });

  it('keeps the /suggest rating when /goodfor fails, rather than dropping the row', async () => {
    const { adapter } = await setup({ goodFor: async () => { throw new Error('boom'); } });
    const { items } = await adapter.getFineGroupSuggestions({ conditions: [203, 1] }, 'k1');
    expect(items[0].numericId).toBe(2);
  });

  it('warms the cache the card reads, so opening the row costs no second overall call', async () => {
    const { adapter, fetchGoodFor } = await setup({ goodFor: goodForAgingAndCholesterol });
    const profile = { conditions: [203, 1] };
    await adapter.getFineGroupSuggestions(profile, 'k1');
    await adapter.assessFood(FIBER, profile);
    expect(fetchGoodFor.mock.calls.filter((c) => c[1] === '203,1')).toHaveLength(1);
  });

  it('computes the card overall over the same conditions as the lists when one has no data', async () => {
    const { adapter } = await setup({
      goodFor: async (_id, csv) => (csv === '1'
        ? null
        : { value: 1, description: 'Helpful', descriptionNumericID: csv === '203' ? 2 : 3, notes: '' }),
    });
    const card = await adapter.assessFood(FIBER, { conditions: [203, 1] });
    expect(card.numericId).toBe(3);
  });

  it('gives the Check against my profile sheet the same overall rating', async () => {
    const { adapter } = await setup({ goodFor: goodForAgingAndCholesterol });
    const res = await adapter.getGoodForMe(FIBER, { conditions: [203, 1] });
    expect(res.overallNumericId).toBe(3);
    expect(res.rows.map((r) => r.numericId)).toEqual([3, 2]);
  });
});

describe('assessFood first-load speed (2.3)', () => {
  it('asks for references without waiting on /goodfor', async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const { adapter, fetchReferences } = await setup({
      goodFor: async () => { await gate; return { value: 1, description: 'Helpful', descriptionNumericID: 3, notes: '' }; },
    });
    const pending = adapter.assessFood(FIBER, { conditions: [203, 1] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchReferences).toHaveBeenCalledTimes(2);
    release();
    await pending;
  });
});
