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
 *   - `searchEverything` (Wave 2 — collapses Food Lookup + Natural Sources
 *     into one sectioned "Food & Nutrient Lookup" screen) fans out THREE
 *     sources — `searchFoods`, `searchNaturalSources`, `getRecipes` — via
 *     `Promise.allSettled`. Total failure (ALL THREE reject) -> throws.
 *     Partial failure (some reject) -> resolves, with each failed source's
 *     section(s) degrading to empty while the others still populate.
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

describe('searchFoods: coarse group k regression — nutrients/herbals never leak into food results', () => {
  it('excludes every group-k row even when the name matches', async () => {
    const { searchFoods } = await setupApi({
      getItemTableImpl: () => [
        { foodItemID: 300, displayAs: 'Vitamin A Supplement', coarseFoodGroup: 'k', fineFoodGroup: 'k1' },
        { foodItemID: 301, displayAs: 'Vitamin B12 Supplement', coarseFoodGroup: 'k', fineFoodGroup: 'k1' },
        { foodItemID: 302, displayAs: 'Vitamin-Rich Kale', coarseFoodGroup: 'e', fineFoodGroup: 'e1' },
      ],
    });
    const results = await searchFoods('vitamin', { conditions: CONDITIONS });
    expect(results.every((f) => f.group !== 'k')).toBe(true);
    expect(results.some((f) => f.id === 302)).toBe(true);
    expect(results.some((f) => f.id === 300 || f.id === 301)).toBe(false);
  });
});

describe('searchEverything: total failure — searchFoods/searchNaturalSources (dictionary) and getRecipes both fail', () => {
  it('throws instead of resolving with empty sections', async () => {
    const { searchEverything } = await setupApi({
      fetchSuggestImpl: async () => {
        throw new Error('recipes network down');
      },
      getItemTableImpl: () => {
        throw new Error('dictionary load failed');
      },
    });

    await expect(
      searchEverything('kale', { conditions: CONDITIONS })
    ).rejects.toThrow();
  });
});

describe('searchEverything: partial failure — dictionary fails, recipes succeed', () => {
  it('resolves with only the recipes section populated', async () => {
    const { searchEverything } = await setupApi({
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

    const results = await searchEverything('kale', { conditions: CONDITIONS });
    expect(results.foods).toEqual([]);
    expect(results.nutrients).toEqual([]);
    expect(results.herbals).toEqual([]);
    expect(results.recipes.some((r) => r.kind === 'recipe' && r.recipe.id === 900)).toBe(true);
  });
});

describe('searchEverything: partial failure — recipes fail, dictionary succeeds', () => {
  it('resolves with foods/nutrients/herbals sections populated and recipes empty', async () => {
    const { searchEverything } = await setupApi({
      fetchSuggestImpl: async () => {
        throw new Error('recipes network down');
      },
      getItemTableImpl: () => [
        { foodItemID: 100, displayAs: 'Kale Chips', coarseFoodGroup: 'e', fineFoodGroup: 'e1' },
        { foodItemID: 101, displayAs: 'Kale Root Extract', coarseFoodGroup: 'k', fineFoodGroup: 'k2' },
      ],
    });

    const results = await searchEverything('kale', { conditions: CONDITIONS });
    expect(results.recipes).toEqual([]);
    expect(results.foods.some((r) => r.kind === 'food' && r.food.id === 100)).toBe(true);
    expect(results.herbals.some((r) => r.kind === 'food' && r.food.id === 101)).toBe(true);
    expect(results.nutrients).toEqual([]);
  });
});

describe('searchEverything: success but nothing matches anywhere', () => {
  it('resolves to all-empty sections WITHOUT throwing', async () => {
    const { searchEverything } = await setupApi({
      fetchSuggestImpl: async () => [],
      getItemTableImpl: () => [],
    });

    const results = await searchEverything('nonexistent query', { conditions: CONDITIONS });
    expect(results).toEqual({ foods: [], recipes: [], nutrients: [], herbals: [] });
  });

  it('no query -> empty sections without calling any source', async () => {
    const { searchEverything } = await setupApi();
    const results = await searchEverything('   ', { conditions: CONDITIONS });
    expect(results).toEqual({ foods: [], recipes: [], nutrients: [], herbals: [] });
  });
});

describe('searchEverything: nutrients vs herbals split', () => {
  it('buckets fine group k1 as nutrients and k2 as herbals', async () => {
    const { searchEverything } = await setupApi({
      fetchSuggestImpl: async () => [],
      getItemTableImpl: () => [
        { foodItemID: 400, displayAs: 'Ginseng Vitamin Blend', coarseFoodGroup: 'k', fineFoodGroup: 'k1' },
        { foodItemID: 401, displayAs: 'Ginseng Root', coarseFoodGroup: 'k', fineFoodGroup: 'k2' },
      ],
    });

    const results = await searchEverything('ginseng', { conditions: CONDITIONS });
    expect(results.nutrients).toEqual([{ kind: 'food', key: 'food-400', food: expect.objectContaining({ id: 400 }) }]);
    expect(results.herbals).toEqual([{ kind: 'food', key: 'food-401', food: expect.objectContaining({ id: 401 }) }]);
  });
});
