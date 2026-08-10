/**
 * adapter.recipeOverlay.test.js — Guards T3C's wiring of the C1 recipe
 * overlay (src/api/recipeIngestion.js's `joinRecipeOverlay`) into
 * `getRecipesRaw`/`getRecipes` and `recipeToPlanCandidate` (src/api/adapter.js).
 *
 * recipeIngestion.test.js already guards `joinRecipeOverlay` itself in
 * isolation (structural incapability of minting/upgrading a recipe the API
 * didn't return, no numericId/tier leakage). This file guards the NEXT
 * layer: that adapter.js actually calls it, applies the documented
 * `mealType` precedence (overlay's editorial `overlayMealType` beats
 * `guessMealType`'s keyword heuristic), derives the light-shape
 * `ingredients` from the overlay's parallel `rawIngredients`/
 * `ingredientFoodItemIds` arrays, and threads `sourceUrl`/`attribution`
 * through to Plan-slot candidates — all without ever letting overlay
 * content affect a recipe's `numericId`/`tier` (the app's entire safety
 * model, see recipeIngestion.js's header).
 *
 * Uses `vi.doMock` + dynamic `import()` per test (with `vi.resetModules()`
 * in beforeEach), same idiom as recipeIngestion.test.js, so each test can
 * control both the overlay content (src/data/recipeOverlay.json) and the
 * mocked /suggest responses (../nutridigm.js) without leaking adapter.js's
 * internal caches (cache.js's in-memory Map, and the module-level
 * `_healthConditionsCache`) between cases.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A fully-valid C1 overlay row (see recipeIngestion.js's RecipeOverlayRow schema). */
const OVERLAY_ROW = {
  name: 'Baked Salmon',
  sourceUrl: 'https://medlineplus.gov/recipes/baked-salmon',
  attribution: 'MedlinePlus',
  mealType: 'dinner',
  rawIngredients: ['1 lb salmon fillet', '1 tbsp olive oil'],
  ingredientFoodItemIds: [101, 202],
  servings: 4,
  nutritionPerServing: { calories: 320, protein: 28, carbs: 4, fat: 20 },
  totalTimeMinutes: 25,
  fineFoodGroup: 'l',
  foodItemID: 555,
};

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
 * imports adapter.js so it picks up THIS test's mocks (module registry was
 * just reset in beforeEach). Mirrors adapter.beveragesPool.test.js's mock
 * shape for ../nutridigm.js/../localTables.js.
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

describe('getRecipes: C1 overlay join is a transparent no-op with an empty overlay', () => {
  it('leaves recipes unchanged — same fields, guessMealType fallback still applies', async () => {
    const { getRecipes } = await setupAdapter({
      suggestResponses: {
        l: [{ foodItemID: 555, foodItemDisplayAs: 'Baked Salmon', descriptionNumericID: 1 }],
      },
    });
    const { recipes } = await getRecipes({ conditions: [9001] });
    expect(recipes).toHaveLength(1);
    expect(recipes[0].id).toBe(555);
    expect(recipes[0].numericId).toBe(1);
    expect(recipes[0].tier).toBe('Top');
    // 'salmon' keyword -> 'dinner' per RECIPE_MEAL_TYPE_KEYWORDS, untouched by any overlay
    expect(recipes[0].mealType).toBe('dinner');
    expect(recipes[0].sourceUrl).toBeUndefined();
    expect(recipes[0].attribution).toBeUndefined();
    expect(recipes[0].ingredients).toBeUndefined();
  });
});

