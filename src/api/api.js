/**
 * api.js — The single interface every screen imports.
 *
 * Exposes the typed Nutridigm adapter functions and a small set of
 * legacy helpers (profile storage, swipe deck, recipe stub) that
 * screens still call via `api.*`.
 */

import {
  searchFoods,
  assessFood,
  getSuggestions,
  getWorstFoods,
  getTopDosAndDonts,
  getAlternatives,
  getCategoryDetail,
  buildMealPlan,
  getRecipes,
  getConditions,
  getFoodGroups,
  getFoodDictionary,
  getFoodFacts,
  getNutritionFacts,
  getConditionName,
  getConditionNames,
  getConditionIdByName,
  getFoodIdByName,
  getGroupLabel,
  getGroupLabels,
  getCachedRefCount,
  warmReferenceCount,
} from './adapter.js';
import { fetchReferences } from './nutridigm.js';
import { storage } from './storage.js';
import { schedulePush } from './profileSync.js';

// ── Re-export typed interface ────────────────────────────────────────────────

export {
  searchFoods,
  assessFood,
  getSuggestions,
  getWorstFoods,
  getTopDosAndDonts,
  getAlternatives,
  getCategoryDetail,
  buildMealPlan,
  getRecipes,
  getConditions,
  getFoodGroups,
  getFoodDictionary,
  getFoodFacts,
  getNutritionFacts,
  getConditionName,
  getConditionNames,
  getGroupLabel,
  getGroupLabels,
  getCachedRefCount,
  warmReferenceCount,
};

// ── Unified search (foods only) ──────────────────────────────────────────────

/**
 * Search across foods. Returns tagged results with `kind: 'food'`.
 * @param {string} query
 * @param {import('./types.js').Profile} [profile]
 * @returns {Promise<Array<{ kind: 'food', key: string, food: object }>>}
 */
export async function searchFoodsAndRecipes(query, profile) {
  const q = (query || '').trim();
  if (!q) return [];

  const foods = await searchFoods(q, profile).catch((err) => {
    console.error('searchFoodsAndRecipes: searchFoods failed', err);
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

export const api = {
  // ── New typed interface (accessible via api.* too) ──────────────────────────
  searchFoods,
  assessFood,
  getSuggestions,
  getTopDosAndDonts,
  getAlternatives,
  getCategoryDetail,
  buildMealPlan,
  getConditions,
  getFoodGroups,
  getFoodDictionary,
  getFoodFacts,
  getNutritionFacts,
  getConditionName,
  getConditionNames,
  searchFoodsAndRecipes,
  getRecipes,
  getCachedRefCount,
  warmReferenceCount,

  // ── Profile ─────────────────────────────────────────────────────────────────

  async getProfile() {
    await delay(200);
    const migrated = await migrateProfileConditions(_profile);
    if (migrated !== _profile) {
      _profile = migrated;
      storage.set('profile', _profile);
    }
    return _profile;
  },

  async saveProfile(p) {
    await delay(200);
    _profile = { ...p };
    storage.set('profile', _profile);
    schedulePush();
  },

  async clearProfile() {
    await delay(100);
    _profile = null;
    storage.remove('profile');
    schedulePush();
  },

  // ── Swipe deck (taste calibration) ──────────────────────────────────────────
  // Returns up to 20 real foods from the dictionary, shaped for SwipeDeck.

  async getSwipeDeck() {
    const foods = await getFoodDictionary();
    const slice = foods.slice(0, 20);
    return Promise.all(
      slice.map(async (f) => ({
        id: f.id,
        name: f.name,
        category: await getGroupLabel(f.fineGroup || f.group),
      }))
    );
  },

  // ── References ────────────────────────────────────────────────────────────
  // Used by RecipeDetail (IngredientRow) to lazily load citations for an
  // ingredient when its studies accordion is expanded.

  /**
   * Resolve an ingredient name + condition (display name, as passed by
   * RecipeDetail's matchedConditions, or a numeric healthConditionID) to
   * their Nutridigm IDs and fetch the supporting citations via /references.
   * Returns [] if either side can't be resolved, or on any fetch error.
   * @param {string} name - Ingredient/food display name
   * @param {string|number} condition - Condition display name or healthConditionID
   * @returns {Promise<string[]>}
   */
  async getIngredientReferences(name, condition) {
    try {
      const foodId = await getFoodIdByName(name);
      if (!foodId) return [];

      const conditionId =
        typeof condition === 'number' ? condition : await getConditionIdByName(condition);
      if (!conditionId) return [];

      const refs = await fetchReferences(conditionId, foodId);
      return refs || [];
    } catch {
      return [];
    }
  },
};
