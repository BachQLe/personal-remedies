/**
 * recipeDetail.test.js — Guards T3C decision (c) "honest recipe detail"
 * (src/api/recipeDetail.js's `buildRecipeDetail`):
 *   - the old fabricated-name `ingredients` field (actually a "top foods
 *     for these conditions" rail from /topdoordonts, unrelated to the
 *     viewed recipe's real ingredients) is renamed `topFoodsForConditions`
 *   - the legacy `ingredients` key (dual-published for one wave so
 *     FoodDetailCard.jsx kept working unmodified) is GONE as of Task T4B —
 *     FoodDetailCard now reads `topFoodsForConditions` directly, so the
 *     payload must no longer carry an `ingredients` key at all
 *   - real overlay-derived fields (`realIngredients`, `sourceUrl`,
 *     `attribution`) appear ONLY when the caller's `card` actually carries
 *     them (i.e. only when a real C1 overlay match exists upstream, per
 *     adapter.js's `getRecipesRaw`) — never fabricated, never defaulted to
 *     an empty/placeholder value.
 *
 * Mocks `./adapter.js` (assessFood, isExcludedItem), `./nutridigm.js`
 * (fetchTopDoOrDonts), `./storage.js`, and `./ingredientImages.js` so this
 * makes zero real network calls and fully controls the topdoordonts
 * response shaping the (renamed) rail.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../adapter.js', () => ({
  assessFood: vi.fn(),
  isExcludedItem: vi.fn(() => false),
}));

vi.mock('../nutridigm.js', () => ({
  fetchTopDoOrDonts: vi.fn(),
}));

vi.mock('../ingredientImages.js', () => ({
  getIngredientImage: vi.fn(() => 'https://example.com/img.jpg'),
}));

vi.mock('../storage.js', () => ({
  storage: { get: vi.fn(() => null) },
}));

import { assessFood, isExcludedItem } from '../adapter.js';
import { fetchTopDoOrDonts } from '../nutridigm.js';
import { buildRecipeDetail } from '../recipeDetail.js';

const HERO_CARD = {
  foodId: 555,
  name: 'Baked Salmon',
  image: 'https://example.com/salmon.jpg',
  sourceName: 'MedlinePlus',
  matchedConditions: ['Heart Health'],
};

const TOPDOORDONTS_RESPONSE = [
  { foodItemID: 555, displayAs: 'Baked Salmon', coarseFoodGroup: 'b' }, // hero, filtered out by foodId match
  { foodItemID: 201, displayAs: 'Spinach', coarseFoodGroup: 'e' },
  { foodItemID: 202, displayAs: 'Blueberries', coarseFoodGroup: 'c' },
];

beforeEach(() => {
  vi.clearAllMocks();
  isExcludedItem.mockReturnValue(false);
  assessFood.mockResolvedValue(null);
  fetchTopDoOrDonts.mockResolvedValue(TOPDOORDONTS_RESPONSE);
});

describe('buildRecipeDetail: topFoodsForConditions (legacy ingredients alias removed)', () => {
  it('publishes topFoodsForConditions with no legacy ingredients key', async () => {
    const payload = await buildRecipeDetail(HERO_CARD, { conditions: [9001] });
    expect(payload.topFoodsForConditions).toBeDefined();
    expect(payload.topFoodsForConditions.length).toBeGreaterThan(0);
    expect('ingredients' in payload).toBe(false);
    // hero food leads the rail
    expect(payload.topFoodsForConditions[0]).toEqual({
      name: HERO_CARD.name,
      image: HERO_CARD.image,
      foodId: HERO_CARD.foodId,
    });
  });

  it('falls back to a hero-only rail (still no legacy alias) when topdoordonts is empty', async () => {
    fetchTopDoOrDonts.mockResolvedValue([]);
    const payload = await buildRecipeDetail(HERO_CARD, { conditions: [9001] });
    expect(payload.topFoodsForConditions).toEqual([
      { name: HERO_CARD.name, image: HERO_CARD.image, foodId: HERO_CARD.foodId },
    ]);
    expect('ingredients' in payload).toBe(false);
  });

  it('falls back to a hero-only rail when topdoordonts rejects', async () => {
    fetchTopDoOrDonts.mockRejectedValue(new Error('network error'));
    const payload = await buildRecipeDetail(HERO_CARD, { conditions: [9001] });
    expect(payload.topFoodsForConditions).toEqual([
      { name: HERO_CARD.name, image: HERO_CARD.image, foodId: HERO_CARD.foodId },
    ]);
    expect('ingredients' in payload).toBe(false);
  });
});

describe('buildRecipeDetail: realIngredients (never fabricated)', () => {
  it('is absent when card carries no ingredients (no C1 overlay match upstream)', async () => {
    const payload = await buildRecipeDetail(HERO_CARD, { conditions: [9001] });
    expect(payload.realIngredients).toBeUndefined();
    expect('realIngredients' in payload).toBe(false);
  });

  it('is absent when card.ingredients is an empty array', async () => {
    const payload = await buildRecipeDetail({ ...HERO_CARD, ingredients: [] }, { conditions: [9001] });
    expect(payload.realIngredients).toBeUndefined();
  });

  it('is populated from card.ingredients (the light overlay shape) when present', async () => {
    const realIngredients = [
      { name: '1 lb salmon fillet', foodItemID: 101 },
      { name: '1 tbsp olive oil' },
    ];
    const payload = await buildRecipeDetail({ ...HERO_CARD, ingredients: realIngredients }, { conditions: [9001] });
    expect(payload.realIngredients).toEqual(realIngredients);
    // never mixed into the topdoordonts-derived rail
    expect(payload.topFoodsForConditions).not.toEqual(realIngredients);
  });
});

describe('buildRecipeDetail: sourceUrl / attribution passthrough (never fabricated)', () => {
  it('are absent when not present on card', async () => {
    const payload = await buildRecipeDetail(HERO_CARD, { conditions: [9001] });
    expect(payload.sourceUrl).toBeUndefined();
    expect(payload.attribution).toBeUndefined();
  });

  it('are forwarded through unchanged when present on card', async () => {
    const cardWithOverlay = {
      ...HERO_CARD,
      sourceUrl: 'https://medlineplus.gov/recipes/baked-salmon',
      attribution: 'MedlinePlus',
    };
    const payload = await buildRecipeDetail(cardWithOverlay, { conditions: [9001] });
    expect(payload.sourceUrl).toBe(cardWithOverlay.sourceUrl);
    expect(payload.attribution).toBe(cardWithOverlay.attribution);
  });
});

describe('buildRecipeDetail: nutritionPerServing passthrough (never fabricated)', () => {
  it('is absent when not present on card', async () => {
    const payload = await buildRecipeDetail(HERO_CARD, { conditions: [9001] });
    expect(payload.nutritionPerServing).toBeUndefined();
    expect('nutritionPerServing' in payload).toBe(false);
  });

  it('is forwarded through unchanged when present on card', async () => {
    const cardWithOverlay = {
      ...HERO_CARD,
      nutritionPerServing: { calories: 420 },
    };
    const payload = await buildRecipeDetail(cardWithOverlay, { conditions: [9001] });
    expect(payload.nutritionPerServing).toEqual(cardWithOverlay.nutritionPerServing);
  });
});

describe('buildRecipeDetail: unchanged base behavior', () => {
  it('derives conditions from assessFood when it returns helpful per-condition tiers', async () => {
    assessFood.mockResolvedValue({
      perCondition: [
        { conditionName: 'Diabetes', tier: 'Top', referenceCount: 5 },
        { conditionName: 'Neutral Condition', tier: null, referenceCount: 0 },
      ],
    });
    const payload = await buildRecipeDetail(HERO_CARD, { conditions: [9001] });
    expect(payload.conditions).toEqual(['Diabetes']);
  });

  it('falls back to card.matchedConditions when assessFood throws', async () => {
    assessFood.mockRejectedValue(new Error('boom'));
    const payload = await buildRecipeDetail(HERO_CARD, { conditions: [9001] });
    expect(payload.conditions).toEqual(HERO_CARD.matchedConditions);
  });

  it('skips assessFood/topdoordonts entirely when card has no foodId', async () => {
    const noIdCard = { name: 'Mystery Dish', image: null, matchedConditions: [] };
    const payload = await buildRecipeDetail(noIdCard, { conditions: [9001] });
    expect(assessFood).not.toHaveBeenCalled();
    expect(fetchTopDoOrDonts).not.toHaveBeenCalled();
    expect(payload.foodId).toBeNull();
    expect(payload.topFoodsForConditions).toEqual([{ name: 'Mystery Dish', image: null, foodId: null }]);
  });

  it('excludes the hero food and excluded items from the topdoordonts rail, caps at 4 others', async () => {
    const manyTops = [
      { foodItemID: 555, displayAs: 'Baked Salmon' }, // hero, excluded by foodId match
      { foodItemID: 301, displayAs: 'Excluded Item' }, // excluded by isExcludedItem
      { foodItemID: 201, displayAs: 'Spinach' },
      { foodItemID: 202, displayAs: 'Blueberries' },
      { foodItemID: 203, displayAs: 'Walnuts' },
      { foodItemID: 204, displayAs: 'Oats' },
      { foodItemID: 205, displayAs: 'Kale' },
    ];
    isExcludedItem.mockImplementation((f) => f.foodItemID === 301);
    fetchTopDoOrDonts.mockResolvedValue(manyTops);
    const payload = await buildRecipeDetail(HERO_CARD, { conditions: [9001] });
    // hero + up to 4 others
    expect(payload.topFoodsForConditions).toHaveLength(5);
    const ids = payload.topFoodsForConditions.map((f) => f.foodId);
    expect(ids).not.toContain(301);
    expect(ids).toEqual([555, 201, 202, 203, 204]);
  });
});
