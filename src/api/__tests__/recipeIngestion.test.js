/**
 * recipeIngestion.test.js — Guards the C1 recipe-overlay ingestion seam
 * (src/api/recipeIngestion.js):
 *   - invalid overlay rows are dropped with a console.warn, never thrown
 *   - `joinRecipeOverlay` never returns a recipe the API didn't already
 *     return, and never copies numericId/tier off an overlay row
 *     (Track B item 2 / REMEDI_MASTER_PLAN.md — numericId is the app's
 *     ENTIRE safety model; the overlay must be structurally incapable of
 *     ever supplying one).
 *
 * Uses `vi.doMock` + dynamic `import()` per test (with `vi.resetModules()`
 * in beforeEach) so each test can control the contents of
 * src/data/recipeOverlay.json without touching the real (ships-as-[])
 * file, and so `loadRecipeOverlay`'s module-level memoization doesn't leak
 * state between tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const VALID_ROW = {
  name: 'Baked Salmon',
  sourceUrl: 'https://medlineplus.gov/recipes/baked-salmon',
  attribution: 'MedlinePlus',
  mealType: 'dinner',
  alsoFits: ['lunch'],
  rawIngredients: ['1 lb salmon fillet', '1 tbsp olive oil'],
  ingredientFoodItemIds: [101, 202],
  servings: 4,
  nutritionPerServing: { calories: 320, protein: 28, carbs: 4, fat: 20 },
  dietaryTags: ['gluten-free'],
  totalTimeMinutes: 25,
  fineFoodGroup: 'l',
  foodItemID: 555,
};

let warnSpy;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.resetModules();
});

afterEach(() => {
  warnSpy.mockRestore();
  vi.doUnmock('../../data/recipeOverlay.json');
});

describe('validateOverlayRow', () => {
  it('accepts a fully-populated valid row', async () => {
    const { validateOverlayRow } = await import('../recipeIngestion.js');
    expect(validateOverlayRow(VALID_ROW)).toEqual({ valid: true });
  });

  it('accepts a row with optional fields omitted (alsoFits, dietaryTags, foodItemID)', async () => {
    const { validateOverlayRow } = await import('../recipeIngestion.js');
    // eslint-disable-next-line no-unused-vars
    const { foodItemID, alsoFits, dietaryTags, ...rest } = VALID_ROW;
    expect(validateOverlayRow(rest)).toEqual({ valid: true });
  });

  const invalidCases = [
    ['row is not an object', null],
    ['row is an array', ['not', 'an', 'object']],
    ['missing name', { ...VALID_ROW, name: '' }],
    ['non-https sourceUrl', { ...VALID_ROW, sourceUrl: 'http://medlineplus.gov/x' }],
    ['malformed sourceUrl', { ...VALID_ROW, sourceUrl: 'not-a-url' }],
    ['missing attribution', { ...VALID_ROW, attribution: undefined }],
    ['bad mealType', { ...VALID_ROW, mealType: 'brunch' }],
    ['bad alsoFits entry', { ...VALID_ROW, alsoFits: ['brunch'] }],
    ['empty rawIngredients', { ...VALID_ROW, rawIngredients: [] }],
    ['non-string rawIngredients entry', { ...VALID_ROW, rawIngredients: [1, 2] }],
    ['non-numeric ingredientFoodItemIds', { ...VALID_ROW, ingredientFoodItemIds: ['101'] }],
    ['non-positive servings', { ...VALID_ROW, servings: 0 }],
    ['missing nutritionPerServing field', { ...VALID_ROW, nutritionPerServing: { calories: 1, protein: 1, carbs: 1 } }],
    ['non-numeric nutritionPerServing field', { ...VALID_ROW, nutritionPerServing: { calories: '320', protein: 1, carbs: 1, fat: 1 } }],
    ['non-positive totalTimeMinutes', { ...VALID_ROW, totalTimeMinutes: -5 }],
    ["wrong fineFoodGroup (not 'l')", { ...VALID_ROW, fineFoodGroup: 'b1' }],
    ['non-numeric foodItemID', { ...VALID_ROW, foodItemID: 'abc' }],
  ];

  it.each(invalidCases)('rejects: %s', async (_label, row) => {
    const { validateOverlayRow } = await import('../recipeIngestion.js');
    expect(validateOverlayRow(row).valid).toBe(false);
  });

  it('tolerates an unknown extra field (e.g. a stray "directions") without treating it as required or forbidden', async () => {
    const { validateOverlayRow } = await import('../recipeIngestion.js');
    expect(validateOverlayRow({ ...VALID_ROW, directions: 'Step 1...' })).toEqual({ valid: true });
  });
});

describe('loadRecipeOverlay', () => {
  it('drops invalid rows and warns, keeps valid ones', async () => {
    vi.doMock('../../data/recipeOverlay.json', () => ({
      default: [
        VALID_ROW,
        { ...VALID_ROW, mealType: 'brunch' }, // invalid
        { ...VALID_ROW, foodItemID: 556, sourceUrl: 'not-a-url' }, // invalid
      ],
    }));
    const { loadRecipeOverlay } = await import('../recipeIngestion.js');
    const rows = loadRecipeOverlay();
    expect(rows).toHaveLength(1);
    expect(rows[0].foodItemID).toBe(555);
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('returns [] when the overlay file is empty (its shipped state until Track C delivers)', async () => {
    vi.doMock('../../data/recipeOverlay.json', () => ({ default: [] }));
    const { loadRecipeOverlay } = await import('../recipeIngestion.js');
    expect(loadRecipeOverlay()).toEqual([]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('memoizes: a second call does not re-warn', async () => {
    vi.doMock('../../data/recipeOverlay.json', () => ({
      default: [{ ...VALID_ROW, mealType: 'brunch' }],
    }));
    const { loadRecipeOverlay } = await import('../recipeIngestion.js');
    loadRecipeOverlay();
    loadRecipeOverlay();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe('joinRecipeOverlay — the only exposure path (Track B item 2)', () => {
  const apiRecipe = (overrides) => ({
    id: 555,
    foodId: 555,
    title: 'Baked Salmon',
    tier: 'Top',
    numericId: 1,
    mealType: 'dinner',
    sourceName: 'MedlinePlus',
    matchedConditions: [],
    ...overrides,
  });

  it('enriches a recipe whose foodItemID the API returned', async () => {
    vi.doMock('../../data/recipeOverlay.json', () => ({ default: [VALID_ROW] }));
    const { joinRecipeOverlay } = await import('../recipeIngestion.js');
    const [joined] = joinRecipeOverlay([apiRecipe()]);
    expect(joined.sourceUrl).toBe(VALID_ROW.sourceUrl);
    expect(joined.attribution).toBe(VALID_ROW.attribution);
    expect(joined.servings).toBe(VALID_ROW.servings);
    expect(joined.nutritionPerServing).toEqual(VALID_ROW.nutritionPerServing);
    expect(joined.rawIngredients).toEqual(VALID_ROW.rawIngredients);
    expect(joined.ingredientFoodItemIds).toEqual(VALID_ROW.ingredientFoodItemIds);
    expect(joined.overlayMealType).toBe('dinner');
    expect(joined.alsoFits).toEqual(['lunch']);
    // API-side fields untouched
    expect(joined.id).toBe(555);
    expect(joined.numericId).toBe(1);
    expect(joined.tier).toBe('Top');
    expect(joined.mealType).toBe('dinner'); // untouched API-side guess, not overwritten
  });

  it('never returns overlay content for a foodItemID absent from apiRecipes', async () => {
    vi.doMock('../../data/recipeOverlay.json', () => ({ default: [VALID_ROW] }));
    const { joinRecipeOverlay } = await import('../recipeIngestion.js');
    // apiRecipes carries a DIFFERENT foodItemID (999) — overlay row for 555 must not surface.
    const result = joinRecipeOverlay([apiRecipe({ id: 999, foodId: 999 })]);
    expect(result).toHaveLength(1);
    expect(result[0].sourceUrl).toBeUndefined();
    expect(result[0].rawIngredients).toBeUndefined();
    expect(result[0].id).toBe(999);
  });

  it('a row with no foodItemID (pre-scoring draft) can never match anything', async () => {
    // eslint-disable-next-line no-unused-vars
    const { foodItemID, ...rowWithoutId } = VALID_ROW;
    vi.doMock('../../data/recipeOverlay.json', () => ({ default: [rowWithoutId] }));
    const { joinRecipeOverlay } = await import('../recipeIngestion.js');
    const [result] = joinRecipeOverlay([apiRecipe()]);
    expect(result.sourceUrl).toBeUndefined();
  });

  it('never copies numericId/tier from the overlay row even if one is present (structural, not just schema)', async () => {
    // Simulates a malformed/malicious overlay row smuggling safety-shaped fields.
    const rowWithSafetyFields = { ...VALID_ROW, numericId: 7, tier: 'poor' };
    vi.doMock('../../data/recipeOverlay.json', () => ({ default: [rowWithSafetyFields] }));
    const { joinRecipeOverlay } = await import('../recipeIngestion.js');
    const [joined] = joinRecipeOverlay([apiRecipe({ numericId: 1, tier: 'Top' })]);
    expect(joined.numericId).toBe(1);
    expect(joined.tier).toBe('Top');
  });

  it('is structurally incapable of minting a recipe the API did not return: empty apiRecipes yields empty result regardless of overlay size', async () => {
    vi.doMock('../../data/recipeOverlay.json', () => ({ default: [VALID_ROW] }));
    const { joinRecipeOverlay } = await import('../recipeIngestion.js');
    expect(joinRecipeOverlay([])).toEqual([]);
  });

  it('never adds or removes recipes — same length, same order in and out', async () => {
    vi.doMock('../../data/recipeOverlay.json', () => ({ default: [VALID_ROW] }));
    const { joinRecipeOverlay } = await import('../recipeIngestion.js');
    const unmatched = apiRecipe({ id: 42, foodId: 42, title: 'Other Recipe' });
    const matched = apiRecipe();
    const result = joinRecipeOverlay([unmatched, matched]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(42);
    expect(result[0].sourceUrl).toBeUndefined();
    expect(result[1].id).toBe(555);
    expect(result[1].sourceUrl).toBe(VALID_ROW.sourceUrl);
  });

  it('passes through non-array input as an empty array rather than throwing', async () => {
    vi.doMock('../../data/recipeOverlay.json', () => ({ default: [] }));
    const { joinRecipeOverlay } = await import('../recipeIngestion.js');
    expect(joinRecipeOverlay(null)).toEqual([]);
    expect(joinRecipeOverlay(undefined)).toEqual([]);
  });

  it('with the real (shipped, empty) overlay file, returns apiRecipes unchanged', async () => {
    const { joinRecipeOverlay } = await import('../recipeIngestion.js');
    const recipes = [apiRecipe()];
    expect(joinRecipeOverlay(recipes)).toEqual(recipes);
  });
});
