/**
 * schedule.js — Scheduled meal plan state store.
 *
 * Holds the user's multi-day meal schedule (Plan screen — /app/plan),
 * keyed by LOCAL calendar date. Persists to localStorage and exposes a
 * pub/sub interface for React components to subscribe. Mirrors
 * src/state/dailyPlan.js's module structure.
 *
 * API:
 *   getSchedule()                      → ScheduleState
 *   subscribeSchedule(cb)              → unsubscribe function
 *   reloadSchedule()                   → void (re-read from storage; profileSync pull path)
 *   scheduleItem(dateKey, item, opts)  → boolean (false if id already scheduled that day)
 *   removeScheduled(dateKey, id)       → ScheduledItem|null (removed item, for Undo)
 *   setCooked(dateKey, id, cooked)     → void
 *   getItemsForDay(dateKey)            → ScheduledItem[]
 *   clearSchedule()                    → void (wipe every day; profile-change purge)
 */

import { storage } from '../api/storage.js';

/**
 * @typedef {Object} ScheduledItem
 * @property {number|string} id
 * @property {string} name
 * @property {string} [image]
 * @property {string} [group] - Coarse food group code
 * @property {string} [fineGroup] - Fine food group code
 * @property {import('../api/types.js').TierOrPoor} [tier]
 * @property {number|null} [numericId] - Raw /goodfor descriptionNumericID (1-7), null if unknown
 * @property {'food'|'recipe'} kind
 * @property {string} [sourceName] - Attribution for recipes, e.g. "Food Network · ..."
 * @property {boolean} cooked
 * @property {string|null} cookedAt - ISO timestamp, or null if not cooked
 * @property {string} fromSlot - originating slot key (e.g. 'breakfast'), '' if unknown
 */

/**
 * @typedef {Object} ScheduleState
 * @property {1} version
 * @property {Object<string, ScheduledItem[]>} days - 'YYYY-MM-DD' LOCAL date
 *   (produced via `toLocaleDateString('en-CA')` — NEVER `toISOString`, which
 *   rolls over at UTC midnight and would put items on the wrong day) → items.
 */

const STORAGE_KEY = 'schedule';
const PRUNE_DAYS = 14;

/**
 * Read the stored value and validate its shape. A foreign or stale row
 * must yield a fresh empty state (clean rebuild) rather than crash the app.
 * @returns {ScheduleState}
 */
function _readValid() {
  const value = storage.get(STORAGE_KEY, null);
  if (!value || typeof value !== 'object') return { version: 1, days: {} };
  if (value.version !== 1) return { version: 1, days: {} };
  if (!value.days || typeof value.days !== 'object' || Array.isArray(value.days)) {
    return { version: 1, days: {} };
  }
  return value;
}

/**
 * Drop day keys older than (today − PRUNE_DAYS days). Keys are LOCAL
 * 'YYYY-MM-DD' strings, which sort lexicographically the same as
 * chronologically, so a plain string comparison against the cutoff works.
 * @param {ScheduleState} state
 * @returns {ScheduleState}
 */
function _pruneOldDays(state) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - PRUNE_DAYS);
  const cutoffKey = cutoff.toLocaleDateString('en-CA');
  const nextDays = {};
  let changed = false;
  for (const [key, items] of Object.entries(state.days)) {
    if (key >= cutoffKey) {
      nextDays[key] = items;
    } else {
      changed = true;
    }
  }
  return changed ? { ...state, days: nextDays } : state;
}

/** @type {ScheduleState} */
let _schedule = _pruneOldDays(_readValid());

/** @type {Set<(schedule: ScheduleState) => void>} */
const _listeners = new Set();

function _persist() {
  storage.set(STORAGE_KEY, _schedule);
}

function _notify() {
  for (const cb of _listeners) {
    try { cb(_schedule); } catch { /* swallow */ }
  }
}

// Persist the pruned state immediately so stale days don't linger in
// storage even if no mutation happens this session.
_persist();

/**
 * Get the current schedule state.
 * @returns {ScheduleState}
 */
export function getSchedule() {
  return _schedule;
}

