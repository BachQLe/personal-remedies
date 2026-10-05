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

import { EXCLUDED_FINE_GROUPS, COARSE_GROUP_LABELS, MEAL_SLOT_MAP, PLAN_SLOTS, PLAN_SLOT_KEYS } from './config.js';
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
 * params so each condition set caches under its own key.
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
 * fine groups), so each condition set caches under its own key.
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

// ── Condition authorization ─────────────────────────────────────────────────

/** Shared copy for conditions the Nutridigm key can't score (UI shows it on empty results). */
export const cantScoreMessage = (names) => `We can't score food for ${names.join(', ')} yet.`;

function isUnauthorized(err) {
  const isAuthError = err instanceof NutridigmAuthError || err?.name === 'NutridigmAuthError';
  return isAuthError && err.code === 'NOTAUTHORIZEDHEALTHID';
}

/**
 * Calls `fn(conditionIds)`. On NOTAUTHORIZEDHEALTHID, probes each condition
 * alone, drops the unauthorized ones and re-runs with the rest. If none are
 * scorable returns `empty`. Always returns `unscorableReason` (string|null)
 * naming the dropped conditions. Other errors (quota, network) rethrow.
 *
 * @template T
 * @param {number[]} conditionIds
 * @param {(ids: number[]) => Promise<T>} fn
 * @param {T} empty - result when no condition is scorable
 * @returns {Promise<{ result: T, unscorableReason: string|null }>}
 */
