/**
 * adapter.fineGroupSuggest.test.js — Guards the Wave 1 "Suggest" browse
 * surface data layer: `getFineFoodGroups` (the static 17-group menu) and
 * `getFineGroupSuggestions` (one group's condition-ranked browse list), both
 * in adapter.js.
 *
 * `getFineFoodGroups` tests mock only `../localTables.js` (it's a pure
 * /foodgroups-dictionary read, no /suggest call) and use the module-level
 * `vi.mock` + static import style (adapter.categoryDetailRefs.test.js's
 * pattern) since there's no per-test fetchSuggest behavior to vary.
 *
 * `getFineGroupSuggestions` tests need per-test control over `fetchSuggest`
 * responses (ranking/exclusion/fallback), so they follow
 * adapter.substitutes.test.js / adapter.mealPlanOutage.test.js's
 * `vi.doMock` + fresh dynamic `import()` + `vi.resetModules()` idiom — each
 * test gets its own empty cache.js module instance so one test's cached
 * /suggest response can never leak into another.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CONDITIONS = [9001];

// ── getFineFoodGroups ────────────────────────────────────────────────────────

/**
 * Stand-in /foodgroups dictionary: the 9 coarse-only letters (b,c,g,h,i,j,k —
 * isCoarseFoodGroup only), the 14 true subdivided fine groups, the 3
 * dual-flagged d/e/f records (both isCoarseFoodGroup AND isFineFoodGroup,
 * foodGroupID === their own coarse letter — the subtlety this function
 * handles the opposite way from `getFineGroupLabelsByCoarse`), and the 3
 * excluded fine codes (x, j1, l).
 */
const FOOD_GROUPS = [
  // Coarse-only letters (no isFineFoodGroup) — never fine-menu candidates.
  { foodGroupID: 'b', description: 'Meat, Fish & Poultry', isCoarseFoodGroup: true, isFineFoodGroup: false },
  { foodGroupID: 'c', description: 'Eggs, Beans, Nuts & Seeds', isCoarseFoodGroup: true, isFineFoodGroup: false },
  { foodGroupID: 'g', description: 'Dairy, Fats & Oils', isCoarseFoodGroup: true, isFineFoodGroup: false },
  { foodGroupID: 'h', description: 'Desserts, Snacks & Beverages', isCoarseFoodGroup: true, isFineFoodGroup: false },
  { foodGroupID: 'i', description: 'Herbs, Spices & Prepared Foods', isCoarseFoodGroup: true, isFineFoodGroup: false },
  { foodGroupID: 'j', description: 'Alternative Therapies & Misc.', isCoarseFoodGroup: true, isFineFoodGroup: false },
  { foodGroupID: 'k', description: 'Key Nutrients & Herbal', isCoarseFoodGroup: true, isFineFoodGroup: false },
  // True fine subdivisions.
  { foodGroupID: 'b1', description: 'Fish & Seafood', isCoarseFoodGroup: false, isFineFoodGroup: true },
  { foodGroupID: 'b2', description: 'Meat, Red Meat & Organ Meats', isCoarseFoodGroup: false, isFineFoodGroup: true },
  { foodGroupID: 'b3', description: 'Poultry', isCoarseFoodGroup: false, isFineFoodGroup: true },
  { foodGroupID: 'c1', description: 'Eggs & Preparations', isCoarseFoodGroup: false, isFineFoodGroup: true },
  { foodGroupID: 'c2', description: 'Beans & Legumes', isCoarseFoodGroup: false, isFineFoodGroup: true },
  { foodGroupID: 'c3', description: 'Nuts & Seeds', isCoarseFoodGroup: false, isFineFoodGroup: true },
  { foodGroupID: 'g1', description: 'Dairy Products', isCoarseFoodGroup: false, isFineFoodGroup: true },
  { foodGroupID: 'g2', description: 'Fats & Oils', isCoarseFoodGroup: false, isFineFoodGroup: true },
  { foodGroupID: 'h1', description: 'Sweets & Snacks', isCoarseFoodGroup: false, isFineFoodGroup: true },
  { foodGroupID: 'h2', description: 'Beverages', isCoarseFoodGroup: false, isFineFoodGroup: true },
  { foodGroupID: 'i1', description: 'Herbs, Spices & Sauces', isCoarseFoodGroup: false, isFineFoodGroup: true },
  { foodGroupID: 'i2', description: 'Fast & Prepared Foods', isCoarseFoodGroup: false, isFineFoodGroup: true },
  { foodGroupID: 'k1', description: 'Vitamins, Minerals & Other', isCoarseFoodGroup: false, isFineFoodGroup: true },
  { foodGroupID: 'k2', description: 'Herbal Supplements', isCoarseFoodGroup: false, isFineFoodGroup: true },
  // Dual-flagged: no real subdivisions, the record itself IS the fine group.
  { foodGroupID: 'd', description: 'Fruits & Juices', isCoarseFoodGroup: true, isFineFoodGroup: true },
  { foodGroupID: 'e', description: 'Vegetables', isCoarseFoodGroup: true, isFineFoodGroup: true },
  { foodGroupID: 'f', description: 'Breads, Grains, Cereals, Pasta', isCoarseFoodGroup: true, isFineFoodGroup: true },
  // Excluded fine codes.
  { foodGroupID: 'x', description: 'Other', isCoarseFoodGroup: true, isFineFoodGroup: true },
  { foodGroupID: 'j1', description: 'Lifestyle', isCoarseFoodGroup: false, isFineFoodGroup: true },
  { foodGroupID: 'l', description: 'Recipes', isCoarseFoodGroup: true, isFineFoodGroup: true },
];

