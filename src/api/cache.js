/**
 * cache.js — Persistent TTL cache with stale-while-revalidate, for Nutridigm
 * responses that don't change often (dictionaries) or are expensive/rate
 * limited to fetch (topdoordonts).
 *
 * The Nutridigm API enforces a DAILY call limit, so the point of this layer
 * is to avoid re-fetching the same data on every page reload:
 *   - Fresh entry  → return cached data, no network call.
 *   - Stale entry  → return the stale data immediately (so the UI isn't
 *     blocked) AND kick off a background refetch that updates the persisted
 *     entry for next time.
 *   - Missing/corrupt/version-mismatched entry → await the fetcher, persist
 *     the result, then return it.
 *
 * Storage: plain localStorage under its own namespace (NOT storage.js) so
 * cache writes never fire storage.js's `onWrite` hook — that hook drives
 * src/api/profileSync.js's debounced remote push, which only cares about
 * `profile`/`library`/`dailyPlan`, not HTTP cache bookkeeping.
 *
 * An in-memory Map sits on top of localStorage so repeat calls within the
 * same session (e.g. multiple components asking for the food dictionary)
 * don't even pay the JSON.parse cost.
 */

const NS = 'remedi.cache.v1.';

/** Bump this when the shape of any cached payload changes, to invalidate old entries. */
export const SCHEMA_VERSION = 1;

/** @type {Map<string, { v: number, ts: number, data: any }>} */
const _memory = new Map();

/** @type {Map<string, Promise<any>>} In-flight background revalidations, keyed by storage key. */
const _revalidating = new Map();

function readEntry(key) {
  if (_memory.has(key)) return _memory.get(key);

  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(NS + key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry !== 'object' || typeof entry.ts !== 'number') return null;
    _memory.set(key, entry);
    return entry;
  } catch {
    // Corrupt JSON — treat as missing, fall through to network.
    return null;
  }
}

function writeEntry(key, entry) {
  _memory.set(key, entry);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(NS + key, JSON.stringify(entry));
  } catch {
    // Quota exceeded / privacy mode — cache still works in-memory for this session.
  }
}

/**
 * Fetch-through cache with TTL + stale-while-revalidate semantics.
 *
 * @template T
 * @param {string} key - Cache key. Callers should fold any request params
 *   (e.g. conditionsCSV) into the key so distinct requests don't collide.
 * @param {number} ttlMs - How long an entry is considered fresh.
 * @param {() => Promise<T>} fetcher - Produces a fresh value; only awaited
 *   when the cache is missing/stale/version-mismatched.
 * @returns {Promise<T>}
 */
export async function cachedFetch(key, ttlMs, fetcher) {
  const entry = readEntry(key);
  const now = Date.now();

  if (entry && entry.v === SCHEMA_VERSION) {
    const age = now - entry.ts;
    if (age < ttlMs) {
      return entry.data;
    }

    // Stale: return immediately, revalidate in the background (de-duped).
    if (!_revalidating.has(key)) {
      const revalidation = (async () => {
        try {
          const data = await fetcher();
          writeEntry(key, { v: SCHEMA_VERSION, ts: Date.now(), data });
        } catch {
          // Background revalidation failure — keep serving the stale entry.
        } finally {
          _revalidating.delete(key);
        }
      })();
      _revalidating.set(key, revalidation);
    }
    return entry.data;
  }

  // Missing or version-mismatched — await the network, then persist.
  const data = await fetcher();
  writeEntry(key, { v: SCHEMA_VERSION, ts: now, data });
  return data;
}

/**
 * Read a cache entry WITHOUT triggering any network call — not even a
 * background revalidation. Returns the cached data if present (fresh OR
 * stale — staleness doesn't matter for a "have we ever fetched this"
 * check), or `undefined` if there's no entry (or it's version-mismatched).
 *
 * Used by trust-signal UI (e.g. `getCachedRefCount`) that wants to opportunistically
 * show data already paid for, without ever causing a fetch itself.
 *
 * @param {string} key
 * @returns {any|undefined}
 */
export function peekCache(key) {
  const entry = readEntry(key);
  if (!entry || entry.v !== SCHEMA_VERSION) return undefined;
  return entry.data;
}

/**
 * Clear all cached entries (dev/debugging helper).
 */
export function clearCache() {
  _memory.clear();
  _revalidating.clear();
  if (typeof window === 'undefined') return;
  try {
    const toRemove = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(NS)) toRemove.push(k);
    }
    toRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
