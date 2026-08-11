/**
 * adapter.js — Maps raw Nutridigm API responses to typed shapes.
 *
 * This layer:
 * - Normalizes field-name drift (displayAs / foodItemDisplayAs → name)
 * - Maps descriptionNumericID → tier (Top/Strong/Good/poor/null)
 * - Filters out non-food items by FINE group (lifestyle 'x'/'j1', recipes 'l')
 *   — see `isExcludedItem` — never by coarse group (coarse 'x' is also used
 *   by real foods like Taro leaves / pork liver)
 * - Historically NEVER exposed value/descriptionNumericID/numeric scores.
 *   RELAXED July 2026 (user-approved) for the rating feature: `assessFood`
 *   now also returns `score`/`verdict`/`numericId` alongside the existing
 *   `tier`. `numericId` feeds the 3-star/3-skull rating row — see
 *   `numericIdToRating` in src/utils/rating.js. Everything else
 *   items still carry no tier/score data (list membership + rank/listType
 *   IS the verdict there), and `referenceTotal: null` still means "unknown",
 *   never "zero".
 *
 * @typedef {import('./types.js')} Types
 */

import { EXCLUDED_FINE_GROUPS, COARSE_GROUP_LABELS, MEAL_SLOT_MAP, DEFAULT_DEV_CONDITIONS, PLAN_SLOTS, PLAN_SLOT_KEYS } from './config.js';
import { getIngredientImage } from './ingredientImages.js';
import {
  fetchGoodFor,
  fetchTopDoOrDonts,
  fetchSuggest,
  fetchDetailed,
  fetchReferences,
  NutridigmAuthError,
} from './nutridigm.js';
import { cachedFetch, peekCache } from './cache.js';
import { getItemTable, getConditionTable, getGroupTable, getOverlayImageFile } from './localTables.js';
import { joinRecipeOverlay } from './recipeIngestion.js';

// ── Cache TTLs ────────────────────────────────────────────────────────────────

/** /topdoordonts results — cached per {conditionsCSV, consumeOrAvoid, limit}. */
export const TOPDOORDONTS_TTL_MS = 8 * 60 * 60 * 1000; // 8h

/** /suggest results for the recipe fine food group — cached per conditionsCSV. */
export const RECIPES_TTL_MS = 8 * 60 * 60 * 1000; // 8h

/** /detailed results — cached per {conditionsCSV, coarseGroup, listType}. */
export const DETAILED_TTL_MS = 8 * 60 * 60 * 1000; // 8h

/** /goodfor assessment results — cached per {conditionsCSV, foodId}. */
export const GOODFOR_TTL_MS = 8 * 60 * 60 * 1000; // 8h

/** /suggest results for Plan-slot fine food groups — cached per {conditionsCSV, fineFoodGroup}. */
export const SUGGEST_TTL_MS = 8 * 60 * 60 * 1000; // 8h

/**
 * /references citations — cached per (conditionId, foodId). Citations are
 * static curated data (not condition-set-dependent, not per-user), so this
 * is cached far longer than the request-shaped caches above and is safe to
 * key on the pair alone rather than the full conditionsCSV.
 */
export const REFERENCES_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7d

/** Fine food group that holds real Food Network recipes (condition-ranked). */
const RECIPE_FINE_GROUP = 'l';

/**
 * Cached wrapper around fetchTopDoOrDonts, keyed by the exact request
 * params so a fallback retry with DEFAULT_DEV_CONDITIONS caches under its
 * OWN key rather than colliding with (or shadowing) the profile's real
 * conditions.
 * @param {string} conditionsCSV
 * @param {'consume'|'avoid'} consumeOrAvoid
 * @param {number} limit
 * @returns {Promise<Array>}
 */
function cachedTopDoOrDonts(conditionsCSV, consumeOrAvoid, limit) {
  const key = `topdoordonts:${conditionsCSV}:${consumeOrAvoid}:${limit}`;
  return cachedFetch(key, TOPDOORDONTS_TTL_MS, () =>
    fetchTopDoOrDonts(conditionsCSV, consumeOrAvoid, limit)
  );
}

/**
 * Cached wrapper around fetchSuggest, keyed by {conditionsCSV, fineFoodGroup}.
 * Backs both `getRecipes` (fine group 'l', via its own `recipes:{csv}:l`
 * key — see `getRecipesRaw`) and `getMealPlanSuggestions` (the 10 Plan-slot
 * fine groups), so a fallback retry with DEFAULT_DEV_CONDITIONS caches under
 * its OWN key rather than colliding with the profile's real conditions.
 * @param {string} conditionsCSV
 * @param {string} fineFoodGroup
 * @returns {Promise<Array>}
 */
function cachedSuggest(conditionsCSV, fineFoodGroup) {
  const key = `suggest:${conditionsCSV}:${fineFoodGroup}`;
  return cachedFetch(key, SUGGEST_TTL_MS, () => fetchSuggest(conditionsCSV, fineFoodGroup));
}

/**
 * Cache key for a single (conditionId, foodId) /references lookup. Shared
 * between `cachedReferences` (write path) and `getCachedRefCount` (read-only
 * peek path) so the two never drift apart.
 * @param {number} conditionId
 * @param {number} foodId
 * @returns {string}
 */
function refsCacheKey(conditionId, foodId) {
  return `refs:${conditionId}:${foodId}`;
}

/**
 * Cached wrapper around fetchReferences, keyed by (conditionId, foodId).
 * Citations are static curated data, so a 7-day TTL means repeat FoodDetailCard
 * opens for the same food+condition cost zero /references calls.
 * @param {number} conditionId
 * @param {number} foodId
 * @returns {Promise<string[]>}
 */
function cachedReferences(conditionId, foodId) {
  const key = refsCacheKey(conditionId, foodId);
  return cachedFetch(key, REFERENCES_TTL_MS, () => fetchReferences(conditionId, foodId));
}

// ── Condition fallback ───────────────────────────────────────────────────────

/**
 * Centralized demo-condition fallback.
 *
 * Calls `fn(conditionIds)`. If it throws a NutridigmAuthError with code
 * NOTAUTHORIZEDHEALTHID (the demo subscription key can't score these
 * condition IDs), retries ONCE with DEFAULT_DEV_CONDITIONS and marks the
 * result as a fallback so the UI can show a "Demo data" chip.
 *
 * Does NOT retry on APIDAILYLIMITREACHED (quota exhausted — retrying with
 * different conditions won't help and would waste another call) or any
 * other error type (e.g. NutridigmConfigError), which are rethrown as-is.
 *
 * See types.js for how `usedFallback` is attached to object vs array results.
 *
 * @template T
 * @param {number[]} conditionIds
 * @param {(ids: number[]) => Promise<T>} fn
 * @returns {Promise<{ result: T, usedFallback: boolean }>}
 */
async function withConditionFallback(conditionIds, fn) {
  try {
    const result = await fn(conditionIds);
    return { result, usedFallback: false };
  } catch (err) {
    const isAuthError = err instanceof NutridigmAuthError || err?.name === 'NutridigmAuthError';
    if (isAuthError && err.code === 'NOTAUTHORIZEDHEALTHID') {
      const result = await fn(DEFAULT_DEV_CONDITIONS);
      return { result, usedFallback: true };
    }
    throw err;
  }
}

// ── Tier mapping ─────────────────────────────────────────────────────────────

/**
 * Map descriptionNumericID to a UI tier.
 * @param {number} numericId
 * @returns {import('./types.js').TierOrPoor}
 */
