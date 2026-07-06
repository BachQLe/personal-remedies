/**
 * recentSearches — persisted most-recent-first list of executed search terms.
 *
 * Mirrors the library.js state-module pattern: a thin wrapper over `storage`
 * so the search surface reads (for the chip row) and appends (on each executed
 * search) through one place. Whether recents persist across sessions is a
 * data-layer concern handled here, not in the UI.
 *
 * API:
 *   getRecentSearches()   → string[]   (most-recent-first)
 *   addRecentSearch(term) → void       (dedupes case-insensitively, caps length)
 *   clearRecentSearches() → void
 */

import { storage } from '../api/storage.js';

const STORAGE_KEY = 'recentSearches';
const MAX = 8;

/**
 * Get recent search terms, most-recent-first.
 * @returns {string[]}
 */
export function getRecentSearches() {
  const list = storage.get(STORAGE_KEY, []);
  return Array.isArray(list) ? list : [];
}

/**
 * Append a term to recents. Dedupes (case-insensitive) by moving an existing
 * match to the front, and caps the list at MAX entries.
 * @param {string} term
 */
export function addRecentSearch(term) {
  const t = (term || '').trim();
  if (!t) return;
  const existing = getRecentSearches().filter(
    (x) => x.toLowerCase() !== t.toLowerCase(),
  );
  const next = [t, ...existing].slice(0, MAX);
  storage.set(STORAGE_KEY, next);
}

/**
 * Clear all recent searches.
 */
export function clearRecentSearches() {
  storage.remove(STORAGE_KEY);
}