async function withAuthorized(conditionIds, fn, empty) {
  try {
    return { result: await fn(conditionIds), unscorableReason: null };
  } catch (err) {
    if (!isUnauthorized(err)) throw err;
  }
  const probes = await Promise.allSettled(conditionIds.map((id) => fn([id])));
  const hard = probes.find((p) => p.status === 'rejected' && !isUnauthorized(p.reason));
  if (hard) throw hard.reason;
  const okIdx = probes.flatMap((p, i) => (p.status === 'fulfilled' ? [i] : []));
  const bad = conditionIds.filter((_, i) => !okIdx.includes(i));
  const names = await getConditionNames(bad).catch(() => bad.map((id) => `condition ${id}`));
  const unscorableReason = cantScoreMessage(names);
  if (!okIdx.length) return { result: empty, unscorableReason };
  const result = okIdx.length === 1 ? probes[okIdx[0]].value : await fn(okIdx.map((i) => conditionIds[i]));
  return { result, unscorableReason };
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
 *
 * Builds into a local `map` and only assigns it to the module-level
 * `_foodItemsCache` once the loop finishes without throwing — assigning the
 * (still-empty) Map to the cache BEFORE the loop, as this used to, left a
 * corrupted "successfully empty" cache behind if `getItemTable()` ever threw
 * (e.g. a corrupt bundle), which a second concurrent caller (searchFoods and
 * searchNaturalSources now both hit this from the same
 * `searchEverything` Promise.allSettled fan-out — see api.js) would then
 * read as a real empty dictionary instead of hitting the same failure.
 * @returns {Promise<Map<number, Object>>}
 */
async function ensureFoodItems() {
  if (_foodItemsCache) return _foodItemsCache;

  const map = new Map();
  for (const item of getItemTable()) {
    map.set(item.foodItemID, item);
  }
  _foodItemsCache = map;
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
 * 9 UI grid letters (b,c,d,e,f,g,h,i,k), so no exclusion filtering for those
 * is needed here. Separately, a fine-group record whose `foodGroupID` is
 * IDENTICAL to its own coarse letter (d, e, f as of this writing — flagged
 * both `isCoarseFoodGroup` and `isFineFoodGroup` with no real subdivisions
 * underneath) is excluded from its own bucket — see inline comment below —
 * so those groups resolve to an empty (not self-referential) list.
 * @returns {Promise<Map<string, string[]>>}
 */
export async function getFineGroupLabelsByCoarse() {
  if (_fineGroupLabelsByCoarseCache) return _fineGroupLabelsByCoarseCache;

  const groups = await ensureFoodGroups();
  const byCoarse = new Map();
  for (const g of groups) {
    if (!g.isFineFoodGroup) continue;
    const coarseLetter = g.foodGroupID[0];
    // A handful of coarse groups (d, e, f as of this writing) are flagged
    // BOTH isCoarseFoodGroup and isFineFoodGroup on the very same record,
    // with no real b1/b2-style subdivisions underneath — that record means
    // "this coarse group has no fine subdivisions," not an actual fine-group
    // label. Skip it so a group's own coarse record never gets bucketed as
    // its own fine-group entry (which previously made the tile's title and
    // its fine-group preview line render the exact same string).
    if (g.foodGroupID === coarseLetter) continue;
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

/** @type {Array<{ code: string, label: string, coarse: string }>|null} */
let _fineFoodGroupsCache = null;

/**
 * The flat, ordered fine-food-group menu that powers the Suggest browse
 * surface (the `/suggest` endpoint's own fine-group list — see this file's
 * top-of-module doc for the coarse-vs-fine distinction; coarse groups power
 * the separate `/detailed` "choose this, not that" surface and are untouched
 * by this function). Sourced from the same cached /foodgroups dictionary as
 * `getFineGroupLabelsByCoarse`/`getGroupLabels`: every record with
 * `isFineFoodGroup: true`, minus `EXCLUDED_FINE_GROUPS` ('x'/'j1' lifestyle,
 * 'l' recipes — recipes have their own surface, RecipesScreen). That yields
 * exactly the 17 real fine groups (b1,b2,b3,c1,c2,c3,d,e,f,g1,g2,h1,h2,i1,
 * i2,k1,k2) as of this writing.
 *
 * SUBTLETY (the same one `getFineGroupLabelsByCoarse` documents, resolved
 * the OPPOSITE way here — read this before touching either function): d, e,
 * and f are flagged BOTH `isCoarseFoodGroup` and `isFineFoodGroup` on the
 * very same record, with no real b1/b2-style subdivisions underneath.
 * `getFineGroupLabelsByCoarse` excludes that record from its own bucket
 * because THERE it would be a self-referential entry inside a coarse
 * group's "fine subdivisions" list (the tile's title and its one listed
 * subdivision would read identically). HERE there is no such bucket — a
 * flat menu of fine groups to browse — and for d/e/f that single record IS
 * the legitimate, only fine group for Fruits & Juices / Vegetables / Breads,
 * Grains, Cereals & Pasta. So this function does NOT apply that same
 * exclusion: d, e, and f MUST appear in this menu (17 groups total, not
 * 14) — only `isFineFoodGroup` + the `EXCLUDED_FINE_GROUPS` check gate
 * inclusion here. This is why the two functions don't share a filter
 * helper despite both reading the same "both flags set" record shape: the
 * correct handling of that record is inverted between them, not duplicated.
 *
 * Cached in a module-level variable exactly like `_fineGroupLabelsByCoarseCache`
 * — same source dictionary, same cache-once-forever lifetime, so adding this
 * export costs zero extra /foodgroups reads.
 *
 * Order: ascending by `code` (plain string compare). Every code is either a
 * single coarse letter (d, e, f) or a coarse-letter-plus-single-digit (b1,
 * c3, …) — never multi-digit — so a plain string sort keeps each coarse
 * group's codes contiguous and correctly ordered (b1 < b2 < b3) with no need
 * for a numeric-aware comparator.
 *
 * Profile-independent — no /goodfor or condition scoring involved, this is
 * the static menu of groups to browse, not a ranked result. Pair with
 * `getFineGroupSuggestions(profile, code)` for the actual condition-ranked
 * items within one of these groups.
 * @returns {Promise<Array<{ code: string, label: string, coarse: string }>>}
 */
export async function getFineFoodGroups() {
  if (_fineFoodGroupsCache) return _fineFoodGroupsCache;

  const groups = await ensureFoodGroups();
  const menu = groups
    .filter((g) => g.isFineFoodGroup && !EXCLUDED_FINE_GROUPS.includes(g.foodGroupID))
    .map((g) => ({ code: g.foodGroupID, label: g.description, coarse: g.foodGroupID.charAt(0) }))
    .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));

  _fineFoodGroupsCache = menu;
  return _fineFoodGroupsCache;
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
 * endpoint, and the raw `value` must never be exposed. `referenceTotal` is
 * NOT set here either — this function stays synchronous; the caller
 * (`getCategoryDetailRaw`) attaches it afterward via the cache-only
 * `getCachedRefCount` (no /references network call — see that function's
 * docblock).
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

/**
 * [keyword, mealType] — checked in order, first substring match wins.
 *
 * BUG FIX (Task 4, "no choices appear for Lunch"): `guessMealType`'s
 * fallback is 'dinner' for anything that matches no keyword at all, and the
 * pre-fix lunch bucket held only 'salad'/'sandwich'/'wrap' — against the
 * real recipe dictionary (fine group 'l', src/data/cache/items.json) that
 * classified just 2 of 54 recipe titles as lunch (e.g. "Vietnamese Noodle
 * Soup", "Lentil Soup", "Garden Vegetable Soup" all fell through to the
 * 'dinner' default instead), while 42/54 landed on 'dinner'. Combined with
 * `getMealPlanSuggestionsRaw`'s lunch slot being recipes-only (see its doc)
 * and the further `TIER_TO_NUMERIC_ID` tier filter, a 2-recipe pool
 * frequently resolved to an empty lunch slot. 'soup' moves here (soup is at
 * least as often a lunch dish as a dinner one, and lunch's PLAN_SLOTS
 * fineGroups — beans/vegetables/fish — already skew toward the lighter fare
 * soups represent) and 'taco'/'bowl' are added — both rescue real titles
 * from the dictionary ("Slow-Cooker Pork Tacos", "Fish Tacos") into a slot
 * that otherwise starves. This is a genuine classification-accuracy fix, not
 * a fallback: it changes which honest bucket a recipe lands in, never
 * fabricates one.
 *
 * FURTHER FIX (lunch rail still blank, #8/#13): re-checked the same 54-title
 * dictionary against this table and found two more genuine
 * misclassifications:
 * - "American Macaroni Salald" — a dictionary typo ("Salald", not "Salad")
 *   that never substring-matched the existing 'salad' keyword, so it fell
 *   all the way through to the 'dinner' default. Added `salald` as its own
 *   keyword (matching the API's actual string, not "fixing" the typo).
 * - "Chicken Pot Pie (no crust)" — matched 'pie' → 'snack', which is wrong
 *   (it's a dinner dish, not a dessert). `pot pie` → 'dinner' is added ahead
 *   of `pie` so it wins the first-match race.
 * The rest of the dictionary was left alone deliberately (conservative per
 * task instructions) — e.g. "Pasta e Fagioli"/"Hash Brown Casserole" still
 * default to 'dinner' with no keyword hit, a reasonable bucket rather than a
 * bug on the level of the two fixed above. Any recipe still stuck on the
 * 'dinner' default (not a real keyword match) is now also eligible for the
 * lunch-slot top-up — see `topUpLunchFromDefaultedDinnerRecipes` below.
 */
const RECIPE_MEAL_TYPE_KEYWORDS = [
  ['oatmeal', 'breakfast'],
  ['pancake', 'breakfast'],
  ['omelet', 'breakfast'],
  ['scramble', 'breakfast'],
  ['granola', 'breakfast'],
  ['parfait', 'breakfast'],
  ['smoothie', 'breakfast'],
  ['chili', 'dinner'],
  ['stew', 'dinner'],
  ['roast', 'dinner'],
  ['salmon', 'dinner'],
  ['pot pie', 'dinner'],
  ['salad', 'lunch'],
  ['salald', 'lunch'],
  ['sandwich', 'lunch'],
  ['wrap', 'lunch'],
  ['soup', 'lunch'],
  ['taco', 'lunch'],
  ['bowl', 'lunch'],
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
 * Best-effort mealType match for a recipe title's keywords, reporting
 * whether the result came from a real keyword hit or fell through to the
 * 'dinner' default. Internal — `getRecipesRaw` uses this directly (rather
 * than the exported `guessMealType` below) so it can stamp
 * `mealTypeDefaulted` on the Recipe it builds; that flag is what
 * `getMealPlanSuggestionsRaw`'s lunch top-up (see
 * `topUpLunchFromDefaultedDinnerRecipes`) uses to tell "genuinely a dinner
 * dish" apart from "landed on dinner only because nothing matched" — a
 * distinction `guessMealType`'s plain string return can't express.
 * @param {string} title
 * @returns {{ mealType: string, defaulted: boolean }}
 */
function matchMealType(title) {
  const lower = (title || '').toLowerCase();
  for (const [keyword, mealType] of RECIPE_MEAL_TYPE_KEYWORDS) {
    if (lower.includes(keyword)) return { mealType, defaulted: false };
  }
  return { mealType: 'dinner', defaulted: true };
}

/**
 * Best-effort mealType guess from a recipe title's keywords.
 * Falls back to 'dinner' when nothing matches. Exported so a screen can
 * reuse the exact same classification (e.g. previewing how a title would be
 * bucketed) without duplicating RECIPE_MEAL_TYPE_KEYWORDS.
 * @param {string} title
 * @returns {string}
 */
export function guessMealType(title) {
  return matchMealType(title).mealType;
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
 * Excludes non-food items (lifestyle, recipes) — see `isExcludedItem` — AND
 * excludes coarse group 'k' (Key Nutrients & Herbal Meds — vitamins,
 * minerals, herbal supplements). Without that second guard, a food-oriented
 * query like "vitamin" surfaced every nutrient/supplement row too (e.g.
 * "Vitamin A Supplement"), which reads as a food but isn't one — group 'k'
 * items are searched separately via `searchNaturalSources` and surfaced in
 * their own nutrients/herbals sections by `searchEverything` (api.js).
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
    if (effectiveCoarseGroup(item) === 'k') continue;
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
 * Mirrors `searchFoods` but scoped to the coarse group that used to power a
 * separate "Natural Sources" screen; that screen has since been folded into
 * the single Food & Nutrient Lookup screen (`searchEverything`, api.js),
 * which splits this function's results into "Nutrients" (fine group 'k1' —
 * Vitamins, Minerals & Other) and "Herbal Supplements" (fine group 'k2')
 * sections. No separate helper/loop needed for that split: `normalizeFood`
 * already stamps every result with a `fineGroup` field, so callers filter on
 * `food.fineGroup === 'k1' | 'k2'` directly rather than this function
 * duplicating the scan per subgroup. Zero network beyond the already-cached
 * dictionary.
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
 * Fetch /references citations for a food across multiple conditions and
 * reduce them to the honest "study total" both `assessFoodRaw` and
 * `getCategoryDetailRaw` need: `null` (unknown) if ANY per-condition fetch
 * errored, otherwise the summed citation count — never a fabricated 0 when
 * we simply couldn't check. Runs the fetches through Promise.allSettled
 * (rather than Promise.all + try/catch per item) so one condition's
 * /references failure can't be silently swallowed into an
 * indistinguishable-from-"no studies" empty array. Also returns the raw
 * `refSettlements` so callers that need per-condition citations/
 * referenceStatus (assessFoodRaw) don't have to re-fetch.
 * @param {number} foodId
 * @param {number[]} conditionIds
 * @returns {Promise<{ refSettlements: PromiseSettledResult<string[]>[], referenceTotal: number|null }>}
 */
async function fetchReferenceTotal(foodId, conditionIds) {
  const refSettlements = await Promise.allSettled(
    conditionIds.map((conditionId) => cachedReferences(conditionId, foodId))
  );

  const anyErrored = refSettlements.some((s) => s.status === 'rejected');
  const referenceTotal = anyErrored
    ? null
    : refSettlements.reduce((sum, s) => sum + (s.value || []).length, 0);

  return { refSettlements, referenceTotal };
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
  // A condition the key can't score is reported as an `unauthorized`
  // perCondition row.
  const result = await assessFoodRaw(foodId, conditionIds);
  if (!result) return null;
  return result;
}

/**
 * Internal sentinel thrown from `assessFoodRaw`'s `cachedFetch` fetcher when
 * `/goodfor` resolves with no result (HTTP 220 — a valid "nothing to
 * assess" response, `null`) — see `assessFoodRaw` for why.
 */
class GoodForEmptyResult extends Error {}

/**
 * Unwrapped assessFood body.
 *
 * BUG FIX: `cachedFetch` persists whatever its fetcher resolves with, for
 * the full `ttlMs` it's given — including a null `/goodfor` result — so a
 * food with no assessment data got that `null` cached for the entire 8h
 * `GOODFOR_TTL_MS`, same as a real result. That's wrong for a value this
 * cheap and likely to change (data curation catching up, a retry after a
 * transient upstream gap): once null, a food stayed "unassessable" for the
 * rest of the day even if `/goodfor` would answer differently moments
 * later. `cache.js` isn't owned by this task, so instead of adding a
 * conditional-TTL option there, the fetcher throws this module-private
 * `GoodForEmptyResult` sentinel when the result is null; `cachedFetch`
 * (cache.js) only ever writes an entry from a fetcher's RESOLVED value — a
 * rejection is never persisted on a first fetch, and for an already-cached
 * STALE entry a background-revalidation rejection is swallowed while the
 * old stale value keeps serving (see cache.js's `cachedFetchWithMeta` doc)
 * — so this gets "never cache a null" with zero changes to cache.js. The
 * catch below turns the sentinel back into the same `null` this function
 * always returned for "no assessment"; any OTHER error (a real fetch
 * failure) is rethrown unchanged.
 * @param {number} foodId
 * @param {number[]} conditionIds
 * @returns {Promise<import('./types.js').Assessment|null>}
 */
async function assessFoodRaw(foodId, conditionIds) {
  // One /goodfor per condition (works for a single condition, whose combined
  // response has no conditions[] array, and isolates NOTAUTHORIZEDHEALTHID
  // to just that condition's row).
  const { rows, raws } = await fetchGoodForRows(foodId, conditionIds);
  const okIds = rows.filter((r) => r.status === 'ok').map((r) => r.conditionId);
  const anyUnscorable = rows.some((r) => r.status === 'unauthorized' || r.status === 'error');
  if (!okIds.length && !anyUnscorable) return null;

  // Overall verdict: the single scored condition's own response, or the
  // combined /goodfor over just the scorable conditions.
  let raw = null;
  if (okIds.length === 1) {
    raw = raws.get(okIds[0]);
  } else if (okIds.length > 1) {
    try {
      raw = await cachedFetch(`goodfor:${okIds.join(',')}:${foodId}`, GOODFOR_TTL_MS, async () => {
        const result = await fetchGoodFor(foodId, okIds.join(','));
        if (result == null) throw new GoodForEmptyResult();
        return result;
      });
    } catch (err) {
      if (!(err instanceof GoodForEmptyResult)) throw err;
    }
  }

  const cache = await ensureFoodItems();
  const foodItem = cache.get(foodId);
  const food = foodItem
    ? normalizeFood(foodItem)
    : { id: foodId, name: `Food ${foodId}`, group: '', fineGroup: '' };

  const tier = raw ? numericIdToTier(raw.descriptionNumericID) : null;

  // /references only for scorable conditions (see fetchReferenceTotal for
  // the allSettled/honest-null rationale).
  const { refSettlements, referenceTotal } = await fetchReferenceTotal(foodId, okIds);

  const perCondition = rows.map((row) => {
    if (row.status !== 'ok') {
      return {
        conditionId: row.conditionId,
        conditionName: row.conditionName,
        status: row.status,
        tier: null,
        numericId: null,
        referenceCount: 0,
        citations: [],
        referenceStatus: 'skipped',
        errorCode: row.errorCode,
      };
    }
    const settled = refSettlements[okIds.indexOf(row.conditionId)];
    const referenceStatus = settled.status === 'fulfilled' ? 'ok' : 'error';
    const citations = referenceStatus === 'ok' ? settled.value || [] : [];
    return {
      conditionId: row.conditionId,
      conditionName: row.conditionName,
      status: 'ok',
      tier: row.tier,
      // Kept alongside tier so the UI can tell a real neutral (4) from missing.
      numericId: row.numericId,
      referenceCount: citations.length,
      citations,
      referenceStatus,
    };
  });

  food.tier = tier;
  // Null (unknown), not 0, when ANY reference fetch failed.
  food.referenceTotal = referenceTotal;

  return {
    food,
    tier,
    perCondition,
    score: raw?.value ?? null,
    verdict: raw?.description ?? null,
    numericId: raw?.descriptionNumericID ?? null,
  };
}

/**
 * Shared per-condition /goodfor fetch (see getGoodForMe). Returns the
 * normalized rows plus each scored condition's raw response.
 */
async function fetchGoodForRows(foodId, conditionIds) {
  const raws = new Map();
  const rows = await Promise.all(
    conditionIds.map(async (conditionId) => {
      const conditionName = await getConditionName(conditionId);
      const base = { conditionId, conditionName, numericId: null, tier: null, label: null, notes: '' };
      try {
        const raw = await cachedFetch(`goodfor:${conditionId}:${foodId}`, GOODFOR_TTL_MS, async () => {
          const result = await fetchGoodFor(foodId, String(conditionId));
          if (result == null) throw new GoodForEmptyResult();
          return result;
        });
        const numericId = raw?.descriptionNumericID ?? null;
        if (numericId == null) return { ...base, status: 'nodata' };
        raws.set(conditionId, raw);
        return {
          ...base,
          status: 'ok',
          numericId,
          tier: numericIdToTier(numericId),
          label: raw.description || null,
          notes: typeof raw.notes === 'string' ? raw.notes.trim() : '',
        };
      } catch (err) {
        if (err instanceof GoodForEmptyResult) return { ...base, status: 'nodata' };
        const isAuthError = err instanceof NutridigmAuthError || err?.name === 'NutridigmAuthError';
        if (isAuthError && err.code === 'NOTAUTHORIZEDHEALTHID') return { ...base, status: 'unauthorized' };
        return { ...base, status: 'error', errorCode: err?.code };
      }
    })
  );
  return { rows, raws };
}

/**
 * "Good for me?" lookup: ONE /goodfor request per profile condition (rather
 * than the combined CSV `assessFood` sends), so each condition gets its own
 * honest outcome — in particular a condition the API key isn't authorized
 * for (NOTAUTHORIZEDHEALTHID) is reported as `unauthorized` for just that
 * row instead of failing the whole lookup (`withAuthorized` is deliberately NOT used here). Also
 * carries Nutridigm's per-condition `notes`, which `assessFood` drops, and
 * works for single-condition profiles (the combined response has no
 * `conditions[]` array then). Per-condition calls share the
 * `goodfor:{id}:{foodId}` cache entry a single-condition `assessFood` writes
 * (identical response shape), 8h TTL, null results never cached. Intended
 * to be called only on an explicit user tap, never per keystroke.
 *
 * Row `status`: 'ok' (scored, incl. neutral numericId 4), 'nodata' (API
 * returned nothing), 'unauthorized', 'error' (anything else; `errorCode`
 * carries the API code when present). No tier is ever fabricated.
 * @param {number} foodId
 * @param {{conditions?: number[]}} profile
 * @returns {Promise<{ foodId: number, foodName: string, rows: Array<{
 *   conditionId: number, conditionName: string,
 *   status: 'ok'|'nodata'|'unauthorized'|'error',
 *   numericId: number|null, tier: import('./types.js').TierOrPoor,
 *   label: string|null, notes: string, errorCode?: string }> }>}
 */
export async function getGoodForMe(foodId, profile) {
  const conditionIds = (profile && profile.conditions) || [];
  const cache = await ensureFoodItems();
  const foodItem = cache.get(foodId);
  const foodName = foodItem ? normalizeFood(foodItem).name : `Food ${foodId}`;
  const { rows } = await fetchGoodForRows(foodId, conditionIds);
  return { foodId, foodName, rows };
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

  const { result, unscorableReason } = await withAuthorized(
    conditionIds,
    (ids) => getSuggestionsRaw(ids, 'consume'),
    { categories: [] }
  );

  return { ...result, unscorableReason };
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
 * getSuggestions/getWorstFoods, so this screen, Best & Worst Choices, and any
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
 * @returns {Promise<{ items: import('./types.js').Food[], unscorableReason: string|null }>}
 */
export async function getTopDosAndDonts(profile, direction) {
  const conditionIds = profile?.conditions || [];
  if (!conditionIds.length) return { items: [], unscorableReason: null };

  const { result, unscorableReason } = await withAuthorized(
    conditionIds,
    (ids) => getTopDosAndDontsRaw(ids, direction),
    []
  );

  return { items: result, unscorableReason };
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

  const { result, unscorableReason } = await withAuthorized(
    conditionIds,
    (ids) => getSuggestionsRaw(ids, 'avoid'),
    { categories: [] }
  );

  return { ...result, unscorableReason };
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
 * @returns {Promise<{ items: import('./types.js').Food[], unscorableReason: string|null }>}
 */
export async function getCategoryDetail(profile, coarseGroup, listType) {
  const conditionIds = profile?.conditions || [];
  if (!conditionIds.length || !coarseGroup) return { items: [], unscorableReason: null };

  const { result, unscorableReason } = await withAuthorized(
    conditionIds,
    (ids) => getCategoryDetailRaw(ids, coarseGroup, listType),
    []
  );

  return { items: result, unscorableReason };
}

/**
 * Unwrapped getCategoryDetail body.
 *
 * Each item's `referenceTotal` is attached here (not in
 * `normalizeDetailedFood`, which is synchronous), but CACHE-ONLY via
 * `getCachedRefCount` — exactly like TopDosTab's list view. A `/detailed`
 * response can carry 100+ items; fanning `fetchReferenceTotal` (a
 * per-condition /references fetch) out over every one of them concurrently
 * was overwhelming Nutridigm (HTTP 500s, "Connection problem" failures) and
 * is now gone from this path entirely. `getCachedRefCount` reads whatever
 * `refs:{conditionId}:{foodId}` entries are already persisted from prior
 * calls and never hits the network, so unopened rows simply show no count
 * (`null`) until something else (FoodDetailCard's `assessFood` on the one
 * item the user actually opens) warms the cache.
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
    raw.map(async (item) => {
      const food = await attachGroupLabel(normalizeDetailedFood(item, coarseGroup));
      food.referenceTotal = getCachedRefCount(item.foodItemID, conditionIds);
      return food;
    })
  );
}

/**
 * Get real, condition-ranked recipes for the profile via /suggest on the
 * 'l' fine food group (Food Network recipes scored against the requested
 * health conditions). Cached 8h per conditionsCSV.
 * @param {import('./types.js').Profile} profile
 * @returns {Promise<{ recipes: import('./types.js').Recipe[], unscorableReason: string|null }>}
 */
export async function getRecipes(profile) {
  const conditionIds = profile?.conditions || [];
  if (!conditionIds.length) return { recipes: [], unscorableReason: null };

  const { result, unscorableReason } = await withAuthorized(
    conditionIds,
    (ids) => getRecipesRaw(ids),
    []
  );
  return { recipes: result, unscorableReason };
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
 *   adapter.beveragesPool.test.js). The SAME invariant holds for 'dessert'
 *   (Task C1, Sept 2026): RECIPE_MEAL_TYPE_KEYWORDS deliberately keeps
 *   dessert-sounding keywords ('cake'/'cookie'/'pie'/'brownie'/'pudding'/
 *   'tart'/'ice cream'/'cheesecake'/'muffin') mapped to `'snack'`, not
 *   `'dessert'` — the keyword guess is a coarse title heuristic with no way
 *   to tell "snack" and "dessert" apart reliably (a "protein bar" and a
 *   "candy bar" both match `'bar'`), so only a human-curated overlay row may
 *   assign `'dessert'`. Guessing it from a title would misclassify real
 *   snacks as desserts (and vice versa) with no way to correct it short of
 *   an editorial pass anyway, so the keyword table just never tries — see
 *   adapter.dessertPool.test.js. The keyword guess remains the fallback
 *   for any recipe the overlay hasn't reached. `mealTypeDefaulted` tracks
 *   this same precedence: it's `true` only when the FINAL mealType is the
 *   honest keyword-miss 'dinner' default (`matchMealType`'s `defaulted`
 *   flag) — the overlay winning always forces it back to `false`, since an
 *   editorial categorization (even "dinner") is never a default. Consumed
 *   by `getMealPlanSuggestionsRaw`'s lunch top-up.
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
    const { mealType, defaulted } = matchMealType(title);
    return {
      id: item.foodItemID,
      foodId: item.foodItemID,
      title,
      tier: numericIdToTier(item.descriptionNumericID),
      numericId: item.descriptionNumericID ?? null,
      sourceName: parseSourceName(item.notes),
      matchedConditions,
      photo: getIngredientImage(title, item.coarseFoodGroup, getOverlayImageFile(item.foodItemID)),
      mealType,
      mealTypeDefaulted: defaulted,
    };
  });

  return joinRecipeOverlay(recipes).map((recipe) => {
    const { overlayMealType, rawIngredients, ingredientFoodItemIds, ...rest } = recipe;
    const mealType = overlayMealType ?? recipe.mealType;
    // Overlay wins the mealType, and an editorial categorization is never a
    // "default" — see the doc above.
    const mealTypeDefaulted = overlayMealType != null ? false : recipe.mealTypeDefaulted;

    if (!rawIngredients) return { ...rest, mealType, mealTypeDefaulted };

    const ingredients = rawIngredients.map((name, i) => {
      const foodItemID = ingredientFoodItemIds?.[i];
      return foodItemID !== undefined ? { name, foodItemID } : { name };
    });
    return { ...rest, mealType, mealTypeDefaulted, ingredients };
  });
}

/** Recipe tiers eligible to fill a Plan slot — reverse of numericIdToTier for 1/2/3 only. */
const TIER_TO_NUMERIC_ID = { Top: 1, Strong: 2, Good: 3 };

/**
 * Shared per-item mapping from a raw /suggest item to its tier/numericId-
 * bearing display shape — id, name, resolved image, group, fineGroup, tier,
 * numericId. Factored out of `normalizePlanGroup` so `getFineGroupSuggestions`
 * (the Suggest browse surface) can reuse the exact same field resolution
 * WITHOUT `normalizePlanGroup`'s numericId 1-4 filter, which is a Plan-only
 * safety rule (a Plan slot must never suggest a harmful 5-7 food) that is
 * wrong for a browse surface — a fine-group browse list's whole point is
 * showing the group's full condition-ranked spread, including the "Avoid"
 * end (5-7), not just the Plan-safe subset. Does NOT apply `isExcludedItem`
 * or any filtering/sorting at all — purely the per-item field mapping;
 * callers own their own filter/sort pass.
 * @param {Object} item - Raw /suggest item
 * @param {string} fineGroup - The fine food group requested (injected, not
 *   on raw — unlike /topdoordonts, /suggest items carry no
 *   coarseFoodGroup/fineFoodGroup fields at all, so every item in this batch
 *   is implicitly that group; without this every candidate's group/fineGroup
 *   normalizes to '', which silently breaks downstream calorie/grouping
 *   logic that keys off those fields).
 * @returns {{ id: number, name: string, image: string, group: string, fineGroup: string, tier: import('./types.js').TierOrPoor, numericId: number }}
 */
function suggestItemToCandidate(item, fineGroup) {
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
  };
}

/**
 * Normalize one /suggest fine-group response into slot-ready
 * PlanCandidates. Filters to `descriptionNumericID` 1-4 (CRITICAL — 5-7 are
 * harmful; a Plan slot must never suggest them) and excluded items (see
 * `isExcludedItem`), then stable-sorts ascending by descriptionNumericID so
 * the best matches lead each group's list. Per-item field mapping is shared
 * with `getFineGroupSuggestions` via `suggestItemToCandidate` — see that
 * function's doc for why its SAFETY FILTER (not its field mapping) is
 * Plan-specific and deliberately not reused there.
 * @param {Object[]} raw - Raw /suggest items for one fine food group
 * @param {string} fineGroup - The fine food group requested (injected — see
 *   `suggestItemToCandidate`).
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

  return filtered.map((item) => ({ ...suggestItemToCandidate(item, fineGroup), kind: 'food' }));
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
 *
 * `substituteFineGroup` (added for the Substitutions feature): the REAL fine
 * food group to scope substitute suggestions by — unlike `fineGroup` above
 * (always the hardcoded recipe group 'l', useless for scoping substitutes),
 * this is resolved from the recipe's `ingredients` array (built in
 * `getRecipesRaw` from the C1 overlay's `rawIngredients`/
 * `ingredientFoodItemIds`, BEFORE this function strips it away): the first
 * ingredient entry that carries a `foodItemID` is looked up in `itemsMap`
 * (the same `ensureFoodItems()` item-table Map `flaggedPoolAcrossGroups`
 * uses) for its real `fineFoodGroup`. `null` when the recipe has no overlay
 * ingredient data, or that first resolvable ingredient isn't in the
 * dictionary — an honest degradation (recipes outside the ~150-recipe C1
 * overlay dataset), never a fabricated fallback. Purely additive: never
 * read from/written to `tier`/`numericId`.
 *
 * `nutritionPerServing` (added for the recipe-calories feature) is copied
 * onto the candidate ONLY when the recipe carries it (from the C1 overlay
 * join — see recipeIngestion.js) — the key is omitted entirely, never set
 * to `undefined`, when absent, so the Plan screen can never render a
 * fabricated calorie number for a recipe with no real overlay data.
 *
 * `mealTypeDefaulted` is always copied over (coerced to a plain boolean,
 * unlike the omit-when-absent fields above) — it's a cheap internal flag,
 * never rendered, that `topUpLunchFromDefaultedDinnerRecipes` reads straight
 * off a slot's already-built dinner candidates to find lunch top-up
 * eligible recipes.
 * @param {import('./types.js').Recipe} recipe
 * @param {Map<number, Object>} itemsMap - foodItemID -> merged item row (from `ensureFoodItems`)
 * @returns {import('./types.js').PlanCandidate}
 */
/**
 * Split `recipes` into the pool eligible for a Plan slot whose accepted
 * meal types are `recipeMealTypes`, honoring BOTH a recipe's primary
 * `mealType` and its secondary `alsoFits` (Task D, Sept 2026 — see the bug
 * this fixes: Mory's real overlay data encodes slash-coded meals like
 * `L/D`/`B/Bv` as `mealType` (first code) + `alsoFits` (remaining codes),
 * and `alsoFits` existed on the joined Recipe object but was never
 * consulted here, so recipes coded dinner- or beverage-*secondary* never
 * reached those slots even though the whole point of `alsoFits` is
 * multi-slot placement).
 *
 * Returns primary matches BEFORE alsoFits-only matches (each group
 * internally in `recipes`' original relative order, since `Array#filter`
 * is stable) rather than interleaving them: a recipe's primary `mealType`
 * is a human's editorial call that THIS is the dish's main slot, while
 * `alsoFits` is a secondary "also works here" — a stronger signal should
 * outrank a weaker one when both are eligible for the same slot, e.g. a
 * lunch-primary/dinner-secondary soup should show up after (not blended
 * randomly with) dishes actually authored as dinner-primary. A recipe is
 * counted at most once: the alsoFits pass explicitly excludes anything
 * already claimed by the primary pass, so a recipe never appears twice in
 * one slot's pool.
 *
 * `alsoFits` is optional on a Recipe (recipes with no matching overlay row
 * pass through `joinRecipeOverlay` unchanged and never gain the key at
 * all — see recipeIngestion.js), so this reads it defensively
 * (`r.alsoFits ?? []`) rather than assuming an array.
 * @param {import('./types.js').Recipe[]} recipes
 * @param {string[]} recipeMealTypes - this slot's accepted meal type(s),
 *   already normalized to an array (see call site).
 * @returns {import('./types.js').Recipe[]}
 */
function recipesEligibleForSlot(recipes, recipeMealTypes) {
  const primary = recipes.filter(
    (r) => recipeMealTypes.includes(r.mealType) && TIER_TO_NUMERIC_ID[r.tier] != null
  );
  const primaryIds = new Set(primary.map((r) => r.id));
  const viaAlsoFits = recipes.filter(
    (r) =>
      !primaryIds.has(r.id) &&
      TIER_TO_NUMERIC_ID[r.tier] != null &&
      (r.alsoFits ?? []).some((mt) => recipeMealTypes.includes(mt))
  );
  return [...primary, ...viaAlsoFits];
}

function recipeToPlanCandidate(recipe, itemsMap) {
  const firstResolvableIngredient = recipe.ingredients?.find((ing) => ing.foodItemID != null);
  const substituteFineGroup = firstResolvableIngredient
    ? itemsMap.get(firstResolvableIngredient.foodItemID)?.fineFoodGroup || null
    : null;

  const candidate = {
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
    substituteFineGroup,
    mealTypeDefaulted: !!recipe.mealTypeDefaulted,
  };
  if (recipe.nutritionPerServing) candidate.nutritionPerServing = recipe.nutritionPerServing;
  return candidate;
}

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
 * @param {'isBreakfast'|'isSnack'|'isBeverage'} flagKey
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
 * Merge a slot's flagged-item pool with its recipe pool into one ranked
 * candidate list (see `PLAN_SLOTS`' `itemFlagKey`/`recipeLead` in
 * config.js). Concatenates the two pools in tie-break order —
 * `recipeLead: true` puts `recipes` ahead of `items`, `false` puts `items`
 * ahead of `recipes` — then dedupes by `id` (first occurrence, i.e. the
 * tie-break winner, is kept) and stable-sorts ascending by `numericId`
 * (1 = best condition-tier match). `Array#sort` is spec-stable, so within a
 * numericId tie the concat order decides who wins — the same technique
 * `flaggedPoolAcrossGroups` above already relies on. Zero new API calls:
 * both pools were already fetched by the caller.
 * @param {import('./types.js').PlanCandidate[]} items
 * @param {import('./types.js').PlanCandidate[]} recipes
 * @param {boolean} recipeLead
 * @returns {import('./types.js').PlanCandidate[]}
 */
function mergeCandidatePools(items, recipes, recipeLead) {
  const ordered = recipeLead ? [...recipes, ...items] : [...items, ...recipes];
  const seen = new Set();
  const pool = [];
  for (const candidate of ordered) {
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    pool.push(candidate);
  }
  pool.sort((a, b) => a.numericId - b.numericId);
  return pool;
}

/**
 * Task 1c lunch top-up: lunch is deliberately recipes-only (`PLAN_SLOTS`'
 * `itemFlagKey: null` — a user decision, not a bug to "fix" by mixing in
 * plain food items), and even after the Task 1a keyword-table fixes only a
 * fraction of the real recipe dictionary keyword-matches to 'lunch' — most
 * of the rest land on 'dinner' purely because `matchMealType` found nothing
 * to key off (`mealTypeDefaulted: true`, see `getRecipesRaw`), not because
 * they're genuinely dinner-only dishes. When the honest lunch pool still
 * comes up short of the slot's `size`, this borrows from that pool of
 * dinner candidates that are ONLY dinner by default (never a real keyword
 * match, and never an overlay's editorial call — both force
 * `mealTypeDefaulted` back to `false`) and adds them to lunch, in the
 * dinner list's existing order, stopping once lunch reaches exactly
 * `lunchSize` (or the eligible pool runs out first, in which case lunch
 * stays honestly short rather than a made-up length).
 *
 * This is additive, not a move: `dinnerCandidates` is read, never mutated,
 * so a borrowed recipe still shows up as a dinner option too — an honest
 * "this recipe reasonably fits either" outcome, not a duplicate-selection
 * bug. Every borrowed candidate already passed the same Top/Strong/Good
 * (`TIER_TO_NUMERIC_ID`) filter dinner's own candidate list was built with
 * (see `getMealPlanSuggestionsRaw`), so this never fabricates a score or
 * relaxes the tier gate — it only widens WHERE an already-qualified recipe
 * is allowed to appear.
 * @param {import('./types.js').PlanCandidate[]} lunchCandidates
 * @param {import('./types.js').PlanCandidate[]} dinnerCandidates
 * @param {number} lunchSize - the lunch slot's `PLAN_SLOTS` `size`
 * @returns {import('./types.js').PlanCandidate[]}
 */
function topUpLunchFromDefaultedDinnerRecipes(lunchCandidates, dinnerCandidates, lunchSize) {
  const needed = lunchSize - lunchCandidates.length;
  if (needed <= 0) return lunchCandidates;

  const lunchIds = new Set(lunchCandidates.map((c) => c.id));
  const topUp = dinnerCandidates
    .filter((c) => c.kind === 'recipe' && c.mealTypeDefaulted && !lunchIds.has(c.id))
    .slice(0, needed);

  return [...lunchCandidates, ...topUp];
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
 *   unscorableReason: string|null
 * }>}
 */