vi.mock('../nutridigm.js', () => ({
  fetchSuggest: vi.fn(),
  fetchGoodFor: vi.fn(),
  fetchTopDoOrDonts: vi.fn(),
  fetchDetailed: vi.fn(),
  fetchReferences: vi.fn(),
  NutridigmAuthError: class NutridigmAuthError extends Error {},
}));

vi.mock('../localTables.js', () => ({
  getItemTable: vi.fn(() => []),
  getConditionTable: vi.fn(() => []),
  getGroupTable: vi.fn(() => FOOD_GROUPS),
  getOverlayImageFile: vi.fn(() => undefined),
}));

import { getFineFoodGroups } from '../adapter.js';

describe('getFineFoodGroups', () => {
  /** @type {Awaited<ReturnType<typeof getFineFoodGroups>>} */
  let menu;

  beforeEach(async () => {
    menu = await getFineFoodGroups();
  });

  it('returns exactly the 17 real fine groups', () => {
    expect(menu).toHaveLength(17);
  });

  it('excludes the lifestyle/recipe codes (x, j1, l)', () => {
    const codes = menu.map((g) => g.code);
    expect(codes).not.toContain('x');
    expect(codes).not.toContain('j1');
    expect(codes).not.toContain('l');
  });

  it('excludes coarse-only records (no isFineFoodGroup)', () => {
    const codes = menu.map((g) => g.code);
    for (const coarseOnly of ['b', 'c', 'g', 'h', 'i', 'j', 'k']) {
      expect(codes).not.toContain(coarseOnly);
    }
  });

  it('includes d, e, f — the dual-flagged records with no real subdivisions — unlike getFineGroupLabelsByCoarse', () => {
    const codes = menu.map((g) => g.code);
    expect(codes).toEqual(expect.arrayContaining(['d', 'e', 'f']));
    const d = menu.find((g) => g.code === 'd');
    expect(d).toEqual({ code: 'd', label: 'Fruits & Juices', coarse: 'd' });
  });

  it('is ordered ascending by code, keeping each coarse letter contiguous', () => {
    const codes = menu.map((g) => g.code);
    const sorted = [...codes].sort();
    expect(codes).toEqual(sorted);
    // b1, b2, b3 stay adjacent and in order.
    expect(codes.slice(codes.indexOf('b1'), codes.indexOf('b1') + 3)).toEqual(['b1', 'b2', 'b3']);
  });

  it('stamps the correct coarse letter and real label on every entry', () => {
    const b1 = menu.find((g) => g.code === 'b1');
    expect(b1).toEqual({ code: 'b1', label: 'Fish & Seafood', coarse: 'b' });
    const k2 = menu.find((g) => g.code === 'k2');
    expect(k2).toEqual({ code: 'k2', label: 'Herbal Supplements', coarse: 'k' });
  });
});