/**
 * Subscribe to schedule changes. The callback is invoked immediately with
 * the current state (screens need initial hydration on mount, same as
 * subscribePlan), then on each change.
 * @param {(schedule: ScheduleState) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeSchedule(callback) {
  _listeners.add(callback);
  try { callback(_schedule); } catch { /* swallow */ }
  return () => {
    _listeners.delete(callback);
  };
}

/**
 * Re-read the schedule from storage and notify subscribers. Used by
 * src/api/profileSync.js after a remote pull hydrates localStorage with a
 * newer copy of the schedule, so this in-memory module picks up the change.
 */
export function reloadSchedule() {
  _schedule = _pruneOldDays(_readValid());
  _notify();
}

/**
 * Wipe every scheduled day. Called by the health-profile-change purge
 * (`purgeMealPlanForProfileChange`, src/api/planBuilder.js): scheduled
 * meals were chosen under the previous guidance and must not outlive it.
 * No-op (writes nothing, notifies nobody) when already empty.
 */
export function clearSchedule() {
  if (Object.keys(_schedule.days).length === 0) return;
  _schedule = { version: 1, days: {} };
  _persist();
  _notify();
}

/**
 * Schedule an item onto a given day. Deduped per-day by id — the same id
 * may appear on different days, but not twice on the same day.
 * @param {string} dateKey - LOCAL 'YYYY-MM-DD'
 * @param {Object} item - source item (food or recipe); extra fields are
 *   stripped down to the ScheduledItem shape.
 * @param {Object} [opts]
 * @param {boolean} [opts.cooked=false]
 * @param {string} [opts.fromSlot='']
 * @returns {boolean} true if scheduled, false if an item with this id
 *   already exists on that day.
 */
export function scheduleItem(dateKey, item, { cooked = false, fromSlot = '' } = {}) {
  if (!item || item.id == null) return false;
  const items = _schedule.days[dateKey] || [];
  if (items.some((i) => i.id === item.id)) return false;

  /** @type {ScheduledItem} */
  const scheduled = {
    id: item.id,
    name: item.name,
    image: item.image,
    group: item.group,
    fineGroup: item.fineGroup || '',
    tier: item.tier,
    numericId: item.numericId ?? null,
    kind: item.kind,
    sourceName: item.sourceName,
    cooked,
    cookedAt: cooked ? new Date().toISOString() : null,
    fromSlot,
  };

  _schedule = {
    ..._schedule,
    days: { ..._schedule.days, [dateKey]: [...items, scheduled] },
  };
  _persist();
  _notify();
  return true;
}

/**
 * Remove a scheduled item from a day by id.
 * @param {string} dateKey
 * @param {number|string} id
 * @returns {ScheduledItem|null} the removed item (for Undo), or null if not found.
 */
export function removeScheduled(dateKey, id) {
  const items = _schedule.days[dateKey];
  if (!items) return null;
  const index = items.findIndex((i) => i.id === id);
  if (index === -1) return null;
  const removed = items[index];
  const nextItems = items.slice();
  nextItems.splice(index, 1);
  _schedule = { ..._schedule, days: { ..._schedule.days, [dateKey]: nextItems } };
  _persist();
  _notify();
  return removed;
}

/**
 * Mark a scheduled item cooked/uncooked.
 * @param {string} dateKey
 * @param {number|string} id
 * @param {boolean} cooked
 */
export function setCooked(dateKey, id, cooked) {
  const items = _schedule.days[dateKey];
  if (!items) return;
  const index = items.findIndex((i) => i.id === id);
  if (index === -1) return;
  const nextItems = items.slice();
  nextItems[index] = {
    ...nextItems[index],
    cooked,
    cookedAt: cooked ? new Date().toISOString() : null,
  };
  _schedule = { ..._schedule, days: { ..._schedule.days, [dateKey]: nextItems } };
  _persist();
  _notify();
}

/**
 * Get the scheduled items for a given day.
 * @param {string} dateKey
 * @returns {ScheduledItem[]}
 */
export function getItemsForDay(dateKey) {
  return _schedule.days[dateKey] || [];
}
