/**
 * adapter.categoryScoped.test.js — regression guard for 1B's category-scoped
 * selection rule: `PLAN_SLOTS`' `itemFlagKey` (config.js) drives
 * `getMealPlanSuggestionsRaw` (adapter.js) to pool flagged items alongside
 * recipes for breakfast/snacks/beverages (`itemFlagKey` non-null), while
 * lunch/dinner (`itemFlagKey: null`) stay recipes-only no matter what flags
 * an item carries — the rule that keeps raw meat/fish cuts from ever
 * surfacing as a lunch/dinner "meal".
 *
 * Mocks the fetch layer (`../nutridigm.js`), the local dictionary layer
 * (`../localTables.js`) and the C1 recipe-overlay join (`../recipeIngestion.js`)
 * so this makes zero real network calls and fully controls which
 * foodItemIDs carry curated isBreakfast/isSnack/isBeverage flags and which
 * recipes resolve to which `mealType` — see adapter.beveragesPool.test.js
 * for the same mocking pattern this file follows.
 *
 * All assertions run against a SINGLE `getMealPlanSuggestions` call (in
 * `beforeAll`) so adapter.js's internal `_foodItemsCache`, populated once
 * lazily and never invalidated within a module instance, can't go stale
 * between assertions.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../nutridigm.js', () => ({
  fetchSuggest: vi.fn(),
  fetchGoodFor: vi.fn(),
  fetchTopDoOrDonts: vi.fn(),
  fetchDetailed: vi.fn(),
  fetchReferences: vi.fn(),
  NutridigmAuthError: class NutridigmAuthError extends Error {},
}));

vi.mock('../localTables.js', () => ({
  getItemTable: vi.fn(),
  getConditionTable: vi.fn(),
  getGroupTable: vi.fn(() => []),
  getOverlayImageFile: vi.fn(() => undefined),
}));

vi.mock('../recipeIngestion.js', () => ({
  joinRecipeOverlay: vi.fn((recipes) => recipes),
}));

import { fetchSuggest } from '../nutridigm.js';
import { getItemTable, getConditionTable } from '../localTables.js';
import { joinRecipeOverlay } from '../recipeIngestion.js';
import { getMealPlanSuggestions } from '../adapter.js';
import { PLAN_SLOTS } from '../config.js';

const RECIPE_FINE_GROUP = 'l';

/**
 * Merged item-table rows (id + curated flags) — stands in for
 * localTables.js's getItemTable(), which normally merges the base item
 * dictionary with the curation overlay (itemOverlay.json /
 * itemOverlay.generated.json).
 */
const ITEM_TABLE = [
  { foodItemID: 210, isBreakfast: true }, // f (breakfast group), numericId 2 — ties a breakfast recipe
  { foodItemID: 211, isBreakfast: true }, // d (breakfast group), numericId 1 — leads the breakfast pool
  // Carries ALL THREE flags true, numericId 4 (the outer edge of the valid
  // 1-4 range), AND lives in a lunch/dinner fine group ('e') — the
  // lunch/dinner regression guard. Because it's ALSO flagged
  // isBreakfast/isBeverage, it legitimately appears in the breakfast AND
  // beverages pools too (flaggedPoolAcrossGroups pools by flag across
  // EVERY fetched group, not just the slot's own fineGroups) — that is
  // correct, intentional cross-group pooling, not a leak. It must NEVER
  // appear on lunch/dinner, whose `itemFlagKey` is null.
  { foodItemID: 301, isBreakfast: true, isSnack: true, isBeverage: true },
  { foodItemID: 401, isBeverage: true }, // h2, numericId 3 — outranked by a beverage recipe below
  { foodItemID: 403, isBeverage: true }, // h2, numericId 6 (poor, out of range) — excluded before the flag check ever runs
];

/** fineFoodGroup -> raw /suggest items, standing in for fetchSuggest's real HTTP response. */
const SUGGEST_RESPONSES = {
  f: [{ foodItemID: 210, foodItemDisplayAs: 'Flagged Oat Item', descriptionNumericID: 2 }],
  d: [{ foodItemID: 211, foodItemDisplayAs: 'Early Bird Fruit', descriptionNumericID: 1 }],
  g1: [],
  c2: [],
  e: [{ foodItemID: 301, foodItemDisplayAs: 'Suspicious Raw Cut', descriptionNumericID: 4 }],
  b1: [],
  b3: [],
  h1: [],
  c3: [],
  h2: [
    { foodItemID: 401, foodItemDisplayAs: 'Old School Soda', descriptionNumericID: 3 },
    { foodItemID: 403, foodItemDisplayAs: 'Out Of Range Fizz', descriptionNumericID: 6 },
  ],
};