export async function getMealPlanSuggestions(profile) {
  const conditionIds = profile?.conditions || [];
  if (!conditionIds.length) {
    return {
      candidates: Object.fromEntries(PLAN_SLOT_KEYS.map((key) => [key, []])),
      conditionIds: [],
      conditionNames: [],
      unscorableReason: null,
    };
  }

  const { result, unscorableReason } = await withAuthorized(
    conditionIds,
    (ids) => getMealPlanSuggestionsRaw(ids),
    {
      candidates: Object.fromEntries(PLAN_SLOT_KEYS.map((key) => [key, []])),
      conditionIds: [],
      conditionNames: [],
    }
  );

  return { ...result, unscorableReason };
}

/**
 * Unwrapped getMealPlanSuggestions body. `conditionIds`/`conditionNames` on
 * the result are computed from the `ids` this was CALLED with (not the
 * profile's original ids), so only the scorable conditions land on the plan.
 *
 * Per-group /suggest failures (and getRecipesRaw failures) normally degrade
 * to an empty list rather than failing the whole plan — EXCEPT when a
 * rejection is a NutridigmAuthError with code NOTAUTHORIZEDHEALTHID (the
 * key can't score these conditions at all). That error is rethrown instead
 * of swallowed, so `withAuthorized` can drop the unscorable conditions.
 * APIDAILYLIMITREACHED and all other errors still degrade to [] per group.
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

  // Category-scoped selection rule (see `PLAN_SLOTS`' `itemFlagKey` in
  // config.js): a slot with a non-null `itemFlagKey`
  // (breakfast/snacks/beverages) pools BOTH its matching recipes AND every
  // already-fetched item carrying that flag (isBreakfast/isSnack/
  // isBeverage — see scripts/flag-snack-beverage.mjs + localTables.js),
  // ranked together by `mergeCandidatePools`. A slot with `itemFlagKey:
  // null` (lunch/dinner) stays recipes-only — non-recipe items, raw
  // meat/fish cuts especially, must never surface there. Zero new API
  // calls: every candidate here was already fetched for one of this plan's
  // /suggest pools or the shared recipes call.
  /** @type {Record<string, import('./types.js').PlanCandidate[]>} */
  const candidates = {};
  for (const slot of PLAN_SLOTS) {
    // Task C1 (Sept 2026): `recipeMealType` may be a single string or an
    // array — `snacks` is `['snack', 'dessert']` so dessert recipes are
    // eligible for the Snack slot too, per the product decision that
    // desserts are shown together with snacks (one slot, one listing),
    // never a separate Dessert slot. Normalize to an array once so the
    // filter below is shape-agnostic.
    const recipeMealTypes = Array.isArray(slot.recipeMealType)
      ? slot.recipeMealType
      : slot.recipeMealType
        ? [slot.recipeMealType]
        : null;
    // Task D (Sept 2026): eligibility honors BOTH primary `mealType` and
    // secondary `alsoFits` — see `recipesEligibleForSlot`'s doc for why
    // this bug existed (only `mealType` was ever checked) and why primary
    // matches are ordered ahead of alsoFits matches.
    const slotRecipes = recipeMealTypes
      ? recipesEligibleForSlot(recipes, recipeMealTypes).map((r) => recipeToPlanCandidate(r, itemsMap))
      : [];

    if (slot.itemFlagKey) {
      const flaggedItems = flaggedPoolAcrossGroups(byGroup, itemsMap, slot.itemFlagKey);
      candidates[slot.key] = mergeCandidatePools(flaggedItems, slotRecipes, slot.recipeLead);
      continue;
    }

    candidates[slot.key] = slotRecipes;
  }

  // Lunch top-up (Task 1c — see `topUpLunchFromDefaultedDinnerRecipes`):
  // runs AFTER the loop above (not inside it) because it needs dinner's
  // candidates already built. Only ever ADDS to lunch — dinner's own
  // candidate list is left exactly as the loop produced it.
  const lunchSlot = PLAN_SLOTS.find((slot) => slot.key === 'lunch');
  if (lunchSlot) {
    candidates.lunch = topUpLunchFromDefaultedDinnerRecipes(
      candidates.lunch,
      candidates.dinner ?? [],
      lunchSlot.size
    );
  }

  const conditionNames = await getConditionNames(conditionIds).catch(() => []);

  return { candidates, conditionIds, conditionNames };
}

