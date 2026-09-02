/**
 * dailyPlan.js — Weekly meal plan state store.
 *
 * Holds a rolling 7-day slot-based meal plan (breakfast/lunch/dinner/snacks/
 * beverages per day). Persists to localStorage under the same `'dailyPlan'`
 * key the v1 single-day store used (Supabase compat — see below) and exposes
 * a pub/sub interface for React components to subscribe. Mirrors
 * src/state/queue.js's module structure.
 *
 * Note: unlike library.js, this store does NOT call `schedulePush()` after
 * `_persist()` — src/api/profileSync.js's `storage.onWrite` hook already
 * pushes the `'dailyPlan'` key on every write (see its SYNCED_KEYS set), so
 * calling schedulePush here would be redundant.
 *
 * Version 2 (WeeklyPlan) replaces version 1 (single-day DailyPlan). The
 * storage key is unchanged so a v1 row already synced to a user's Supabase
 * `profiles.daily_plan` column keeps round-tripping — `_readValid()`
 * transparently migrates it into a one-day v2 shape on read (see
 * `_migrateV1`); the remaining 6 days get filled in by the next
 * `ensurePlanForWeek()` call (src/api/planBuilder.js), same as any other
 * "missing trailing day" in the rolling window.
 *
 * API:
 *   getPlan()                                → WeeklyPlan|null
 *   setPlan(plan)                            → void (replace whole plan; persist + notify)
 *   subscribePlan(cb)                        → unsubscribe function
 *   reloadPlan()                             → void (re-read from storage; profileSync pull path)
 *   markEaten(dateKey, id) / unmarkEaten(dateKey, id) → void
 *   togglePinned(dateKey, id)                → void (lock/unlock a card in place for regenerate/shuffle)
 *   removeFromSlot(dateKey, slotKey, id)     → number (removed index, or -1)
 *   insertIntoSlot(dateKey, slotKey, item, index) → void (Undo restore)
 *   addToSlot(dateKey, slotKey, item)        → boolean (false if id already in ANY slot that day)
 *   consumeLegacyQueue()                     → PlanItem[] (reads legacy 'queue' key, non-destructive)
 */

import { storage } from '../api/storage.js';

/**
 * @typedef {Object} PlanItem
 * @property {number|string} id
 * @property {string} name
 * @property {string} [image]
 * @property {string} [group] - Coarse food group code
 * @property {string} [fineGroup] - Fine food group code
 * @property {import('../api/types.js').TierOrPoor} [tier]
 * @property {number|null} [numericId] - Raw /goodfor descriptionNumericID (1-7), null if unknown
 * @property {'food'|'recipe'} kind
 * @property {string} [sourceName] - Attribution for recipes, e.g. "Food Network · ..."
 * @property {string|null} [substituteFineGroup] - Recipe-kind items only: the
 *   REAL fine food group of the recipe's primary ingredient (resolved from
 *   the C1 overlay), used to scope `getSlotSubstitutes` — a recipe's own
 *   `fineGroup` is always the hardcoded recipe group 'l', useless for that.
 *   `null`/absent when unresolvable (recipe outside the overlay dataset).
 */

/**
 * @typedef {Object} PlanDayState
 * @property {number} generation - per-day regeneration counter, used by
 *   regenerateDay/shuffleSlot to advance offsets deterministically. Distinct
 *   from `WeeklyPlan.generation` (the week-level counter).
 * @property {Object<string, number>} offsets - slotKey → cursor
 * @property {Object<string, PlanItem[]>} slots - slotKey → items
 * @property {Array<number|string>} eaten - ids marked eaten this day
 * @property {Array<number|string>} pinned - ids locked in place this day;
 *   survive shuffleSlot/regenerateDay/regenerateWeek.
 */

/**
 * @typedef {Object} WeeklyPlan
 * @property {2} version
 * @property {string} conditionsKey - CSV of condition ids the plan was built
 *   for (fallback-resolved).
 * @property {string[]} conditionNames
 * @property {boolean} usedFallback
 * @property {number} generation - week-level counter, bumped only by
 *   `regenerateWeek` (each day also carries its own `generation`).
 * @property {Object<string, PlanDayState>} days - LOCAL 'YYYY-MM-DD' date key
 *   (produced via `toLocaleDateString('en-CA')` — NEVER `toISOString`) →
 *   PlanDayState. A rolling 7-day window: see `ensurePlanForWeek` in
 *   src/api/planBuilder.js for how days enter/leave this map.
 * @property {Object<string, PlanItem[]>} [picksBySlot] - slotKey → the items the
 *   user hand-picked in MealPlannerPicker. Present only on picks-built plans, and
 *   its presence is what puts the whole plan into picks-only mode: every day's
 *   slots are drawn from here and NEVER backfilled from the suggestion pools
 *   (see `pickWindow` in src/api/planBuilder.js). Absent on auto-built plans,
 *   including every plan persisted before this field existed.
 */

