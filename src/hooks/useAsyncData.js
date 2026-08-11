/**
 * useAsyncData — the shared data-fetching hook for the state matrix
 * (REMEDI_MASTER_PLAN.md §4.1). Wraps a fetcher with the loading/empty/
 * error/offline bookkeeping every screen currently hand-rolls, and derives
 * `status` via src/api/loadState.js#deriveState (kept there, not here, so
 * the state machine itself stays a pure, exhaustively-unit-tested function
 * with no React involved).
 *
 * Connectivity comes from src/api/connectivity.js — never `navigator`
 * directly. Profile existence (for `requiresProfile`) comes from
 * src/api/storage.js, the same source App.jsx's `RequireOnboarding` reads.
 *
 * Test approach note: this hook is intentionally thin — nearly all of its
 * decision logic (state derivation, error classification, fetch-result
 * unwrapping) lives in the pure, framework-free src/api/loadState.js, which
 * has exhaustive unit tests. Rather than pull in a new testing dependency
 * (React Testing Library) just to test this wrapper, its own tests
 * (src/hooks/useAsyncData.test.js) use a minimal manual harness — React 19's
 * own `act` (exported from 'react') plus `react-dom/client`'s
 * `createRoot`, both already dependencies — to mount a tiny host component
 * and assert on the hook's returned snapshot across renders.
 *
 * @template T
 * @param {() => Promise<T>} fetcher - Zero-arg function returning a
 *   Promise. May resolve with a plain value, or with the
 *   `{ data, fromCache, stale }` envelope `cachedFetchWithMeta`
 *   (src/api/cache.js) returns — see `unwrapFetchResult`.
 * @param {ReadonlyArray<*>} [deps] - Re-runs the fetcher when any entry
 *   changes, same contract as useEffect's dependency array.
 * @param {Object} [options]
 * @param {(data: T) => boolean} [options.isEmpty] - Semantic emptiness
 *   check. Defaults to loadState.js's `defaultIsEmpty`.
 * @param {boolean} [options.requiresProfile] - When true, the fetcher is
 *   never called until a profile exists, and status is 'empty-no-profile'
 *   while it's missing instead of 'loading'.
 * @returns {{
 *   status: import('../api/loadState.js').LoadState,
 *   data: T|undefined,
 *   error: Error|null,
 *   fromCache: boolean,
 *   offline: boolean,
 *   retry: () => void,
 *   refetch: () => void,
 * }}
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { isOnline, subscribeOnline } from '../api/connectivity.js';
import { storage } from '../api/storage.js';
import { deriveState, isApiError, unwrapFetchResult, defaultIsEmpty } from '../api/loadState.js';

export function useAsyncData(fetcher, deps = [], options = {}) {
  const { isEmpty = defaultIsEmpty, requiresProfile = false } = options;
  const hasProfile = requiresProfile ? !!storage.get('profile', null) : true;

  // Latest fetcher, kept current via an effect (not written during render)
  // so `run` doesn't need it in its own dependency list — callers routinely
  // pass a fresh inline closure every render, and re-fetching on every
  // render (rather than only when `deps` changes) would defeat the whole
  // point of a deps array. `isEmpty` doesn't need this treatment: it's only
  // ever read during render (in the status derivation below), where the
  // plain destructured value is already current — no ref/effect indirection
  // needed there, and reading a ref during render is disallowed anyway.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const [online, setOnline] = useState(isOnline());
  const [snapshot, setSnapshot] = useState({
    loading: true,
    data: undefined,
    error: null,
    fromCache: false,
  });

  // Mirrors `snapshot` for the connectivity-subscription callback below,
  // which is set up once (per `run` identity) and would otherwise close
  // over a stale snapshot from whichever render set it up.
  const snapshotRef = useRef(snapshot);
  useEffect(() => {
    snapshotRef.current = snapshot;
  });

  // Bumped on every fetch attempt (mount, deps change, retry) so a
  // resolution from an earlier, superseded attempt — or one arriving after
  // unmount — is ignored instead of clobbering newer state.
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(() => {
    // Gated: deriveState checks `requiresProfile && !hasProfile` before it
    // ever looks at `loading`/`data` (see loadState.js), so status already
    // resolves to 'empty-no-profile' correctly with zero state mutation
    // here — nothing to fetch, nothing to set.
    if (requiresProfile && !hasProfile) {
      return;
    }

    const attempt = ++attemptRef.current;

    // Every state update below happens inside a promise callback (an async
    // boundary), never synchronously in this function body — the shape
    // react-hooks/set-state-in-effect wants for effect-driven fetches.
    // Consequence: on a retry after an error, the error panel stays up
    // as-is until the retry settles rather than flashing back to a
    // skeleton first — acceptable, and arguably steadier UI.
    Promise.resolve()
      .then(() => fetcherRef.current())
      .then((result) => {
        if (!mountedRef.current || attempt !== attemptRef.current) return;
        const { data, fromCache } = unwrapFetchResult(result);
        setSnapshot({ loading: false, data, error: null, fromCache });
      })
      .catch((error) => {
        if (!mountedRef.current || attempt !== attemptRef.current) return;
        setSnapshot((s) => ({ ...s, loading: false, error }));
      });
  }, [requiresProfile, hasProfile]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` (caller-supplied array) is the intended re-fetch trigger, spread deliberately; `run` already captures requiresProfile/hasProfile and is otherwise stable.
  }, [run, ...deps]);

  // Re-derive on connectivity change, and auto-retry once back online after
  // a network-shaped error (an API error is left alone — the server itself
  // said no, retrying without the user's input won't fix that).
  useEffect(() => {
    return subscribeOnline((nextOnline) => {
      setOnline(nextOnline);
      const lastError = snapshotRef.current.error;
      if (nextOnline && lastError && !isApiError(lastError)) {
        run();
      }
    });
  }, [run]);

  const retry = useCallback(() => {
    run();
  }, [run]);

  const hasData = snapshot.data !== undefined && snapshot.data !== null;
  const status = deriveState({
    loading: snapshot.loading,
    hasData,
    isEmpty: hasData ? !!isEmpty(snapshot.data) : false,
    error: snapshot.error,
    online,
    hasProfile,
    requiresProfile,
  });

  return {
    status,
    data: snapshot.data,
    error: snapshot.error,
    fromCache: snapshot.fromCache,
    offline: !online,
    retry,
    refetch: retry,
  };
}
