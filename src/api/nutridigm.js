/**
 * nutridigm.js — Raw HTTP client for the Nutridigm API.
 *
 * This is the ONLY file that makes network calls to Nutridigm.
 * It returns raw JSON (untyped) — the adapter layer normalizes shapes.
 *
 * Runs in one of two modes (see config.js for the full picture) — proxy
 * mode when `NUTRIDIGM_PROXY_URL` is set (production; no subscriptionID
 * leaves the client), direct mode otherwise (local dev; subscriptionID sent
 * straight to AWS). Status-code handling below is identical either way —
 * the proxy passes upstream statuses through verbatim.
 *
 * Status codes:
 *   200 = success
 *   220 = ok-but-empty (treat as empty array/object, NOT an error)
 *   400 = invalid parameter (IVHEALTHCONDITIONID)
 *   401 = NOTAUTHORIZEDHEALTHID or APIDAILYLIMITREACHED
 */

import {
  NUTRIDIGM_BASE_URL,
  NUTRIDIGM_SUBSCRIPTION_ID,
  NUTRIDIGM_PROXY_URL,
  IS_CONFIGURED,
} from './config.js';
import { storage } from './storage.js';

/**
 * Custom error for Nutridigm API failures that should trigger fallback.
 */
export class NutridigmAuthError extends Error {
  /**
   * @param {string} code - Error code from the API (e.g. NOTAUTHORIZEDHEALTHID)
   * @param {string} message - Human-readable message
   */
  constructor(code, message) {
    super(message);
    this.name = 'NutridigmAuthError';
    this.code = code;
  }
}

/**
 * Thrown when the Nutridigm client is missing its subscription ID.
 * Distinct from NutridigmAuthError — the demo-condition fallback must NOT
 * catch this, since retrying with different condition IDs cannot fix a
 * missing subscription key.
 */
export class NutridigmConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NutridigmConfigError';
  }
}

/** Track which error codes have been logged (log once per code). */
const _loggedErrors = new Set();

// ── Request-count instrumentation (dev-only, P1.2 probe P5) ─────────────────
//
// Per-endpoint counter of real network requests — i.e. actual fetches
// performed by `performRequest`, NOT calls to `request()` that get served by
// the in-flight de-dupe map (`_inFlight`) or the persistent TTL cache in
// cache.js. Purely additive: no existing export's signature changes.
//
// Two views:
//   - session: in-memory, resets on reload (`getRequestCounts`).
//   - daily: persisted per local calendar day (YYYY-MM-DD) through
//     storage.js under the `requestCounts` key, last 14 days kept
//     (`getDailyRequestCounts`). Local-only — nothing is uploaded, and
//     `requestCounts` is not in profileSync's SYNCED_KEYS so it never syncs.
//     The Nutridigm API has a DAILY call limit, hence the daily view.

/** @type {Map<string, number>} endpoint path (e.g. 'goodfor') -> request count. */
const _requestCounts = new Map();

const DAILY_KEY = 'requestCounts';
const DAILY_RETENTION_DAYS = 14;

/** Local-date key (YYYY-MM-DD), not UTC, so "today" matches the user's day. */
function localDateKey(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function recordDaily(endpoint) {
  try {
    const all = storage.get(DAILY_KEY, {});
    const days = all && typeof all === 'object' && !Array.isArray(all) ? { ...all } : {};
    const today = localDateKey();
    const row = { ...(days[today] || {}) };
    row[endpoint] = (row[endpoint] || 0) + 1;
    days[today] = row;
    // ISO dates sort lexicographically; keep the newest N.
    const keep = Object.keys(days).sort().slice(-DAILY_RETENTION_DAYS);
    const pruned = {};
    for (const k of keep) pruned[k] = days[k];
    storage.set(DAILY_KEY, pruned);
  } catch {
    // Instrumentation must never break a request.
  }
}

/**
 * Record one real network request against its endpoint's counters. Endpoint
 * is parsed from the final path segment of the request URL (e.g.
 * '.../api/v2/goodfor?...' -> 'goodfor').
 * @param {string} urlStr - Full request URL (as built by `request()`)
 */
function recordRequest(urlStr) {
  let endpoint = 'unknown';
  try {
    const segments = new URL(urlStr).pathname.split('/').filter(Boolean);
    endpoint = segments[segments.length - 1] || 'unknown';
  } catch {
    // Malformed URL — count it under 'unknown' rather than throwing.
  }
  _requestCounts.set(endpoint, (_requestCounts.get(endpoint) || 0) + 1);
  recordDaily(endpoint);
}

/**
 * Per-endpoint request-count snapshot for THIS session (resets on reload).
 * @returns {Record<string, number>}
 */
export function getRequestCounts() {
  return Object.fromEntries(_requestCounts);
}

/**
 * Persisted daily request counts, last 14 days, oldest first in key order.
 * With a `date` ('YYYY-MM-DD') returns just that day's per-endpoint counts
 * ({} if none).
 * @param {string} [date]
 * @returns {Record<string, Record<string, number>> | Record<string, number>}
 */
export function getDailyRequestCounts(date) {
  let all = {};
  try {
    const raw = storage.get(DAILY_KEY, {});
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) all = raw;
  } catch {
    all = {};
  }
  if (date !== undefined) return { ...(all[date] || {}) };
  return JSON.parse(JSON.stringify(all));
}

