/**
 * api.searchHonesty.test.js — Guard tests for T6D's fix to api.js's Hole:
 * `searchFoodsAndRecipes` and `searchNaturalSourceItems` used to `.catch()`
 * their underlying calls internally and ALWAYS resolve — even when EVERY
 * source failed (a genuine network/API outage), which made a real failure
 * indistinguishable from "searched successfully, found nothing" (violates
 * the binding project rule: an error must never be presented to the user
 * as "no results").
 *
 * Fixed contract (api.js):
 *   - `searchFoodsAndRecipes` fans out `searchFoods` + `getRecipes` via
 *     `Promise.allSettled`. Total failure (BOTH reject) -> throws. Partial
 *     failure (one rejects, the other fulfills) -> resolves with whatever
 *     succeeded, degrading the failed side to its empty contribution.
 *   - `searchNaturalSourceItems` has a single source (`searchNaturalSources`)
 *     — there's nothing to partially degrade to, so ANY failure there is a
 *     total failure and is left to propagate (no internal catch at all).
 *   - Either way, a real "searched successfully, found nothing" result
 *     (including the API's HTTP 220 "valid but empty" shape, which
 *     nutridigm.js's `fetchSuggest`/`request` already coalesce to `[]`/`null`
 *     before adapter.js ever sees them) still resolves to an empty array
 *     WITHOUT throwing.
 *
 * Mocks at the ../nutridigm.js boundary (`fetchSuggest` backs the recipes
 * 'l' /suggest call inside `getRecipes`) and the ../localTables.js boundary
 * (`getItemTable` backs `searchFoods`/`searchNaturalSources`'s client-side
 * dictionary filter) — same idiom as adapter.mealPlanOutage.test.js. Uses
 * `vi.doMock` + a fresh dynamic `import()` per test (with
 * `vi.resetModules()` in beforeEach) so each test's adapter.js module
 * instance (and its internal `_foodItemsCache`) starts empty.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CONDITIONS = [9001];

/**
 * Mocks the fetch + local-dictionary layers, then dynamically imports
 * api.js so it (and the adapter.js it wraps) pick up THIS test's mocks
 * (module registry was just reset in beforeEach).
 * @param {{
 *   fetchSuggestImpl?: (csv: string, fineFoodGroup: string) => Promise<any>,
 *   getItemTableImpl?: () => Array<Object>,
 *   conditionTable?: Array<Object>,
 * }} opts
 */
async function setupApi({
  fetchSuggestImpl = async () => [],
  getItemTableImpl = () => [],
  conditionTable = [{ healthConditionID: 9001, description: 'Test Condition' }],
} = {}) {
  vi.doMock('../nutridigm.js', () => ({
    fetchSuggest: vi.fn(fetchSuggestImpl),
    fetchGoodFor: vi.fn(),
    fetchTopDoOrDonts: vi.fn(),
    fetchDetailed: vi.fn(),
    fetchReferences: vi.fn(),
    NutridigmAuthError: class NutridigmAuthError extends Error {},
  }));
  vi.doMock('../localTables.js', () => ({
    getItemTable: vi.fn(getItemTableImpl),
    getConditionTable: vi.fn(() => conditionTable),
    getGroupTable: vi.fn(() => []),
    getOverlayImageFile: vi.fn(() => undefined),
  }));
  return import('../api.js');
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.doUnmock('../nutridigm.js');
  vi.doUnmock('../localTables.js');
});

describe('searchFoodsAndRecipes: total failure — both searchFoods and getRecipes fail', () => {
  it('throws instead of resolving with an empty list', async () => {
    const { searchFoodsAndRecipes } = await setupApi({
      fetchSuggestImpl: async () => {
        throw new Error('recipes network down');
      },
      getItemTableImpl: () => {
        throw new Error('dictionary load failed');
      },
    });

    await expect(
      searchFoodsAndRecipes('kale', { conditions: CONDITIONS })
    ).rejects.toThrow();
  });
});

describe('searchFoodsAndRecipes: partial failure — searchFoods fails, getRecipes succeeds', () => {
  it('resolves without throwing, using only the recipe results', async () => {
    const { searchFoodsAndRecipes } = await setupApi({
      fetchSuggestImpl: async (_csv, fineFoodGroup) => {
        if (fineFoodGroup === 'l') {
          return [{ foodItemID: 900, foodItemDisplayAs: 'Kale Salad', descriptionNumericID: 2 }];
        }
        return [];
      },
      getItemTableImpl: () => {
        throw new Error('dictionary load failed');
      },
    });

    const results = await searchFoodsAndRecipes('kale', { conditions: CONDITIONS });
    expect(results.some((r) => r.kind === 'recipe' && r.recipe.id === 900)).toBe(true);
    expect(results.some((r) => r.kind === 'food')).toBe(false);
  });
});

describe('searchFoodsAndRecipes: partial failure — getRecipes fails, searchFoods succeeds', () => {
  it('resolves without throwing, using only the food results', async () => {
    const { searchFoodsAndRecipes } = await setupApi({
      fetchSuggestImpl: async () => {
        throw new Error('recipes network down');
      },
      getItemTableImpl: () => [
        { foodItemID: 100, displayAs: 'Kale', coarseFoodGroup: 'e', fineFoodGroup: 'e1' },
      ],
    });

    const results = await searchFoodsAndRecipes('kale', { conditions: CONDITIONS });
    expect(results.some((r) => r.kind === 'food' && r.food.id === 100)).toBe(true);
    expect(results.some((r) => r.kind === 'recipe')).toBe(false);
  });
});

describe('searchFoodsAndRecipes: success but nothing matches (incl. HTTP 220 "valid but empty" shape)', () => {
  it('resolves to an empty array WITHOUT throwing', async () => {
    // fetchSuggest's real implementation coalesces a 220 response to `[]`
    // before adapter.js ever sees it — mock the boundary the same way.
    const { searchFoodsAndRecipes } = await setupApi({
      fetchSuggestImpl: async () => [],
      getItemTableImpl: () => [],
    });

    const results = await searchFoodsAndRecipes('nonexistent query', { conditions: CONDITIONS });
    expect(results).toEqual([]);
  });

  it('no query -> empty array without calling any source', async () => {
    const { searchFoodsAndRecipes } = await setupApi();
    const results = await searchFoodsAndRecipes('   ', { conditions: CONDITIONS });
    expect(results).toEqual([]);
  });
});

describe('searchNaturalSourceItems: total failure — the single source fails', () => {
  it('throws instead of resolving with an empty list', async () => {
    const { searchNaturalSourceItems } = await setupApi({
      getItemTableImpl: () => {
        throw new Error('dictionary load failed');
      },
    });

    await expect(searchNaturalSourceItems('ginseng')).rejects.toThrow('dictionary load failed');
  });
});

describe('searchNaturalSourceItems: success but nothing matches (incl. 220-shaped empty dictionary)', () => {
  it('resolves to an empty array WITHOUT throwing', async () => {
    const { searchNaturalSourceItems } = await setupApi({ getItemTableImpl: () => [] });
    const results = await searchNaturalSourceItems('ginseng');
    expect(results).toEqual([]);
  });

  it('a real match in coarse group k resolves normally', async () => {
    const { searchNaturalSourceItems } = await setupApi({
      getItemTableImpl: () => [
        { foodItemID: 200, displayAs: 'Ginseng Root', coarseFoodGroup: 'k', fineFoodGroup: 'k2' },
      ],
    });
    const results = await searchNaturalSourceItems('ginseng');
    expect(results).toEqual([{ kind: 'food', key: 'food-200', food: expect.objectContaining({ id: 200 }) }]);
  });
});
