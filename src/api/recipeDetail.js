/**
 * recipeDetail.js — Assembles recipe detail payloads from nutridigm + the
 * C1 recipe overlay (Task T3C, decision c: "honest recipe detail").
 *
 * buildRecipeDetail(card, profile) takes a recommendation card (from
 * getRecommendations) and a profile, and returns the FoodDetailCard item
 * shape:
 *   {
 *     foodId, name, image, sourceName, conditions[],
 *     topFoodsForConditions[],       // see below — this was NEVER a real
 *                                    // ingredients list
 *     realIngredients?: [],          // present only when the recipe has a
 *                                    // C1 overlay match — real ingredient
 *                                    // facts, never fabricated
 *     sourceUrl?: string,            // present only with an overlay match
 *     attribution?: string,          // present only with an overlay match
 *     nutritionPerServing?: {calories: number, ...},
 *                                    // present only with an overlay match —
 *                                    // the transcribed source calorie
 *                                    // number; never derived/estimated here
 *   }
 *
 * WHAT CHANGED AND WHY: the previous version of this module fetched
 * /topdoordonts for the user's conditions and returned the hero food plus
 * up to 4 UNRELATED "complementary" foods under the key `ingredients` —
 * despite the field name, this was never an ingredients list for the card
 * being viewed, just other foods that happen to help the same conditions.
 * That's still useful content (a "top foods for your conditions" rail), so
 * it's kept, just honestly named `topFoodsForConditions`. The legacy
 * `ingredients` alias (dual-published for one wave so FoodDetailCard.jsx
 * kept working unmodified) is gone now that FoodDetailCard reads
 * `topFoodsForConditions` directly (Task T4B). Real ingredients (from the
 * C1 overlay, when a recipe has one) are available separately under
 * `realIngredients`, and are never mixed into `topFoodsForConditions`.
 *
 * Still derives conditions from nutridigm via assessFood, and the
 * top-foods-for-conditions rail via /topdoordonts. No cook times, steps
 * beyond `sourceUrl`, or fabricated servings/nutrition — `realIngredients`/
 * `sourceUrl`/`attribution` are populated only from real C1 overlay data
 * already joined onto the recipe by `joinRecipeOverlay`
 * (src/api/recipeIngestion.js, wired into `getRecipesRaw` in adapter.js);
 * absent (not guessed/empty-array-as-placeholder) when there's no overlay
 * match.
 *
 * NOTE: despite the name, this function is also called for plain (non-
 * recipe) foods — MealprepCarousel's "Top Dos & Don'ts" home rail seeds
 * FoodDetailCard via this same function with `isRecipe: false`, since
 * `topFoodsForConditions` is legitimate "similar items" content for a plain
 * food. `card` carries no reliable recipe/food signal at this layer, so
 * `topFoodsForConditions` is always computed here; FoodDetailCard.jsx is
 * what gates it out of the rendered recipe view (`!isRecipe &&` on the rail,
 * mirroring its other recipe-gated blocks), since only it reliably knows
 * which case it's in.
 */

import { assessFood, isExcludedItem } from './adapter.js';
import { fetchTopDoOrDonts } from './nutridigm.js';
import { getIngredientImage } from './ingredientImages.js';
import { getOverlayImageFile } from './localTables.js';
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
 *   `nutritionPerServing`/`ingredients` (the light `{name, foodItemID?}[]`
 *   shape) are read through onto the output below as `sourceUrl`/
 *   `attribution`/`nutritionPerServing`/`realIngredients`. The caller-side
 *   gap this comment used to describe (screen callers building a
 *   stripped-down `card` that dropped these fields) was closed in the wave
 *   that added the in-app recipe preview sheet: RecipesScreen,
 *   SuggestionsScreen, SearchScreen, MealQueueScreen and MealPlannerPicker
 *   now forward `sourceUrl`/`attribution`/`nutritionPerServing` from the
 *   `Recipe`/`PlanCandidate` they already hold. When a given recipe truly
 *   has no overlay match, these fields are absent on `card` too, and stay
 *   absent on the output — correct (never fabricated) rather than wrong.
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
            image: getIngredientImage(
              f.displayAs || f.description || '',
              f.coarseFoodGroup,
              getOverlayImageFile(f.foodItemID)
            ),
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
  if (card.nutritionPerServing) {
    payload.nutritionPerServing = card.nutritionPerServing;
  }

  return payload;
}
