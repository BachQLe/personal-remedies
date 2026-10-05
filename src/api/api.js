/**
 * api.js — The single interface every screen imports.
 *
 * Named-exports-only surface: the typed Nutridigm adapter functions,
 * unified search helpers, and profile storage helpers (`getProfile`,
 * `saveProfile`, `clearProfile`) are all plain module-level exports —
 * there is no `api` object; import exactly what you need.
 */

import {
  searchFoods,
  searchNaturalSources,
  assessFood,
  getGoodForMe,
  getSuggestions,
  getWorstFoods,
  getTopDosAndDonts,
  getCategoryDetail,
  buildMealPlan,
  getRecipes,
  getMealPlanSuggestions,
  getSlotSubstitutes,
  getIngredientAlternatives,
  guessMealType,
  getConditions,
  getFoodGroups,
  getFoodDictionary,
  getFoodFacts,
  getConditionName,
  getConditionNames,
  getGroupLabel,
  getGroupLabels,
  getFineGroupLabelsByCoarse,
  getFineFoodGroups,
  getFineGroupSuggestions,
  getCachedRefCount,
  getFoodIdByName,
} from './adapter.js';
import { rankFoodsByNutrient } from './nutrientFacts.js';
import { storage } from './storage.js';
import { schedulePush } from './profileSync.js';

// ── Re-export typed interface ────────────────────────────────────────────────

export {
  searchFoods,
  searchNaturalSources,
  assessFood,
  getGoodForMe,
  getSuggestions,
  getWorstFoods,
  getTopDosAndDonts,
  getCategoryDetail,
  buildMealPlan,
  getRecipes,
  getMealPlanSuggestions,
  getSlotSubstitutes,
  getIngredientAlternatives,
  guessMealType,
  getConditions,
  getFoodGroups,
  getFoodDictionary,
  getFoodFacts,
  getConditionName,
  getConditionNames,
  getGroupLabel,
  getGroupLabels,
  getFineGroupLabelsByCoarse,
  getFineFoodGroups,
  getFineGroupSuggestions,
  getCachedRefCount,
  getFoodIdByName,
};
export { buildRecipeDetail } from './recipeDetail.js';
export { ensurePlanForWeek, regenerateDay, regenerateWeek, shuffleSlot, inferSlotKey, generatePlanFromPicks, toPlanItem, getSavedPlans, saveCurrentPlan, updateSavedPlan, loadSavedPlan, deleteSavedPlan, restoreSavedPlan, getCandidatesForSlot, planFingerprint, getActiveSavedPlan, clearActiveSavedPlan, restoreActiveSavedPlan } from './planBuilder.js';

// ── Unified search (foods + recipes) ─────────────────────────────────────────

/**
 * Search across foods and recipes. Foods come from `searchFoods` (client-side
 * dictionary filter); recipes come from the profile's condition-ranked
 * `getRecipes` list (already cached), filtered client-side by title substring
 * (case-insensitive — /suggest has no query param). Recipe entries are
 * appended after food entries.
 *
 * Partial-vs-total failure (binding project rule — an error must never be
 * presented to the user as "no results"): the two sources are fanned out via
 * `Promise.allSettled`. One side failing while the other succeeds is normal,
 * expected degradation — that side contributes its empty list (logged), and
 * the search still resolves with whatever the healthy side found. Only when
 * BOTH sides fail (a genuine outage — network down, API down) does this
 * throw, so callers (e.g. `useAsyncData`) can render an honest error state
 * instead of an empty result indistinguishable from a real zero-result
 * search.
 * @param {string} query
 * @param {import('./types.js').Profile} [profile]
 * @returns {Promise<Array<
 *   { kind: 'food', key: string, food: object } |
 *   { kind: 'recipe', key: string, recipe: object }
 * >>}
 */
