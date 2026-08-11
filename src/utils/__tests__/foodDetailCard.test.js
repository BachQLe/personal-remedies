/**
 * FoodDetailCard.test.js — Guards the pure helpers extracted from
 * FoodDetailCard.jsx into src/utils/foodDetailCard.js for Task T4B (this
 * codebase has no @testing-library/react-style render harness, so
 * component logic worth guarding gets pulled into plain functions and
 * tested directly instead — and living in their own module keeps
 * FoodDetailCard.jsx export-clean for eslint's
 * react-refresh/only-export-components rule):
 *
 *   - `resolveIsRecipe` — the isRecipe heuristic, now independent of the
 *     removed legacy `.ingredients` alias (recipeDetail.js no longer
 *     publishes it at all as of this task).
 *   - `resolveRecipeLinkTarget` — the link-out decision (sourceUrl always
 *     wins over the Google-search fallback, never shown as equals) that
 *     feeds `openUrl` (src/api/browser.js) instead of a raw `window.open`.
 */
import { describe, expect, it } from 'vitest';
import { resolveIsRecipe, resolveRecipeLinkTarget } from '../foodDetailCard.js';

describe('resolveIsRecipe', () => {
  it('returns false for a null/undefined item', () => {
    expect(resolveIsRecipe(null)).toBe(false);
    expect(resolveIsRecipe(undefined)).toBe(false);
  });

  it('honors an explicit isRecipe flag over every other signal', () => {
    expect(resolveIsRecipe({ isRecipe: true })).toBe(true);
    expect(resolveIsRecipe({ isRecipe: false, sourceName: 'Food Network' })).toBe(false);
    // Every real recipe-opening call site (RecipesScreen, SearchScreen,
    // SuggestionsScreen, MealQueueScreen, MealPlannerPicker,
    // MealprepCarousel) sets this explicitly both on the initial seed and
    // after buildRecipeDetail enrichment.
    expect(resolveIsRecipe({ isRecipe: true, topFoodsForConditions: [] })).toBe(true);
  });

  it('falls back to kind when isRecipe is absent', () => {
    expect(resolveIsRecipe({ kind: 'recipe' })).toBe(true);
    expect(resolveIsRecipe({ kind: 'food' })).toBe(false);
  });

  it('falls back to mealType (a Recipe-only field) when isRecipe/kind are absent', () => {
    expect(resolveIsRecipe({ mealType: 'Breakfast' })).toBe(true);
  });

  it('falls back to sourceName presence as a last resort', () => {
    expect(resolveIsRecipe({ sourceName: 'Food Network' })).toBe(true);
    expect(resolveIsRecipe({ sourceName: null })).toBe(false);
  });

  it('resolves false for the bare {foodId, name} seeds real call sites use for plain foods', () => {
    // GroupDetailScreen, SuggestionsScreen (Top Dos & Don'ts / Food Groups
    // tabs), SearchScreen's openFood — none of these set isRecipe/kind/
    // mealType/sourceName at all.
    expect(resolveIsRecipe({ foodId: 42, name: 'Spinach' })).toBe(false);
  });

  it('does not resolve true just because a legacy-shaped .ingredients array is present', () => {
    // The old heuristic depended on `.ingredients?.length > 0`; that field
    // is gone from recipeDetail.js's payload entirely now, and this
    // shouldn't resurrect it as a signal even if some other object happens
    // to carry a same-named field.
    expect(resolveIsRecipe({ ingredients: [{ name: 'Salmon' }] })).toBe(false);
  });
});

describe('resolveRecipeLinkTarget', () => {
  it('prefers sourceUrl, embedding the attribution in the label', () => {
    const target = resolveRecipeLinkTarget({
      sourceUrl: 'https://medlineplus.gov/recipes/baked-salmon',
      attribution: 'MedlinePlus',
      name: 'Baked Salmon',
      sourceName: 'Food Network',
    });
    expect(target).toEqual({
      url: 'https://medlineplus.gov/recipes/baked-salmon',
      label: 'View recipe at MedlinePlus',
      isSource: true,
    });
  });

  it('falls back to a hostname-derived label when sourceUrl exists but attribution does not', () => {
    const target = resolveRecipeLinkTarget({
      sourceUrl: 'https://www.medlineplus.gov/recipes/baked-salmon',
    });
    expect(target.label).toBe('View recipe at medlineplus.gov');
    expect(target.isSource).toBe(true);
  });

  it('falls back to the Google-search behavior/label when sourceUrl is absent', () => {
    const target = resolveRecipeLinkTarget({ name: 'Baked Salmon', sourceName: 'Food Network' });
    expect(target.isSource).toBe(false);
    expect(target.label).toBe('Get the recipe');
    expect(target.url).toBe(
      `https://www.google.com/search?q=${encodeURIComponent('Baked Salmon Food Network recipe')}`
    );
  });

  it('defaults sourceName to "Food Network" in the search fallback when absent', () => {
    const target = resolveRecipeLinkTarget({ name: 'Mystery Dish' });
    expect(target.url).toBe(
      `https://www.google.com/search?q=${encodeURIComponent('Mystery Dish Food Network recipe')}`
    );
  });

  it('never shows both link options as equals — sourceUrl always wins when present', () => {
    const target = resolveRecipeLinkTarget({
      sourceUrl: 'https://medlineplus.gov/x',
      attribution: 'MedlinePlus',
      name: 'X',
      sourceName: 'Food Network',
    });
    expect(target.url).not.toContain('google.com');
  });

  it('handles a missing/null item without throwing', () => {
    expect(() => resolveRecipeLinkTarget(null)).not.toThrow();
    expect(resolveRecipeLinkTarget(null).isSource).toBe(false);
  });
});
