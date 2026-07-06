/**
 * storage — namespaced localStorage wrapper.
 *
 * All Remedi client state lives under a single versioned key so it's easy to
 * inspect, clear, or migrate. Swap the body of these four methods for a real
 * backend later; the rest of the app only knows the `storage.get/set` surface.
 */

const ROOT_KEY = 'remedi.v1';

function readAll() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(ROOT_KEY)) || {};
  } catch {
    return {};
  }
}

function writeAll(obj) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ROOT_KEY, JSON.stringify(obj));
  } catch {
    /* quota / privacy mode — fail silently, app still works in-memory */
  }
}

/**
 * Listeners notified after any `storage.set`/`storage.remove` call. Used by
 * src/api/profileSync.js to schedule a debounced remote push without every
 * call site needing to know about sync — see `onWrite` below.
 * @type {Set<(key: string) => void>}
 */
const _writeListeners = new Set();

function _notifyWrite(key) {
  for (const cb of _writeListeners) {
    try { cb(key); } catch { /* listener error — swallow */ }
  }
}

export const storage = {
  get(key, fallback = null) {
    const all = readAll();
    return key in all ? all[key] : fallback;
  },
  set(key, value) {
    const all = readAll();
    all[key] = value;
    writeAll(all);
    _notifyWrite(key);
  },
  remove(key) {
    const all = readAll();
    delete all[key];
    writeAll(all);
    _notifyWrite(key);
  },
  clear() {
    writeAll({});
  },
  /**
   * Subscribe to writes (`set`/`remove`) across all keys. Returns an
   * unsubscribe function. Intended for cross-cutting concerns (e.g. remote
   * sync) rather than UI — screens should keep using the src/state/ stores.
   * @param {(key: string) => void} callback
   * @returns {() => void} unsubscribe
   */
  onWrite(callback) {
    _writeListeners.add(callback);
    return () => {
      _writeListeners.delete(callback);
    };
  },
};