// ── Slot substitutions ───────────────────────────────────────────────────────

/**
 * The fine food group(s) that scope acceptable substitutes for a single Plan
 * slot item. Returns an ARRAY (not a single group) — even though today it is
 * always 0 or 1 entries — so a later cross-category fast-follow (a curated
 * config of alternate groups per item, e.g. "also suggest from group X") is a
 * change to this one function, not a rewrite of `getSlotSubstitutesRaw`'s
 * fan-out/grouping below.
 *
 * A food-kind item scopes by its own `fineGroup`. A recipe-kind item's own
 * `fineGroup` is always the hardcoded recipe group 'l' (see
 * `recipeToPlanCandidate`) — useless for scoping real-food substitutes — so
 * recipes instead use `substituteFineGroup` (resolved from the recipe's
 * primary overlay ingredient). Either way, a missing/falsy group yields an
 * empty array: that item simply gets no substitutes fetched for it (honest
 * degradation, never fabricated).
 * @param {import('../state/dailyPlan.js').PlanItem} item
 * @returns {string[]}
 */
function scopingGroupsForItem(item) {
  const group = item.kind === 'recipe' ? item.substituteFineGroup : item.fineGroup;
  return group ? [group] : [];
}

/**
 * Unwrapped getSlotSubstitutes body — used by withAuthorized. Mirrors `getMealPlanSuggestionsRaw`'s fan-out/failure shape (see
 * adapter.mealPlanOutage.test.js) but scoped to one slot's current items
 * instead of all of PLAN_SLOTS.
 * @param {number[]} conditionIds
 * @param {import('../state/dailyPlan.js').PlanItem[]} slotItems
 * @returns {Promise<{ bySourceItem: Array<{ sourceItem: import('../state/dailyPlan.js').PlanItem, substitutes: import('./types.js').PlanCandidate[] }> }>}
 */
