/**
 * prefetch.js — boot-time / post-onboarding cache warming.
 *
 * Front-loads the same calls the first screens a user lands on (Home,
 * Suggestions/Best & Worst Choices, Food & Nutrient Lookup) would make
 * anyway, using the EXISTING adapter/api functions so cache keys and the
 * in-flight de-dupe in nutridigm.js line up exactly with what the screens
 * request. This must never add net-new API spend — it only moves the
 * moment those calls happen earlier (to boot / right after onboarding)
 * so the cache is already warm by the time a screen mounts.
 *
 * Entirely fire-and-forget: every promise chain ends in `.catch(() => {})`
 * so a failure here never surfaces to the user and never throws.
 */

import { getSuggestions, getWorstFoods, getFoodDictionary, getFoodGroups, getConditions } from './adapter.js';
import { getRecommendations } from './recommendations.js';
import { getIngredientImage } from './ingredientImages.js';
import { IS_CONFIGURED } from './config.js';

/**
 * Guards dictionary warming (fooditems/foodgroups/healthconditions) — these
 * don't depend on a profile, so they run once on the very first call
 * (typically boot, before onboarding has produced a profile).
 */
let _warmedDictionaries = false;

/**
 * Guards profile-scoped warming (suggestions/images/worst-foods/recommendations)
 * — runs once, the first time a call is made WITH a non-empty profile. Kept
 * independent from `_warmedDictionaries` so a boot call with no profile can
 * never block the later post-onboarding call that actually has one.
 */
let _warmedProfile = false;

/** How many top foods (round-robined across categories) to pre-warm images for. */
const IMAGE_WARM_COUNT = 12;

/**
 * Round-robin the first items of each category until `count` foods are
 * collected (or categories are exhausted).
 * @param {Array<{ foods: Array<{ name: string, group: string }> }>} categories
 * @param {number} count
 * @returns {Array<{ name: string, group: string }>}
 */
function collectTopFoods(categories, count) {
  const foods = [];
  let round = 0;
  while (foods.length < count) {
    let addedAny = false;
    for (const category of categories) {
      const food = category.foods?.[round];
      if (food) {
        foods.push(food);
        addedAny = true;
        if (foods.length >= count) break;
      }
    }
    if (!addedAny) break;
    round += 1;
  }
  return foods;
}

/**
 * Pre-warm the Unsplash images for the top foods surfaced by Suggestions.
 * @param {import('./types.js').SuggestionsResult} suggestions
 */
function warmImages(suggestions) {
  const foods = collectTopFoods(suggestions?.categories || [], IMAGE_WARM_COUNT);
  for (const food of foods) {
    try {
      const img = new Image();
      img.fetchPriority = 'low';
      img.decoding = 'async';
      img.src = getIngredientImage(food.name, food.group);
    } catch {
      /* ignore — best-effort image warming only */
    }
  }
}

/**
 * Fire-and-forget cache warming. Safe to call multiple times (or concurrently
 * from boot + onboarding) and safe to call with or without a profile:
 *
 * - Dictionary warming (getFoodDictionary, getFoodGroups, getConditions) has
 *   no profile dependency, so it runs on the very first call regardless of
 *   whether a profile exists yet (e.g. an un-onboarded boot call).
 * - Profile-scoped warming (getSuggestions→warmImages, getWorstFoods,
 *   getRecommendations) only runs once a non-empty `profile.conditions` is
 *   available — which may be on this same call or a later one (e.g. right
 *   after onboarding completes).
 *
 * The two are gated by independent one-shot guards so an early no-profile
 * boot call can never block the later post-onboarding call from doing its
 * (separate) warming work.
 * @param {import('./types.js').Profile} [profile]
 */
export function prefetchAppData(profile) {
  if (!IS_CONFIGURED) return;

  if (!_warmedDictionaries) {
    _warmedDictionaries = true;
    getFoodDictionary().catch(() => {});
    getFoodGroups().catch(() => {});
    getConditions().catch(() => {});
  }

  if (!_warmedProfile && profile?.conditions?.length) {
    _warmedProfile = true;

    getSuggestions(profile)
      .then((suggestions) => warmImages(suggestions))
      .catch(() => {});

    getWorstFoods(profile).catch(() => {});
    getRecommendations('breakfast', 0, 1).catch(() => {});
  }
}