/** Today's (local date) per-endpoint counts, e.g. { goodfor: 3 }. */
export function getTodayRequestCounts() {
  return getDailyRequestCounts(localDateKey());
}

// Dev-only globals (no-op in prod bundles via Vite's DEV flag).
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  window.__remediRequestCounts = getRequestCounts;
  window.__remediDailyRequestCounts = getDailyRequestCounts;
}

/**
 * In-flight request de-dupe: concurrent calls to the exact same URL share a
 * single network request/promise instead of each firing their own. Keyed by
 * full URL (including subscriptionID + params), entry removed on settle
 * (success or failure) so it never leaks memory or serves a stale promise
 * to a later, independent call.
 * @type {Map<string, Promise<any>>}
 */
const _inFlight = new Map();

/**
 * Make a GET request to the Nutridigm API.
 *
 * Two URL shapes, chosen by which config is present (see config.js):
 *   - Proxy mode (`NUTRIDIGM_PROXY_URL` set — wins if both are set):
 *     `<NUTRIDIGM_PROXY_URL>/<endpoint>?<params>` — no `subscriptionID` is
 *     sent; the deployed Supabase function injects its own from a secret.
 *   - Direct mode (proxy unset): `<NUTRIDIGM_BASE_URL>/<endpoint>?<params>` +
 *     `subscriptionID` query param, unchanged from pre-proxy behavior.
 * @param {string} endpoint - Endpoint path (e.g. '/goodfor')
 * @param {Record<string, string>} params - Query parameters (excluding subscriptionID)
 * @returns {Promise<any>} Parsed JSON response
 * @throws {NutridigmConfigError} When neither VITE_NUTRIDIGM_PROXY_URL nor
 *   VITE_NUTRIDIGM_SUBSCRIPTION_ID is set
 * @throws {NutridigmAuthError} On 401 responses
 */
async function request(endpoint, params = {}) {
  if (!IS_CONFIGURED) {
    throw new NutridigmConfigError(
      `[nutridigm] Cannot call /${endpoint}: neither VITE_NUTRIDIGM_PROXY_URL ` +
      'nor VITE_NUTRIDIGM_SUBSCRIPTION_ID is set. See .env.example.'
    );
  }

  const url = NUTRIDIGM_PROXY_URL
    ? new URL(`${NUTRIDIGM_PROXY_URL}/${endpoint}`)
    : new URL(`${NUTRIDIGM_BASE_URL}/${endpoint}`);

  if (!NUTRIDIGM_PROXY_URL) {
    url.searchParams.set('subscriptionID', NUTRIDIGM_SUBSCRIPTION_ID);
  }

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const urlStr = url.toString();

  const existing = _inFlight.get(urlStr);
  if (existing) return existing;

  const promise = performRequest(urlStr).finally(() => {
    _inFlight.delete(urlStr);
  });
  _inFlight.set(urlStr, promise);
  return promise;
}

/**
 * Actually perform the fetch + response handling. Split out from `request`
 * so the in-flight de-dupe map can wrap this whole thing (including the
 * fetch itself) behind a single shared promise per URL.
 * @param {string} urlStr
 * @returns {Promise<any>}
 */
