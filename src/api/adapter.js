/**
 * adapter.js — Maps raw Nutridigm API responses to typed shapes.
 *
 * This layer:
 * - Normalizes field-name drift (displayAs / foodItemDisplayAs → name)
 * - Maps descriptionNumericID → tier (Top/Strong/Good/poor/null)
 * - Filters out non-food items by FINE group (lifestyle 'x'/'j1', recipes 'l')
 *   — see `isExcludedItem` — never by coarse group (coarse 'x' is also used
 *   by real foods like Taro leaves / pork liver)
 * - NEVER exposes value/descriptionNumericID/numeric scores
 *
 * @typedef {import('./types.js')} Types
 */

import { EXCLUDED_FINE_GROUPS, COARSE_GROUP_LABELS, MEAL_SLOT_MAP, DEFAULT_DEV_CONDITIONS } from './config.js';
import { getIngredientImage } from './ingredientImages.js';
import {
  fetchFoodItems,
  fetchFoodGroups,
  fetchHealthConditions,
  fetchGoodFor,
  fetchTopDoOrDonts,
  fetchSuggest,
  fetchDetailed,
  fetchReferences,
  NutridigmAuthError,
} from './nutridigm.js';
import { cachedFetch, peekCache } from './cache.js';

// ── Cache TTLs ────────────────────────────────────────────────────────────────

/** Dictionaries (fooditems/foodgroups/healthconditions) change rarely. */
const DICTIONARY_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/** /topdoordonts results — cached per {conditionsCSV, consumeOrAvoid, limit}. */
const TOPDOORDONTS_TTL_MS = 8 * 60 * 60 * 1000; // 8h

/** /suggest results for the recipe fine food group — cached per conditionsCSV. */
const RECIPES_TTL_MS = 8 * 60 * 60 * 1000; // 8h

/** /detailed results — cached per {conditionsCSV, coarseGroup, listType}. */
const DETAILED_TTL_MS = 8 * 60 * 60 * 1000; // 8h

/**
 * /references citations — cached per (conditionId, foodId). Citations are
 * static curated data (not condition-set-dependent, not per-user), so this
 * is cached far longer than the request-shaped caches above and is safe to
 * key on the pair alone rather than the full conditionsCSV.
 */
const REFERENCES_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7d

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
 * Citations are static curated data, so a 7-day TTL means repeat FoodDetail
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
/** @type {Promise<void>|null} */
let _foodItemsLoading = null;

/**
 * Ensure the food dictionary is loaded and cached.
 * The raw array is persisted via cachedFetch (24h TTL, stale-while-revalidate);
 * the in-memory Map keyed by foodItemID is rebuilt from it on every process
 * start (and again if a background revalidation swaps in fresher data —
 * see the note below).
 * @returns {Promise<Map<number, Object>>}
 */
async function ensureFoodItems() {
  if (_foodItemsCache) return _foodItemsCache;
  if (_foodItemsLoading) {
    await _foodItemsLoading;
    return _foodItemsCache;
  }

  _foodItemsLoading = (async () => {
    const items = await cachedFetch('fooditems', DICTIONARY_TTL_MS, fetchFoodItems);
    _foodItemsCache = new Map();
    for (const item of items) {
      _foodItemsCache.set(item.foodItemID, item);
    }
  })();

  await _foodItemsLoading;
  _foodItemsLoading = null;
  return _foodItemsCache;
}

/** @type {Array|null} */
let _foodGroupsCache = null;

