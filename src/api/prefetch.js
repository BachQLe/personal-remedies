/**
 * prefetch.js — boot-time / post-onboarding cache warming.
 *
 * Front-loads the same calls the first screens a user lands on (Home,
 * Suggestions/Dietary Guidance, Top Dos & Don'ts, Daily Picks) would make
 * anyway, using the EXISTING adapter/api functions so cache keys and the
 * in-flight de-dupe in nutridigm.js line up exactly with what the screens
 * request. This must never add net-new API spend — it only moves the
 * moment those calls happen earlier (to boot / right after onboarding)
 * so the cache is already warm by the time a screen mounts.
 *
 * Entirely fire-and-forget: every promise chain ends in `.catch(() => {})`
 * so a failure here never surfaces to the user and never throws.
 */

import { getSuggestions, getWorstFoods, getFoodDictionary, getFoodGroups } from './adapter.js';
import { getRecommendations } from './recommendations.js';
import { getIngredientImage } from './ingredientImages.js';
import { IS_CONFIGURED } from './config.js';

/** Guards against StrictMode double-invoked effects and boot/onboarding overlap. */
let _ran = false;

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
 * Fire-and-forget cache warming for the given profile. Safe to call multiple
 * times (or concurrently from boot + onboarding) — only the first call in
 * the page lifetime does any work.
 * @param {import('./types.js').Profile} profile
 */
export function prefetchAppData(profile) {
  if (_ran) return;
  _ran = true;

  if (!IS_CONFIGURED) return;
  if (!profile?.conditions?.length) return;

  getSuggestions(profile)
    .then((suggestions) => warmImages(suggestions))
    .catch(() => {});

  getWorstFoods(profile).catch(() => {});
  getFoodDictionary().catch(() => {});
  getFoodGroups().catch(() => {});
  getRecommendations('breakfast', 0, 1).catch(() => {});
}
