/**
 * adapter.substitutes.test.js — Guards `getSlotSubstitutes` (src/api/adapter.js),
 * the acceptable-substitutions feature's data layer, plus the
 * `substituteFineGroup` resolution it depends on (`recipeToPlanCandidate`,
 * fed by the C1 overlay's ingredient data via `getRecipesRaw` — see
 * adapter.recipeOverlay.test.js for the sibling tests of that same join).
 *
 * Mirrors the mocking conventions of adapter.mealPlanOutage.test.js
 * (fan-out + partial-vs-total-failure contract) and
 * adapter.recipeOverlay.test.js (overlay ingestion): `vi.doMock` + a fresh
 * dynamic `import()` per test (with `vi.resetModules()` in beforeEach) so
 * each test's cache.js module instance starts empty and controls its own
 * fetchSuggest/overlay/item-table behavior without leaking into other tests.
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

/**
 * Mocks the fetch + local-dictionary + overlay layers, then dynamically
 * imports adapter.js so it picks up THIS test's mocks (module registry was
 * just reset in beforeEach).
 * @param {{
 *   fetchSuggestImpl: (csv: string, fineFoodGroup: string) => Promise<any>,
 *   itemTable?: Array<Object>,
 *   conditionTable?: Array<Object>,
 *   overlay?: Array<Object>,
 * }} opts
 */