export function numericIdToTier(numericId) {
  switch (numericId) {
    case 1: return 'Top';
    case 2: return 'Strong';
    case 3: return 'Good';
    case 5:
    case 6:
    case 7: return 'poor';
    case 4:
    default: return null;
  }
}

// ── Food item cache ──────────────────────────────────────────────────────────

/** @type {Map<number, Object>|null} */
let _foodItemsCache = null;

/**
 * Ensure the food dictionary is loaded and cached.
 * Source is the local (bundled, zero-network) item table from
 * localTables.js — the in-memory Map keyed by foodItemID is built from it
 * once and memoized. Stays `async` (and callers keep `await`ing it)
 * purely to preserve the existing public call shape downstream; the actual
 * work is synchronous.
 * @returns {Promise<Map<number, Object>>}
 */
async function ensureFoodItems() {
  if (_foodItemsCache) return _foodItemsCache;

  _foodItemsCache = new Map();
  for (const item of getItemTable()) {
    _foodItemsCache.set(item.foodItemID, item);
  }
  return _foodItemsCache;
}

/** @type {Array|null} */
let _foodGroupsCache = null;

/**
 * Ensure the food group dictionary is loaded and cached. Source is the
 * local food group table from localTables.js. See `ensureFoodItems` for why
 * this stays `async` despite doing no actual async work.
 * @returns {Promise<Array>}
 */
async function ensureFoodGroups() {
  if (_foodGroupsCache) return _foodGroupsCache;
  _foodGroupsCache = getGroupTable();
  return _foodGroupsCache;
}

/** @type {{ coarse: Map<string, string>, fine: Map<string, string> }|null} */
let _groupLabelsCache = null;

/**
 * Real human labels for both coarse (b–l) and fine (b1, c3, ...) food
 * groups, sourced from the cached /foodgroups dictionary. This is the
 * source of truth for group labels — prefer this (or `getGroupLabel`) over
 * the static `COARSE_GROUP_LABELS` fallback in config.js.
 * @returns {Promise<{ coarse: Map<string, string>, fine: Map<string, string> }>}
 */
export async function getGroupLabels() {
  if (_groupLabelsCache) return _groupLabelsCache;

  const groups = await ensureFoodGroups();
  const coarse = new Map();
  const fine = new Map();
  for (const g of groups) {
    if (g.isCoarseFoodGroup) coarse.set(g.foodGroupID, g.description);
    if (g.isFineFoodGroup) fine.set(g.foodGroupID, g.description);
  }

  _groupLabelsCache = { coarse, fine };
  return _groupLabelsCache;
}

/** @type {Map<string, string[]>|null} */
let _fineGroupLabelsByCoarseCache = null;

/**
 * Fine-group display labels bucketed by their coarse-group letter, sourced
 * from the same cached /foodgroups dictionary as `getGroupLabels`. Each
 * bucket is sorted by foodGroupID (e.g. 'b' → ['Fish & Seafood', 'Meat, Red
 * Meat & Organ Meats', 'Poultry'], from b1/b2/b3).
 *
 * Bucketing is a plain `foodGroupID[0]` prefix match — the excluded fine
 * codes ('x', 'j1', 'l', see `EXCLUDED_FINE_GROUPS`) never prefix-match the
 * 9 UI grid letters (b,c,d,e,f,g,h,i,k), so no exclusion filtering is needed
 * here.
 * @returns {Promise<Map<string, string[]>>}
 */
export async function getFineGroupLabelsByCoarse() {
  if (_fineGroupLabelsByCoarseCache) return _fineGroupLabelsByCoarseCache;

  const groups = await ensureFoodGroups();
  const byCoarse = new Map();
  for (const g of groups) {
    if (!g.isFineFoodGroup) continue;
    const coarseLetter = g.foodGroupID[0];
    if (!byCoarse.has(coarseLetter)) byCoarse.set(coarseLetter, []);
    byCoarse.get(coarseLetter).push(g);
  }

  const result = new Map();
  for (const [coarseLetter, fineGroups] of byCoarse) {
    fineGroups.sort((a, b) => (a.foodGroupID < b.foodGroupID ? -1 : a.foodGroupID > b.foodGroupID ? 1 : 0));
    result.set(coarseLetter, fineGroups.map((g) => g.description));
  }

  _fineGroupLabelsByCoarseCache = result;
  return _fineGroupLabelsByCoarseCache;
}

/**
 * Resolve a single food group code (fine or coarse) to its real display
 * label. Checks fine groups first (more specific, e.g. 'b1' → 'Fish &
 * Seafood'), then coarse groups, then falls back to the static
 * `COARSE_GROUP_LABELS` map (offline fallback), and finally the raw code
 * itself if nothing matches.
 * @param {string} code - Fine or coarse food group code
 * @returns {Promise<string>}
 */
export async function getGroupLabel(code) {
  if (!code) return code;
  try {
    const { coarse, fine } = await getGroupLabels();
    if (fine.has(code)) return fine.get(code);
    if (coarse.has(code)) return coarse.get(code);
  } catch {
    // fall through to static fallback below
  }
  return COARSE_GROUP_LABELS[code] || code;
}

/** @type {Array|null} */
let _healthConditionsCache = null;

/**
 * Ensure the health condition dictionary is loaded and cached. Source is
 * the local health condition table from localTables.js. See
 * `ensureFoodItems` for why this stays `async` despite doing no actual
 * async work.
 * @returns {Promise<Array>}
 */
async function ensureHealthConditions() {
  if (_healthConditionsCache) return _healthConditionsCache;
  _healthConditionsCache = getConditionTable();
  return _healthConditionsCache;
}

// ── Normalization ────────────────────────────────────────────────────────────

/**
 * True when a raw food item should be excluded from food-facing lists.
 *
 * Filters by FINE group (not coarse) so real foods that happen to carry
 * `coarseFoodGroup: 'x'` (e.g. Taro leaves — fine 'e', coarse 'x'; pork
 * liver — fine 'b2', coarse 'x') are never dropped. Excluded when:
 * - fine group is 'x', 'j1', or 'l' (lifestyle/behavior items, recipes)
 * - coarse group is 'j' (defensive: any lifestyle item, regardless of fine code)
 * - no fine group is present AND coarse group is 'x' or 'l' (nothing to
 *   rescue the item with, so fall back to the coarse signal)
 * @param {Object} raw - Raw API item
 * @returns {boolean}
 */
export function isExcludedItem(raw) {
  const fine = raw.fineFoodGroup;
  if (fine && EXCLUDED_FINE_GROUPS.includes(fine)) return true;
  if (raw.coarseFoodGroup === 'j') return true;
  if (!fine && ['x', 'l'].includes(raw.coarseFoodGroup)) return true;
  return false;
}

/**
 * The coarse group to display/bucket a raw food item under.
 *
 * Nutridigm uses coarse group 'x' as a catch-all for some real foods whose
 * fine group is more specific (Taro leaves: fine 'e', coarse 'x'). When
 * coarse is 'x' or missing, derive the display group from the first
 * character of the fine group instead (e.g. 'b2' → 'b', 'e' → 'e').
 * @param {Object} raw - Raw API item
 * @returns {string}
 */
function effectiveCoarseGroup(raw) {
  const coarse = raw.coarseFoodGroup;
  if (coarse && coarse !== 'x') return coarse;
  const fine = raw.fineFoodGroup;
  if (fine) return fine.charAt(0);
  return coarse || '';
}

