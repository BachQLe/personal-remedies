/**
 * adapter.dessertPool.test.js — Guard tests for Task C1 (Sept 2026):
 * dessert recipes are eligible for the `snacks` Plan slot (never a separate
 * Dessert slot — snacks and desserts share one slot/listing, per the
 * product decision quoted in adapter.js's `getRecipesRaw` doc), AND
 * `guessMealType`/`RECIPE_MEAL_TYPE_KEYWORDS` never guesses `'dessert'` on
 * their own — only a human-curated C1 overlay row may assign it, the exact
 * same invariant `adapter.beveragesPool.test.js` guards for `'beverage'`.
 *
 * Uses the same `vi.doMock` + dynamic `import()` idiom as
 * adapter.recipeOverlay.test.js so each test controls the overlay content
 * (src/data/recipeOverlay.json) and the mocked /suggest responses
 * (../nutridigm.js) without leaking adapter.js's module-level caches
 * between cases.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.doUnmock('../../data/recipeOverlay.json');
  vi.doUnmock('../nutridigm.js');
  vi.doUnmock('../localTables.js');
});

/**
 * Mocks the overlay file + fetch/dictionary layers, then dynamically
 * imports adapter.js so it picks up THIS test's mocks. Mirrors
 * adapter.recipeOverlay.test.js's `setupAdapter` helper.
 * @param {{ overlay?: Array<Object>, suggestResponses?: Record<string, Array<Object>> }} opts
 */
async function setupAdapter({ overlay = [], suggestResponses = {} } = {}) {
  vi.doMock('../../data/recipeOverlay.json', () => ({ default: overlay }));
  vi.doMock('../nutridigm.js', () => ({
    fetchSuggest: vi.fn(async (_csv, fineFoodGroup) => suggestResponses[fineFoodGroup] ?? []),
    fetchGoodFor: vi.fn(),
    fetchTopDoOrDonts: vi.fn(),
    fetchDetailed: vi.fn(),
    fetchReferences: vi.fn(),
    NutridigmAuthError: class NutridigmAuthError extends Error {},
  }));
  vi.doMock('../localTables.js', () => ({
    getItemTable: vi.fn(() => []),
    getConditionTable: vi.fn(() => [{ healthConditionID: 9001, description: 'Test Condition' }]),
    getGroupTable: vi.fn(() => []),
    getOverlayImageFile: vi.fn(() => undefined),
  }));
  return import('../adapter.js');
}

describe('guessMealType never returns "dessert" — only a curated overlay row may', () => {
  it('every dessert-sounding keyword still maps to "snack", never "dessert"', async () => {
    const { guessMealType } = await setupAdapter();
    const dessertSoundingTitles = [
      'Chocolate Cake',
      'Chocolate Chip Cookie',
      'Apple Pie',
      'Fudge Brownie',
      'Rice Pudding',
      'Fruit Tart',
      'Vanilla Ice Cream',
      'New York Cheesecake',
      'Blueberry Muffin',
    ];
    for (const title of dessertSoundingTitles) {
      expect(guessMealType(title)).toBe('snack');
      expect(guessMealType(title)).not.toBe('dessert');
    }
  });

  it('no title at all produces "dessert" via the keyword heuristic', async () => {
    const { guessMealType } = await setupAdapter();
    // Sweep every mealType the heuristic can produce — 'dessert' must never
    // be among them, mirroring how 'beverage' never is either.
    const titles = ['Oatmeal', 'Chili', 'Salad', 'Chocolate Cake', 'Random Title With No Keywords'];
    for (const title of titles) {
      expect(guessMealType(title)).not.toBe('dessert');
    }
  });
});

describe('getRecipes: a curated overlay row IS the only way a recipe lands as "dessert"', () => {
  it('overlay mealType "dessert" wins over the keyword guess ("cake" -> snack)', async () => {
    const dessertRow = {
      name: 'Chocolate Cake',
      sourceUrl: 'https://example.com/chocolate-cake',
      mealType: 'dessert',
      fineFoodGroup: 'l',
      foodItemID: 601,
    };
    const { getRecipes } = await setupAdapter({
      overlay: [dessertRow],
      suggestResponses: {
        l: [{ foodItemID: 601, foodItemDisplayAs: 'Chocolate Cake', descriptionNumericID: 1 }],
      },
    });
    const { recipes } = await getRecipes({ conditions: [9001] });
    expect(recipes).toHaveLength(1);
    expect(recipes[0].mealType).toBe('dessert');
  });
});

describe('getMealPlanSuggestions: the "snacks" slot pools BOTH snack- and dessert-mealType recipes', () => {
  it('a dessert-overlay recipe is eligible for the snacks slot candidates, not a separate dessert slot', async () => {
    const dessertRow = {
      name: 'Chocolate Cake',
      sourceUrl: 'https://example.com/chocolate-cake',
      mealType: 'dessert',
      fineFoodGroup: 'l',
      foodItemID: 601,
    };
    const { getMealPlanSuggestions } = await setupAdapter({
      overlay: [dessertRow],
      suggestResponses: {
        l: [{ foodItemID: 601, foodItemDisplayAs: 'Chocolate Cake', descriptionNumericID: 1 }],
      },
    });
    const result = await getMealPlanSuggestions({ conditions: [9001] });

    const snackIds = result.candidates.snacks.map((c) => c.id);
    expect(snackIds).toContain(601);

    // No slot key besides 'snacks' exists to hold it — PLAN_SLOT_KEYS has
    // no 'dessert'/'desserts' entry, so there is nowhere else it could land.
    expect(Object.keys(result.candidates)).not.toContain('dessert');
    expect(Object.keys(result.candidates)).not.toContain('desserts');
  });

  it('a plain snack-mealType recipe (guessMealType keyword hit) still lands in snacks too, alongside dessert', async () => {
    const { getMealPlanSuggestions } = await setupAdapter({
      suggestResponses: {
        // guessMealType('Protein Bar') -> 'bar' keyword -> 'snack'
        l: [{ foodItemID: 602, foodItemDisplayAs: 'Protein Bar', descriptionNumericID: 2 }],
      },
    });
    const result = await getMealPlanSuggestions({ conditions: [9001] });
    const snackIds = result.candidates.snacks.map((c) => c.id);
    expect(snackIds).toContain(602);
  });
});
