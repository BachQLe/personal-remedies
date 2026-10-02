// @vitest-environment jsdom
/**
 * RecipesScreen.test.js — guards `matchesMealFilter`, the pure predicate
 * behind RecipesScreen's "Meal type" tab filter (Task C1, Sept 2026).
 *
 * Product decision (verbatim): "Snacks and deserts are going to be shown at
 * once. But theyre going to have different tags. So yeah add as another
 * meal type." — `dessert` is a real, distinct `mealType` in the data
 * (recipeIngestion.js's MEAL_TYPES), but there is no separate Dessert tab:
 * the `Snack` tab matches BOTH `'snack'` and `'dessert'` recipes, shown
 * together in one list and told apart by `MEAL_TAG_CONFIG`'s card pill
 * instead (covered visually, not here — this file is the filter logic
 * only, matching this repo's convention of testing extracted pure functions
 * rather than mounting screens; see adapter.js's `guessMealType` for the
 * same pattern).
 */
import { describe, expect, it } from 'vitest';
import { matchesMealFilter, mealFilterFromSearchParams } from '../RecipesScreen.jsx';

describe('matchesMealFilter — "All" matches everything', () => {
  it('matches every mealType, including dessert and undefined', () => {
    expect(matchesMealFilter('breakfast', 'All')).toBe(true);
    expect(matchesMealFilter('dessert', 'All')).toBe(true);
    expect(matchesMealFilter(undefined, 'All')).toBe(true);
  });
});

describe('matchesMealFilter — "Snack" tab includes both snack AND dessert recipes', () => {
  it('matches a snack recipe', () => {
    expect(matchesMealFilter('snack', 'Snack')).toBe(true);
  });

  it('matches a dessert recipe — the C1 product decision: shown together, no separate Dessert tab', () => {
    expect(matchesMealFilter('dessert', 'Snack')).toBe(true);
  });

  it('is case-insensitive on the recipe mealType side', () => {
    expect(matchesMealFilter('Dessert', 'Snack')).toBe(true);
    expect(matchesMealFilter('SNACK', 'Snack')).toBe(true);
  });

  it('does not match an unrelated mealType', () => {
    expect(matchesMealFilter('breakfast', 'Snack')).toBe(false);
    expect(matchesMealFilter('dinner', 'Snack')).toBe(false);
    expect(matchesMealFilter('beverage', 'Snack')).toBe(false);
  });
});

describe('matchesMealFilter — every other tab matches only its own mealType', () => {
  it('Breakfast/Lunch/Dinner each match only their own mealType, never dessert', () => {
    expect(matchesMealFilter('breakfast', 'Breakfast')).toBe(true);
    expect(matchesMealFilter('lunch', 'Lunch')).toBe(true);
    expect(matchesMealFilter('dinner', 'Dinner')).toBe(true);
    expect(matchesMealFilter('dessert', 'Breakfast')).toBe(false);
    expect(matchesMealFilter('dessert', 'Lunch')).toBe(false);
    expect(matchesMealFilter('dessert', 'Dinner')).toBe(false);
  });

  it('a recipe with no mealType at all matches no specific tab', () => {
    expect(matchesMealFilter(undefined, 'Breakfast')).toBe(false);
    expect(matchesMealFilter(undefined, 'Snack')).toBe(false);
  });
});

/**
 * mealFilterFromSearchParams — seeds the initial `mealFilter` tab from the
 * `?meal=` query param FoodDetailCard's recipe "other options" link lands
 * with (Wave 3 Suggest tie-in). Must validate against the real MEAL_TYPES
 * labels and fall back to 'All' for anything it doesn't recognize, rather
 * than ever filtering the screen on an unvetted string straight from a URL.
 */
describe('mealFilterFromSearchParams', () => {
  it('falls back to All when there is no meal param at all', () => {
    expect(mealFilterFromSearchParams(new URLSearchParams())).toBe('All');
  });

  it('resolves a recognized label to itself', () => {
    expect(mealFilterFromSearchParams(new URLSearchParams('meal=Dinner'))).toBe('Dinner');
    expect(mealFilterFromSearchParams(new URLSearchParams('meal=Breakfast'))).toBe('Breakfast');
    expect(mealFilterFromSearchParams(new URLSearchParams('meal=Snack'))).toBe('Snack');
  });

  it('is case-insensitive', () => {
    expect(mealFilterFromSearchParams(new URLSearchParams('meal=dinner'))).toBe('Dinner');
    expect(mealFilterFromSearchParams(new URLSearchParams('meal=SNACK'))).toBe('Snack');
  });

  it('falls back to All for an unrecognized or garbage value', () => {
    expect(mealFilterFromSearchParams(new URLSearchParams('meal=Dessert'))).toBe('All');
    expect(mealFilterFromSearchParams(new URLSearchParams('meal=beverage'))).toBe('All');
    expect(mealFilterFromSearchParams(new URLSearchParams('meal=xyz'))).toBe('All');
  });
});