/**
 * Normalize a raw food item to the typed Food shape.
 * Handles field drift: displayAs (fooditems/topdoordonts) vs foodItemDisplayAs (suggest/detailed).
 * Note: `groupLabel` is NOT attached here since normalizeFood is synchronous
 * and label resolution is async (cached but still a promise) — callers that
 * need a resolved label should use `attachGroupLabel` below.
 * @param {Object} raw - Raw API item
 * @returns {import('./types.js').Food}
 */
function normalizeFood(raw) {
  return {
    id: raw.foodItemID,
    name: raw.displayAs || raw.foodItemDisplayAs || raw.description || 'Unknown',
    group: effectiveCoarseGroup(raw),
    fineGroup: raw.fineFoodGroup || '',
    tier: raw.descriptionNumericID != null ? numericIdToTier(raw.descriptionNumericID) : undefined,
    notes: raw.notes || undefined,
  };
}

/**
 * Normalize a topdoordonts item to Food shape.
 * @param {Object} raw
 * @returns {import('./types.js').Food}
 */
function normalizeTopFood(raw) {
  return {
    id: raw.foodItemID,
    name: raw.displayAs || raw.description || 'Unknown',
    group: effectiveCoarseGroup(raw),
    fineGroup: raw.fineFoodGroup || '',
    notes: raw.notes || undefined,
  };
}

/**
 * Normalize a /detailed item to Food shape.
 *
 * /detailed responses carry `{ foodItemID, foodItemDisplayAs, description,
 * notes, value, healthConditionID }` — no descriptionNumericID and no group
 * fields at all, so `group` is injected from the request (the coarseGroup
 * the caller asked for) rather than read off the raw item. No `tier` is set:
 * list membership (helpful/neutral/harmful) IS the verdict for this
 * endpoint, and the raw `value` must never be exposed.
 * @param {Object} raw
 * @param {string} coarseGroup - The coarse group requested (injected, not on raw)
 * @returns {import('./types.js').Food}
 */
function normalizeDetailedFood(raw, coarseGroup) {
  return {
    id: raw.foodItemID,
    name: raw.foodItemDisplayAs || raw.description || 'Unknown',
    group: coarseGroup,
    fineGroup: '',
    notes: raw.notes || undefined,
  };
}

/**
 * Attach a resolved `groupLabel` (real human label, fine-group-preferred) to
 * a Food, mutating and returning it. Centralizes label resolution so
 * consumers (suggestions, food detail views) stay dumb and just render
 * `food.groupLabel`.
 * @param {import('./types.js').Food} food
 * @returns {Promise<import('./types.js').Food>}
 */
async function attachGroupLabel(food) {
  food.groupLabel = await getGroupLabel(food.fineGroup || food.group);
  return food;
}

// ── Recipe helpers ───────────────────────────────────────────────────────────

/**
 * Split a raw Nutridigm `notes` string on ';', trim each segment, drop
 * empties, and dedupe case-insensitively (first occurrence's original
 * casing wins). Shared by `parseSourceName` (recipe source name) here and
 * by `cleanNotes` in recommendations.js (blurb text) — both see the same
 * "FN; Giada De Laurentiis;; FN; Giada De Laurentiis;"-shaped duplication
 * from the API and need it cleaned identically before diverging in what
 * they do with the result.
 * @param {string} notes - Non-empty notes string (callers guard the empty case).
 * @returns {string[]}
 */
export function dedupeNotes(notes) {
  const segments = notes
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set();
  const deduped = [];
  for (const seg of segments) {
    const key = seg.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(seg);
    }
  }
  return deduped;
}

/**
 * Parse a recipe's `notes` field into a display sourceName.
 *
 * Observed format: "FN; Giada De Laurentiis;; FN; Giada De Laurentiis;"
 * — semicolon-separated clauses, duplicated, sometimes with extra clauses
 * (e.g. "see also recipe for biscuit crust", "FN Kitchen"). We split on
 * ';', trim, drop empties, dedupe (via `dedupeNotes`), map the "FN"/"FN
 * Kitchen" network abbreviation to "Food Network", and join the network +
 * first chef name found as "Food Network · <chef>".
 *
 * Examples:
 *   "FN; Giada De Laurentiis;; FN; Giada De Laurentiis;" → "Food Network · Giada De Laurentiis"
 *   "FN Kitchen;; FN Kitchen;"                            → "Food Network"
 *   "FN; Ina Garten;; see also recipe for biscuit crust"  → "Food Network · Ina Garten"
 *   "" / null / undefined                                 → "Food Network"
 *
 * @param {string} [notes]
 * @returns {string}
 */
function parseSourceName(notes) {
  if (!notes) return 'Food Network';

  const deduped = dedupeNotes(notes);

  let network = 'Food Network';
  let chef = null;
  for (const seg of deduped) {
    const lower = seg.toLowerCase();
    if (lower === 'fn' || lower === 'fn kitchen') {
      network = 'Food Network';
    } else if (!chef && !lower.startsWith('see also')) {
      chef = seg;
    }
  }

  return chef ? `${network} · ${chef}` : network;
}

/** [keyword, mealType] — checked in order, first substring match wins. */
const RECIPE_MEAL_TYPE_KEYWORDS = [
  ['oatmeal', 'breakfast'],
  ['pancake', 'breakfast'],
  ['omelet', 'breakfast'],
  ['scramble', 'breakfast'],
  ['granola', 'breakfast'],
  ['parfait', 'breakfast'],
  ['smoothie', 'breakfast'],
  ['soup', 'dinner'],
  ['chili', 'dinner'],
  ['stew', 'dinner'],
  ['roast', 'dinner'],
  ['salmon', 'dinner'],
  ['salad', 'lunch'],
  ['sandwich', 'lunch'],
  ['wrap', 'lunch'],
  ['guacamole', 'snack'],
  ['dip', 'snack'],
  ['bar', 'snack'],
  ['cake', 'snack'],
  ['cookie', 'snack'],
  ['pie', 'snack'],
  ['brownie', 'snack'],
  ['pudding', 'snack'],
  ['tart', 'snack'],
  ['ice cream', 'snack'],
  ['cheesecake', 'snack'],
  ['muffin', 'snack'],
];

/**
 * Best-effort mealType guess from a recipe title's keywords.
 * Falls back to 'dinner' when nothing matches.
 * @param {string} title
 * @returns {string}
 */
function guessMealType(title) {
  const lower = (title || '').toLowerCase();
  for (const [keyword, mealType] of RECIPE_MEAL_TYPE_KEYWORDS) {
    if (lower.includes(keyword)) return mealType;
  }
  return 'dinner';
}

// ── Condition name lookup ────────────────────────────────────────────────────

/**
 * Resolve a single healthConditionID to its display name via the cached
 * /healthconditions dictionary.
 * @param {number} conditionId
 * @returns {Promise<string>}
 */
export async function getConditionName(conditionId) {
  const conditions = await ensureHealthConditions();
  const found = conditions.find((c) => c.healthConditionID === conditionId);
  return found ? found.description : `Condition ${conditionId}`;
}

/**
 * Resolve multiple healthConditionIDs to display names (positional, same
 * order as input) via the cached /healthconditions dictionary.
 * @param {number[]} conditionIds
 * @returns {Promise<string[]>}
 */
export async function getConditionNames(conditionIds) {
  const conditions = await ensureHealthConditions();
  return (conditionIds || []).map((id) => {
    const found = conditions.find((c) => c.healthConditionID === id);
    return found ? found.description : `Condition ${id}`;
  });
}

/**
 * Resolve an ingredient/food display name to its foodItemID (case-insensitive
 * match on displayAs/description) via the cached /fooditems dictionary.
 * @param {string} name
 * @returns {Promise<number|null>}
 */
