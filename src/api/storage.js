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

export const storage = {
  get(key, fallback = null) {
    const all = readAll();
    return key in all ? all[key] : fallback;
  },
  set(key, value) {
    const all = readAll();
    all[key] = value;
    writeAll(all);
  },
  remove(key) {
    const all = readAll();
    delete all[key];
    writeAll(all);
  },
  clear() {
    writeAll({});
  },
};