const STORAGE_KEY = 'dailyPlan';

/** @type {WeeklyPlan|null} */
let _plan = _readValid();

/** @type {Set<(plan: WeeklyPlan|null) => void>} */
const _listeners = new Set();

/**
 * Migrate a v1 single-day `DailyPlan` into the v2 `WeeklyPlan` shape: its
 * slots/offsets/eaten become the entry for its own `date`, with an empty
 * `pinned` list (pinning didn't exist in v1). The remaining 6 days of the
 * window are intentionally left ungenerated — `ensurePlanForWeek` treats
 * that exactly like any other "missing trailing day" and fills them in.
 * @param {Object} v1
 * @returns {WeeklyPlan}
 */
function _migrateV1(v1) {
  return {
    version: 2,
    conditionsKey: v1.conditionsKey ?? '',
    conditionNames: Array.isArray(v1.conditionNames) ? v1.conditionNames : [],
    usedFallback: !!v1.usedFallback,
    generation: 0,
    days: {
      [v1.date]: {
        generation: v1.generation ?? 0,
        offsets: v1.offsets && typeof v1.offsets === 'object' ? v1.offsets : {},
        slots: v1.slots,
        eaten: Array.isArray(v1.eaten) ? v1.eaten : [],
        pinned: [],
      },
    },
  };
}

/**
 * Read the stored value and validate its shape. The `'dailyPlan'` key
 * round-trips through Supabase's `profiles.daily_plan` column, so a foreign
 * or stale row must yield `null` (clean rebuild) rather than crash the app.
 * A v1 row is migrated in place (and the migrated v2 shape is written back
 * immediately, so the next Supabase push already carries v2).
 * @returns {WeeklyPlan|null}
 */
function _readValid() {
  const value = storage.get(STORAGE_KEY, null);
  if (!value || typeof value !== 'object') return null;

  if (value.version === 1) {
    if (!value.date || !value.slots || typeof value.slots !== 'object') return null;
    const migrated = _migrateV1(value);
    storage.set(STORAGE_KEY, migrated);
    return migrated;
  }

  if (value.version !== 2) return null;
  if (!value.days || typeof value.days !== 'object' || Array.isArray(value.days)) return null;
  return value;
}

function _persist() {
  storage.set(STORAGE_KEY, _plan);
}

function _notify() {
  for (const cb of _listeners) {
    try { cb(_plan); } catch { /* swallow */ }
  }
}

/**
 * Get the current weekly plan.
 * @returns {WeeklyPlan|null}
 */
export function getPlan() {
  return _plan;
}

/**
 * Replace the whole plan. Persists + notifies.
 * @param {WeeklyPlan} plan
 */
export function setPlan(plan) {
  _plan = plan;
  _persist();
  _notify();
}

/**
 * Subscribe to plan changes. The callback is invoked immediately with the
 * current state (the screen needs initial hydration on mount, same as
 * subscribeLibrary), then on each change.
 * @param {(plan: WeeklyPlan|null) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribePlan(callback) {
  _listeners.add(callback);
  try { callback(_plan); } catch { /* swallow */ }
  return () => {
    _listeners.delete(callback);
  };
}

/**
 * Re-read the plan from storage and notify subscribers. Used by
 * src/api/profileSync.js after a remote pull hydrates localStorage with a
 * newer copy of the plan, so this in-memory module picks up the change.
 */
export function reloadPlan() {
  _plan = _readValid();
  _notify();
}

/**
 * Mark an id eaten for a given day. No-op if there's no plan/day, or if
 * already marked.
 * @param {string} dateKey
 * @param {number|string} id
 */
export function markEaten(dateKey, id) {
  const day = _plan?.days?.[dateKey];
  if (!day || day.eaten.includes(id)) return;
  _plan = { ..._plan, days: { ..._plan.days, [dateKey]: { ...day, eaten: [...day.eaten, id] } } };
  _persist();
  _notify();
}

/**
 * Unmark an id as eaten for a given day. No-op if there's no plan/day, or if
 * not marked.
 * @param {string} dateKey
 * @param {number|string} id
 */
