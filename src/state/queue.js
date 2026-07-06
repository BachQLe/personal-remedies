/**
 * queue.js — Meal queue state store.
 *
 * Holds items the user plans to eat. Persists to localStorage and
 * exposes a pub/sub interface for React components to subscribe.
 *
 * API:
 *   getQueue()                 → item[]
 *   addToQueue(item)           → boolean (false if already present — for "Already in queue" snackbar)
 *   removeFromQueue(id)        → void
 *   insertIntoQueue(item, idx) → void (Undo restore)
 *   clearQueue()               → void
 *   subscribeQueue(cb)         → unsubscribe function
 *
 * Items have the same shape as library items: { id, name, image?, group?, tier?, referenceTotal? }
 */

import { storage } from '../api/storage.js';

const STORAGE_KEY = 'queue';

let _items = storage.get(STORAGE_KEY, []);

const _listeners = new Set();

function _persist() {
  storage.set(STORAGE_KEY, _items);
}

function _notify() {
  for (const cb of _listeners) {
    try { cb(_items); } catch { /* swallow */ }
  }
}

export function getQueue() {
  return _items;
}

/**
 * Add an item to the queue.
 * @returns {boolean} true if added, false if already present (by id).
 */
export function addToQueue(item) {
  if (!item || item.id == null) return false;
  if (_items.some((i) => i.id === item.id)) return false;
  _items = [..._items, item];
  _persist();
  _notify();
  return true;
}

export function removeFromQueue(id) {
  const before = _items.length;
  _items = _items.filter((i) => i.id !== id);
  if (_items.length !== before) {
    _persist();
    _notify();
  }
}

/**
 * Insert an item at a specific index — used by Undo to restore a removed card.
 */
export function insertIntoQueue(item, index) {
  if (!item || item.id == null) return;
  if (_items.some((i) => i.id === item.id)) return;
  const next = [..._items];
  next.splice(index, 0, item);
  _items = next;
  _persist();
  _notify();
}

export function clearQueue() {
  if (_items.length === 0) return;
  _items = [];
  _persist();
  _notify();
}

export function subscribeQueue(callback) {
  _listeners.add(callback);
  try { callback(_items); } catch { /* swallow */ }
  return () => {
    _listeners.delete(callback);
  };
}
