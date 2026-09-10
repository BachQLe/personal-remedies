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
