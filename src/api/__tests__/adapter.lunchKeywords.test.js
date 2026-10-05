/**
 * adapter.lunchKeywords.test.js — regression guard for Task 4 ("no choices
 * appear for Lunch").
 *
 * Root cause: `guessMealType` (adapter.js) defaults any recipe title
 * matching no keyword to 'dinner', and the lunch bucket in
 * `RECIPE_MEAL_TYPE_KEYWORDS` used to hold only 'salad'/'sandwich'/'wrap'.
 * Against the real recipe dictionary (fine group 'l' in
 * src/data/cache/items.json) that classified only 2 of 54 recipes as lunch,
 * starving the lunch Plan slot's (recipes-only) candidate pool — see
 * `getMealPlanSuggestionsRaw`'s doc for why that slot never draws from plain
 * food items. This test locks in the fix: 'soup' and 'taco' titles (both
 * present in the real dictionary and previously misclassified as 'dinner')
 * now resolve to 'lunch'.
 *
 * Mocking idiom matches adapter.mealPlanOutage.test.js.
 */
import { describe, expect, it, vi } from 'vitest';

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
  getConditionTable: vi.fn(() => [{ healthConditionID: 9001, description: 'Test Condition' }]),
  getGroupTable: vi.fn(() => []),
  getOverlayImageFile: vi.fn(() => undefined),
}));

import { fetchSuggest } from '../nutridigm.js';
import { getMealPlanSuggestions } from '../adapter.js';

describe('getMealPlanSuggestions: lunch mealType classification (Task 4 fix)', () => {
  it('a real dictionary-style soup/taco recipe title lands in the lunch slot, not dinner', async () => {
    fetchSuggest.mockImplementation(async (_csv, fineFoodGroup) => {
      if (fineFoodGroup === 'l') {
        return [
          { foodItemID: 900, foodItemDisplayAs: 'Garden Vegetable Soup', descriptionNumericID: 2 },
          { foodItemID: 901, foodItemDisplayAs: 'Fish Tacos', descriptionNumericID: 1 },
        ];
      }
      return [];
    });

    const result = await getMealPlanSuggestions({ conditions: [9001] });

    expect(result.candidates.lunch.some((c) => c.id === 900)).toBe(true);
    expect(result.candidates.lunch.some((c) => c.id === 901)).toBe(true);
    expect(result.candidates.dinner.some((c) => c.id === 900)).toBe(false);
    expect(result.candidates.dinner.some((c) => c.id === 901)).toBe(false);
  });
});

describe('getMealPlanSuggestions: lunch rail blank fix (#8/#13) keyword corrections', () => {
  it('the dictionary typo "American Macaroni Salald" lands in lunch as primary (overlay alsoFits adds dinner as secondary)', async () => {
    fetchSuggest.mockImplementation(async (_csv, fineFoodGroup) => {
      if (fineFoodGroup === 'l') {
        return [
          { foodItemID: 5003, foodItemDisplayAs: 'American Macaroni Salald', descriptionNumericID: 2 },
        ];
      }
      return [];
    });

    // Distinct condition id per test in this file — `recipes:{csv}:l` is
    // cached by adapter.js's `cachedFetch` for the whole module lifetime
    // (which spans this entire test file), so reusing condition 9001 here
    // would silently serve an EARLIER test's cached /suggest('l') response
    // instead of this test's mock.
    const result = await getMealPlanSuggestions({ conditions: [9101] });

    expect(result.candidates.lunch.some((c) => c.id === 5003)).toBe(true);
    // recipeOverlay.json row 5003 is mealType 'lunch' + alsoFits ['dinner'],
    // and Task D (Sept 2026) feeds alsoFits into secondary slots on purpose.
    // So it legitimately ALSO appears in dinner — but only as a secondary
    // match, never ahead of its primary lunch slot, and never in snacks.
    expect(result.candidates.snacks.some((c) => c.id === 5003)).toBe(false);
  });

  it('"Chicken Pot Pie (no crust)" lands in dinner, not snacks (pot pie is a dish, not a dessert)', async () => {
    fetchSuggest.mockImplementation(async (_csv, fineFoodGroup) => {
      if (fineFoodGroup === 'l') {
        return [
          { foodItemID: 5039, foodItemDisplayAs: 'Chicken Pot Pie (no crust)', descriptionNumericID: 1 },
        ];
      }
      return [];
    });

    const result = await getMealPlanSuggestions({ conditions: [9102] });

    expect(result.candidates.dinner.some((c) => c.id === 5039)).toBe(true);
    expect(result.candidates.snacks.some((c) => c.id === 5039)).toBe(false);
  });

  it('a plain "pie" title (no "pot pie") still lands as a snack — the pot-pie fix does not swallow real desserts', async () => {
    fetchSuggest.mockImplementation(async (_csv, fineFoodGroup) => {
      if (fineFoodGroup === 'l') {
        return [{ foodItemID: 5099, foodItemDisplayAs: 'Apple Pie', descriptionNumericID: 1 }];
      }
      return [];
    });

    const result = await getMealPlanSuggestions({ conditions: [9103] });

    expect(result.candidates.snacks.some((c) => c.id === 5099)).toBe(true);
    expect(result.candidates.dinner.some((c) => c.id === 5099)).toBe(false);
  });
});

