// @vitest-environment jsdom
/**
 * FoodDetailCard.test.js — Guards the two pure helpers behind Wave 3's
 * "other options" link (Mory: "the link that says better/other options...
 * from the same food group as the card is wonderful"):
 *
 *   - `resolveGroupLinkTarget` — the plain-FOOD link's fine→coarse→nothing
 *     fallback chain (fine group wins unless it's in EXCLUDED_FINE_GROUPS,
 *     else coarse, else no link at all), reading group/fineGroup off the
 *     same assessment→facts→item layering the file's non-food icon lookup
 *     uses.
 *   - `mealTypeToRecipesHref` — the RECIPE link's mealType→`?meal=` tab
 *     mapping, including the dessert→Snack rule (RecipesScreen.jsx's Task
 *     C1 decision) and the missing/unmappable→no-param fallback.
 *
 * Exported directly from FoodDetailCard.jsx (not split into
 * utils/foodDetailCard.js) — see the comment above `resolveGroupLinkTarget`
 * in that file for why: this task's file ownership is scoped to
 * FoodDetailCard.jsx/RecipesScreen.jsx only, and RecipesScreen.jsx's own
 * exported `matchesMealFilter` is the precedent being followed here
 * instead.
 */
import { describe, expect, it } from 'vitest';
import { resolveGroupLinkTarget, mealTypeToRecipesHref } from '../../utils/foodDetailCard.js';

describe('resolveGroupLinkTarget — fine group wins when it resolves and is not excluded', () => {
  it('links to the fine group page when item.fineGroup is a real, non-excluded code', () => {
    expect(resolveGroupLinkTarget({ fineGroup: 'b1', group: 'b' }, null, null)).toEqual({
      path: '/app/suggestions/fine/b1',
      code: 'b1',
      kind: 'fine',
    });
  });

  it('prefers assessment.food over facts over item (same layering as the non-food icon lookup)', () => {
    const item = { fineGroup: 'item-fine', group: 'item-coarse' };
    const facts = { fineGroup: 'facts-fine', group: 'facts-coarse' };
    const assessment = { food: { fineGroup: 'assess-fine', group: 'assess-coarse' } };
    expect(resolveGroupLinkTarget(item, facts, assessment).code).toBe('assess-fine');
    expect(resolveGroupLinkTarget(item, facts, null).code).toBe('facts-fine');
    expect(resolveGroupLinkTarget(item, null, null).code).toBe('item-fine');
  });
});

describe('resolveGroupLinkTarget — excluded fine groups fall back to coarse', () => {
  it('falls back to the coarse group when fineGroup is x, j1, or l', () => {
    expect(resolveGroupLinkTarget({ fineGroup: 'x', group: 'k' }, null, null)).toEqual({
      path: '/app/suggestions/group/k',
      code: 'k',
      kind: 'coarse',
    });
    expect(resolveGroupLinkTarget({ fineGroup: 'j1', group: 'k' }, null, null).kind).toBe('coarse');
    expect(resolveGroupLinkTarget({ fineGroup: 'l', group: 'g' }, null, null).kind).toBe('coarse');
  });
});

describe('resolveGroupLinkTarget — no group at all renders no link', () => {
  it('returns null when neither fineGroup nor group resolves', () => {
    expect(resolveGroupLinkTarget({}, null, null)).toBeNull();
    expect(resolveGroupLinkTarget(null, null, null)).toBeNull();
  });

  it('returns null when only an excluded fineGroup resolves and no coarse group backs it up', () => {
    expect(resolveGroupLinkTarget({ fineGroup: 'x' }, null, null)).toBeNull();
  });
});

describe('mealTypeToRecipesHref — maps a recipe mealType to its MEAL_TYPES tab', () => {
  it('maps the direct 1:1 mealTypes to their matching tab', () => {
    expect(mealTypeToRecipesHref('breakfast')).toBe('/app/recipes?meal=Breakfast');
    expect(mealTypeToRecipesHref('lunch')).toBe('/app/recipes?meal=Lunch');
    expect(mealTypeToRecipesHref('dinner')).toBe('/app/recipes?meal=Dinner');
    expect(mealTypeToRecipesHref('snack')).toBe('/app/recipes?meal=Snack');
  });

  it('maps dessert to the Snack tab — RecipesScreen Task C1: no separate Dessert tab exists', () => {
    expect(mealTypeToRecipesHref('dessert')).toBe('/app/recipes?meal=Snack');
  });

  it('is case-insensitive', () => {
    expect(mealTypeToRecipesHref('Dinner')).toBe('/app/recipes?meal=Dinner');
    expect(mealTypeToRecipesHref('DESSERT')).toBe('/app/recipes?meal=Snack');
  });

  it('falls back to an unfiltered link for beverage (no tab exists for it)', () => {
    expect(mealTypeToRecipesHref('beverage')).toBe('/app/recipes');
  });

  it('falls back to an unfiltered link when mealType is missing or unrecognized', () => {
    expect(mealTypeToRecipesHref(undefined)).toBe('/app/recipes');
    expect(mealTypeToRecipesHref(null)).toBe('/app/recipes');
    expect(mealTypeToRecipesHref('')).toBe('/app/recipes');
    expect(mealTypeToRecipesHref('smoothie')).toBe('/app/recipes');
  });
});