// ── getFineGroupSuggestions ──────────────────────────────────────────────────


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
 * reset in beforeEach) — same idiom as adapter.substitutes.test.js.
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

describe('getFineGroupSuggestions: no profile conditions / no group code', () => {
  it('returns an honestly-empty envelope without calling /suggest when conditions are empty', async () => {
    const { getFineGroupSuggestions } = await setupAdapter({
      fetchSuggestImpl: async () => {
        throw new Error('should never be called');
      },
    });

    const result = await getFineGroupSuggestions({ conditions: [] }, 'b1');
    expect(result).toEqual({ items: [], unscorableReason: null, requestedConditionIds: [] });
  });

  it('returns an honestly-empty envelope without calling /suggest when fineGroupCode is falsy', async () => {
    const { getFineGroupSuggestions } = await setupAdapter({
      fetchSuggestImpl: async () => {
        throw new Error('should never be called');
      },
    });

    const result = await getFineGroupSuggestions({ conditions: CONDITIONS }, null);
    expect(result).toEqual({ items: [], unscorableReason: null, requestedConditionIds: CONDITIONS });
  });
});

describe('getFineGroupSuggestions: ranking shows the FULL spread, including Avoid (5-7)', () => {
  it('keeps every item with a descriptionNumericID (1-7), unlike the Plan-safety numericId 1-4 filter', async () => {
    const { getFineGroupSuggestions } = await setupAdapter({
      fetchSuggestImpl: async (_csv, fineFoodGroup) => {
        if (fineFoodGroup !== 'b1') return [];
        return [
          { foodItemID: 7, foodItemDisplayAs: 'Worst Fish', descriptionNumericID: 7 },
          { foodItemID: 1, foodItemDisplayAs: 'Top Fish', descriptionNumericID: 1 },
          { foodItemID: 5, foodItemDisplayAs: 'Poor Fish', descriptionNumericID: 5 },
          { foodItemID: 4, foodItemDisplayAs: 'Neutral Fish', descriptionNumericID: 4 },
        ];
      },
    });

    const result = await getFineGroupSuggestions({ conditions: CONDITIONS }, 'b1');
    expect(result.items.map((i) => i.id)).toEqual([1, 4, 5, 7]);
    expect(result.items.map((i) => i.tier)).toEqual(['Top', null, 'poor', 'poor']);
  });

  it('drops items with no descriptionNumericID at all (nothing to rank by)', async () => {
    const { getFineGroupSuggestions } = await setupAdapter({
      fetchSuggestImpl: async (_csv, fineFoodGroup) => {
        if (fineFoodGroup !== 'b1') return [];
        return [
          { foodItemID: 1, foodItemDisplayAs: 'Top Fish', descriptionNumericID: 1 },
          { foodItemID: 2, foodItemDisplayAs: 'No-ID Fish' },
        ];
      },
    });

    const result = await getFineGroupSuggestions({ conditions: CONDITIONS }, 'b1');
    expect(result.items.map((i) => i.id)).toEqual([1]);
  });
});

describe('getFineGroupSuggestions: isExcludedItem filtering', () => {
  it('excludes an item carrying a lifestyle-flagged group even though real /suggest items carry no such fields today', async () => {
    const { getFineGroupSuggestions } = await setupAdapter({
      fetchSuggestImpl: async (_csv, fineFoodGroup) => {
        if (fineFoodGroup !== 'b1') return [];
        return [
          { foodItemID: 1, foodItemDisplayAs: 'Real Fish', descriptionNumericID: 1 },
          // Defensive case: isExcludedItem keys off fineFoodGroup/coarseFoodGroup
          // on the raw item — exercise that path even though /suggest doesn't
          // populate those fields in practice (see suggestItemToCandidate's doc).
          { foodItemID: 2, foodItemDisplayAs: 'Lifestyle Item', descriptionNumericID: 2, coarseFoodGroup: 'j' },
        ];
      },
    });

    const result = await getFineGroupSuggestions({ conditions: CONDITIONS }, 'b1');
    expect(result.items.map((i) => i.id)).toEqual([1]);
  });
});

