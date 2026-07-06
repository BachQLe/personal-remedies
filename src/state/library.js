/**
 * library.js — Shared state store for the ingredient library.
 *
 * The library holds the user's saved ingredients (Food objects).
 * It persists to localStorage and exposes a pub/sub interface for
 * React components to subscribe to changes.
 *
 * API:
 *   getLibrary()              → Food[]
 *   addToLibrary(food)        → void (no-op if already present)
 *   removeFromLibrary(foodId) → void
 *   clearLibrary()            → void
 *   subscribeLibrary(cb)      → unsubscribe function
 *   reloadLibrary()           → void (re-read from storage; used by profileSync after a remote pull)
 *
 * Used by IngredientCard's onAddToLibrary everywhere in the app,
 * and consumed by LibraryStrip on Home + buildMealPlan.
 */

import { storage } from '../api/storage.js';
import { schedulePush } from '../api/profileSync.js';

const STORAGE_KEY = 'library';

/** @type {import('../api/types.js').Food[]} */
let _items = storage.get(STORAGE_KEY, []);

/** @type {Set<(items: import('../api/types.js').Food[]) => void>} */
const _listeners = new Set();

function _persist() {
  storage.set(STORAGE_KEY, _items);
  schedulePush();
}

function _notify() {
  for (const cb of _listeners) {
    try { cb(_items); } catch { /* listener error — swallow */ }
  }
}

/**
 * Get the current library items.
 * @returns {import('../api/types.js').Food[]}
 */
export function getLibrary() {
  return _items;
}

/**
 * Add a food to the library. No-op if it already exists (by id).
 * @param {import('../api/types.js').Food} food
 */
export function addToLibrary(food) {
  if (!food || food.id == null) return;
  if (_items.some((f) => f.id === food.id)) return;
  _items = [..._items, food];
  _persist();
  _notify();
}

/**
 * Remove a food from the library by id.
 * @param {number} foodId
 */
export function removeFromLibrary(foodId) {
  const before = _items.length;
  _items = _items.filter((f) => f.id !== foodId);
  if (_items.length !== before) {
    _persist();
    _notify();
  }
}

/**
 * Clear all items from the library.
 */
export function clearLibrary() {
  if (_items.length === 0) return;
  _items = [];
  _persist();
  _notify();
}

/**
 * Subscribe to library changes. Returns an unsubscribe function.
 * The callback is invoked immediately with the current state, then on each change.
 * @param {(items: import('../api/types.js').Food[]) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeLibrary(callback) {
  _listeners.add(callback);
  // Immediate call with current state
  try { callback(_items); } catch { /* swallow */ }
  return () => {
    _listeners.delete(callback);
  };
}

/**
 * Re-read the library from storage and notify subscribers. Used by
 * src/api/profileSync.js after a remote pull hydrates localStorage with a
 * newer copy of the library, so this in-memory module picks up the change.
 */
export function reloadLibrary() {
  _items = storage.get(STORAGE_KEY, []);
  _notify();
}