async function setupAdapter({
  fetchSuggestImpl,
  itemTable = [],
  conditionTable = [{ healthConditionID: 9001, description: 'Test Condition' }],
  overlay = [],
} = {}) {
  vi.doMock('../../data/recipeOverlay.json', () => ({ default: overlay }));
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

// ── substituteFineGroup resolution (recipeToPlanCandidate, via getMealPlanSuggestions) ──

describe('recipeToPlanCandidate: substituteFineGroup resolution', () => {
  it('resolves the real fine group of the first overlay ingredient that has a foodItemID', async () => {
    const overlayRow = {
      name: 'Baked Salmon',
      sourceUrl: 'https://medlineplus.gov/recipes/baked-salmon',
      attribution: 'MedlinePlus',
      mealType: 'lunch',
      rawIngredients: ['1 lb salmon fillet', '1 tbsp olive oil'],
      ingredientFoodItemIds: [101, 202],
      servings: 4,
      nutritionPerServing: { calories: 320, protein: 28, carbs: 4, fat: 20 },
      totalTimeMinutes: 25,
      fineFoodGroup: 'l',
      foodItemID: 555,
    };
    const { getMealPlanSuggestions } = await setupAdapter({
      overlay: [overlayRow],
      fetchSuggestImpl: async (_csv, fineFoodGroup) =>
        fineFoodGroup === 'l'
          ? [{ foodItemID: 555, foodItemDisplayAs: 'Baked Salmon', descriptionNumericID: 1 }]
          : [],
      // Only the FIRST ingredient's foodItemID (101) resolves in the
      // dictionary — 202 is deliberately absent to prove it's never even
      // consulted once the first resolvable entry is found.
      itemTable: [{ foodItemID: 101, fineFoodGroup: 'b1' }],
    });

    const result = await getMealPlanSuggestions({ conditions: CONDITIONS });
    const candidate = result.candidates.lunch.find((c) => c.id === 555);
    expect(candidate).toBeDefined();
    expect(candidate.substituteFineGroup).toBe('b1');
    // Additive only — never touches the safety fields.
    expect(candidate.numericId).toBe(1);
    expect(candidate.tier).toBe('Top');
  });

  it('is null when no ingredient resolves to a known food item (honest degradation, never fabricated)', async () => {
    const { getMealPlanSuggestions } = await setupAdapter({
      fetchSuggestImpl: async (_csv, fineFoodGroup) =>
        fineFoodGroup === 'l'
          ? [{ foodItemID: 777, foodItemDisplayAs: 'Chicken Salad', descriptionNumericID: 2 }]
          : [],
      // No overlay row for 777 at all -> getRecipesRaw never attaches an
      // `ingredients` array to this recipe.
    });

    const result = await getMealPlanSuggestions({ conditions: CONDITIONS });
    const candidate = result.candidates.lunch.find((c) => c.id === 777);
    expect(candidate).toBeDefined();
    expect(candidate.substituteFineGroup).toBeNull();
  });
});

// ── getSlotSubstitutes ───────────────────────────────────────────────────────

describe('getSlotSubstitutes: same-group scoping for a food-kind item', () => {
  it('fetches substitutes from the item\'s own fineGroup, excluding the item itself', async () => {
    const { getSlotSubstitutes } = await setupAdapter({
      fetchSuggestImpl: async (_csv, fineFoodGroup) => {
        if (fineFoodGroup === 'e') {
          return [
            { foodItemID: 10, foodItemDisplayAs: 'Original Veg', descriptionNumericID: 1 },
            { foodItemID: 11, foodItemDisplayAs: 'Substitute Veg', descriptionNumericID: 2 },
          ];
        }
        return [];
      },
    });

    const slotItem = { id: 10, name: 'Original Veg', kind: 'food', fineGroup: 'e' };
    const result = await getSlotSubstitutes({ conditions: CONDITIONS }, [slotItem]);

    expect(result.bySourceItem).toHaveLength(1);
    const { sourceItem, substitutes } = result.bySourceItem[0];
    expect(sourceItem.id).toBe(10);
    expect(substitutes.map((s) => s.id)).toEqual([11]);
  });
});

describe('getSlotSubstitutes: recipe-kind item is scoped by substituteFineGroup, never its own "l" fineGroup', () => {
  it('requests the resolved substituteFineGroup and never the excluded recipe group', async () => {
    const requested = new Set();
    const { getSlotSubstitutes } = await setupAdapter({
      fetchSuggestImpl: async (_csv, fineFoodGroup) => {
        requested.add(fineFoodGroup);
        if (fineFoodGroup === 'b1') {
          return [{ foodItemID: 42, foodItemDisplayAs: 'Salmon Alternative', descriptionNumericID: 1 }];
        }
        return [];
      },
    });

    const slotItem = {
      id: 555,
      name: 'Baked Salmon',
      kind: 'recipe',
      fineGroup: 'l',
      substituteFineGroup: 'b1',
    };
    const result = await getSlotSubstitutes({ conditions: CONDITIONS }, [slotItem]);

    expect(requested.has('l')).toBe(false);
    expect(requested.has('b1')).toBe(true);
    expect(result.bySourceItem[0].substitutes.map((s) => s.id)).toEqual([42]);
  });
});

describe('getSlotSubstitutes: null substituteFineGroup degrades to an honest empty section', () => {
  it('makes no fetch for that item and returns it with an empty substitutes list, without affecting other items', async () => {
    const requested = new Set();
    const { getSlotSubstitutes } = await setupAdapter({
      fetchSuggestImpl: async (_csv, fineFoodGroup) => {
        requested.add(fineFoodGroup);
        if (fineFoodGroup === 'e') {
          return [{ foodItemID: 20, foodItemDisplayAs: 'Leafy Green', descriptionNumericID: 1 }];
        }
        return [];
      },
    });

    const recipeItem = { id: 999, name: 'Mystery Recipe', kind: 'recipe', fineGroup: 'l', substituteFineGroup: null };
    const foodItem = { id: 30, name: 'Carrot', kind: 'food', fineGroup: 'e' };
    const result = await getSlotSubstitutes({ conditions: CONDITIONS }, [recipeItem, foodItem]);

    expect(requested.has('l')).toBe(false);
    const recipeSection = result.bySourceItem.find((b) => b.sourceItem.id === 999);
    const foodSection = result.bySourceItem.find((b) => b.sourceItem.id === 30);
    expect(recipeSection.substitutes).toEqual([]);
    expect(foodSection.substitutes.map((s) => s.id)).toEqual([20]);
  });
});

describe('getSlotSubstitutes: numericId 1-4 Plan safety filter still applies', () => {
  it('never surfaces a harmful (5-7) or out-of-range item', async () => {
    const { getSlotSubstitutes } = await setupAdapter({
      fetchSuggestImpl: async (_csv, fineFoodGroup) => {
        if (fineFoodGroup === 'h2') {
          return [
            { foodItemID: 501, foodItemDisplayAs: 'Top Tea', descriptionNumericID: 1 },
            { foodItemID: 502, foodItemDisplayAs: 'Neutral Tea', descriptionNumericID: 4 },
            { foodItemID: 503, foodItemDisplayAs: 'Poor Tea', descriptionNumericID: 5 },
            { foodItemID: 504, foodItemDisplayAs: 'Bad Tea', descriptionNumericID: 6 },
            { foodItemID: 505, foodItemDisplayAs: 'Worst Tea', descriptionNumericID: 7 },
          ];
        }
        return [];
      },
    });

    const slotItem = { id: 9999, name: 'Current Beverage', kind: 'food', fineGroup: 'h2' };
    const result = await getSlotSubstitutes({ conditions: CONDITIONS }, [slotItem]);
    const ids = result.bySourceItem[0].substitutes.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining([501, 502]));
    expect(ids).not.toEqual(expect.arrayContaining([503, 504, 505]));
  });
});