export async function getFoodIdByName(name) {
  if (!name) return null;
  const cache = await ensureFoodItems();
  const q = String(name).toLowerCase().trim();
  for (const [, item] of cache) {
    const itemName = (item.displayAs || item.description || '').toLowerCase().trim();
    if (itemName === q) return item.foodItemID;
  }
  return null;
}

// ── Exported adapter functions ───────────────────────────────────────────────

/**
 * Search the food dictionary (client-side filter on cached /fooditems).
 * Excludes non-food items (lifestyle, recipes) — see `isExcludedItem`.
 * @param {string} query
 * @param {import('./types.js').Profile} _profile
 * @returns {Promise<import('./types.js').Food[]>}
 */
export async function searchFoods(query, _profile) {
  const cache = await ensureFoodItems();
  const q = query.trim().toLowerCase();
  if (!q) return [];

  /** @type {import('./types.js').Food[]} */
  const results = [];

  for (const [, item] of cache) {
    if (isExcludedItem(item)) continue;
    const name = (item.displayAs || item.description || '').toLowerCase();
    if (name.includes(q)) {
      results.push(normalizeFood(item));
    }
  }

  return results.slice(0, 50);
}

/**
 * Search Key Nutrients & Herbal Medicines (coarse group 'k', i.e. fine groups
 * k1/k2) in the food dictionary (client-side filter on cached /fooditems).
 * Mirrors `searchFoods` but scoped to the coarse group that powers the
 * Natural Sources screen, so its own search box doesn't surface unrelated
 * foods. Zero network beyond the already-cached dictionary.
 * @param {string} query
 * @returns {Promise<import('./types.js').Food[]>}
 */
export async function searchNaturalSources(query) {
  const cache = await ensureFoodItems();
  const q = query.trim().toLowerCase();
  if (!q) return [];

  /** @type {import('./types.js').Food[]} */
  const results = [];

  for (const [, item] of cache) {
    if (isExcludedItem(item)) continue;
    if (effectiveCoarseGroup(item) !== 'k') continue;
    const name = (item.displayAs || item.description || '').toLowerCase();
    if (name.includes(q)) {
      results.push(normalizeFood(item));
    }
  }

  return results.slice(0, 50);
}

/**
 * Assess a single food against the user's profile.
 * Calls /goodfor for the reconciled verdict, then /references for each condition.
 * @param {number} foodId
 * @param {import('./types.js').Profile} profile
 * @returns {Promise<import('./types.js').Assessment|null>}
 */
export async function assessFood(foodId, profile) {
  const conditionIds = profile.conditions || [];
  if (!conditionIds.length) return null;

  const { result, usedFallback } = await withConditionFallback(conditionIds, (ids) =>
    assessFoodRaw(foodId, ids)
  );

  if (!result) return null;
  return { ...result, usedFallback };
}

/**
 * Unwrapped assessFood body — used by withConditionFallback for the retry.
 * @param {number} foodId
 * @param {number[]} conditionIds
 * @returns {Promise<import('./types.js').Assessment|null>}
 */
async function assessFoodRaw(foodId, conditionIds) {
  const conditionIdStr = conditionIds.join(',');
  const raw = await cachedFetch(`goodfor:${conditionIdStr}:${foodId}`, GOODFOR_TTL_MS, () =>
    fetchGoodFor(foodId, conditionIdStr)
  );

  if (!raw) return null;

  const cache = await ensureFoodItems();
  const foodItem = cache.get(foodId);
  const food = foodItem
    ? normalizeFood(foodItem)
    : { id: foodId, name: `Food ${foodId}`, group: '', fineGroup: '' };

  const tier = numericIdToTier(raw.descriptionNumericID);

  // Per-condition reference fetches run through Promise.allSettled (rather
  // than Promise.all + try/catch per item) so one condition's /references
  // failure can't be silently swallowed into an indistinguishable-from-
  // "no studies" empty array — each row gets an honest referenceStatus.
  const refSettlements = await Promise.allSettled(
    conditionIds.map((conditionId) => cachedReferences(conditionId, foodId))
  );

  const perCondition = await Promise.all(
    conditionIds.map(async (conditionId, index) => {
      const condData = raw.conditions && raw.conditions[index];
      const condTier = condData ? numericIdToTier(condData.descriptionNumericID) : null;
      const conditionName = await getConditionName(conditionId);

      const settled = refSettlements[index];
      const referenceStatus = settled.status === 'fulfilled' ? 'ok' : 'error';
      const citations = referenceStatus === 'ok' ? settled.value || [] : [];

      return {
        conditionId,
        conditionName,
        tier: condTier,
        // Raw descriptionNumericID for this condition (null if absent from the
        // /goodfor response), kept ALONGSIDE tier so the UI can distinguish a
        // real "Neutral / OK" (numericId 4) from missing data — numericIdToTier
        // maps 4 to null, same as "no data", so tier alone can't tell them apart.
        numericId: condData?.descriptionNumericID ?? null,
        referenceCount: citations.length,
        citations,
        referenceStatus,
      };
    })
  );

  food.tier = tier;
  // Null (unknown), not 0, when ANY per-condition reference fetch failed —
  // a failed fetch is indistinguishable from "no studies" otherwise, and we
  // never want to imply zero support when we simply couldn't check.
  const anyErrored = perCondition.some((c) => c.referenceStatus === 'error');
  food.referenceTotal = anyErrored
    ? null
    : perCondition.reduce((sum, c) => sum + c.referenceCount, 0);

  return {
    food,
    tier,
    perCondition,
    score: raw.value ?? null,
    verdict: raw.description ?? null,
    numericId: raw.descriptionNumericID ?? null,
  };
}

/**
 * Read a "backed by N studies" total for a food, WITHOUT ever making a
 * network call — only consults whatever `refs:{conditionId}:{foodId}`
 * entries `assessFood`/prior calls have already persisted via
 * `cachedReferences`. Returns the summed citation count only if EVERY
 * (conditionId, foodId) pair requested is already cached; otherwise `null`
 * (unknown — caller should render nothing rather than guess).
 *
 * Intended for rate-limit-safe trust-signal UI (e.g. SuggestionsScreen's
 * list view) that wants to opportunistically surface a study count without
 * fanning out /references calls per card.
 *
 * @param {number} foodId
 * @param {number[]} conditionIds
 * @returns {number|null}
 */
export function getCachedRefCount(foodId, conditionIds) {
  if (!conditionIds || !conditionIds.length) return null;

  let total = 0;
  for (const conditionId of conditionIds) {
    const cached = peekCache(refsCacheKey(conditionId, foodId));
    if (cached === undefined) return null;
    total += (cached || []).length;
  }
  return total;
}

/**
 * Get food suggestions organized by category.
 * Uses /topdoordonts (consumeOrAvoid=consume) and groups the results by
 * coarse food group.
 * @param {import('./types.js').Profile} profile
 * @returns {Promise<import('./types.js').SuggestionsResult>}
 */
export async function getSuggestions(profile) {
  const conditionIds = profile.conditions || [];
  if (!conditionIds.length) return { categories: [] };

  const { result, usedFallback } = await withConditionFallback(conditionIds, (ids) =>
    getSuggestionsRaw(ids, 'consume')
  );

  return { ...result, usedFallback };
}

/**
 * Unwrapped getSuggestions/getWorstFoods body.
 * @param {number[]} conditionIds
 * @param {'consume'|'avoid'} consumeOrAvoid
 * @returns {Promise<import('./types.js').SuggestionsResult>}
 */
