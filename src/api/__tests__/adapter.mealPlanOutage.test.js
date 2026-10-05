/**
 * adapter.mealPlanOutage.test.js — Guard tests for T6C's fix to adapter.js's
 * Hole 2: `getMealPlanSuggestions` used to fan out ~10 parallel /suggest
 * calls (one per unique PLAN_SLOTS fine group) plus a recipes call and only
 * rethrow on an auth-shaped rejection (NOTAUTHORIZEDHEALTHID) — ANY other
 * total failure (e.g. a full network outage while `navigator.onLine` still
 * reports true) left every group `[]` and RESOLVED SUCCESSFULLY, which the
 * Plan/BestRecipes surfaces then rendered as "No recipes yet" instead of an
 * honest error with Retry (violates the binding rule: an error must never
 * be presented to the user as "no results").
 *
 * Fixed contract (`getMealPlanSuggestionsRaw`, adapter.js):
 *   - total outage (EVERY /suggest group call AND the recipes call reject)
 *     -> throws, so callers see an honest error state.
 *   - partial failure (some groups and/or recipes reject while others
 *     succeed) -> resolves with whatever succeeded; the honest-empty design
 *     for the failed side keeps working exactly as before.
 *   - every source succeeding with nothing found (including the real /
 *     API's HTTP 220 "valid but empty" shape, which nutridigm.js's
 *     `fetchSuggest` already coalesces to `[]` before adapter.js ever sees
 *     it) -> resolves to empty candidates WITHOUT throwing. A real
 *     zero-result response from a healthy API is not an error.
 *   - partial / total authorization (`withAuthorized`): unscorable
 *     conditions are dropped and named in `unscorableReason`.
 *   - the numericId 1-4 Plan safety pre-filter (`normalizePlanGroup`,
 *     unchanged) still holds.
 *
 * Mocks at the ../nutridigm.js boundary (`fetchSuggest` backs BOTH the
 * per-slot /suggest calls and the recipes 'l' /suggest call) and the
 * ../localTables.js boundary, same idiom as adapter.beveragesPool.test.js /
 * adapter.recipeOverlay.test.js. Uses `vi.doMock` + a fresh dynamic
 * `import()` per test (with `vi.resetModules()` in beforeEach, matching
 * adapter.recipeOverlay.test.js) so each test's cache.js module instance
 * starts empty — different tests reuse the same condition IDs with very
 * different fetchSuggest behavior, and a shared in-memory cache across tests
 * would let an earlier test's successful response silently serve a later
 * test that expects a rejection (or vice versa).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PLAN_SLOTS, PLAN_SLOT_KEYS } from '../config.js';

const CONDITIONS = [9001];

/** Every unique fine food group getMealPlanSuggestionsRaw fans out to (10 groups, per PLAN_SLOTS). */
const UNIQUE_GROUPS = [...new Set(PLAN_SLOTS.flatMap((s) => s.fineGroups))];

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.doUnmock('../nutridigm.js');
  vi.doUnmock('../localTables.js');
});

/**
 * Mocks the fetch + local-dictionary layers, then dynamically imports
 * adapter.js so it picks up THIS test's mocks (module registry was just
 * reset in beforeEach).
 * @param {{
 *   fetchSuggestImpl: (csv: string, fineFoodGroup: string) => Promise<any>,
 *   itemTable?: Array<Object>,
 *   conditionTable?: Array<Object>,
 * }} opts
 */
async function setupAdapter({
  fetchSuggestImpl,
  itemTable = [],
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
    getItemTable: vi.fn(() => itemTable),
    getConditionTable: vi.fn(() => conditionTable),
    getGroupTable: vi.fn(() => []),
    getOverlayImageFile: vi.fn(() => undefined),
  }));
  return import('../adapter.js');
}

describe('getMealPlanSuggestions: total outage — every group AND recipes fail', () => {
  it('throws instead of resolving with all-empty candidates', async () => {
    const { getMealPlanSuggestions } = await setupAdapter({
      fetchSuggestImpl: async () => {
        throw new Error('network down: total outage');
      },
    });

    await expect(getMealPlanSuggestions({ conditions: CONDITIONS })).rejects.toThrow('total outage');
  });

  it('still throws even when the underlying rejection reason varies per call (not just a shared reference)', async () => {
    const { getMealPlanSuggestions } = await setupAdapter({
      fetchSuggestImpl: async (_csv, fineFoodGroup) => {
        throw new Error(`aborted: ${fineFoodGroup}`);
      },
    });

    await expect(getMealPlanSuggestions({ conditions: CONDITIONS })).rejects.toThrow(/aborted:/);
  });
});

