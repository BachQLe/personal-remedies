/**
 * adapter.goodForNullCache.test.js — guards the Task 3 fix ("assessFoodRaw
 * caches a null /goodfor result for the full 8h GOODFOR_TTL_MS"): a food
 * with no `/goodfor` data (HTTP 220 — valid-but-empty, surfaces as `null`
 * from `fetchGoodFor`) must NOT be persisted in `cachedFetch`'s TTL cache
 * the same way a real result is, so a retry (or a later call once data
 * catches up) hits the network again instead of being stuck "unassessable"
 * for 8 hours.
 *
 * Uses `vi.resetModules()` + a fresh dynamic `import()` per test (mirrors
 * adapter.substitutes.test.js) so each test gets its own `cache.js` module
 * instance — both `adapter.js`'s `assessFood` and a direct `peekCache` read
 * need to be looking at the SAME cache instance, and this is the only way
 * to guarantee that with `../nutridigm.js`/`../localTables.js` mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.doUnmock('../nutridigm.js');
  vi.doUnmock('../localTables.js');
});

/**
 * Mocks the fetch + local-dictionary layers, then dynamically imports
 * adapter.js AND cache.js so both this test and adapter.js internals share
 * one fresh, empty cache instance.
 * @param {{ fetchGoodForImpl: (foodId: number, conditionsCSV: string) => Promise<any> }} opts
 */
async function setupAdapter({ fetchGoodForImpl }) {
  vi.doMock('../nutridigm.js', () => ({
    fetchSuggest: vi.fn(),
    fetchGoodFor: vi.fn(fetchGoodForImpl),
    fetchTopDoOrDonts: vi.fn(),
    fetchDetailed: vi.fn(),
    fetchReferences: vi.fn(async () => []),
    NutridigmAuthError: class NutridigmAuthError extends Error {},
  }));
  vi.doMock('../localTables.js', () => ({
    getItemTable: vi.fn(() => []),
    getConditionTable: vi.fn(() => [{ healthConditionID: 9001, description: 'Test Condition' }]),
    getGroupTable: vi.fn(() => []),
    getOverlayImageFile: vi.fn(() => undefined),
  }));
  const adapter = await import('../adapter.js');
  const cache = await import('../cache.js');
  const nutridigm = await import('../nutridigm.js');
  return { ...adapter, ...cache, fetchGoodFor: nutridigm.fetchGoodFor };
}

describe('assessFood: a null /goodfor result is not cached for GOODFOR_TTL_MS', () => {
  it('does not leave a readable cache entry behind after a null result', async () => {
    const { assessFood, peekCache, fetchGoodFor } = await setupAdapter({
      fetchGoodForImpl: async () => null,
    });

    const result = await assessFood(123, { conditions: [9001] });

    expect(result).toBeNull();
    expect(fetchGoodFor).toHaveBeenCalledTimes(1);
    // The whole point of the fix: nothing persisted under the goodfor key.
    expect(peekCache('goodfor:9001:123')).toBeUndefined();
  });

  it('re-fetches on a second call instead of serving a cached null (proves it was never cached)', async () => {
    let calls = 0;
    const { assessFood, fetchGoodFor } = await setupAdapter({
      fetchGoodForImpl: async () => {
        calls++;
        return null;
      },
    });

    const first = await assessFood(123, { conditions: [9001] });
    const second = await assessFood(123, { conditions: [9001] });

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(calls).toBe(2);
    expect(fetchGoodFor).toHaveBeenCalledTimes(2);
  });

  it('a real (non-null) result IS still cached normally — behavior unchanged for the success path', async () => {
    const rawGoodFor = { descriptionNumericID: 1, value: 0.9, description: 'Great match' };
    let calls = 0;
    const { assessFood, peekCache, fetchGoodFor } = await setupAdapter({
      fetchGoodForImpl: async () => {
        calls++;
        return rawGoodFor;
      },
    });

    const first = await assessFood(123, { conditions: [9001] });
    const second = await assessFood(123, { conditions: [9001] });

    expect(first).not.toBeNull();
    expect(first.tier).toBe('Top');
    expect(second.tier).toBe('Top');
    // Second call was served from cache — the fetcher only ran once.
    expect(calls).toBe(1);
    expect(fetchGoodFor).toHaveBeenCalledTimes(1);
    expect(peekCache('goodfor:9001:123')).toEqual(rawGoodFor);
  });
});
