/**
 * loadState.js — pure state-matrix logic for data-dependent screens
 * (REMEDI_MASTER_PLAN.md §4.1: "loading · empty (no results) · empty (no
 * profile) · error (network) · error (API) · offline (cached) · offline
 * (no cache)").
 *
 * Deliberately has ZERO React and ZERO Nutridigm-client imports — it's a
 * plain state machine so it can be unit-tested exhaustively without a DOM,
 * and so `src/hooks/useAsyncData.js` (the one file allowed to touch React
 * state) can stay a thin wrapper around logic that's fully covered here.
 * Error classification uses duck-typing against src/api/nutridigm.js's
 * error shapes (NutridigmAuthError/NutridigmConfigError, plus its plain
 * `Error`s prefixed with '[nutridigm]') rather than importing those classes,
 * so this file never needs to know the API client exists.
 */

/**
 * The full state-matrix vocabulary. Every data-dependent screen should be
 * able to render *something* for each of these without extra branching.
 * @typedef {'loading'|'success'|'empty'|'empty-no-profile'|'error-network'|'error-api'|'offline-cached'|'offline-no-cache'} LoadState
 */

/**
 * Duck-types an error as Nutridigm-API-shaped (the server answered, just
 * not with what we wanted) rather than a raw transport failure. Checked
 * against src/api/nutridigm.js's actual shapes:
 *   - `NutridigmAuthError` — `.name === 'NutridigmAuthError'`, `.code` string
 *     (e.g. NOTAUTHORIZEDHEALTHID, APIDAILYLIMITREACHED)
 *   - `NutridigmConfigError` — `.name === 'NutridigmConfigError'`, no `.code`
 *   - `performRequest`'s bad-request/non-2xx paths — plain `Error`s whose
 *     `.message` is prefixed `'[nutridigm] ...'`, no `.code`/`.status`
 * Also recognizes a generic numeric `.status` field so any other layer's
 * HTTP-shaped error (e.g. a future non-Nutridigm API) classifies correctly
 * without this file needing to know about it by name.
 * @param {*} error
 * @returns {boolean}
 */
export function isApiError(error) {
  if (!error || typeof error !== 'object') return false;
  if (error.name === 'NutridigmAuthError' || error.name === 'NutridigmConfigError') return true;
  if (typeof error.status === 'number') return true;
  if (typeof error.code === 'string' && error.code.length > 0) return true;
  if (typeof error.message === 'string' && /^\[nutridigm\]/.test(error.message)) return true;
  return false;
}

/**
 * Duck-types an error as a network/transport failure — `fetch()` itself
 * rejecting rather than the server responding. Browsers throw a `TypeError`
 * for this ("Failed to fetch" in Chrome, "NetworkError when attempting to
 * fetch resource" in Firefox, "Load failed" in Safari), so that's the
 * primary signal; a message-text fallback catches anything wrapping the
 * original error. Any error that isn't API-shaped (see `isApiError`) also
 * falls back to network — a rejection reaching this state machine is always
 * either the API client's shaped error or a transport failure, never a
 * third kind this matrix knows about.
 * @param {*} error
 * @returns {boolean}
 */
export function isNetworkError(error) {
  if (!error) return false;
  if (isApiError(error)) return false;
  if (error.name === 'TypeError') return true;
  if (
    typeof error.message === 'string' &&
    /fail(?:ed)? to fetch|networkerror|load failed|network request failed/i.test(error.message)
  ) {
    return true;
  }
  return true;
}

/**
 * Default emptiness predicate: null/undefined, an empty array, or a plain
 * object with no own keys. Screens whose "empty" means something else
 * (e.g. a sentinel value) should pass their own `isEmpty` to `useAsyncData`.
 * @param {*} data
 * @returns {boolean}
 */
export function defaultIsEmpty(data) {
  if (data === null || data === undefined) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === 'object') return Object.keys(data).length === 0;
  return false;
}