async function getSuggestionsRaw(conditionIds, consumeOrAvoid) {
  const conditionIdStr = conditionIds.join(',');
  const topFoods = await cachedTopDoOrDonts(conditionIdStr, consumeOrAvoid, 50);
  if (!topFoods || !topFoods.length) return { categories: [] };

  const filtered = topFoods.filter((f) => !isExcludedItem(f));

  /** @type {Record<string, import('./types.js').Food[]>} */
  const grouped = {};
  for (const raw of filtered) {
    const group = effectiveCoarseGroup(raw);
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(normalizeTopFood(raw));
  }

  const categories = await Promise.all(
    Object.entries(grouped).map(async ([group, foods]) => ({
      group,
      label: await getGroupLabel(group),
      foods: await Promise.all(foods.map(attachGroupLabel)),
    }))
  );

  return { categories };
}

/**
 * Get the ranked Top Dos (consume) or Don'ts (avoid) list for the profile —
 * powers the Top Dos & Don'ts screen.
 *
 * Shares the exact same cachedTopDoOrDonts call (limit 50) as
 * getSuggestions/getWorstFoods, so this screen, Dietary Guidance, and any
 * future prefetch cost ONE /topdoordonts request per direction between them.
 *
 * Unlike getSuggestions, lifestyle items (Exercise, Smoking, Sleep, …) are
 * KEPT — they're genuinely among the top dos/don'ts — and flagged with
 * `isLifestyle` so the UI can chip them. Only recipes (fine group 'l') are
 * filtered out. `rank` is 1-based and assigned AFTER filtering, so it
 * reflects the displayed order. No tier is attached: /topdoordonts carries
 * no tier data — list membership + rank IS the verdict.
 *
 * @param {import('./types.js').Profile} profile
 * @param {'consume'|'avoid'} direction
 * @returns {Promise<{ items: import('./types.js').Food[], usedFallback: boolean }>}
 */
export async function getTopDosAndDonts(profile, direction) {
  const conditionIds = profile?.conditions || [];
  if (!conditionIds.length) return { items: [], usedFallback: false };

  const { result, usedFallback } = await withConditionFallback(conditionIds, (ids) =>
    getTopDosAndDontsRaw(ids, direction)
  );

  return { items: result, usedFallback };
}

/**
 * Unwrapped getTopDosAndDonts body.
 * @param {number[]} conditionIds
 * @param {'consume'|'avoid'} direction
 * @returns {Promise<import('./types.js').Food[]>}
 */
async function getTopDosAndDontsRaw(conditionIds, direction) {
  const conditionIdStr = conditionIds.join(',');
  const topFoods = await cachedTopDoOrDonts(conditionIdStr, direction, 50);
  if (!topFoods || !topFoods.length) return [];

  // Only recipes are excluded here — lifestyle items stay (see JSDoc above),
  // so this deliberately does NOT use isExcludedItem.
  const filtered = topFoods.filter((raw) => raw.fineFoodGroup !== RECIPE_FINE_GROUP);

  return Promise.all(
    filtered.map(async (raw, i) => {
      const food = await attachGroupLabel(normalizeTopFood(raw));
      food.rank = i + 1;
      food.isLifestyle =
        raw.coarseFoodGroup === 'j' || raw.fineFoodGroup === 'j1' || raw.fineFoodGroup === 'x';
      return food;
    })
  );
}

/**
 * Get worst foods (avoid) organized by category.
 * @param {import('./types.js').Profile} profile
 * @returns {Promise<import('./types.js').SuggestionsResult>}
 */
export async function getWorstFoods(profile) {
  const conditionIds = profile.conditions || [];
  if (!conditionIds.length) return { categories: [] };

  const { result, usedFallback } = await withConditionFallback(conditionIds, (ids) =>
    getSuggestionsRaw(ids, 'avoid')
  );

  return { ...result, usedFallback };
}

/**
 * Get the helpful/neutral/harmful foods within a single coarse food group
 * via the (previously unused) /detailed endpoint — powers the category
 * drill-down from the Best & Worst tab. Fetches ONLY the requested
 * `listType` (never all three at once — avoid tripling API calls), cached
 * 8h per {conditionsCSV, coarseGroup, listType}.
 *
 * Response items carry no descriptionNumericID/group fields, so no `tier`
 * is attached — the list itself (helpful/neutral/harmful) is the signal.
 * API order is preserved (no client-side re-sorting).
 *
 * @param {import('./types.js').Profile} profile
 * @param {string} coarseGroup - Coarse food group code (b,c,d,e,f,g,h,i,k)
 * @param {'helpful'|'neutral'|'harmful'} listType
 * @returns {Promise<{ items: import('./types.js').Food[], usedFallback: boolean }>}
 */
export async function getCategoryDetail(profile, coarseGroup, listType) {
  const conditionIds = profile?.conditions || [];
  if (!conditionIds.length || !coarseGroup) return { items: [], usedFallback: false };

  const { result, usedFallback } = await withConditionFallback(conditionIds, (ids) =>
    getCategoryDetailRaw(ids, coarseGroup, listType)
  );

  return { items: result, usedFallback };
}

/**
 * Unwrapped getCategoryDetail body.
 * @param {number[]} conditionIds
 * @param {string} coarseGroup
 * @param {'helpful'|'neutral'|'harmful'} listType
 * @returns {Promise<import('./types.js').Food[]>}
 */
async function getCategoryDetailRaw(conditionIds, coarseGroup, listType) {
  const conditionIdStr = conditionIds.join(',');
  const cacheKey = `detailed:${conditionIdStr}:${coarseGroup}:${listType}`;
  const raw = await cachedFetch(cacheKey, DETAILED_TTL_MS, () =>
    fetchDetailed(conditionIdStr, coarseGroup, listType)
  );
  if (!raw || !raw.length) return [];

  return Promise.all(
    raw.map((item) => attachGroupLabel(normalizeDetailedFood(item, coarseGroup)))
  );
}

/**
 * Get real, condition-ranked recipes for the profile via /suggest on the
 * 'l' fine food group (Food Network recipes scored against the requested
 * health conditions). Cached 8h per conditionsCSV.
 * @param {import('./types.js').Profile} profile
 * @returns {Promise<{ recipes: import('./types.js').Recipe[], usedFallback: boolean }>}
 */
export async function getRecipes(profile) {
  const conditionIds = profile?.conditions || [];
  if (!conditionIds.length) return { recipes: [], usedFallback: false };

  const { result, usedFallback } = await withConditionFallback(conditionIds, (ids) =>
    getRecipesRaw(ids)
  );

  return { recipes: result, usedFallback };
}