export async function searchFoodsAndRecipes(query, profile) {
  const q = (query || '').trim();
  if (!q) return [];

  const [foodsResult, recipesResult] = await Promise.allSettled([
    searchFoods(q, profile),
    getRecipes(profile),
  ]);

  if (foodsResult.status === 'rejected' && recipesResult.status === 'rejected') {
    console.error('searchFoodsAndRecipes: all sources failed', foodsResult.reason, recipesResult.reason);
    throw recipesResult.reason;
  }

  if (foodsResult.status === 'rejected') {
    console.error('searchFoodsAndRecipes: searchFoods failed', foodsResult.reason);
  }
  if (recipesResult.status === 'rejected') {
    console.error('searchFoodsAndRecipes: getRecipes failed', recipesResult.reason);
  }

  const foods = foodsResult.status === 'fulfilled' ? foodsResult.value : [];
  const recipes = recipesResult.status === 'fulfilled' ? recipesResult.value.recipes : [];

  const qLower = q.toLowerCase();
  const matchedRecipes = recipes.filter((r) => (r.title || '').toLowerCase().includes(qLower));

  return [
    ...foods.map((f) => ({ kind: 'food', key: `food-${f.id}`, food: f })),
    ...matchedRecipes.map((r) => ({ kind: 'recipe', key: `recipe-${r.id}`, recipe: r })),
  ];
}

/**
 * Search Natural Sources (Key Nutrients & Herbal Medicines, coarse group 'k')
 * only. Same result-item contract as `searchFoodsAndRecipes`'s food entries —
 * foods only, no recipe branch, since recipes live in a different fine group.
 *
 * Single source, no fan-out — unlike `searchFoodsAndRecipes` there's nothing
 * to partially degrade to, so any failure here IS a total failure and is
 * left to propagate rather than being swallowed into an indistinguishable-
 * from-real-empty `[]` (binding project rule: an error must never be
 * presented to the user as "no results").
 * @param {string} query
 * @param {import('./types.js').Profile} [_profile] - Unused; kept for parity
 *   with `searchFoodsAndRecipes` in case scoping by profile is added later.
 * @returns {Promise<Array<{ kind: 'food', key: string, food: object }>>}
 */
export async function searchNaturalSourceItems(query, _profile) {
  const q = (query || '').trim();
  if (!q) return [];

  const foods = await searchNaturalSources(q);

  return foods.map((f) => ({ kind: 'food', key: `food-${f.id}`, food: f }));
}

/**
 * Unified search across ALL of foods, recipes, nutrients, and herbal
 * supplements — powers the single "Food & Nutrient Lookup" screen (no mode
 * switcher; results are sectioned by kind instead of picking a source
 * up-front). Supersedes the food-vs-natural-sources split that
 * `searchFoodsAndRecipes` / `searchNaturalSourceItems` (above) used to back
 * as two separate screens; those two functions stay exported/working since
 * existing tests still cover them, but this is what SearchScreen calls now.
 *
 * Sources:
 *  - `foods`: `searchFoods` (dictionary; already excludes coarse group 'k' —
 *    see its doc comment in adapter.js)
 *  - `recipes`: `getRecipes`, filtered client-side by title substring
 *    (case-insensitive — /suggest has no query param), same as
 *    `searchFoodsAndRecipes` above
 *  - `nutrients` / `herbals`: both come from ONE `searchNaturalSources` call
 *    (coarse group 'k'), split client-side on the `fineGroup` field
 *    `normalizeFood` already stamps on every result — 'k1' (Vitamins,
 *    Minerals & Other) -> nutrients, 'k2' (Herbal Supplements) -> herbals.
 *    See adapter.js's `searchNaturalSources` doc comment for why no second
 *    dictionary scan is needed for the split.
 *
 * Honesty contract (same binding project rule as `searchFoodsAndRecipes` /
 * `searchNaturalSourceItems`: an error must never be presented as "no
 * results"): the three underlying calls (`searchFoods`, `searchNaturalSources`,
 * `getRecipes`) are fanned out via `Promise.allSettled`. Only when ALL THREE
 * reject (a genuine outage) does this throw; if only some reject, those
 * sources degrade to an empty contribution to their section(s) (console
 * .error'd) while the sections backed by the sources that succeeded still
 * render normally.
 * @param {string} query
 * @param {import('./types.js').Profile} [profile]
 * @returns {Promise<{
 *   foods: Array<{ kind: 'food', key: string, food: object }>,
 *   recipes: Array<{ kind: 'recipe', key: string, recipe: object }>,
 *   nutrients: Array<{ kind: 'food', key: string, food: object }>,
 *   herbals: Array<{ kind: 'food', key: string, food: object }>,
 * }>}
 */