export function unmarkEaten(dateKey, id) {
  const day = _plan?.days?.[dateKey];
  if (!day || !day.eaten.includes(id)) return;
  _plan = { ..._plan, days: { ..._plan.days, [dateKey]: { ...day, eaten: day.eaten.filter((e) => e !== id) } } };
  _persist();
  _notify();
}

/**
 * Toggle whether an id is pinned (locked in place) for a given day. Pinned
 * ids are excluded from that slot's/day's next shuffle or regenerate — see
 * `regenerateDay`/`shuffleSlot`/`regenerateWeek` in src/api/planBuilder.js.
 * No-op if there's no plan/day.
 * @param {string} dateKey
 * @param {number|string} id
 */
export function togglePinned(dateKey, id) {
  const day = _plan?.days?.[dateKey];
  if (!day) return;
  const pinned = day.pinned.includes(id)
    ? day.pinned.filter((p) => p !== id)
    : [...day.pinned, id];
  _plan = { ..._plan, days: { ..._plan.days, [dateKey]: { ...day, pinned } } };
  _persist();
  _notify();
}

/**
 * Remove an item from a day's slot by id — used by Undo (record the
 * returned index, then `insertIntoSlot` to restore). Also drops the id from
 * that day's `pinned` list, if present — a removed card can't stay locked to
 * a position it no longer occupies.
 * @param {string} dateKey
 * @param {string} slotKey
 * @param {number|string} id
 * @returns {number} the removed item's index within the slot, or -1 if not found.
 */
export function removeFromSlot(dateKey, slotKey, id) {
  const day = _plan?.days?.[dateKey];
  if (!day || !day.slots[slotKey]) return -1;
  const items = day.slots[slotKey];
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return -1;
  const nextItems = items.slice();
  nextItems.splice(index, 1);
  const nextPinned = day.pinned.includes(id) ? day.pinned.filter((p) => p !== id) : day.pinned;
  _plan = {
    ..._plan,
    days: {
      ..._plan.days,
      [dateKey]: { ...day, slots: { ...day.slots, [slotKey]: nextItems }, pinned: nextPinned },
    },
  };
  _persist();
  _notify();
  return index;
}

/**
 * Insert an item at a specific index within a day's slot — used by Undo to
 * restore a removed card. Dedupes by id within the slot. Restoring a card
 * never re-pins it (pin state is intentionally lost on remove).
 * @param {string} dateKey
 * @param {string} slotKey
 * @param {PlanItem} item
 * @param {number} index
 */
export function insertIntoSlot(dateKey, slotKey, item, index) {
  const day = _plan?.days?.[dateKey];
  if (!day || !item || item.id == null) return;
  const items = day.slots[slotKey] || [];
  if (items.some((i) => i.id === item.id)) return;
  const nextItems = items.slice();
  nextItems.splice(index, 0, item);
  _plan = {
    ..._plan,
    days: { ..._plan.days, [dateKey]: { ...day, slots: { ...day.slots, [slotKey]: nextItems } } },
  };
  _persist();
  _notify();
}

/**
 * Add an item to a day's slot.
 * @param {string} dateKey
 * @param {string} slotKey
 * @param {PlanItem} item
 * @returns {boolean} true if added, false if there's no such day, or an item
 *   with this id already exists in ANY slot that day (cross-slot dedupe).
 */
export function addToSlot(dateKey, slotKey, item) {
  const day = _plan?.days?.[dateKey];
  if (!day || !item || item.id == null) return false;
  const existsAnywhere = Object.values(day.slots).some((items) => items.some((i) => i.id === item.id));
  if (existsAnywhere) return false;
  const items = day.slots[slotKey] || [];
  _plan = {
    ..._plan,
    days: { ..._plan.days, [dateKey]: { ...day, slots: { ...day.slots, [slotKey]: [...items, item] } } },
  };
  _persist();
  _notify();
  return true;
}

/**
 * Read the legacy `'queue'` key (pre-slot-based-plan) and map its items into
 * PlanItem shape, for one-time migration into a freshly built plan. Does NOT
 * delete the `'queue'` key — src/state/queue.js stays in place as dead code.
 * @returns {PlanItem[]}
 */
export function consumeLegacyQueue() {
  const queue = storage.get('queue', []);
  if (!Array.isArray(queue)) return [];
  return queue.map((item) => ({
    id: item.id,
    name: item.name,
    image: item.image,
    group: item.group,
    fineGroup: item.fineGroup || '',
    tier: item.tier,
    numericId: null,
    kind: 'food',
  }));
}