/** Raw /suggest 'l' (recipe) items, keyed by the conditionsCSV they're returned for. */
const RECIPES_BY_CSV = {
  '9001': [
    { foodItemID: 220, foodItemDisplayAs: 'Oatmeal Deluxe', descriptionNumericID: 2 }, // -> breakfast (ties item 210)
    { foodItemID: 230, foodItemDisplayAs: 'Chicken Caesar Salad', descriptionNumericID: 2 }, // -> lunch
    { foodItemID: 240, foodItemDisplayAs: 'Beef Stew', descriptionNumericID: 1 }, // -> dinner
    { foodItemID: 402, foodItemDisplayAs: 'Golden Recipe', descriptionNumericID: 1 }, // -> beverage via overlay override
  ],
  '9002': [
    { foodItemID: 230, foodItemDisplayAs: 'Chicken Caesar Salad', descriptionNumericID: 2 }, // lunch only, no beverage recipe
  ],
};

/**
 * `joinRecipeOverlay` override table, keyed by recipe id — stands in for
 * the C1 overlay's `overlayMealType` precedence (the only real path to
 * `mealType: 'beverage'`; `guessMealType`'s keyword heuristic never returns
 * it). Recipe 402 also carries `nutritionPerServing` so this file exercises
 * `recipeToPlanCandidate`'s new "copy nutritionPerServing when present"
 * behavior (1B item 3) as a side effect of the beverage-recipe scenario.
 */
const RECIPE_OVERLAY_OVERRIDES = {
  402: { overlayMealType: 'beverage', nutritionPerServing: { calories: 120, protein: 2, carbs: 20, fat: 1 } },
};