describe('getMealPlanSuggestions: partial failure — some groups fail, recipes and other groups succeed', () => {
  it('resolves without throwing, using data from whatever succeeded', async () => {
    const FAILING_GROUPS = new Set(['f', 'd', 'g1']); // breakfast's fine groups
    const { getMealPlanSuggestions } = await setupAdapter({
      fetchSuggestImpl: async (_csv, fineFoodGroup) => {
        if (fineFoodGroup === 'l') {
          // 'salad' keyword -> guessMealType -> 'lunch'
          return [{ foodItemID: 900, foodItemDisplayAs: 'Chicken Salad', descriptionNumericID: 2 }];
        }
        if (FAILING_GROUPS.has(fineFoodGroup)) {
          throw new Error(`suggest failed for ${fineFoodGroup}`);
        }
        if (fineFoodGroup === 'h2') {
          return [
            { foodItemID: 501, foodItemDisplayAs: 'Green Tea', descriptionNumericID: 2 },
            // out-of-range (harmful) numericId — must still be filtered out
            // by normalizePlanGroup, unchanged by this fix (see the
            // dedicated numericId 1-4 regression test below too).
            { foodItemID: 502, foodItemDisplayAs: 'Poor Beverage', descriptionNumericID: 6 },
          ];
        }
        return [];
      },
      itemTable: [
        { foodItemID: 501, isBeverage: true },
        { foodItemID: 502, isBeverage: true },
      ],
    });

    const result = await getMealPlanSuggestions({ conditions: CONDITIONS });

    // Recipes call succeeded -> lunch (recipes-only slot) is populated.
    expect(result.candidates.lunch.some((c) => c.id === 900)).toBe(true);
    // 'h2' group succeeded -> its in-range beverage item surfaces...
    expect(result.candidates.beverages.some((c) => c.id === 501)).toBe(true);
    // ...but the out-of-range one from that SAME successful group never does.
    expect(result.candidates.beverages.some((c) => c.id === 502)).toBe(false);
  });
});

describe('getMealPlanSuggestions: partial failure — every group fails but recipes succeed (NOT a total outage)', () => {
  it('resolves without throwing', async () => {
    const { getMealPlanSuggestions } = await setupAdapter({
      fetchSuggestImpl: async (_csv, fineFoodGroup) => {
        if (fineFoodGroup === 'l') {
          return [{ foodItemID: 900, foodItemDisplayAs: 'Chicken Salad', descriptionNumericID: 2 }];
        }
        throw new Error(`suggest failed for ${fineFoodGroup}`);
      },
    });

    const result = await getMealPlanSuggestions({ conditions: CONDITIONS });
    expect(result.candidates.lunch.some((c) => c.id === 900)).toBe(true);
    // Every item-driven pool is honestly empty (its groups all failed) —
    // that's the pre-existing per-group degradation, not a thrown error.
    expect(result.candidates.beverages).toEqual([]);
  });
});

describe('getMealPlanSuggestions: partial failure — every group succeeds but recipes fail (NOT a total outage)', () => {
  it('resolves without throwing', async () => {
    const { getMealPlanSuggestions } = await setupAdapter({
      fetchSuggestImpl: async (_csv, fineFoodGroup) => {
        if (fineFoodGroup === 'l') {
          throw new Error('recipes suggest failed');
        }
        if (fineFoodGroup === 'h2') {
          return [{ foodItemID: 501, foodItemDisplayAs: 'Green Tea', descriptionNumericID: 2 }];
        }
        return [];
      },
      itemTable: [{ foodItemID: 501, isBeverage: true }],
    });

    const result = await getMealPlanSuggestions({ conditions: CONDITIONS });
    expect(result.candidates.beverages.some((c) => c.id === 501)).toBe(true);
    // lunch is recipes-only; the recipes fetch failed, so it's honestly empty.
    expect(result.candidates.lunch).toEqual([]);
  });
});

describe('getMealPlanSuggestions: every source succeeds but returns nothing (HTTP 220 "valid but empty" shape)', () => {
  it('resolves to all-empty candidates WITHOUT throwing', async () => {
    // fetchSuggest's real implementation coalesces a 220 response to `[]`
    // (`(await request(...)) ?? []`) before adapter.js ever sees it — mock
    // the boundary the same way, per the task's mocking instructions.
    const { getMealPlanSuggestions } = await setupAdapter({
      fetchSuggestImpl: async () => [],
    });

    const result = await getMealPlanSuggestions({ conditions: CONDITIONS });
    for (const key of PLAN_SLOT_KEYS) {
      expect(result.candidates[key]).toEqual([]);
    }
  });

  it('every unique fine group was actually requested (sanity: this is a real empty response, not a skipped fetch)', async () => {
    const requested = new Set();
    const { getMealPlanSuggestions } = await setupAdapter({
      fetchSuggestImpl: async (_csv, fineFoodGroup) => {
        requested.add(fineFoodGroup);
        return [];
      },
    });

    await getMealPlanSuggestions({ conditions: CONDITIONS });
    for (const group of UNIQUE_GROUPS) {
      expect(requested.has(group)).toBe(true);
    }
    expect(requested.has('l')).toBe(true); // the shared recipes fine group
  });
});