/**
 * Unwrapped getRecipes body.
 *
 * C1 overlay join (Track C / T3C): after building the API-sourced Recipe
 * objects below, they're passed through `joinRecipeOverlay`
 * (recipeIngestion.js) to attach editorial content — `sourceUrl`,
 * `attribution`, `servings`, `nutritionPerServing`, `dietaryTags`,
 * `totalTimeMinutes`, `alsoFits` — keyed by foodItemID. That join is a
 * structural no-op (recipes pass through unchanged) whenever the overlay is
 * empty (src/data/recipeOverlay.json ships as `[]` today) or has no row for
 * a given foodItemID, so nothing here regresses ahead of Track C content
 * landing.
 *
 * Two overlay fields get resolved into existing Recipe fields rather than
 * exposed raw:
 * - `mealType` precedence: the overlay's `overlayMealType` (editorial —
 *   a human read the source and categorized it) wins over `guessMealType`'s
 *   keyword heuristic when present, because it's the ONLY way a recipe can
 *   ever land as 'beverage' — `guessMealType`/RECIPE_MEAL_TYPE_KEYWORDS
 *   above never returns 'beverage', by design (see
 *   adapter.beveragesPool.test.js). The keyword guess remains the fallback
 *   for any recipe the overlay hasn't reached.
 * - `ingredients`: built from the overlay's parallel `rawIngredients`
 *   (strings) + `ingredientFoodItemIds` (numbers) arrays, zipped by index
 *   into a light `{ name, foodItemID? }` shape — NOT the full `Food[]` the
 *   Recipe typedef currently documents (types.js's `ingredients` doc is
 *   stale as of this change; see T3C report to orchestrator for the
 *   recommended typedef update). A fuller Food object would need
 *   group/fineGroup/etc. we'd have to look up per ingredient id, which adds
 *   real cost for fields nothing currently renders; the light shape is
 *   enough for a rendered ingredient list + a future detail-lookup by id.
 *   Absent entirely (not an empty array) when there's no overlay match —
 *   never fabricated from the title or elsewhere.
 * @param {number[]} conditionIds
 * @returns {Promise<import('./types.js').Recipe[]>}
 */
async function getRecipesRaw(conditionIds) {
  const conditionIdStr = conditionIds.join(',');
  const cacheKey = `recipes:${conditionIdStr}:${RECIPE_FINE_GROUP}`;
  const raw = await cachedFetch(cacheKey, RECIPES_TTL_MS, () =>
    fetchSuggest(conditionIdStr, RECIPE_FINE_GROUP)
  );
  if (!raw || !raw.length) return [];

  const matchedConditions = await getConditionNames(conditionIds);

  const recipes = raw.map((item) => {
    const title = item.foodItemDisplayAs || item.foodDescription || item.description || 'Unknown recipe';
    return {
      id: item.foodItemID,
      foodId: item.foodItemID,
      title,
      tier: numericIdToTier(item.descriptionNumericID),
      numericId: item.descriptionNumericID ?? null,
      sourceName: parseSourceName(item.notes),
      matchedConditions,
      photo: getIngredientImage(title, item.coarseFoodGroup, getOverlayImageFile(item.foodItemID)),
      mealType: guessMealType(title),
    };
  });

  return joinRecipeOverlay(recipes).map((recipe) => {
    const { overlayMealType, rawIngredients, ingredientFoodItemIds, ...rest } = recipe;
    const mealType = overlayMealType ?? recipe.mealType;

    if (!rawIngredients) return { ...rest, mealType };

    const ingredients = rawIngredients.map((name, i) => {
      const foodItemID = ingredientFoodItemIds?.[i];
      return foodItemID !== undefined ? { name, foodItemID } : { name };
    });
    return { ...rest, mealType, ingredients };
  });
}

/** Recipe tiers eligible to fill a Plan slot — reverse of numericIdToTier for 1/2/3 only. */
const TIER_TO_NUMERIC_ID = { Top: 1, Strong: 2, Good: 3 };

/**
 * Normalize one /suggest fine-group response into slot-ready
 * PlanCandidates. Filters to `descriptionNumericID` 1-4 (CRITICAL — 5-7 are
 * harmful; a Plan slot must never suggest them) and excluded items (see
 * `isExcludedItem`), then stable-sorts ascending by descriptionNumericID so
 * the best matches lead each group's list.
 * @param {Object[]} raw - Raw /suggest items for one fine food group
 * @param {string} fineGroup - The fine food group requested (injected, not
 *   on raw — unlike /topdoordonts, /suggest items carry no
 *   coarseFoodGroup/fineFoodGroup fields at all, so every item in this batch
 *   is implicitly that group; without this every Plan candidate's
 *   group/fineGroup normalizes to '', which silently breaks
 *   `estimateNutrition`'s calorie estimate for the whole Plan screen).
 * @returns {import('./types.js').PlanCandidate[]}
 */
function normalizePlanGroup(raw, fineGroup) {
  const filtered = raw.filter(
    (item) =>
      item.descriptionNumericID != null &&
      item.descriptionNumericID >= 1 &&
      item.descriptionNumericID <= 4 &&
      !isExcludedItem(item)
  );

  filtered.sort((a, b) => a.descriptionNumericID - b.descriptionNumericID);

  return filtered.map((item) => {
    const food = normalizeFood(item);
    const resolvedFineGroup = food.fineGroup || fineGroup || '';
    const resolvedGroup = food.group || resolvedFineGroup.charAt(0);
    return {
      id: food.id,
      name: food.name,
      image: getIngredientImage(food.name, resolvedGroup, getOverlayImageFile(food.id)),
      group: resolvedGroup,
      fineGroup: resolvedFineGroup,
      tier: numericIdToTier(item.descriptionNumericID),
      numericId: item.descriptionNumericID,
      kind: 'food',
    };
  });
}

/**
 * Map a Recipe (from `getRecipesRaw`) to a PlanCandidate for a lunch/dinner
 * Plan slot. `group`/`fineGroup` are the recipe fine food group code
 * ('l') — real recipes ARE food items under that group, there's no separate
 * coarse code to read off the already-mapped Recipe shape.
 *
 * `sourceUrl`/`attribution` are threaded through unchanged (undefined when
 * the recipe has no C1 overlay match) purely so the Plan screen's detail
 * open can use them — this is additive to the PlanCandidate shape (not yet
 * reflected in the PlanCandidate typedef in types.js; see T3C report to
 * orchestrator) and never touches the safety fields below (`tier`/
 * `numericId`), which stay derived from the API's `descriptionNumericID`
 * only, exactly as before.
 * @param {import('./types.js').Recipe} recipe
 * @returns {import('./types.js').PlanCandidate}
 */
function recipeToPlanCandidate(recipe) {
  return {
    id: recipe.id,
    name: recipe.title,
    image: recipe.photo,
    group: RECIPE_FINE_GROUP,
    fineGroup: RECIPE_FINE_GROUP,
    tier: recipe.tier,
    numericId: recipe.numericId ?? TIER_TO_NUMERIC_ID[recipe.tier] ?? null,
    kind: 'recipe',
    sourceName: recipe.sourceName,
    sourceUrl: recipe.sourceUrl,
    attribution: recipe.attribution,
  };
}

/**
 * Which flag column on the merged item table (isSnack/isBeverage) each of
 * these two slot keys WOULD draw its candidates from, via
 * `flaggedPoolAcrossGroups`. Only `beverages` is actually wired to it below
 * (restored Aug 2026 — zero recipes carry `mealType: 'beverage'` yet, so an
 * items-only pool is the only way that slot isn't permanently empty);
 * `snacks` stays recipes-only like breakfast/lunch/dinner, so `isSnack` is
 * intentionally unused for now — kept here as the fast-follow hook if
 * Snacks & Desserts ever needs the same items+recipes treatment.
 */
const SLOT_FLAG_KEY = { snacks: 'isSnack', beverages: 'isBeverage' };