describe('getFineGroupSuggestions: shares the planner\'s /suggest cache (zero new network surface)', () => {
  it('requests exactly the group asked for, via the same conditionsCSV:fineFoodGroup cache key shape', async () => {
    const requested = [];
    const { getFineGroupSuggestions } = await setupAdapter({
      fetchSuggestImpl: async (csv, fineFoodGroup) => {
        requested.push([csv, fineFoodGroup]);
        return [{ foodItemID: 1, foodItemDisplayAs: 'Carrot', descriptionNumericID: 1 }];
      },
    });

    await getFineGroupSuggestions({ conditions: CONDITIONS }, 'e');
    expect(requested).toEqual([[CONDITIONS.join(','), 'e']]);
  });

  it('attaches matchedConditions (profile condition display names) to every item', async () => {
    const { getFineGroupSuggestions } = await setupAdapter({
      fetchSuggestImpl: async (_csv, fineFoodGroup) =>
        fineFoodGroup === 'e'
          ? [{ foodItemID: 1, foodItemDisplayAs: 'Carrot', descriptionNumericID: 1 }]
          : [],
      conditionTable: [{ healthConditionID: 9001, description: 'High Blood Pressure' }],
    });

    const result = await getFineGroupSuggestions({ conditions: CONDITIONS }, 'e');
    expect(result.items[0].matchedConditions).toEqual(['High Blood Pressure']);
  });

  it('attaches referenceTotal CACHE-ONLY (null — never a network /references call)', async () => {
    const { getFineGroupSuggestions, } = await setupAdapter({
      fetchSuggestImpl: async (_csv, fineFoodGroup) =>
        fineFoodGroup === 'e'
          ? [{ foodItemID: 1, foodItemDisplayAs: 'Carrot', descriptionNumericID: 1 }]
          : [],
    });
    const { fetchReferences } = await import('../nutridigm.js');

    const result = await getFineGroupSuggestions({ conditions: CONDITIONS }, 'e');
    expect(result.items[0].referenceTotal).toBeNull();
    expect(fetchReferences).not.toHaveBeenCalled();
  });
});

describe('getFineGroupSuggestions: partial authorization (key cannot score some conditions)', () => {
  async function setupAuth() {
    vi.resetModules();
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
          if (csv.split(',').includes('9001')) throw new NutridigmAuthError('NOTAUTHORIZEDHEALTHID', 'nope');
          return fineFoodGroup === 'b1'
            ? [{ foodItemID: 501, foodItemDisplayAs: 'Salmon', descriptionNumericID: 1 }]
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
      getItemTable: vi.fn(() => []),
      getConditionTable: vi.fn(() => [
        { healthConditionID: 203, description: 'Aging' },
        { healthConditionID: 9001, description: 'Condition 9001' },
      ]),
      getGroupTable: vi.fn(() => []),
      getOverlayImageFile: vi.fn(() => undefined),
    }));
    return import('../adapter.js');
  }

  it('returns results for the scorable condition and names the unscorable one', async () => {
    const { getFineGroupSuggestions } = await setupAuth();
    const result = await getFineGroupSuggestions({ conditions: [203, 9001] }, 'b1');

    expect(result.items.map((i) => i.id)).toEqual([501]);
    expect(result.unscorableReason).toBe("We can't score food for Condition 9001 yet.");
    expect(result.requestedConditionIds).toEqual([203, 9001]);
  });

  it('returns an empty list plus a reason when no condition is scorable', async () => {
    const { getFineGroupSuggestions } = await setupAuth();
    const result = await getFineGroupSuggestions({ conditions: [9001] }, 'b1');

    expect(result.items).toEqual([]);
    expect(result.unscorableReason).toBe("We can't score food for Condition 9001 yet.");
  });
});