describe('getMealPlanSuggestions: category-scoped selection rule (1B)', () => {
  /** @type {Awaited<ReturnType<typeof getMealPlanSuggestions>>} */
  let result;

  beforeAll(async () => {
    getItemTable.mockReturnValue(ITEM_TABLE);
    getConditionTable.mockReturnValue([
      { healthConditionID: 9001, description: 'Test Condition' },
      { healthConditionID: 9002, description: 'Test Condition 2' },
    ]);
    fetchSuggest.mockImplementation(async (csv, fineFoodGroup) => {
      if (fineFoodGroup === RECIPE_FINE_GROUP) return RECIPES_BY_CSV[csv] ?? [];
      return SUGGEST_RESPONSES[fineFoodGroup] ?? [];
    });
    joinRecipeOverlay.mockImplementation((recipes) =>
      recipes.map((r) => (RECIPE_OVERLAY_OVERRIDES[r.id] ? { ...r, ...RECIPE_OVERLAY_OVERRIDES[r.id] } : r))
    );

    result = await getMealPlanSuggestions({ conditions: [9001] });
  });

  // ── (a) Lunch/dinner regression guard ─────────────────────────────────

  it('lunch stays recipes-only even though a matching-fineGroup item carries isBreakfast/isSnack/isBeverage all true', () => {
    expect(result.candidates.lunch.length).toBeGreaterThan(0);
    expect(result.candidates.lunch.every((c) => c.kind === 'recipe')).toBe(true);
    expect(result.candidates.lunch.map((c) => c.id)).not.toContain(301);
  });

  it('dinner stays recipes-only even though a matching-fineGroup item carries isBreakfast/isSnack/isBeverage all true', () => {
    expect(result.candidates.dinner.length).toBeGreaterThan(0);
    expect(result.candidates.dinner.every((c) => c.kind === 'recipe')).toBe(true);
    expect(result.candidates.dinner.map((c) => c.id)).not.toContain(301);
  });

  it('PLAN_SLOTS marks lunch and dinner itemFlagKey: null (the structural source of the guard above)', () => {
    const lunch = PLAN_SLOTS.find((s) => s.key === 'lunch');
    const dinner = PLAN_SLOTS.find((s) => s.key === 'dinner');
    expect(lunch.itemFlagKey).toBeNull();
    expect(dinner.itemFlagKey).toBeNull();
  });

  // ── (b) Global safety guard ────────────────────────────────────────────

  it('every candidate in every slot carries numericId within 1-4', () => {
    for (const key of Object.keys(result.candidates)) {
      for (const c of result.candidates[key]) {
        expect(c.numericId).toBeGreaterThanOrEqual(1);
        expect(c.numericId).toBeLessThanOrEqual(4);
      }
    }
  });

  it('excludes an out-of-range (numericId 6) flagged beverage item entirely', () => {
    const ids = result.candidates.beverages.map((c) => c.id);
    expect(ids).not.toContain(403);
  });

  // ── (c) Breakfast mixes flagged items + recipes, sorted, tie-broken ───

  it('breakfast mixes flagged items and a flagged recipe, ascending by numericId', () => {
    const ids = result.candidates.breakfast.map((c) => c.id);
    // 211 (numericId 1, item) leads; then the numericId-2 tie between item
    // 210 and recipe 220, item first because breakfast's recipeLead is
    // false; 301 (numericId 4, item, cross-group pooled — see the
    // ITEM_TABLE comment above) trails last.
    expect(ids).toEqual([211, 210, 220, 301]);
  });

  it('breaks a numericId tie between an item and a recipe with items first (recipeLead: false)', () => {
    const breakfast = result.candidates.breakfast;
    const item210Index = breakfast.findIndex((c) => c.id === 210);
    const recipe220Index = breakfast.findIndex((c) => c.id === 220);
    expect(breakfast[item210Index].kind).toBe('food');
    expect(breakfast[recipe220Index].kind).toBe('recipe');
    expect(item210Index).toBeLessThan(recipe220Index);
  });

  // ── (e) Beverage recipe (numericId 1) outranks a beverage item (numericId 3) ──

  it('a beverage recipe outranks a beverage item of a worse numericId — the intentional behavior change', () => {
    const beverages = result.candidates.beverages;
    // 402 (recipe, numericId 1) beats 401 (item, numericId 3) — the
    // accepted behavior change; 301 (item, numericId 4, cross-pooled) still
    // trails last, same as everywhere else it appears.
    expect(beverages.map((c) => c.id)).toEqual([402, 401, 301]);
    expect(beverages[0].kind).toBe('recipe');
    expect(beverages[1].kind).toBe('food');
  });

  it('recipeToPlanCandidate copies nutritionPerServing onto the candidate when the recipe carries it', () => {
    const recipeCandidate = result.candidates.beverages.find((c) => c.id === 402);
    expect(recipeCandidate.nutritionPerServing).toEqual({ calories: 120, protein: 2, carbs: 20, fat: 1 });
  });
});

describe('getMealPlanSuggestions: beverages with zero beverage recipes matches the pre-1B output order', () => {
  /** @type {Awaited<ReturnType<typeof getMealPlanSuggestions>>} */
  let result;

  beforeAll(async () => {
    getItemTable.mockReturnValue(ITEM_TABLE);
    getConditionTable.mockReturnValue([
      { healthConditionID: 9001, description: 'Test Condition' },
      { healthConditionID: 9002, description: 'Test Condition 2' },
    ]);
    fetchSuggest.mockImplementation(async (csv, fineFoodGroup) => {
      if (fineFoodGroup === RECIPE_FINE_GROUP) return RECIPES_BY_CSV[csv] ?? [];
      return SUGGEST_RESPONSES[fineFoodGroup] ?? [];
    });
    // No overlay overrides this time — the 'l' response for csv '9002'
    // carries no recipe that could resolve to mealType 'beverage' at all,
    // so joinRecipeOverlay is a pure passthrough here.
    joinRecipeOverlay.mockImplementation((recipes) => recipes);

    result = await getMealPlanSuggestions({ conditions: [9002] });
  });

  it('produces items-only, ascending-by-numericId order — identical to the pre-1B [...items, ...recipes] shape', () => {
    expect(result.candidates.beverages.map((c) => c.id)).toEqual([401, 301]);
    expect(result.candidates.beverages.every((c) => c.kind === 'food')).toBe(true);
  });

  it('still has zero beverage recipes to merge (sanity check on the fixture)', () => {
    expect(result.candidates.beverages.some((c) => c.kind === 'recipe')).toBe(false);
  });
});
