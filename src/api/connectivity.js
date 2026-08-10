/**
 * connectivity.js — thin adapter for online/offline status.
 *
 * This is the ONLY file allowed to touch `navigator.onLine` and the
 * window `online`/`offline` events. Everything else should call
 * `isOnline()` / `subscribeOnline()` instead of reaching for `navigator`
 * directly, so the rest of the app stays portable to Expo/React Native
 * later (where connectivity is read via NetInfo, not `navigator.onLine`).
 *
 * Mirrors the pub/sub shape used by src/state/library.js and
 * src/state/dailyPlan.js: a `subscribe*(callback)` that returns an
 * unsubscribe function.
 */

/**
 * Current online status.
 *
 * Defaults to `true` when `navigator.onLine` isn't available (SSR, node
 * tests, or an odd browser that doesn't implement it) — the app should
 * assume network access rather than falsely reporting offline and hiding
 * features the user could actually use. `navigator.onLine` itself is also
 * a best-effort signal (it can be `true` while genuinely offline, e.g.
 * captive portals), so callers should still handle fetch failures
 * gracefully rather than trusting this as a guarantee.
 *
 * @returns {boolean}
 */
export function isOnline() {
  if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') {
    return true;
  }
  return navigator.onLine;
}

/**
 * Subscribe to online/offline transitions. `callback` is invoked with the
 * new `isOnline()` value whenever the browser fires an `online` or
 * `offline` event. Returns an unsubscribe function.
 *
 * No-ops (returns a no-op unsubscribe) outside a browser so importing this
 * module and calling this function is always safe.
 *
 * @param {(online: boolean) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeOnline(callback) {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }

  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