describe('getRecipes: a matching overlay row enriches the recipe', () => {
  it('applies mealType precedence (overlay wins), populates sourceUrl/attribution, derives light-shape ingredients', async () => {
    const beverageRow = { ...OVERLAY_ROW, mealType: 'beverage' };
    const { getRecipes } = await setupAdapter({
      overlay: [beverageRow],
      suggestResponses: {
        l: [{ foodItemID: 555, foodItemDisplayAs: 'Baked Salmon', descriptionNumericID: 1 }],
      },
    });
    const { recipes } = await getRecipes({ conditions: [9001] });
    expect(recipes).toHaveLength(1);
    const r = recipes[0];

    // mealType precedence: overlay's editorial 'beverage' wins over the
    // keyword guess ('salmon' -> 'dinner') — the ONLY way a recipe can ever
    // land as 'beverage', since guessMealType never returns it.
    expect(r.mealType).toBe('beverage');

    expect(r.sourceUrl).toBe(beverageRow.sourceUrl);
    expect(r.attribution).toBe(beverageRow.attribution);
    expect(r.servings).toBe(beverageRow.servings);
    expect(r.nutritionPerServing).toEqual(beverageRow.nutritionPerServing);

    // light `{ name, foodItemID? }` shape, zipped from the overlay's
    // parallel rawIngredients/ingredientFoodItemIds arrays
    expect(r.ingredients).toEqual([
      { name: '1 lb salmon fillet', foodItemID: 101 },
      { name: '1 tbsp olive oil', foodItemID: 202 },
    ]);

    // join-artifact fields are resolved away, not left dangling on the Recipe
    expect(r.overlayMealType).toBeUndefined();
    expect(r.rawIngredients).toBeUndefined();
    expect(r.ingredientFoodItemIds).toBeUndefined();

    // safety fields: API-derived only, never touched by the overlay
    expect(r.numericId).toBe(1);
    expect(r.tier).toBe('Top');
  });

  it('numericId/tier stay API-only even if an overlay row smuggles same-named fields', async () => {
    const maliciousRow = { ...OVERLAY_ROW, numericId: 7, tier: 'poor' };
    const { getRecipes } = await setupAdapter({
      overlay: [maliciousRow],
      suggestResponses: {
        l: [{ foodItemID: 555, foodItemDisplayAs: 'Baked Salmon', descriptionNumericID: 1 }],
      },
    });
    const { recipes } = await getRecipes({ conditions: [9001] });
    expect(recipes[0].numericId).toBe(1);
    expect(recipes[0].tier).toBe('Top');
  });
});

describe('getRecipes: an overlay row whose foodItemID the API did not return never surfaces', () => {
  it('the unmatched recipe stays plain, and no extra recipe is minted', async () => {
    const { getRecipes } = await setupAdapter({
      overlay: [OVERLAY_ROW], // foodItemID 555
      suggestResponses: {
        // API returns a DIFFERENT foodItemID — overlay row for 555 has nothing to join to.
        l: [{ foodItemID: 999, foodItemDisplayAs: 'Other Recipe', descriptionNumericID: 2 }],
      },
    });
    const { recipes } = await getRecipes({ conditions: [9001] });
    expect(recipes).toHaveLength(1);
    expect(recipes[0].id).toBe(999);
    expect(recipes[0].sourceUrl).toBeUndefined();
    expect(recipes[0].attribution).toBeUndefined();
    expect(recipes[0].ingredients).toBeUndefined();
    expect(recipes[0].mealType).toBe('dinner'); // guessMealType fallback, untouched
  });
});

describe('recipeToPlanCandidate: threads sourceUrl/attribution through to Plan-slot candidates', () => {
  it('a Plan candidate built from an overlay-matched recipe carries sourceUrl/attribution, with numericId still API-derived', async () => {
    const lunchRow = { ...OVERLAY_ROW, mealType: 'lunch' };
    const { getMealPlanSuggestions } = await setupAdapter({
      overlay: [lunchRow],
      suggestResponses: {
        l: [{ foodItemID: 555, foodItemDisplayAs: 'Baked Salmon', descriptionNumericID: 1 }],
      },
    });
    const result = await getMealPlanSuggestions({ conditions: [9001] });
    const candidate = result.candidates.lunch.find((c) => c.id === 555);
    expect(candidate).toBeDefined();
    expect(candidate.sourceUrl).toBe(lunchRow.sourceUrl);
    expect(candidate.attribution).toBe(lunchRow.attribution);
    expect(candidate.kind).toBe('recipe');
    // safety fields: unaffected by the overlay join
    expect(candidate.numericId).toBe(1);
    expect(candidate.tier).toBe('Top');
  });

  it('a Plan candidate built from a recipe with no overlay match has undefined sourceUrl/attribution (never fabricated)', async () => {
    const { getMealPlanSuggestions } = await setupAdapter({
      suggestResponses: {
        // guessMealType('Chicken Salad') -> 'salad' keyword -> 'lunch'
        l: [{ foodItemID: 777, foodItemDisplayAs: 'Chicken Salad', descriptionNumericID: 2 }],
      },
    });
    const result = await getMealPlanSuggestions({ conditions: [9001] });
    const candidate = result.candidates.lunch.find((c) => c.id === 777);
    expect(candidate).toBeDefined();
    expect(candidate.sourceUrl).toBeUndefined();
    expect(candidate.attribution).toBeUndefined();
  });
});