export async function searchEverything(query, profile) {
  const q = (query || '').trim();
  if (!q) return { foods: [], recipes: [], nutrients: [], herbals: [] };

  const [foodsResult, naturalResult, recipesResult] = await Promise.allSettled([
    searchFoods(q, profile),
    searchNaturalSources(q),
    getRecipes(profile),
  ]);

  if (
    foodsResult.status === 'rejected' &&
    naturalResult.status === 'rejected' &&
    recipesResult.status === 'rejected'
  ) {
    console.error(
      'searchEverything: all sources failed',
      foodsResult.reason,
      naturalResult.reason,
      recipesResult.reason,
    );
    throw foodsResult.reason;
  }

  if (foodsResult.status === 'rejected') {
    console.error('searchEverything: searchFoods failed', foodsResult.reason);
  }
  if (naturalResult.status === 'rejected') {
    console.error('searchEverything: searchNaturalSources failed', naturalResult.reason);
  }
  if (recipesResult.status === 'rejected') {
    console.error('searchEverything: getRecipes failed', recipesResult.reason);
  }

  const foods = foodsResult.status === 'fulfilled' ? foodsResult.value : [];
  const naturalItems = naturalResult.status === 'fulfilled' ? naturalResult.value : [];
  const recipes = recipesResult.status === 'fulfilled' ? recipesResult.value.recipes : [];

  const qLower = q.toLowerCase();
  const matchedRecipes = recipes.filter((r) => (r.title || '').toLowerCase().includes(qLower));
  const nutrients = naturalItems.filter((f) => f.fineGroup === 'k1');
  const herbals = naturalItems.filter((f) => f.fineGroup === 'k2');

  return {
    foods: foods.map((f) => ({ kind: 'food', key: `food-${f.id}`, food: f })),
    recipes: matchedRecipes.map((r) => ({ kind: 'recipe', key: `recipe-${r.id}`, recipe: r })),
    nutrients: nutrients.map((f) => ({ kind: 'food', key: `food-${f.id}`, food: f })),
    herbals: herbals.map((f) => ({ kind: 'food', key: `food-${f.id}`, food: f })),
  };
}

/**
 * Natural Sources ranking: the top foods for one nutrient, per serving
 * (per-100g carried as the secondary figure). Candidates are the food
 * dictionary minus non-food items (adapter `isExcludedItem` — lifestyle,
 * recipes — already applied by `getFoodDictionary`) and minus coarse group
 * 'k' supplements. Only foods with real USDA data can rank.
 * @param {string} nutrientKey - key from PICKABLE_NUTRIENTS (e.g. 'fiber')
 * @param {{limit?: number}} [opts]
 */
export async function getTopNutrientSources(nutrientKey, opts = {}) {
  const dictionary = await getFoodDictionary();
  const foods = dictionary.filter((f) => f.group !== 'k');
  return rankFoodsByNutrient(foods, nutrientKey, { limit: opts.limit ?? 20 });
}

// ── Profile / storage helpers ────────────────────────────────────────────────

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

let _profile = storage.get('profile', null);

/**
 * One-time silent migration: older profiles stored `conditions` as an array
 * of name strings. Map each name to its healthConditionID (case-insensitive
 * match on `description`) using the cached conditions dictionary; unmatched
 * entries are dropped. Numeric profiles pass through untouched.
 * @param {import('./types.js').Profile|null} profile
 * @returns {Promise<import('./types.js').Profile|null>}
 */
async function migrateProfileConditions(profile) {
  if (!profile || !Array.isArray(profile.conditions) || !profile.conditions.length) {
    return profile;
  }
  const hasNameStrings = profile.conditions.some((c) => typeof c === 'string');
  if (!hasNameStrings) return profile;

  const dictionary = await getConditions();
  const byName = new Map(
    dictionary.map((c) => [c.description.toLowerCase().trim(), c.healthConditionID])
  );

  const migrated = profile.conditions
    .map((c) => {
      if (typeof c === 'number') return c;
      return byName.get(String(c).toLowerCase().trim());
    })
    .filter((id) => typeof id === 'number');

  return { ...profile, conditions: migrated };
}

// ── Profile ──────────────────────────────────────────────────────────────────

export async function getProfile() {
  await delay(200);
  let migrated = await migrateProfileConditions(_profile);
  if (migrated && migrated.calorieTarget == null) {
    migrated = { ...migrated, calorieTarget: 2000 };
  }
  if (migrated !== _profile) {
    _profile = migrated;
    storage.set('profile', _profile);
  }
  return _profile;
}

export async function saveProfile(p) {
  await delay(200);
  _profile = { ...p };
  storage.set('profile', _profile);
  schedulePush();
}

export async function clearProfile() {
  await delay(100);
  _profile = null;
  storage.remove('profile');
  schedulePush();
}