/**
 * Normalizes a fetcher's resolved value into `{ data, fromCache, stale }`.
 * A fetcher passed to `useAsyncData` may resolve with either a plain value,
 * or the `{ data, fromCache, stale }` envelope `cachedFetchWithMeta`
 * (src/api/cache.js) returns when a screen wants the offline-cached banner
 * to reflect real cache provenance instead of always reporting `false`.
 * Duck-typed on shape so callers of either kind work without the hook
 * needing to know which one it got.
 * @param {*} result
 * @returns {{ data: *, fromCache: boolean, stale: boolean }}
 */
export function unwrapFetchResult(result) {
  if (
    result &&
    typeof result === 'object' &&
    typeof result.fromCache === 'boolean' &&
    Object.prototype.hasOwnProperty.call(result, 'data')
  ) {
    return { data: result.data, fromCache: result.fromCache, stale: !!result.stale };
  }
  return { data: result, fromCache: false, stale: false };
}

/**
 * Derives the matrix state from a snapshot of loading/data/error/
 * connectivity/profile inputs. Pure — same input always yields the same
 * output, no hidden clock/randomness/global reads.
 *
 * Precedence (highest first) — each rule only applies once the ones above
 * it don't:
 *   1. `requiresProfile && !hasProfile` → 'empty-no-profile'. A screen that
 *      can't function without a profile shouldn't show a spinner or a
 *      generic empty state — it should say so specifically, regardless of
 *      whether a fetch was even attempted.
 *   2. `!online` → 'offline-cached' (have data) or 'offline-no-cache'
 *      (don't). Checked before `loading`/`error` because once we know the
 *      device is offline, that's the more actionable, more specific story
 *      than a generic spinner or network error — no point telling the user
 *      "connection problem" when we can tell them "you're offline".
 *   3. `loading` → 'loading'. Only meaningful pre-first-resolution — see
 *      `loading`'s doc below; a background SWR revalidation with existing
 *      data should never re-enter this branch.
 *   4. `error` → 'error-api' or 'error-network', via `isApiError`.
 *   5. `hasData` → 'success' or 'empty', via `isEmpty`.
 *   6. Fallback (no data, no error, online, not loading) → 'empty'.
 *
 * @param {Object} input
 * @param {boolean} [input.loading] - True only until the fetch's FIRST
 *   resolution (success or failure). A later background revalidation that
 *   keeps existing `data` on screen (stale-while-revalidate) should pass
 *   `loading: false` even while a request is technically in flight — that's
 *   what keeps 'success'/'offline-cached' showing stale content instead of
 *   flashing back to a skeleton.
 * @param {boolean} [input.hasData] - Whether there's data to show (from
 *   this fetch or a still-valid earlier one), independent of `isEmpty`.
 * @param {boolean} [input.isEmpty] - Semantic emptiness of that data
 *   (e.g. an empty array). Ignored when `hasData` is false.
 * @param {*} [input.error] - The most recent rejection, if any.
 * @param {boolean} [input.online] - Current connectivity
 *   (src/api/connectivity.js#isOnline()).
 * @param {boolean} [input.hasProfile] - Whether a profile exists. Only
 *   consulted when `requiresProfile` is true.
 * @param {boolean} [input.requiresProfile] - Whether this data depends on a
 *   profile existing before it can even be fetched.
 * @returns {LoadState}
 */
export function deriveState(input = {}) {
  const {
    loading = false,
    hasData = false,
    isEmpty = false,
    error = null,
    online = true,
    hasProfile = true,
    requiresProfile = false,
  } = input;

  if (requiresProfile && !hasProfile) {
    return 'empty-no-profile';
  }

  if (!online) {
    return hasData ? 'offline-cached' : 'offline-no-cache';
  }

  if (loading) {
    return 'loading';
  }

  if (error) {
    return isApiError(error) ? 'error-api' : 'error-network';
  }

  if (hasData) {
    return isEmpty ? 'empty' : 'success';
  }

  return 'empty';
}