async function ensureFoodGroups() {
  if (_foodGroupsCache) return _foodGroupsCache;
  _foodGroupsCache = await cachedFetch('foodgroups', DICTIONARY_TTL_MS, fetchFoodGroups);
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

async function ensureHealthConditions() {
  if (_healthConditionsCache) return _healthConditionsCache;
  _healthConditionsCache = await cachedFetch('healthconditions', DICTIONARY_TTL_MS, fetchHealthConditions);
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
function isExcludedItem(raw) {
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
 * consumers (PlanScreen, Daily Picks, suggestions) stay dumb and just render
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
 * Parse a recipe's `notes` field into a display sourceName.
 *
 * Observed format: "FN; Giada De Laurentiis;; FN; Giada De Laurentiis;"
 * — semicolon-separated clauses, duplicated, sometimes with extra clauses
 * (e.g. "see also recipe for biscuit crust", "FN Kitchen"). We split on
 * ';', trim, drop empties, dedupe, map the "FN"/"FN Kitchen" network
 * abbreviation to "Food Network", and join the network + first chef name
 * found as "Food Network · <chef>".
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
 * Resolve a condition display name back to its healthConditionID
 * (case-insensitive match on `description`) via the cached
 * /healthconditions dictionary.
 * @param {string} name
 * @returns {Promise<number|null>}
 */
export async function getConditionIdByName(name) {
  if (!name) return null;
  const conditions = await ensureHealthConditions();
  const q = String(name).toLowerCase().trim();
  const found = conditions.find((c) => (c.description || '').toLowerCase().trim() === q);
  return found ? found.healthConditionID : null;
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
  const raw = await fetchGoodFor(foodId, conditionIdStr);

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

  return { food, tier, perCondition };
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
 * Eagerly fetch (and cache, via `cachedReferences`) the study count for a
 * single food+condition pair. This DOES hit the network on a cache miss —
 * callers are responsible for rate-limit safety (e.g. only warming a small,
 * fixed number of rows). After this resolves, `getCachedRefCount` for the
 * same pair will return a non-null value.
 * @param {number} foodId
 * @param {number} conditionId
 * @returns {Promise<number|null>} Citation count, or null on fetch failure.
 */
export async function warmReferenceCount(foodId, conditionId) {
  try {
    const citations = await cachedReferences(conditionId, foodId);
    return (citations || []).length;
  } catch {
    return null;
  }
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
 * Get alternatives for a food based on its fine food group via /suggest.
 * @param {number} foodId
 * @param {import('./types.js').Profile} profile
 * @returns {Promise<import('./types.js').Food[]>}
 */
export async function getAlternatives(foodId, profile) {
  const conditionIds = profile.conditions || [];
  if (!conditionIds.length) return [];

  const cache = await ensureFoodItems();
  const foodItem = cache.get(foodId);
  if (!foodItem) return [];

  const fineGroup = foodItem.fineFoodGroup;
  if (!fineGroup) return [];

  const { result, usedFallback } = await withConditionFallback(conditionIds, (ids) =>
    getAlternativesRaw(foodId, ids, fineGroup)
  );

  // Array shape preserved for existing consumers; usedFallback attached as a
  // non-enumerable property so it doesn't leak into JSON/spread/iteration.
  // See types.js "usedFallback propagation" for the full rationale.
  Object.defineProperty(result, 'usedFallback', {
    value: usedFallback,
    enumerable: false,
  });

  return result;
}

/**
 * Unwrapped getAlternatives body.
 * @param {number} foodId
 * @param {number[]} conditionIds
 * @param {string} fineGroup
 * @returns {Promise<import('./types.js').Food[]>}
 */
async function getAlternativesRaw(foodId, conditionIds, fineGroup) {
  const conditionIdStr = conditionIds.join(',');
  const suggestions = await fetchSuggest(conditionIdStr, fineGroup);
  if (!suggestions || !suggestions.length) return [];

  return suggestions
    .filter((s) => s.foodItemID !== foodId)
    .filter((s) => {
      const tier = numericIdToTier(s.descriptionNumericID);
      return tier === 'Top' || tier === 'Strong' || tier === 'Good';
    })
    .slice(0, 10)
    .map((raw) => normalizeFood(raw));
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

  return raw.map((item) => {
    const title = item.foodItemDisplayAs || item.foodDescription || item.description || 'Unknown recipe';
    return {
      id: item.foodItemID,
      foodId: item.foodItemID,
      title,
      tier: numericIdToTier(item.descriptionNumericID),
      sourceName: parseSourceName(item.notes),
      matchedConditions,
      photo: getIngredientImage(title, item.coarseFoodGroup),
      mealType: guessMealType(title),
    };
  });
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
    photo: getIngredientImage(name, coarse),
    longDescription: trimmed || null,
    groupLabel: await getGroupLabel(item.fineFoodGroup || coarse),
  };
}

/**
 * Nutrition facts for a food — ALWAYS resolves to null today.
 *
 * A July-2026 probe of the live Nutridigm API (fooditems, /goodfor,
 * /detailed) found NO nutrition-fact fields anywhere in the payloads —
 * items carry only longDescription and group/tier metadata. Per the
 * never-fabricate-data rule, this stub returns null and consumers must
 * render NOTHING nutritional (no placeholder tables). If Nutridigm ever
 * exposes nutrient data, implement this against the `NutritionFacts`
 * typedef in types.js.
 *
 * @param {number} _foodId
 * @returns {Promise<import('./types.js').NutritionFacts|null>} Always null today.
 */
export function getNutritionFacts(_foodId) {
  return Promise.resolve(null);
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