async function getSlotSubstitutesRaw(conditionIds, slotItems) {
  const csv = conditionIds.join(',');
  const existingIds = new Set(slotItems.map((item) => item.id));

  const groupsByItemId = new Map(slotItems.map((item) => [item.id, scopingGroupsForItem(item)]));
  const uniqueGroups = [...new Set([...groupsByItemId.values()].flat())];

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

  // Total outage: every group actually fetched rejected — nothing left to be
  // honestly-empty about (mirrors getMealPlanSuggestionsRaw's allGroupsFailed
  // handling), so this rethrows rather than resolving to an all-empty
  // substitutes list ("no results" must never be presented as a real
  // answer). `uniqueGroups.length > 0` guards the vacuous-true case: a slot
  // whose every item resolved to no scoping group (e.g. all recipes outside
  // the C1 overlay) makes zero /suggest calls at all — that's a real,
  // honestly-empty state, not an outage.
  const allGroupsFailed = uniqueGroups.length > 0 && settlements.every((s) => s.status === 'rejected');
  if (allGroupsFailed) {
    throw settlements[0].reason;
  }

  /** @type {Map<string, import('./types.js').PlanCandidate[]>} */
  const substitutesByGroup = new Map();
  settlements.forEach((settlement, i) => {
    const group = uniqueGroups[i];
    if (settlement.status === 'fulfilled') {
      const candidates = normalizePlanGroup(settlement.value || [], group).filter(
        (c) => !existingIds.has(c.id)
      );
      substitutesByGroup.set(group, candidates);
    } else {
      console.error(`getSlotSubstitutes: /suggest failed for fine group "${group}"`, settlement.reason);
      substitutesByGroup.set(group, []);
    }
  });

  const bySourceItem = slotItems.map((item) => {
    const groups = groupsByItemId.get(item.id) || [];
    const seen = new Set();
    const substitutes = [];
    for (const group of groups) {
      for (const candidate of substitutesByGroup.get(group) || []) {
        if (seen.has(candidate.id)) continue;
        seen.add(candidate.id);
        substitutes.push(candidate);
      }
    }
    return { sourceItem: item, substitutes };
  });

  return { bySourceItem };
}