describe('getSlotSubstitutes: excludes ids already present anywhere in the slot', () => {
  it('never suggests an item that already occupies a position in the slot', async () => {
    const { getSlotSubstitutes } = await setupAdapter({
      fetchSuggestImpl: async (_csv, fineFoodGroup) => {
        if (fineFoodGroup === 'e') {
          return [
            { foodItemID: 40, foodItemDisplayAs: 'Existing A', descriptionNumericID: 1 },
            { foodItemID: 45, foodItemDisplayAs: 'Existing B', descriptionNumericID: 1 },
            { foodItemID: 46, foodItemDisplayAs: 'Fresh Substitute', descriptionNumericID: 2 },
          ];
        }
        return [];
      },
    });

    const itemA = { id: 40, name: 'Existing A', kind: 'food', fineGroup: 'e' };
    const itemB = { id: 45, name: 'Existing B', kind: 'food', fineGroup: 'e' };
    const result = await getSlotSubstitutes({ conditions: CONDITIONS }, [itemA, itemB]);

    for (const { substitutes } of result.bySourceItem) {
      const ids = substitutes.map((s) => s.id);
      expect(ids).not.toContain(40);
      expect(ids).not.toContain(45);
      expect(ids).toContain(46);
    }
  });
});

describe('getSlotSubstitutes: partial failure — some groups fail, others succeed', () => {
  it('degrades honestly per source item instead of failing the whole call', async () => {
    const itemA = { id: 1, name: 'Item A', kind: 'food', fineGroup: 'e' };
    const itemB = { id: 2, name: 'Item B', kind: 'food', fineGroup: 'h2' };
    const { getSlotSubstitutes } = await setupAdapter({
      fetchSuggestImpl: async (_csv, fineFoodGroup) => {
        if (fineFoodGroup === 'e') throw new Error('suggest failed for e');
        if (fineFoodGroup === 'h2') {
          return [{ foodItemID: 501, foodItemDisplayAs: 'Green Tea', descriptionNumericID: 2 }];
        }
        return [];
      },
    });

    const result = await getSlotSubstitutes({ conditions: CONDITIONS }, [itemA, itemB]);
    const sectionA = result.bySourceItem.find((b) => b.sourceItem.id === 1);
    const sectionB = result.bySourceItem.find((b) => b.sourceItem.id === 2);
    expect(sectionA.substitutes).toEqual([]);
    expect(sectionB.substitutes.map((s) => s.id)).toEqual([501]);
  });
});

describe('getSlotSubstitutes: total failure — every fetched group rejects', () => {
  it('throws instead of resolving with all-empty substitutes ("no results" must never look like a real answer)', async () => {
    const itemA = { id: 1, name: 'Item A', kind: 'food', fineGroup: 'e' };
    const itemB = { id: 2, name: 'Item B', kind: 'food', fineGroup: 'h2' };
    const { getSlotSubstitutes } = await setupAdapter({
      fetchSuggestImpl: async () => {
        throw new Error('network down: total outage');
      },
    });

    await expect(getSlotSubstitutes({ conditions: CONDITIONS }, [itemA, itemB])).rejects.toThrow('total outage');
  });

  it('resolves (does not throw) when every item resolves to no scoping group at all — that is honestly empty, not an outage', async () => {
    const { getSlotSubstitutes } = await setupAdapter({
      fetchSuggestImpl: async () => {
        throw new Error('should never be called');
      },
    });

    const recipeItem = { id: 999, name: 'Mystery Recipe', kind: 'recipe', fineGroup: 'l', substituteFineGroup: null };
    const result = await getSlotSubstitutes({ conditions: CONDITIONS }, [recipeItem]);
    expect(result.bySourceItem[0].substitutes).toEqual([]);
  });
});