describe('getMealPlanSuggestions: lunch top-up from defaulted-dinner recipes (Task 1c)', () => {
  it('fills lunch up to its slot size from dinner recipes that only defaulted to dinner (no keyword match), without removing them from dinner', async () => {
    fetchSuggest.mockImplementation(async (_csv, fineFoodGroup) => {
      if (fineFoodGroup === 'l') {
        return [
          // No keyword-lunch recipes at all.
          { foodItemID: 700, foodItemDisplayAs: 'Pasta e Fagioli', descriptionNumericID: 1 }, // defaults to dinner
          { foodItemID: 701, foodItemDisplayAs: 'Hash Brown Casserole', descriptionNumericID: 2 }, // defaults to dinner
          { foodItemID: 702, foodItemDisplayAs: 'Zucchini Parmesan Crisps', descriptionNumericID: 3 }, // defaults to dinner
          { foodItemID: 703, foodItemDisplayAs: 'Sauteed Kale', descriptionNumericID: 2 }, // defaults to dinner (4th default -- should NOT be needed, lunch size is 3)
          { foodItemID: 704, foodItemDisplayAs: 'Slow-Cooker Beef Roast', descriptionNumericID: 1 }, // real 'roast' keyword -> dinner, NOT defaulted
        ];
      }
      return [];
    });

    const result = await getMealPlanSuggestions({ conditions: [9104] });

    // Lunch slot size is 3 (PLAN_SLOTS) — zero real lunch matches, so it's
    // topped up from the defaulted-dinner pool, in dinner's existing order,
    // up to size 3.
    expect(result.candidates.lunch.length).toBe(3);
    expect(result.candidates.lunch.map((c) => c.id)).toEqual([700, 701, 702]);

    // The real 'roast' keyword match (never defaulted) must NOT be used to
    // top up lunch.
    expect(result.candidates.lunch.some((c) => c.id === 704)).toBe(false);

    // Dinner keeps every one of its own candidates — the top-up is additive,
    // never a move.
    expect(result.candidates.dinner.map((c) => c.id)).toEqual([700, 701, 702, 703, 704]);
  });

  it('does not top up lunch when it already meets the slot size from real keyword matches', async () => {
    fetchSuggest.mockImplementation(async (_csv, fineFoodGroup) => {
      if (fineFoodGroup === 'l') {
        return [
          { foodItemID: 800, foodItemDisplayAs: 'Chicken Caesar Salad', descriptionNumericID: 1 },
          { foodItemID: 801, foodItemDisplayAs: 'Turkey Sandwich', descriptionNumericID: 1 },
          { foodItemID: 802, foodItemDisplayAs: 'Veggie Wrap', descriptionNumericID: 1 },
          { foodItemID: 803, foodItemDisplayAs: 'Mystery Casserole', descriptionNumericID: 1 }, // defaults to dinner
        ];
      }
      return [];
    });

    const result = await getMealPlanSuggestions({ conditions: [9105] });

    expect(result.candidates.lunch.map((c) => c.id).sort()).toEqual([800, 801, 802]);
    expect(result.candidates.lunch.some((c) => c.id === 803)).toBe(false);
  });
});