async function performRequest(urlStr) {
  recordRequest(urlStr);
  const res = await fetch(urlStr);

  // 220 = empty but valid
  if (res.status === 220) {
    return null;
  }

  // 401 = auth error — throw so adapter can catch and fall back
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}));
    const code = body.code || 'UNKNOWN_AUTH_ERROR';
    const msg = body.message || 'Unauthorized';

    if (!_loggedErrors.has(code)) {
      _loggedErrors.add(code);
      console.warn(`[nutridigm] ${code}: ${msg}`);
    }

    throw new NutridigmAuthError(code, msg);
  }

  // 400 = bad parameter
  if (res.status === 400) {
    const body = await res.json().catch(() => ({}));

    // /detailed can 400 with NOFOODITEMSFORGROUP when a food group simply has
    // no items for the given condition(s) — a data gap, not an error, so
    // resolve to empty instead of throwing (all other 400s still throw).
    if (body.code === 'NOFOODITEMSFORGROUP') {
      return [];
    }

    throw new Error(`[nutridigm] Bad request: ${body.code || body.message || res.statusText}`);
  }

  // Other non-2xx
  if (!res.ok && res.status !== 200) {
    throw new Error(`[nutridigm] HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

// ── Public endpoint wrappers ─────────────────────────────────────────────────

/**
 * GET /healthconditions
 * @returns {Promise<Array>} List of all health conditions
 */
export async function fetchHealthConditions() {
  return (await request('healthconditions')) ?? [];
}

/**
 * GET /fooditems
 * @returns {Promise<Array>} Full food dictionary
 */
export async function fetchFoodItems() {
  return (await request('fooditems')) ?? [];
}

/**
 * GET /foodgroups
 * @returns {Promise<Array>} All food group definitions
 */
export async function fetchFoodGroups() {
  return (await request('foodgroups')) ?? [];
}

/**
 * GET /goodfor — single food assessment against profile conditions.
 * @param {number} foodItemID
 * @param {string} healthConditionIDs - Comma-separated condition IDs
 * @returns {Promise<Object|null>} Assessment object or null if empty
 */
export async function fetchGoodFor(foodItemID, healthConditionIDs) {
  return request('goodfor', {
    foodItemID: String(foodItemID),
    healthConditionID: healthConditionIDs,
  });
}

/**
 * GET /topdoordonts — top consume/avoid foods.
 * @param {string} healthConditionIDs - Comma-separated condition IDs
 * @param {'consume' | 'avoid'} consumeOrAvoid
 * @param {number} [limit=30]
 * @returns {Promise<Array>} Sorted list of foods
 */
export async function fetchTopDoOrDonts(healthConditionIDs, consumeOrAvoid, limit = 30) {
  return (await request('topdoordonts', {
    healthConditionID: healthConditionIDs,
    consumeOrAvoid,
    limit: String(limit),
  })) ?? [];
}

/**
 * GET /suggest — best foods within a fine food group.
 * @param {string} healthConditionIDs - Comma-separated condition IDs
 * @param {string} fineFoodGroup - Fine group code (e.g. 'b1')
 * @returns {Promise<Array>} Sorted list of suggestions
 */
export async function fetchSuggest(healthConditionIDs, fineFoodGroup) {
  return (await request('suggest', {
    healthConditionID: healthConditionIDs,
    fineFoodGroup,
  })) ?? [];
}

/**
 * GET /detailed — best foods within a coarse food group.
 * @param {string} healthConditionIDs - Comma-separated condition IDs
 * @param {string} coarseFoodGroup - Coarse group code (e.g. 'e')
 * @param {'helpful' | 'neutral' | 'harmful'} listType
 * @returns {Promise<Array>} Foods in the group
 */
export async function fetchDetailed(healthConditionIDs, coarseFoodGroup, listType = 'helpful') {
  return (await request('detailed', {
    healthConditionID: healthConditionIDs,
    coarseFoodGroup,
    listType,
  })) ?? [];
}

/**
 * GET /references — citation strings for a food+condition pair.
 * @param {number} healthConditionID - Single condition ID
 * @param {number} foodItemID
 * @returns {Promise<string[]>} Array of citation strings
 */
export async function fetchReferences(healthConditionID, foodItemID) {
  return (await request('references', {
    healthConditionID: String(healthConditionID),
    foodItemID: String(foodItemID),
  })) ?? [];
}