/**
 * Get acceptable substitute items/recipes for everything currently in ONE
 * Plan slot, via /suggest scoped by fine food group — powers the Plan
 * screen's per-slot "Suggestions" sheet (SuggestionsSheet.jsx, formerly
 * "Substitutions"/SubstitutionsSheet.jsx — renamed/re-skinned in Task 11;
 * this function's own name and data flow are unchanged). Grouped
 * by which source item each substitute stands in for, so a slot holding
 * multiple recipes (e.g. 3 lunch options) needs only ONE call/sheet covering
 * all of them, rather than a per-card picker (see SuggestionsSheet.jsx's
 * doc for why this is structurally distinct from the deleted SwapSheet).
 *
 * Every candidate is pre-filtered through the same safety gate as the Plan
 * screen itself (`normalizePlanGroup`/`isExcludedItem`, numericId 1-4 only)
 * before ever reaching the UI, and never suggests an id already present in
 * `slotItems` (nothing recommends what's already shown).
 *
 * Only wired to same-group scoping for now (see `scopingGroupsForItem`) — a
 * curated cross-category alternate-groups config is a documented fast-follow,
 * not part of this pass.
 * @param {import('./types.js').Profile} profile
 * @param {import('../state/dailyPlan.js').PlanItem[]} slotItems - the slot's
 *   current items (e.g. `day.slots[slotKey]`)
 * @returns {Promise<{
 *   bySourceItem: Array<{ sourceItem: import('../state/dailyPlan.js').PlanItem, substitutes: import('./types.js').PlanCandidate[] }>,
 *   unscorableReason: string|null
 * }>}
 */
