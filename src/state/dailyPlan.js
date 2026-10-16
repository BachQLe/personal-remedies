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
 * "missing trailing day" in the rolling window. Old persisted plans may still
 * carry `pinned`/`offsets`/`generation` (pre-Oct-2026); nothing reads them.
 *
 * API:
 *   getPlan()                                → WeeklyPlan|null
 *   setPlan(plan)                            → void (replace whole plan; persist + notify)
 *   subscribePlan(cb)                        → unsubscribe function
 *   reloadPlan()                             → void (re-read from storage; profileSync pull path)
 *   markEaten(dateKey, id) / unmarkEaten(dateKey, id) → void
 *   removeFromSlot(dateKey, slotKey, id)     → number (removed index, or -1)
 *   insertIntoSlot(dateKey, slotKey, item, index) → void (Undo restore)
 *   addToSlot(dateKey, slotKey, item)        → boolean (false if id already in ANY slot that day)
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
 * @property {string} [sourceUrl] - Recipe-kind items only: link to the
 *   original recipe (MedlinePlus, etc.), from the C1 content overlay.
 *   Carried through by `toPlanItem` (src/api/planBuilder.js) ONLY when the
 *   source candidate has one — absent (not `undefined`-valued) on plain
 *   foods and on recipes with no overlay match, so old persisted plans
 *   round-trip unchanged. Feeds `RecipeLinkSheet`'s hand-off button via
 *   `resolveRecipePreview` (src/utils/foodDetailCard.js).
 * @property {string} [attribution] - Recipe-kind items only: source
 *   attribution string from the C1 overlay, e.g. "MedlinePlus". Same
 *   present-only-when-real carry-through as `sourceUrl`.
 * @property {{calories:number, protein?:number, carbs?:number, fat?:number}} [nutritionPerServing] -
 *   Recipe-kind items only: per-serving macros transcribed from the C1
 *   overlay's source Nutrition Facts panel — never computed/estimated (see
 *   `types.js`'s `Recipe.nutritionPerServing` for the full provenance
 *   note). Same present-only-when-real carry-through as `sourceUrl`.
 *   `resolveRecipePreview` reads `nutritionPerServing.calories` directly
 *   and never falls back to `resolveNutrition`/`estimateNutrition` for a
 *   recipe — fabricating a recipe calorie number is forbidden.
 */

/**
 * @typedef {Object} PlanDayState
 * @property {Object<string, PlanItem[]>} slots - slotKey → items
 * @property {Array<number|string>} eaten - ids marked eaten this day
 */

/**
 * @typedef {Object} WeeklyPlan
 * @property {2} version
 * @property {string} conditionsKey - CSV of condition ids the plan was built
 *   for (requested).
 * @property {string[]} conditionNames
 * @property {Object<string, PlanDayState>} days - LOCAL 'YYYY-MM-DD' date key
 *   (produced via `toLocaleDateString('en-CA')` — NEVER `toISOString`) →
 *   PlanDayState. A rolling 7-day window: see `ensurePlanForWeek` in
 *   src/api/planBuilder.js for how days enter/leave this map.
 * @property {Object<string, PlanItem[]>} [picksBySlot] - slotKey → the favorites
 *   that fit that slot (`favoritesBySlot`, src/api/planBuilder.js). Every day's
 *   slots are drawn from here, and `ensurePlanForWeek` fills the trailing day
 *   from it as the window rolls — never from the suggestion pools. Absent on
 *   plans persisted before this field existed; those never get trailing days
 *   filled.
 */

const STORAGE_KEY = 'dailyPlan';

/** @type {WeeklyPlan|null} */
let _plan = _readValid();

/** @type {Set<(plan: WeeklyPlan|null) => void>} */
const _listeners = new Set();

/**
 * Migrate a v1 single-day `DailyPlan` into the v2 `WeeklyPlan` shape: its
 * slots/eaten become the entry for its own `date`. The remaining 6 days of the
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
    days: {
      [v1.date]: {
        slots: v1.slots,
        eaten: Array.isArray(v1.eaten) ? v1.eaten : [],
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
 * Remove an item from a day's slot by id — used by Undo (record the
 * returned index, then `insertIntoSlot` to restore).
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
  _plan = {
    ..._plan,
    days: { ..._plan.days, [dateKey]: { ...day, slots: { ...day.slots, [slotKey]: nextItems } } },
  };
  _persist();
  _notify();
  return index;
}

/**
 * Insert an item at a specific index within a day's slot — used by Undo to
 * restore a removed card. Dedupes by id within the slot.
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