/**
 * Build a slot's candidate pool from flagged items scattered across EVERY
 * /suggest pool already fetched for the plan, instead of just the slot's
 * own `fineGroups`. "Snacks & sweets" (fineFoodGroup 'h1') is a food-group
 * label, not a snackability judgment — it also holds baking ingredients
 * (frostings, pie crust) that no one eats standalone, while genuine snacks
 * (nuts, fruit) live in other groups already being fetched for
 * breakfast/lunch/dinner. `itemsMap` carries the merged isSnack/isBeverage
 * overlay flags (see scripts/flag-snack-beverage.mjs + localTables.js); a
 * candidate qualifies only if its flag is true — never inferred.
 *
 * Pool is deduped by id and sorted ascending by `numericId` (1 = best
 * condition-tier match); `Array#sort` is spec-stable, and candidates are
 * scanned in `byGroup`'s fetch order with each group's list already
 * ascending by numericId (see `normalizePlanGroup`), so numericId ties keep
 * their original /suggest rank. Zero new API calls — every candidate here
 * was already fetched for one of the 10 unique PLAN_SLOTS fine groups
 * (see `getMealPlanSuggestionsRaw`'s `uniqueGroups`).
 * Honesty: if nothing fetched is flagged, the pool is honestly empty — this
 * never backfills from unflagged items.
 * @param {Map<string, import('./types.js').PlanCandidate[]>} byGroup
 * @param {Map<number, Object>} itemsMap - foodItemID -> merged item row (from ensureFoodItems)
 * @param {'isSnack'|'isBeverage'} flagKey
 * @returns {import('./types.js').PlanCandidate[]}
 */
function flaggedPoolAcrossGroups(byGroup, itemsMap, flagKey) {
  const seen = new Set();
  const pool = [];
  for (const list of byGroup.values()) {
    for (const candidate of list) {
      if (seen.has(candidate.id)) continue;
      const item = itemsMap.get(candidate.id);
      if (!item?.[flagKey]) continue;
      seen.add(candidate.id);
      pool.push(candidate);
    }
  }
  pool.sort((a, b) => a.numericId - b.numericId);
  return pool;
}

/**
 * Get slot-ready candidates for the Plan screen (/app/plan) — see
 * `PLAN_SLOTS` in config.js for the slot → fine food group mapping.
 *
 * Fires one /suggest call per unique fine food group across all slots (10
 * groups) via `Promise.allSettled` — a failed group resolves to an empty
 * list for that group (one console.error, logged once) rather than failing
 * the whole plan — plus the shared recipes call, which reuses the existing
 * `recipes:{csv}:l` cache (`getRecipesRaw`) instead of making a second 'l'
 * /suggest call.
 *
 * Every candidate is pre-filtered to `descriptionNumericID` 1-4 (never a
 * harmful 5-7 food) before being surfaced. Never fabricates fields (no
 * calories, no cook times) — only what the API actually returned.
 *
 * @param {import('./types.js').Profile} profile
 * @returns {Promise<{
 *   candidates: Record<string, import('./types.js').PlanCandidate[]>,
 *   conditionIds: number[],
 *   conditionNames: string[],
 *   usedFallback: boolean
 * }>}
 */
export async function getMealPlanSuggestions(profile) {
  const conditionIds = profile?.conditions || [];
  if (!conditionIds.length) {
    return {
      candidates: Object.fromEntries(PLAN_SLOT_KEYS.map((key) => [key, []])),
      conditionIds: [],
      conditionNames: [],
      usedFallback: false,
    };
  }

  const { result, usedFallback } = await withConditionFallback(conditionIds, (ids) =>
    getMealPlanSuggestionsRaw(ids)
  );

  return { ...result, usedFallback };
}

/**
 * Unwrapped getMealPlanSuggestions body. `conditionIds`/`conditionNames` on
 * the result are computed from the `ids` this was CALLED with (not the
 * profile's original ids), so a demo-fallback retry's resolved ids/names
 * propagate correctly onto the plan instead of claiming the wrong condition.
 *
 * Per-group /suggest failures (and getRecipesRaw failures) normally degrade
 * to an empty list rather than failing the whole plan — EXCEPT when a
 * rejection is a NutridigmAuthError with code NOTAUTHORIZEDHEALTHID (the
 * demo key can't score these conditions at all). That error is rethrown
 * instead of swallowed, so it propagates up to `withConditionFallback`
 * (which detects it the same way) and triggers its single retry with
 * DEFAULT_DEV_CONDITIONS — otherwise every group/recipes call would reject
 * for the same reason, the raw function would never throw, and the caller
 * would silently get empty slots with no "Demo data" chip.
 * APIDAILYLIMITREACHED and all other errors still degrade to [] per group,
 * since `withConditionFallback` deliberately doesn't retry quota errors.
 *
 * Total-vs-partial failure (binding project rule — an error must never be
 * presented to the user as "no results"): some groups failing while others
 * (or the recipes call) succeed is normal, expected degradation — the
 * honest-empty design above — and keeps producing a (possibly partial)
 * plan. But when EVERY /suggest group call AND the recipes call fail, there
 * is nothing left to be "honestly empty" about — that's an outage (e.g. a
 * total network failure), not a real zero-result plan, so this rethrows one
 * of the underlying errors instead of returning all-empty candidates. A
 * fulfilled settlement with an empty array (HTTP 220 — valid-but-empty) is
 * NOT a failure for this check, so a real "nothing available" response from
 * a healthy API still resolves normally.
 * @param {number[]} conditionIds
 * @returns {Promise<{
 *   candidates: Record<string, import('./types.js').PlanCandidate[]>,
 *   conditionIds: number[],
 *   conditionNames: string[]
 * }>}
 */
async function getMealPlanSuggestionsRaw(conditionIds) {
  const csv = conditionIds.join(',');

  const uniqueGroups = [...new Set(PLAN_SLOTS.flatMap((slot) => slot.fineGroups))];

  const settlements = await Promise.allSettled(
    uniqueGroups.map((group) => cachedSuggest(csv, group))
  );

  const authFailure = settlements.find((settlement) => {
    if (settlement.status !== 'rejected') return false;
    const err = settlement.reason;
    const isAuthError = err instanceof NutridigmAuthError || err?.name === 'NutridigmAuthError';
    return isAuthError && err.code === 'NOTAUTHORIZEDHEALTHID';
  });
  if (authFailure) {
    throw authFailure.reason;
  }

  /** @type {Map<string, import('./types.js').PlanCandidate[]>} */
  const byGroup = new Map();
  settlements.forEach((settlement, i) => {
    const group = uniqueGroups[i];
    if (settlement.status === 'fulfilled') {
      byGroup.set(group, normalizePlanGroup(settlement.value || [], group));
    } else {
      console.error(`getMealPlanSuggestions: /suggest failed for fine group "${group}"`, settlement.reason);
      byGroup.set(group, []);
    }
  });

  let recipes;
  let recipesFailed = false;
  let recipesError = null;
  try {
    recipes = await getRecipesRaw(conditionIds);
  } catch (err) {
    const isAuthError = err instanceof NutridigmAuthError || err?.name === 'NutridigmAuthError';
    if (isAuthError && err.code === 'NOTAUTHORIZEDHEALTHID') {
      throw err;
    }
    console.error('getMealPlanSuggestions: getRecipesRaw failed', err);
    recipes = [];
    recipesFailed = true;
    recipesError = err;
  }

  // Total outage: every /suggest group rejected AND the recipes call
  // rejected — nothing succeeded anywhere. Rethrow instead of proceeding to
  // build an all-empty candidates object, so callers see an honest error
  // (with Retry) rather than "No recipes yet". `settlements` is never empty
  // (PLAN_SLOTS always has fineGroups), so `.every(...)` here is a real
  // "all failed" check, not a vacuous true.
  const allGroupsFailed = settlements.every((s) => s.status === 'rejected');
  if (allGroupsFailed && recipesFailed) {
    throw recipesError ?? settlements[0].reason;
  }

  const itemsMap = await ensureFoodItems();

  // Every slot's candidate pool is recipes-only EXCEPT `beverages`: zero
  // recipes carry `mealType: 'beverage'` TODAY (`guessMealType`, above,
  // never returns it — the only path to 'beverage' is the C1 overlay's
  // editorial `overlayMealType` winning mealType precedence in
  // `getRecipesRaw`, and the overlay ships empty until Track C content
  // lands), so a recipes-only pool for that slot would be permanently
  // empty in the meantime. Beverages is therefore item-driven for now
  // (this stays correct even once beverage recipes exist: `slotRecipes`
  // below already includes any recipe whose `mealType` resolves to
  // 'beverage', appended after the item pool), via
  // `flaggedPoolAcrossGroups`: it
  // pulls every `isBeverage`-flagged item already fetched across ALL of
  // this plan's /suggest pools (already numericId 1-4-filtered by
  // `normalizePlanGroup`) — 'h2' (Beverages) is one of those pools because
  // it's this slot's own `fineGroups` entry, feeding `uniqueGroups` above.
  // Items lead (`slot.recipeLead: false`), with any (currently zero)
  // beverage recipes appended after.
  /** @type {Record<string, import('./types.js').PlanCandidate[]>} */
  const candidates = {};
  for (const slot of PLAN_SLOTS) {
    const slotRecipes = slot.recipeMealType
      ? recipes
          .filter((r) => r.mealType === slot.recipeMealType && TIER_TO_NUMERIC_ID[r.tier] != null)
          .map(recipeToPlanCandidate)
      : [];

    if (slot.key === 'beverages') {
      const beverageItems = flaggedPoolAcrossGroups(byGroup, itemsMap, SLOT_FLAG_KEY.beverages);
      candidates[slot.key] = [...beverageItems, ...slotRecipes];
      continue;
    }

    candidates[slot.key] = slotRecipes;
  }

  const conditionNames = await getConditionNames(conditionIds).catch(() => []);

  return { candidates, conditionIds, conditionNames };
}