export async function getSlotSubstitutes(profile, slotItems) {
  const items = slotItems || [];
  const conditionIds = profile?.conditions || [];

  if (!conditionIds.length || !items.length) {
    return {
      bySourceItem: items.map((item) => ({ sourceItem: item, substitutes: [] })),
      unscorableReason: null,
    };
  }

  const { result, unscorableReason } = await withAuthorized(
    conditionIds,
    (ids) => getSlotSubstitutesRaw(ids, items),
    { bySourceItem: items.map((item) => ({ sourceItem: item, substitutes: [] })) }
  );

  return { ...result, unscorableReason };
}

/**
 * Unwrapped getIngredientAlternatives body — used by withAuthorized. One /suggest call, scoped to the ingredient's own fine food
 * group, filtered through the same safety gate (`normalizePlanGroup`:
 * numericId 1-4 only, `isExcludedItem` applied) every other food-facing list
 * in this app goes through, and sorted best-verdict-first by /suggest itself.
 * @param {number[]} conditionIds
 * @param {string} suggestGroup - fine food group to scope by
 * @param {number|null} excludeFoodId - the ingredient itself
 * @param {number} limit
 * @returns {Promise<import('./types.js').PlanCandidate[]>}
 */
async function getIngredientAlternativesRaw(conditionIds, suggestGroup, excludeFoodId, limit) {
  const raw = await cachedSuggest(conditionIds.join(','), suggestGroup);
  return normalizePlanGroup(raw || [], suggestGroup)
    .filter((candidate) => candidate.id !== excludeFoodId)
    .slice(0, limit);
}

/**
 * Healthier/more useful stand-ins for ONE ingredient, ranked for the user's
 * conditions — powers the ingredient swap rows on FoodDetailCard's back face.
 *
 * Same data path as the Plan screen's per-slot Suggestions sheet
 * (`getSlotSubstitutes`): /suggest scoped by fine food group, so every
 * alternative is a food the API already ranks as helpful-or-better for the
 * profile's conditions within the ingredient's own category — swapping Beef
 * stays inside "Meat, Red Meat & Organ Meats" rather than proposing a
 * different food group. The scoping group comes from
 * `resolveSuggestGroup` (ingredientDerivation.js), which also rescues the
 * dictionary's generic 'x' staples (Beef/Chicken/Fish) via their siblings.
 *
 * Returns an honestly-empty list (never an error, never a fabricated
 * suggestion) when the ingredient has no resolvable group or the profile has
 * no conditions; a real API failure propagates so the UI can offer a retry
 * instead of implying "no alternatives exist".
 *
 * @param {import('./types.js').Profile} profile
 * @param {{name?: string, foodItemID?: number|null, suggestGroup?: string|null}} ingredient
 * @param {Object} [options]
 * @param {number} [options.limit] - max alternatives (default 6)
 * @returns {Promise<{alternatives: import('./types.js').PlanCandidate[], suggestGroup: string|null, unscorableReason: string|null}>}
 */
