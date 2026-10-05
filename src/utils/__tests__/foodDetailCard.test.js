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
 *   - `groupConditionsByVerdict` / `orderVerdictGroups` — the front face's
 *     "Best for:" chip-row fix: every entry in `perCondition` now lands in
 *     a Helps/Neutral/Avoid for bucket (never silently dropped), and the
 *     buckets render in a caller-selectable order.
 *   - `deriveAssessStatus` — the back face's loading/success/empty/error
 *     classification fix: a genuine empty result, an API error, and a
 *     timeout must render honestly different states, not the same
 *     "No data for this item" blank.
 */
import { describe, expect, it } from 'vitest';
import {
  resolveIsRecipe,
  resolveRecipeLinkTarget,
  groupConditionsByVerdict,
  orderVerdictGroups,
  deriveAssessStatus,
} from '../foodDetailCard.js';

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
    expect(target.label).toBe('Open recipe');
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

describe('groupConditionsByVerdict', () => {
  it('buckets every entry — nothing is dropped like the old tier-filtered list did', () => {
    const perCondition = [
      { conditionName: 'Diabetes', numericId: 1, referenceCount: 2 },
      { conditionName: 'Hypertension', numericId: 4, referenceCount: 0 },
      { conditionName: 'Aging', numericId: 7, referenceCount: 5 },
    ];
    const grouped = groupConditionsByVerdict(perCondition);
    expect(grouped.helps).toEqual(['Diabetes']);
    expect(grouped.neutral).toEqual(['Hypertension']);
    expect(grouped.avoid).toEqual(['Aging']);
  });

  it('treats a null/undefined/out-of-range numericId as neutral, same as an explicit 4', () => {
    const perCondition = [
      { conditionName: 'No data A', numericId: null },
      { conditionName: 'No data B', numericId: undefined },
      { conditionName: 'Out of range', numericId: 9 },
      { conditionName: 'Explicit neutral', numericId: 4 },
    ];
    const grouped = groupConditionsByVerdict(perCondition);
    expect(grouped.helps).toEqual([]);
    expect(grouped.avoid).toEqual([]);
    expect(grouped.neutral).toEqual(['No data A', 'No data B', 'Out of range', 'Explicit neutral']);
  });

  it('sorts each bucket by referenceCount descending (more evidence first)', () => {
    const perCondition = [
      { conditionName: 'Few studies', numericId: 2, referenceCount: 1 },
      { conditionName: 'Many studies', numericId: 1, referenceCount: 9 },
      { conditionName: 'No studies', numericId: 3, referenceCount: 0 },
    ];
    const grouped = groupConditionsByVerdict(perCondition);
    expect(grouped.helps).toEqual(['Many studies', 'Few studies', 'No studies']);
  });

  it('handles an empty/missing perCondition without throwing', () => {
    expect(groupConditionsByVerdict([])).toEqual({ helps: [], neutral: [], avoid: [] });
    expect(groupConditionsByVerdict(undefined)).toEqual({ helps: [], neutral: [], avoid: [] });
  });

  it('skips a row with no conditionName rather than rendering a blank chip', () => {
    const grouped = groupConditionsByVerdict([{ numericId: 1 }, { conditionName: 'Real', numericId: 1 }]);
    expect(grouped.helps).toEqual(['Real']);
  });
});

describe('orderVerdictGroups', () => {
  const grouped = { helps: ['A'], neutral: ['B'], avoid: ['C'] };

  it('defaults to Helps → Neutral → Avoid for when listType is unset', () => {
    expect(orderVerdictGroups(grouped).map((g) => g.key)).toEqual(['helps', 'neutral', 'avoid']);
  });

  it('defaults to the same order for listType "helpful"', () => {
    expect(orderVerdictGroups(grouped, 'helpful').map((g) => g.key)).toEqual(['helps', 'neutral', 'avoid']);
  });

  it('leads with "Avoid for" when listType is "harmful"', () => {
    expect(orderVerdictGroups(grouped, 'harmful').map((g) => g.key)).toEqual(['avoid', 'helps', 'neutral']);
  });

  it('drops empty groups rather than rendering an empty label row', () => {
    const partial = { helps: ['A'], neutral: [], avoid: [] };
    expect(orderVerdictGroups(partial).map((g) => g.key)).toEqual(['helps']);
    expect(orderVerdictGroups({ helps: [], neutral: [], avoid: [] })).toEqual([]);
  });

  it('carries the display label alongside each group', () => {
    const result = orderVerdictGroups(grouped);
    expect(result.find((g) => g.key === 'avoid').label).toBe('Ranked lower for:');
  });
});

describe('deriveAssessStatus', () => {
  it('returns "error" for a rejected/failed settlement (network error or timeout)', () => {
    expect(deriveAssessStatus({ ok: false })).toBe('error');
    expect(deriveAssessStatus(undefined)).toBe('error');
  });

  it('returns "success" when the assessment resolved with a non-empty perCondition', () => {
    expect(deriveAssessStatus({ ok: true, value: { perCondition: [{ conditionName: 'A' }] } })).toBe('success');
  });

  it('returns "empty" for a genuinely empty resolved result — never conflated with "error"', () => {
    expect(deriveAssessStatus({ ok: true, value: { perCondition: [] } })).toBe('empty');
    expect(deriveAssessStatus({ ok: true, value: null })).toBe('empty');
    expect(deriveAssessStatus({ ok: true, value: {} })).toBe('empty');
  });
});

describe('groupConditionsByVerdict unscorable rows', () => {
  it('omits non-ok (unauthorized) rows from every verdict bucket', () => {
    const out = groupConditionsByVerdict([
      { conditionName: 'Aging', numericId: 2, status: 'ok' },
      { conditionName: 'Other', numericId: null, status: 'unauthorized' },
    ]);
    expect(out).toEqual({ helps: ['Aging'], neutral: [], avoid: [] });
  });
});