/**
 * Build a meal plan from the profile via /topdoordonts.
 * @param {import('./types.js').Profile} profile
 * @param {import('./types.js').Food[]} [libraryItems]
 * @returns {Promise<import('./types.js').DayPlan>}
 */
export async function buildMealPlan(profile, libraryItems) {
  const conditionIds = profile.conditions || [];

  if (!conditionIds.length) return { ...emptyMealPlan(), usedFallback: false };

  const { result, usedFallback } = await withConditionFallback(conditionIds, (ids) =>
    buildMealPlanRaw(ids, libraryItems)
  );

  return { ...result, usedFallback };
}

/**
 * Empty meal plan shape (no conditions / no data available).
 * @returns {import('./types.js').DayPlan}
 */
function emptyMealPlan() {
  const today = new Date().toISOString().split('T')[0];
  return {
    date: today,
    meals: [
      { slot: 'Breakfast', items: [], recipes: [], calories: 500 },
      { slot: 'Lunch', items: [], recipes: [], calories: 600 },
      { slot: 'Dinner', items: [], recipes: [], calories: 600 },
      { slot: 'Snack', items: [], recipes: [], calories: 200 },
      { slot: 'Beverages', items: [], recipes: [], calories: 100 },
    ],
    totalCalories: 2000,
  };
}

/**
 * Unwrapped buildMealPlan body.
 * @param {number[]} conditionIds
 * @param {import('./types.js').Food[]} [libraryItems]
 * @returns {Promise<import('./types.js').DayPlan>}
 */
async function buildMealPlanRaw(conditionIds, libraryItems) {
  const conditionIdStr = conditionIds.join(',');
  const today = new Date().toISOString().split('T')[0];

  const topFoods = await cachedTopDoOrDonts(conditionIdStr, 'consume', 40);
  if (!topFoods || !topFoods.length) return emptyMealPlan();

  const filtered = topFoods.filter((f) => !isExcludedItem(f));

  const allFoods = await Promise.all(filtered.map(normalizeTopFood).map(attachGroupLabel));

  if (libraryItems && libraryItems.length) {
    for (const item of libraryItems) {
      if (!allFoods.find((f) => f.id === item.id)) {
        if (!item.groupLabel) await attachGroupLabel(item);
        allFoods.push(item);
      }
    }
  }

  const buckets = {
    Beverages: [],
    Snack: [],
    Breakfast: [],
    Lunch: [],
    Dinner: [],
  };

  for (const food of allFoods) {
    const slotByFine = MEAL_SLOT_MAP[food.fineGroup];
    if (slotByFine) {
      buckets[slotByFine].push(food);
    } else {
      switch (food.group) {
        case 'f':
          buckets.Breakfast.push(food);
          break;
        case 'c':
        case 'd':
          buckets.Lunch.push(food);
          break;
        case 'b':
        case 'e':
        case 'g':
        case 'i':
          buckets.Dinner.push(food);
          break;
        default:
          buckets.Lunch.push(food);
      }
    }
  }

  const DAILY_TARGET = 2000;
  const slotCalories = {
    Breakfast: Math.round(DAILY_TARGET * 0.25),
    Lunch: Math.round(DAILY_TARGET * 0.30),
    Dinner: Math.round(DAILY_TARGET * 0.30),
    Snack: Math.round(DAILY_TARGET * 0.10),
    Beverages: Math.round(DAILY_TARGET * 0.05),
  };

  const meals = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Beverages'].map((slot) => ({
    slot,
    items: buckets[slot].slice(0, slot === 'Beverages' ? 4 : 5),
    recipes: [],
    calories: slotCalories[slot],
  }));

  return { date: today, meals, totalCalories: DAILY_TARGET };
}

/**
 * Get all health conditions (for onboarding/profile editing).
 * @returns {Promise<import('./types.js').HealthCondition[]>}
 */
export async function getConditions() {
  try {
    return await ensureHealthConditions();
  } catch {
    return [];
  }
}

/**
 * Get all food groups.
 * @returns {Promise<import('./types.js').FoodGroup[]>}
 */
export async function getFoodGroups() {
  try {
    return await ensureFoodGroups();
  } catch {
    return [];
  }
}

/**
 * Get static display facts for a single food from the cached /fooditems
 * dictionary — zero network beyond the (24h-cached) dictionary warm.
 *
 * `longDescription` is trimmed; empty/whitespace-only values come back as
 * null so the UI can self-hide the paragraph (many dictionary entries carry
 * thin values like "Cooked" or nothing at all — never fabricate copy).
 *
 * @param {number} foodId
 * @returns {Promise<{ name: string, photo: string, longDescription: string|null, groupLabel: string }|null>}
 *   null when the id isn't in the dictionary.
 */
export async function getFoodFacts(foodId) {
  const cache = await ensureFoodItems();
  const item = cache.get(foodId);
  if (!item) return null;

  const name = item.displayAs || item.description || 'Unknown';
  const coarse = effectiveCoarseGroup(item);
  const trimmed = (item.longDescription || '').trim();

  return {
    name,
    photo: getIngredientImage(name, coarse, getOverlayImageFile(foodId)),
    longDescription: trimmed || null,
    groupLabel: await getGroupLabel(item.fineFoodGroup || coarse),
  };
}

/**
 * Get the full food dictionary as Food[].
 * @returns {Promise<import('./types.js').Food[]>}
 */
export async function getFoodDictionary() {
  try {
    const cache = await ensureFoodItems();
    const foods = [];
    for (const [, item] of cache) {
      if (isExcludedItem(item)) continue;
      foods.push(normalizeFood(item));
    }
    return foods;
  } catch {
    return [];
  }
}
