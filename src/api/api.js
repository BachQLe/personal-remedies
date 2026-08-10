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
  getSuggestions,
  getWorstFoods,
  getTopDosAndDonts,
  getCategoryDetail,
  buildMealPlan,
  getRecipes,
  getMealPlanSuggestions,
  getConditions,
  getFoodGroups,
  getFoodDictionary,
  getFoodFacts,
  getConditionName,
  getConditionNames,
  getGroupLabel,
  getGroupLabels,
  getFineGroupLabelsByCoarse,
  getCachedRefCount,
  getFoodIdByName,
} from './adapter.js';
import { storage } from './storage.js';
import { schedulePush } from './profileSync.js';

// ── Re-export typed interface ────────────────────────────────────────────────

export {
  searchFoods,
  searchNaturalSources,
  assessFood,
  getSuggestions,
  getWorstFoods,
  getTopDosAndDonts,
  getCategoryDetail,
  buildMealPlan,
  getRecipes,
  getMealPlanSuggestions,
  getConditions,
  getFoodGroups,
  getFoodDictionary,
  getFoodFacts,
  getConditionName,
  getConditionNames,
  getGroupLabel,
  getGroupLabels,
  getFineGroupLabelsByCoarse,
  getCachedRefCount,
  getFoodIdByName,
};
export { buildRecipeDetail } from './recipeDetail.js';
export { ensurePlanForWeek, regenerateDay, regenerateWeek, shuffleSlot, inferSlotKey, generatePlanFromPicks } from './planBuilder.js';

// ── Unified search (foods + recipes) ─────────────────────────────────────────

/**
 * Search across foods and recipes. Foods come from `searchFoods` (client-side
 * dictionary filter); recipes come from the profile's condition-ranked
 * `getRecipes` list (already cached), filtered client-side by title substring
 * (case-insensitive — /suggest has no query param). Recipe entries are
 * appended after food entries; either side failing degrades to its empty
 * list rather than failing the whole search.
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

  const foods = await searchFoods(q, profile).catch((err) => {
    console.error('searchFoodsAndRecipes: searchFoods failed', err);
    return [];
  });

  const { recipes } = await getRecipes(profile).catch((err) => {
    console.error('searchFoodsAndRecipes: getRecipes failed', err);
    return { recipes: [] };
  });

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
 * @param {string} query
 * @param {import('./types.js').Profile} [_profile] - Unused; kept for parity
 *   with `searchFoodsAndRecipes` in case scoping by profile is added later.
 * @returns {Promise<Array<{ kind: 'food', key: string, food: object }>>}
 */
export async function searchNaturalSourceItems(query, _profile) {
  const q = (query || '').trim();
  if (!q) return [];

  const foods = await searchNaturalSources(q).catch((err) => {
    console.error('searchNaturalSourceItems: searchNaturalSources failed', err);
    return [];
  });

  return foods.map((f) => ({ kind: 'food', key: `food-${f.id}`, food: f }));
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