describe('getMealPlanSuggestions: partial authorization (key cannot score some conditions)', () => {
  async function setupAuth() {
    vi.doMock('../nutridigm.js', () => {
      class NutridigmAuthError extends Error {
        constructor(code, message) {
          super(message);
          this.name = 'NutridigmAuthError';
          this.code = code;
        }
      }
      return {
        fetchSuggest: vi.fn(async (csv, fineFoodGroup) => {
          if (csv.split(',').includes('9001')) {
            throw new NutridigmAuthError('NOTAUTHORIZEDHEALTHID', 'key cannot score condition 9001');
          }
          return fineFoodGroup === 'h2'
            ? [{ foodItemID: 501, foodItemDisplayAs: 'Green Tea', descriptionNumericID: 2 }]
            : [];
        }),
        fetchGoodFor: vi.fn(),
        fetchTopDoOrDonts: vi.fn(),
        fetchDetailed: vi.fn(),
        fetchReferences: vi.fn(),
        NutridigmAuthError,
      };
    });
    vi.doMock('../localTables.js', () => ({
      getItemTable: vi.fn(() => [{ foodItemID: 501, isBeverage: true }]),
      getConditionTable: vi.fn(() => [
        { healthConditionID: 203, description: 'Aging' },
        { healthConditionID: 9001, description: 'Condition 9001' },
      ]),
      getGroupTable: vi.fn(() => []),
      getOverlayImageFile: vi.fn(() => undefined),
    }));
    return import('../adapter.js');
  }

  it('drops the unauthorized condition and still returns results for the scorable one', async () => {
    const { getMealPlanSuggestions } = await setupAuth();
    const result = await getMealPlanSuggestions({ conditions: [203, 9001] });

    expect(result.conditionIds).toEqual([203]);
    expect(result.conditionNames).toEqual(['Aging']);
    expect(result.unscorableReason).toBe("We can't score food for Condition 9001 yet.");
    expect(result.candidates.beverages.some((c) => c.id === 501)).toBe(true);
  });

  it('returns empty candidates plus a reason when no condition is scorable', async () => {
    const { getMealPlanSuggestions } = await setupAuth();
    const result = await getMealPlanSuggestions({ conditions: CONDITIONS });

    expect(result.conditionIds).toEqual([]);
    expect(result.unscorableReason).toBe("We can't score food for Condition 9001 yet.");
    for (const key of PLAN_SLOT_KEYS) expect(result.candidates[key]).toEqual([]);
  });
});

describe('getMealPlanSuggestions: numericId 1-4 Plan safety pre-filter survives this fix', () => {
  it('never surfaces a harmful (5-7) or out-of-range item, even from an otherwise-successful group', async () => {
    const { getMealPlanSuggestions } = await setupAdapter({
      fetchSuggestImpl: async (_csv, fineFoodGroup) => {
        if (fineFoodGroup === 'h2') {
          return [
            { foodItemID: 501, foodItemDisplayAs: 'Top Tea', descriptionNumericID: 1 },
            { foodItemID: 502, foodItemDisplayAs: 'Neutral Tea', descriptionNumericID: 4 },
            { foodItemID: 503, foodItemDisplayAs: 'Poor Tea', descriptionNumericID: 5 },
            { foodItemID: 504, foodItemDisplayAs: 'Bad Tea', descriptionNumericID: 6 },
            { foodItemID: 505, foodItemDisplayAs: 'Worst Tea', descriptionNumericID: 7 },
            { foodItemID: 506, foodItemDisplayAs: 'No-ID Tea' }, // descriptionNumericID missing
          ];
        }
        return [];
      },
      itemTable: [501, 502, 503, 504, 505, 506].map((id) => ({ foodItemID: id, isBeverage: true })),
    });

    const result = await getMealPlanSuggestions({ conditions: CONDITIONS });
    const ids = result.candidates.beverages.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining([501, 502]));
    expect(ids).not.toEqual(expect.arrayContaining([503, 504, 505, 506]));
    for (const c of result.candidates.beverages) {
      expect(c.numericId).toBeGreaterThanOrEqual(1);
      expect(c.numericId).toBeLessThanOrEqual(4);
    }
  });
});
