/**
 * recipeDetail.js — Assembles recipe detail payloads from nutridigm + the
 * C1 recipe overlay (Task T3C, decision c: "honest recipe detail").
 *
 * buildRecipeDetail(card, profile) takes a recommendation card (from
 * getRecommendations) and a profile, and returns the FoodDetailCard item
 * shape:
 *   {
 *     foodId, name, image, sourceName, conditions[],
 *     topFoodsForConditions[],       // renamed from the old `ingredients` —
 *                                    // see below, this was NEVER a real
 *                                    // ingredients list
 *     ingredients[],                 // LEGACY ALIAS, identical content to
 *                                    // topFoodsForConditions — see note below
 *     realIngredients?: [],          // present only when the recipe has a
 *                                    // C1 overlay match — real ingredient
 *                                    // facts, never fabricated
 *     sourceUrl?: string,            // present only with an overlay match
 *     attribution?: string,          // present only with an overlay match
 *   }
 *
 * WHAT CHANGED AND WHY: the previous version of this module fetched
 * /topdoordonts for the user's conditions and returned the hero food plus
 * up to 4 UNRELATED "complementary" foods under the key `ingredients` —
 * despite the field name, this was never an ingredients list for the card
 * being viewed, just other foods that happen to help the same conditions.
 * That's still useful content (a "top foods for your conditions" rail), so
 * it's kept, just honestly named `topFoodsForConditions`. The `ingredients`
 * key is DUAL-PUBLISHED for one wave with identical content purely so
 * FoodDetailCard.jsx (owned by the Wave-4 agent, not this one) keeps
 * working unmodified — see the LEGACY comment below. Real ingredients (from
 * the C1 overlay, when a recipe has one) are now available separately under
 * `realIngredients`, and are never mixed into `topFoodsForConditions`/
 * `ingredients`.
 *
 * Still derives conditions from nutridigm via assessFood, and the
 * top-foods-for-conditions rail via /topdoordonts. No cook times, steps
 * beyond `sourceUrl`, or fabricated servings/nutrition — `realIngredients`/
 * `sourceUrl`/`attribution` are populated only from real C1 overlay data
 * already joined onto the recipe by `joinRecipeOverlay`
 * (src/api/recipeIngestion.js, wired into `getRecipesRaw` in adapter.js);
 * absent (not guessed/empty-array-as-placeholder) when there's no overlay
 * match.
 */

import { assessFood, isExcludedItem } from './adapter.js';
import { fetchTopDoOrDonts } from './nutridigm.js';
import { getIngredientImage } from './ingredientImages.js';
import { storage } from './storage.js';
import { DEFAULT_DEV_CONDITIONS } from './config.js';

/**
 * Build the full detail payload for FoodDetailCard.
 * Falls back gracefully on auth errors or missing foodId.
 *
 * @param {Object} card - Recommendation object (must include foodId, name,
 *   image, matchedConditions, group). When `card` is (or forwards fields
 *   from) a Recipe that went through `joinRecipeOverlay` — see
 *   `getRecipesRaw` in adapter.js — its `sourceUrl`/`attribution`/
 *   `ingredients` (the light `{name, foodItemID?}[]` shape) are read
 *   through onto the output below as `sourceUrl`/`attribution`/
 *   `realIngredients`. Today's screen callers (RecipesScreen,
 *   MealQueueScreen, SuggestionsScreen, etc.) build a stripped-down `card`
 *   that doesn't carry these fields yet — that's a caller-side gap for a
 *   later wave to close, not something this function can fix — so until
 *   then these output fields simply stay absent, which is correct (never
 *   fabricated) rather than wrong.
 * @param {Object} [profile] - User profile from storage (optional; read from storage if omitted)
 * @returns {Promise<Object>} FoodDetailCard item prop — see module header
 *   for the full shape.
 */
export async function buildRecipeDetail(card, profile) {
  const resolvedProfile = profile ?? storage.get('profile', null);
  const conditions = resolvedProfile?.conditions?.length
    ? resolvedProfile.conditions
    : DEFAULT_DEV_CONDITIONS;

  // --- Conditions from assessFood ---
  let derivedConditions = card.matchedConditions ?? [];
  let topFoodsForConditions = [];

  if (card.foodId) {
    try {
      const assessment = await assessFood(card.foodId, { ...resolvedProfile, conditions });
      if (assessment?.perCondition?.length) {
        const helpful = assessment.perCondition
          .filter((c) => c.tier === 'Top' || c.tier === 'Strong' || c.tier === 'Good')
          .sort((a, b) => (b.referenceCount ?? 0) - (a.referenceCount ?? 0));
        if (helpful.length) {
          derivedConditions = helpful.map((c) => c.conditionName);
        }
      }
    } catch {
      // assessFood failure: keep matchedConditions fallback
    }

    // --- Top foods for these conditions, from topdoordonts (NOT this
    // card's ingredients — see module header for why this was renamed) ---
    try {
      const conditionIdStr = conditions.join(',');
      const tops = await fetchTopDoOrDonts(conditionIdStr, 'consume', 10);
      if (tops?.length) {
        const others = tops
          .filter((f) => f.foodItemID !== card.foodId && !isExcludedItem(f))
          .slice(0, 4)
          .map((f) => ({
            name: f.displayAs || f.description || 'Unknown',
            image: getIngredientImage(f.displayAs || f.description || '', f.coarseFoodGroup),
            foodId: f.foodItemID,
          }));
        // Hero food first
        topFoodsForConditions = [
          { name: card.name, image: card.image, foodId: card.foodId },
          ...others,
        ];
      }
    } catch {
      // fallback: just the hero food
    }
  }

  if (!topFoodsForConditions.length) {
    topFoodsForConditions = [{ name: card.name, image: card.image, foodId: card.foodId ?? null }];
  }

  const payload = {
    foodId: card.foodId ?? null,
    name: card.name,
    image: card.image,
    sourceName: card.sourceName ?? null,
    conditions: derivedConditions,
    topFoodsForConditions,
    // LEGACY: FoodDetailCard still reads .ingredients; Wave-4 removes this alias
    ingredients: topFoodsForConditions,
  };

  // Real fields from the C1 recipe overlay (src/data/recipeOverlay.json,
  // joined onto the Recipe in adapter.js's getRecipesRaw) — included only
  // when the caller actually forwarded them on `card`, i.e. only when a
  // real overlay match exists upstream. Never fabricated/guessed here, and
  // never defaulted to an empty array/placeholder string — genuinely
  // absent from the payload when there's nothing real to show.
  if (Array.isArray(card.ingredients) && card.ingredients.length > 0) {
    payload.realIngredients = card.ingredients;
  }
  if (card.sourceUrl) {
    payload.sourceUrl = card.sourceUrl;
  }
  if (card.attribution) {
    payload.attribution = card.attribution;
  }

  return payload;
}
