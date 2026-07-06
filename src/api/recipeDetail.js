/**
 * recipeDetail.js — Assembles recipe detail payloads from nutridigm.
 *
 * buildRecipeDetail(card, profile) takes a recommendation card (from getRecommendations)
 * and a profile, and returns the RecipeDetailCard shape:
 *   { foodId, name, image, sourceName, conditions[], ingredients[] }
 *
 * buildRecipeIngredients(recipe, profile) takes a real Recipe (from adapter's
 * getRecipes, has foodId) and a profile, and returns the RecipeDetail.jsx
 * (bottom-sheet) shape: the recipe spread with a real `ingredients[]`
 * (hero recipe + complementary foods, each with `signal`/`matchedConditions`)
 * and `matchedConditions` refined to the profile's actual helpful conditions.
 *
 * Both derive conditions and ingredients from nutridigm via assessFood +
 * topdoordonts. No cook times, steps, or servings — the API has none, and
 * we never fabricate data.
 */

import { assessFood } from './adapter.js';
import { fetchTopDoOrDonts } from './nutridigm.js';
import { getIngredientImage } from './ingredientImages.js';
import { storage } from './storage.js';
import { DEFAULT_DEV_CONDITIONS, EXCLUDED_FINE_GROUPS } from './config.js';

// Lifestyle/behavior items ("Exercise", "Rest") come back from topdoordonts
// alongside foods — they must never appear as recipe ingredients. Mirrors
// adapter.js's private isExcludedItem (fine-group based, coarse 'j' defensive).
function isNonFoodItem(raw) {
  return EXCLUDED_FINE_GROUPS.includes(raw.fineFoodGroup) || raw.coarseFoodGroup === 'j';
}

/**
 * Build the full detail payload for RecipeDetailCard.
 * Falls back gracefully on auth errors or missing foodId.
 *
 * @param {Object} card - Recommendation object (must include foodId, name, image, matchedConditions, group)
 * @param {Object} [profile] - User profile from storage (optional; read from storage if omitted)
 * @returns {Promise<Object>} RecipeDetailCard recipe prop
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
          .filter((f) => f.foodItemID !== card.foodId && !isNonFoodItem(f))
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

/**
 * Build the RecipeDetail.jsx (bottom-sheet) payload for a real recipe —
 * title/photo/sourceName/matchedConditions carried over from the recipe
 * card, plus a real per-ingredient breakdown (hero recipe + complementary
 * foods from /topdoordonts) with `signal` derived from assessFood's
 * reconciled tier so IngredientRow/SignalChip render real data instead of
 * a guess. Falls back to a single hero "ingredient" (the recipe itself) if
 * assessFood/topdoordonts fail or the recipe has no foodId.
 *
 * @param {import('./types.js').Recipe} recipe - Recipe card (must include foodId for real data)
 * @param {import('./types.js').Profile} [profile] - User profile (optional; read from storage if omitted)
 * @returns {Promise<import('./types.js').Recipe & { ingredients: Array<{name: string, image: string, signal: string, matchedConditions: string[]}> }>}
 */
export async function buildRecipeIngredients(recipe, profile) {
  const resolvedProfile = profile ?? storage.get('profile', null);
  const conditions = resolvedProfile?.conditions?.length
    ? resolvedProfile.conditions
    : DEFAULT_DEV_CONDITIONS;

  let matchedConditions = recipe.matchedConditions ?? [];
  let ingredients = [];

  if (recipe.foodId) {
    try {
      const assessment = await assessFood(recipe.foodId, { ...resolvedProfile, conditions });
      if (assessment?.perCondition?.length) {
        const helpful = assessment.perCondition
          .filter((c) => c.tier === 'Top' || c.tier === 'Strong' || c.tier === 'Good')
          .sort((a, b) => (b.referenceCount ?? 0) - (a.referenceCount ?? 0));
        if (helpful.length) {
          matchedConditions = helpful.map((c) => c.conditionName);
        }
      }
    } catch {
      // assessFood failure: keep matchedConditions fallback
    }

    try {
      const conditionIdStr = conditions.join(',');
      const tops = await fetchTopDoOrDonts(conditionIdStr, 'consume', 10);
      if (tops?.length) {
        const others = tops
          .filter((f) => f.foodItemID !== recipe.foodId && !isNonFoodItem(f))
          .slice(0, 4)
          .map((f) => {
            const name = f.displayAs || f.description || 'Unknown';
            return {
              name,
              image: getIngredientImage(name, f.coarseFoodGroup),
              foodId: f.foodItemID,
              signal: 'beneficial',
              matchedConditions,
            };
          });
        ingredients = [
          {
            name: recipe.title,
            image: recipe.photo,
            foodId: recipe.foodId,
            signal: recipe.tier === 'poor' ? 'neutral' : 'beneficial',
            matchedConditions,
          },
          ...others,
        ];
      }
    } catch {
      // fallback: just the hero recipe below
    }
  }

  if (!ingredients.length) {
    ingredients = [{
      name: recipe.title,
      image: recipe.photo,
      foodId: recipe.foodId ?? null,
      signal: recipe.tier === 'poor' ? 'neutral' : 'beneficial',
      matchedConditions,
    }];
  }

  return { ...recipe, matchedConditions, ingredients };
}
