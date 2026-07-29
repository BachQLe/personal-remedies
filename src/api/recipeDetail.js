/**
 * recipeDetail.js — Assembles recipe detail payloads from nutridigm.
 *
 * buildRecipeDetail(card, profile) takes a recommendation card (from getRecommendations)
 * and a profile, and returns the FoodDetailCard item shape:
 *   { foodId, name, image, sourceName, conditions[], ingredients[] }
 *
 * Derives conditions and ingredients from nutridigm via assessFood +
 * topdoordonts. No cook times, steps, or servings — the API has none, and
 * we never fabricate data.
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
 * @param {Object} card - Recommendation object (must include foodId, name, image, matchedConditions, group)
 * @param {Object} [profile] - User profile from storage (optional; read from storage if omitted)
 * @returns {Promise<Object>} FoodDetailCard item prop
 */
export async function buildRecipeDetail(card, profile) {
  const resolvedProfile = profile ?? storage.get('profile', null);
  const conditions = resolvedProfile?.conditions?.length
    ? resolvedProfile.conditions
    : DEFAULT_DEV_CONDITIONS;

  // --- Conditions from assessFood ---
  let derivedConditions = card.matchedConditions ?? [];
  let derivedIngredients = [];

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

    // --- Complementary ingredients from topdoordonts ---
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
        derivedIngredients = [
          { name: card.name, image: card.image, foodId: card.foodId },
          ...others,
        ];
      }
    } catch {
      // fallback: just the hero food
    }
  }

  if (!derivedIngredients.length) {
    derivedIngredients = [{ name: card.name, image: card.image, foodId: card.foodId ?? null }];
  }

  return {
    foodId: card.foodId ?? null,
    name: card.name,
    image: card.image,
    sourceName: card.sourceName ?? null,
    conditions: derivedConditions,
    ingredients: derivedIngredients,
  };
}
