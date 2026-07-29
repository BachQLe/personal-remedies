/**
 * recentSearches — persisted most-recent-first list of executed search terms.
 *
 * Mirrors the library.js state-module pattern: a thin wrapper over `storage`
 * so the search surface reads (for the chip row) and appends (on each executed
 * search) through one place. Whether recents persist across sessions is a
 * data-layer concern handled here, not in the UI.
 *
 * Scoping: each surface that embeds SearchScreen (Food Lookup, Natural
 * Sources, …) gets its own namespaced recents list via `scope`. The default
 * scope keeps the original unnamespaced storage key so existing Food Lookup
 * user data survives untouched; any other scope reads/writes `<key>:<scope>`.
 *
 * API:
 *   getRecentSearches(scope?)        → string[]   (most-recent-first)
 *   addRecentSearch(term, scope?)    → void       (dedupes case-insensitively, caps length)
 */

import { storage } from '../api/storage.js';

const STORAGE_KEY = 'recentSearches';
const MAX = 8;

function keyFor(scope) {
  return scope && scope !== 'default' ? `${STORAGE_KEY}:${scope}` : STORAGE_KEY;
}

/**
 * Get recent search terms, most-recent-first.
 * @param {string} [scope]
 * @returns {string[]}
 */
export function getRecentSearches(scope = 'default') {
  const list = storage.get(keyFor(scope), []);
  return Array.isArray(list) ? list : [];
}

/**
 * Append a term to recents. Dedupes (case-insensitive) by moving an existing
 * match to the front, and caps the list at MAX entries.
 * @param {string} term
 * @param {string} [scope]
 */
export function addRecentSearch(term, scope = 'default') {
  const t = (term || '').trim();
  if (!t) return;
  const existing = getRecentSearches(scope).filter(
    (x) => x.toLowerCase() !== t.toLowerCase(),
  );
  const next = [t, ...existing].slice(0, MAX);
  storage.set(keyFor(scope), next);
}