export async function getIngredientAlternatives(profile, ingredient, { limit = 6 } = {}) {
  const conditionIds = profile?.conditions || [];
  const suggestGroup = ingredient?.suggestGroup ?? null;

  if (!suggestGroup || !conditionIds.length) {
    return { alternatives: [], suggestGroup, unscorableReason: null };
  }

  const { result, unscorableReason } = await withAuthorized(
    conditionIds,
    (ids) => getIngredientAlternativesRaw(ids, suggestGroup, ingredient?.foodItemID ?? null, limit),
    []
  );

  return { alternatives: result, suggestGroup, unscorableReason };
}

// ── Fine-group browse (Suggest surface) ──────────────────────────────────────

/**
 * Unwrapped getFineGroupSuggestions body — used by withAuthorized. One /suggest call via the SAME `cachedSuggest` the Plan screen
 * and Suggestions sheet already share (zero new network surface — the
 * Nutridigm API has a daily rate limit, so this browse feature must ride the
 * existing 8h cache rather than add its own fetch path).
 *
 * Deliberately does NOT reuse `normalizePlanGroup` here (see
 * `suggestItemToCandidate`'s doc): that function's numericId 1-4 filter
 * exists to keep harmful (5-7) foods out of a Plan slot, which is the wrong
 * rule for a browse surface whose job is showing a fine group's FULL
 * condition-ranked spread, "Avoid" end included — a user browsing "Fish &
 * Seafood" should see which fish to avoid, not have them silently vanish.
 * This keeps every item that has a `descriptionNumericID` at all (can't rank
 * without one) and only drops `isExcludedItem` hits (defensive — /suggest
 * items carry no fineFoodGroup/coarseFoodGroup of their own today, so this
 * is currently a no-op, exactly as it already is in `normalizePlanGroup`;
 * kept for parity/future-proofing, not because it does anything yet).
 * Stable-sorts ascending by descriptionNumericID (best match leads), same
 * convention as every other ranked surface in this file.
 *
 * `referenceTotal` is attached CACHE-ONLY via `getCachedRefCount` — same
 * reasoning as `getCategoryDetailRaw`: a /suggest response for a busy fine
 * group can be large, and fanning a per-item /references fetch out over all
 * of them overwhelmed Nutridigm before (HTTP 500s). Unopened rows simply
 * show no count (`null`) until something else (FoodDetailCard's `assessFood`
 * on the one item the user actually opens) warms the cache.
 *
 * `matchedConditions` (display names of the profile's conditions) is
 * resolved ONCE and copied onto every item — same convention as
 * `getRecipesRaw` — since it describes the whole request, not a per-item
 * fact.
 * @param {number[]} conditionIds
 * @param {string} fineGroupCode
 * @returns {Promise<Array<{
 *   id: number, name: string, image: string, group: string, fineGroup: string,
 *   groupLabel: string, tier: import('./types.js').TierOrPoor, numericId: number,
 *   referenceTotal: number|null, matchedConditions: string[]
 * }>>}
 */
async function getFineGroupSuggestionsRaw(conditionIds, fineGroupCode) {
  const raw = await cachedSuggest(conditionIds.join(','), fineGroupCode);
  if (!raw || !raw.length) return [];

  const filtered = raw.filter((item) => item.descriptionNumericID != null && !isExcludedItem(item));
  filtered.sort((a, b) => a.descriptionNumericID - b.descriptionNumericID);

  const matchedConditions = await getConditionNames(conditionIds);

  return Promise.all(
    filtered.map(async (item) => {
      const candidate = suggestItemToCandidate(item, fineGroupCode);
      const groupLabel = await getGroupLabel(candidate.fineGroup || candidate.group);
      return {
        ...candidate,
        groupLabel,
        referenceTotal: getCachedRefCount(candidate.id, conditionIds),
        matchedConditions,
      };
    })
  );
}

/**
 * Condition-ranked browse list for ONE fine food group — the Suggest
 * browse surface's data layer (see `getFineFoodGroups` for the 17-group
 * menu this is paired with). Mirrors `getCategoryDetail` (the coarse
 * `/detailed` equivalent) and `getSlotSubstitutes`'s envelope shape.
 * `unscorableReason` names conditions the key can't score; `requestedConditionIds`
 * is always the profile's ORIGINAL requested conditions.
 *
 * Goes through `cachedSuggest` — the exact same 8h cache key
 * (`suggest:{conditionsCSV}:{fineFoodGroup}`) the meal-planner's
 * `getMealPlanSuggestions`/`getSlotSubstitutes` already populate — so
 * browsing a fine group the planner also uses (e.g. 'e' Vegetables) can
 * reuse an already-warm cache entry, and this feature adds zero new network
 * surface either way (hard requirement: the Nutridigm API has a daily rate
 * limit).
 *
 * @param {import('./types.js').Profile} profile
 * @param {string} fineGroupCode - One of the 17 codes `getFineFoodGroups`
 *   returns (e.g. 'b1', 'e'). An empty/falsy code or a profile with no
 *   conditions short-circuits to an honestly-empty result.
 * @returns {Promise<{
 *   items: Array<{
 *     id: number, name: string, image: string, group: string, fineGroup: string,
 *     groupLabel: string, tier: import('./types.js').TierOrPoor, numericId: number,
 *     referenceTotal: number|null, matchedConditions: string[]
 *   }>,
 *   unscorableReason: string|null,
 *   requestedConditionIds: number[]
 * }>}
 */
export async function getFineGroupSuggestions(profile, fineGroupCode) {
  const conditionIds = profile?.conditions || [];

  if (!conditionIds.length || !fineGroupCode) {
    return { items: [], unscorableReason: null, requestedConditionIds: conditionIds };
  }

  const { result, unscorableReason } = await withAuthorized(
    conditionIds,
    (ids) => getFineGroupSuggestionsRaw(ids, fineGroupCode),
    []
  );

  return { items: result, unscorableReason, requestedConditionIds: conditionIds };
}

/**
 * Build a meal plan from the profile via /topdoordonts.
 * @param {import('./types.js').Profile} profile
 * @param {import('./types.js').Food[]} [libraryItems]
 * @returns {Promise<import('./types.js').DayPlan>}
 */
export async function buildMealPlan(profile, libraryItems) {
  const conditionIds = profile.conditions || [];

  if (!conditionIds.length) return { ...emptyMealPlan(), unscorableReason: null };

  const { result, unscorableReason } = await withAuthorized(
    conditionIds,
    (ids) => buildMealPlanRaw(ids, libraryItems),
    { ...emptyMealPlan(), conditionIds: [] }
  );

  return { ...result, unscorableReason };
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
  if (!topFoods || !topFoods.length) return { ...emptyMealPlan(), conditionIds };

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

  return { date: today, meals, totalCalories: DAILY_TARGET, conditionIds };
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
 * `group`/`fineGroup` are the same raw coarse/fine codes `normalizeFood`
 * attaches (via `effectiveCoarseGroup`/`item.fineFoodGroup`) — additive so
 * callers (e.g. FoodDetailCard's non-food icon fallback) can compute
 * `getNonFoodIcon` from dictionary facts alone, even when `assessFood`
 * fails/times out and no assessment-sourced group is available.
 * @param {number} foodId
 * @returns {Promise<{ name: string, photo: string, longDescription: string|null, groupLabel: string, group: string, fineGroup: string }|null>}
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
    group: coarse,
    fineGroup: item.fineFoodGroup || '',
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
