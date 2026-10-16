/**
 * planBuilder.js — builds and maintains the persisted weekly Meal Plan
 * (/app/plan, `WeeklyPlan` in src/state/dailyPlan.js) and the user's saved
 * days / saved weeks.
 *
 * A plan comes from exactly one place: `generateWeekFromFavorites` (random
 * picks from the user's favorites, "My Favorites"), or a saved week loaded
 * back by `loadSavedPlan`. Nothing here fills a plan from the Nutridigm
 * suggestion pools; `getCandidatesForSlot` (read-only, for the suggestions
 * sheet) is the only remaining pool consumer.
 *
 * `purgeDerivedDataForConditionsChange` / `purgeMealPlanForProfileChange` are
 * synchronous and network-free — called from `profileSync.js`'s profile write
 * hook so a conditions change discards the plan the instant it's saved
 * (storage-map.md §5). Favorites / saved days / saved weeks are NOT wiped
 * there; `favoritesPrune.js` removes only newly low-ranked recipes from them.
 */

import { getMealPlanSuggestions, getConditionNames, guessMealType } from './adapter.js';
import {
  PLAN_SLOTS,
  PLAN_SLOT_KEYS,
  MEAL_SLOT_MAP,
  MAX_SAVED_PLANS,
  MAX_SAVED_DAYS,
  SAVED_PLANS_KEY,
  SAVED_DAYS_KEY,
} from './config.js';
import { getPlan, setPlan } from '../state/dailyPlan.js';
import { nextSevenDays } from '../screens/plan/planDates.js';
import { clearSchedule, getSchedule } from '../state/schedule.js';
import { storage } from './storage.js';
import { loadRecipeOverlay } from './recipeIngestion.js';
import { getSaveBlockReason } from '../utils/saveGate.js';
import { isFavoritesPrunePending } from './favoritesPrune.js';

/**
 * Session memo of the last-loaded candidate pools, keyed by conditions CSV —
 * mirrors recommendations.js's `_cachedSlots`/`_loading` pattern.
 * `getMealPlanSuggestions` is already cached 8h under it (cachedSuggest), so
 * this memo just skips the redundant awaits/console churn within a session;
 * the in-flight promise dedupes concurrent callers (e.g. mount + a user
 * action racing).
 * @type {{ key: string, data: Awaited<ReturnType<typeof getMealPlanSuggestions>> }|null}
 */
let _candidatesMemo = null;
/** @type {Promise<Awaited<ReturnType<typeof getMealPlanSuggestions>>>|null} */
let _loading = null;

/**
 * Load (or reuse) the candidate pools for a profile's conditions — used only
 * by `getCandidatesForSlot`.
 * @param {import('./types.js').Profile} profile
 * @returns {Promise<Awaited<ReturnType<typeof getMealPlanSuggestions>>>}
 */
async function loadCandidates(profile) {
  // Memo key is the PROFILE's requested conditions CSV.
  const csv = (profile?.conditions || []).join(',');
  if (_candidatesMemo && _candidatesMemo.key === csv) return _candidatesMemo.data;
  if (_loading) return _loading;

  _loading = (async () => {
    try {
      const data = await getMealPlanSuggestions(profile);
      _candidatesMemo = { key: csv, data };
      return data;
    } finally {
      _loading = null;
    }
  })();

  return _loading;
}

/**
 * Get the cached candidate pool for ONE Plan slot (via `loadCandidates`'
 * session memo, so this triggers zero extra network calls beyond whatever
 * this profile's conditions already fetched this session/8h-cache window).
 *
 * Used by SuggestionsSheet's empty-slot / no-scope fallback (Task 13): when
 * a Plan slot has nothing in it yet, or nothing in it resolves to a
 * same-group substitute scope (e.g. every current item is a recipe outside
 * the C1 overlay dataset), `getSlotSubstitutes` has nothing to scope a
 * same-group search by — this gives the sheet the slot's full candidate
 * list to offer instead.
 * @param {import('./types.js').Profile} profile
 * @param {string} slotKey - one of PLAN_SLOT_KEYS
 * @returns {Promise<import('./types.js').PlanCandidate[]>}
 */
export async function getCandidatesForSlot(profile, slotKey) {
  const { candidates } = await loadCandidates(profile);
  return candidates[slotKey] || [];
}

/**
 * Heuristic to bucket a food/recipe item into a Plan slot key — used by
 * Cookbook "add to plan" and `mealTypeForItem`. Mirrors
 * adapter.js's `buildMealPlanRaw` bucketing: fine-group overrides
 * (`MEAL_SLOT_MAP`) win first, then coarse group, defaulting to lunch.
 *
 * `MEAL_SLOT_MAP` maps fine group 'h2' to 'Beverages' and 'h1' to 'Snack'
 * (config.js); both short-circuit here before the coarse-group switch runs.
 * The 'beverages' plan slot was removed July 2026 and restored August 2026
 * (both user-approved) — the short-circuit below routes fine group 'h2'
 * items there again instead of letting them fall through to the
 * group-based switch (which has no 'h' case and would otherwise default
 * them to 'lunch').
 * @param {{ fineGroup?: string, group?: string }} item
 * @returns {string} one of PLAN_SLOT_KEYS
 */
export function inferSlotKey(item) {
  const byFine = MEAL_SLOT_MAP[item?.fineGroup];
  if (byFine === 'Snack') return 'snacks';
  if (byFine === 'Beverages') return 'beverages';

  switch (item?.group) {
    case 'f':
      return 'breakfast';
    case 'c':
    case 'd':
      return 'lunch';
    case 'b':
    case 'e':
    case 'g':
    case 'i':
      return 'dinner';
    default:
      return 'lunch';
  }
}

/**
 * Strip a PlanCandidate (or library item) down to the persisted
 * PlanItem fields before it goes into a slot — keeps the Supabase
 * `daily_plan` row small and matches dailyPlan.js's `PlanItem` typedef
 * exactly. Drops anything else (e.g. stray fields from older shapes).
 *
 * Ten fields are copied unconditionally (as possibly-undefined, same as the
 * candidate carried them): `id`, `name`, `image`, `group`, `fineGroup`,
 * `tier`, `numericId`, `kind`, `sourceName`, `substituteFineGroup`.
 *
 * `substituteFineGroup` (additive, Substitutions feature): carried through
 * unchanged when present on a recipe candidate (see `recipeToPlanCandidate`
 * in adapter.js) so `getSlotSubstitutes` can scope a persisted recipe's
 * substitutes correctly later — `undefined` on food candidates and on any
 * candidate built before this field existed, same as every other optional
 * field here.
 *
 * `sourceUrl`/`attribution`/`nutritionPerServing` (additive, in-app recipe
 * preview sheet — RecipeLinkSheet.jsx/foodDetailCard.js's
 * `resolveRecipePreview`): UNLIKE the ten fields above, these three are
 * only ever set on the output when the candidate actually has them —
 * omitted (not merely `undefined`-valued) otherwise, so a plain food's
 * persisted PlanItem — and any plan saved before this task — stays exactly
 * as lean as before. `sourceUrl` is carried through, never dropped: it's
 * what lets the preview sheet's hand-off button work for a recipe pulled
 * back out of a saved plan, not just one freshly loaded from candidates.
 * @param {Object} candidate
 * @returns {import('../state/dailyPlan.js').PlanItem}
 */
export function toPlanItem(candidate) {
  return {
    id: candidate.id,
    name: candidate.name,
    image: candidate.image,
    group: candidate.group,
    fineGroup: candidate.fineGroup,
    tier: candidate.tier,
    numericId: candidate.numericId,
    kind: candidate.kind,
    sourceName: candidate.sourceName,
    substituteFineGroup: candidate.substituteFineGroup,
    ...(candidate.sourceUrl !== undefined && { sourceUrl: candidate.sourceUrl }),
    ...(candidate.attribution !== undefined && { attribution: candidate.attribution }),
    ...(candidate.nutritionPerServing !== undefined && {
      nutritionPerServing: candidate.nutritionPerServing,
    }),
  };
}

/**
 * Bucket favorites by the plan slots they fit, keeping only saveable recipes
 * (`getSaveBlockReason(item) === null`) and each id at most once per slot. A
 * recipe lands in EVERY slot it fits: the content overlay's `mealType` +
 * `alsoFits` when its id resolves there, else `guessMealType(name)`. Snack and
 * dessert both fit `snacks`; beverage fits `beverages` (`PLAN_SLOTS`'
 * `recipeMealType`). Pure; also what the favorites-count nudge counts.
 * @param {Array<Object>} favorites - library items (`recipeToSaveItem` shape)
 * @returns {Object<string, Array<Object>>} slotKey → favorites (all 5 keys)
 */
export function favoritesBySlot(favorites) {
  const overlay = new Map(loadRecipeOverlay().map((row) => [String(row.foodItemID), row]));
  const buckets = Object.fromEntries(PLAN_SLOT_KEYS.map((key) => [key, []]));
  for (const item of favorites || []) {
    if (getSaveBlockReason(item) !== null) continue;
    const row = overlay.get(String(item.id));
    const mealTypes = row ? [row.mealType, ...(row.alsoFits ?? [])] : [guessMealType(item.name)];
    for (const slot of PLAN_SLOTS) {
      const bucket = buckets[slot.key];
      if (bucket.some((i) => i.id === item.id)) continue;
      if ([slot.recipeMealType].flat().some((type) => mealTypes.includes(type))) bucket.push(item);
    }
  }
  return buckets;
}

/** Up to `n` distinct random items from `pool` (partial Fisher-Yates over a copy). */
function sample(pool, n, rng) {
  const rest = pool.slice();
  const out = [];
  while (out.length < n && rest.length) out.push(rest.splice(Math.floor(rng() * rest.length), 1)[0]);
  return out;
}

/**
 * One day's slots from `picksBySlot`: up to `slot.size` distinct random picks
 * per slot, never padded from anywhere else, and no recipe in two slots of
 * the same day. Slots go smallest bucket first so a recipe that fits two slots
 * (e.g. breakfast + beverage) can't starve the scarcer one.
 * @param {Object<string, import('../state/dailyPlan.js').PlanItem[]>} picksBySlot
 * @param {() => number} rng
 * @returns {Object<string, import('../state/dailyPlan.js').PlanItem[]>}
 */
function pickDay(picksBySlot, rng) {
  const used = new Set();
  const slots = {};
  const bySize = [...PLAN_SLOTS].sort(
    (a, b) => (picksBySlot[a.key]?.length ?? 0) - (picksBySlot[b.key]?.length ?? 0)
  );
  for (const { key, size } of bySize) {
    const pool = (picksBySlot[key] ?? []).filter((item) => !used.has(item.id));
    slots[key] = sample(pool, size, rng);
    for (const item of slots[key]) used.add(item.id);
  }
  return slots;
}

/**
 * Build a brand-new 7-day plan (the rolling `nextSevenDays()` window) by
 * randomizing from the user's favorites — the ONE generation path. Each
 * day/slot gets up to `RECIPES_PER_MEAL` distinct favorites that fit that
 * slot (`favoritesBySlot`); repeats across days are allowed; a short or empty
 * bucket gives a short or empty slot. The buckets are stored as the plan's
 * `picksBySlot` so `ensurePlanForWeek` keeps filling the trailing day as the
 * window rolls. Replaces the live plan and clears the active-saved-plan
 * pointer (a new week is not an edit of whatever was loaded before).
 *
 * Refuses (touching nothing) with `reason`:
 * - 'prune-pending' — a profile change is waiting on `applyFavoritesPrune`
 * - 'no-favorites'  — no saveable favorite fits any slot
 * @param {import('./types.js').Profile} profile
 * @param {Array<Object>} favorites - library items (`getLibrary()`)
 * @param {{ rng?: () => number }} [opts] - injectable for deterministic tests
 * @returns {Promise<{ ok: true, plan: import('../state/dailyPlan.js').WeeklyPlan } | { ok: false, reason: 'prune-pending'|'no-favorites' }>}
 */
export async function generateWeekFromFavorites(profile, favorites, { rng = Math.random } = {}) {
  if (isFavoritesPrunePending()) return { ok: false, reason: 'prune-pending' };
  const buckets = favoritesBySlot(favorites);
  if (PLAN_SLOT_KEYS.every((key) => buckets[key].length === 0)) return { ok: false, reason: 'no-favorites' };

  const conditions = profile?.conditions || [];
  const conditionNames = await getConditionNames(conditions);
  const picksBySlot = Object.fromEntries(PLAN_SLOT_KEYS.map((key) => [key, buckets[key].map(toPlanItem)]));
  const days = Object.fromEntries(
    nextSevenDays().map(({ key }) => [key, { slots: pickDay(picksBySlot, rng), eaten: [] }])
  );

  const plan = { version: 2, conditionsKey: conditions.join(','), conditionNames, days, picksBySlot };
  setPlan(plan);
  clearActiveSavedPlan();
  return { ok: true, plan };
}

/**
 * Keep the stored plan's rolling 7-day window full. Idempotent — safe to call
 * on every mount, and network-free.
 *
 * - No plan yet → `{ plan: null }`, nothing written (the caller shows its
 *   empty state / "generate" CTA).
 * - The profile's conditions no longer match the plan's `conditionsKey` → the
 *   plan is DISCARDED and `{ plan: null }` returned, same shape as no plan.
 *   Never rebuilt: re-generating from favorites is the honest reset. (See
 *   `purgeDerivedDataForConditionsChange`, which does this eagerly on save.)
 * - Otherwise days still inside `nextSevenDays()` carry over untouched, days
 *   that rolled out are dropped, and each missing trailing day is filled from
 *   the plan's own `picksBySlot` (`pickDay`: same rules as generation). A plan
 *   with no `picksBySlot` (built before it existed) is returned as-is.
 * @param {import('./types.js').Profile} profile
 * @param {{ rng?: () => number }} [opts]
 * @returns {Promise<{ plan: import('../state/dailyPlan.js').WeeklyPlan|null }>}
 */
export async function ensurePlanForWeek(profile, { rng = Math.random } = {}) {
  const existing = getPlan();
  if (!existing) return { plan: null };

  if (existing.conditionsKey !== (profile?.conditions || []).join(',')) {
    setPlan(null);
    clearActiveSavedPlan();
    return { plan: null };
  }

  const dayKeys = nextSevenDays().map((d) => d.key);
  const missingKeys = dayKeys.filter((key) => !existing.days[key]);
  if (!existing.picksBySlot || missingKeys.length === 0) return { plan: existing };

  const days = Object.fromEntries(dayKeys.filter((key) => existing.days[key]).map((key) => [key, existing.days[key]]));
  for (const key of missingKeys) days[key] = { slots: pickDay(existing.picksBySlot, rng), eaten: [] };

  const plan = { ...existing, days };
  setPlan(plan);
  return { plan };
}

/**
 * Discard the stored plan the instant a profile's conditions change, rather
 * than waiting for `ensurePlanForWeek`'s next call — which only happens on
 * `MealQueueScreen`'s mount effect (storage-map.md §6, gap 1). Intended to be
 * called from the profile write path (see `profileSync.js`'s
 * `storage.onWrite('profile', ...)` hook, which fires on EVERY write to the
 * `profile` key from ANY call site — `saveProfile`/`clearProfile` in api.js
 * today, anything else tomorrow — not just a Profile-screen edit) so a
 * conditions change purges the plan no matter which screen made it, and a
 * mismatched `{ conditions: NEW, daily_plan: <built for OLD> }` pair never
 * even transiently exists to be pushed to Supabase.
 *
 * Deliberately synchronous: it compares the RAW `newConditions` (joined in
 * the same order `ensurePlanForWeek` uses to derive `conditionsKey`) against
 * the existing plan's `conditionsKey`, with no lookups that could race the
 * caller's own write.
 *
 * No-op (returns false, writes nothing) if there's no plan to purge, or the
 * conditions didn't actually change.
 *
 * @param {number[]|null|undefined} newConditions - the profile's new
 *   `conditions` array (as just saved — see `saveProfile` in api.js).
 * @returns {boolean} true if a plan was purged.
 */
export function purgeDerivedDataForConditionsChange(newConditions) {
  const existing = getPlan();
  if (!existing) return false;

  const newKey = (Array.isArray(newConditions) ? newConditions : [])
    .filter((c) => typeof c === 'number')
    .join(',');
  if (existing.conditionsKey === newKey) return false;

  setPlan(null);
  clearActiveSavedPlan();
  return true;
}

/**
 * Wipe all meal-plan selections the instant the health profile changes in a
 * way that changes guidance (conditions, allergies, medications, dietary
 * pattern, religious restriction — see `guidanceFingerprint` in
 * profileSync.js). Clears: the live plan (which carries `picksBySlot`, so
 * picks go with it), the active-saved-plan pointer, and the `schedule`
 * store. Deliberately KEEPS the `library`, `savedDays` and `savedPlans`:
 * those are user-authored collections, pruned of newly low-ranked recipes
 * later by `favoritesPrune.js` (profileSync marks that pending alongside this
 * call). Synchronous and network-free, same as
 * `purgeDerivedDataForConditionsChange`.
 * @returns {boolean} true if anything was cleared.
 */
export function purgeMealPlanForProfileChange() {
  const hadPlan = !!getPlan();
  const hadSchedule = Object.keys(getSchedule().days).length > 0;
  setPlan(null);
  clearActiveSavedPlan();
  clearSchedule();
  return hadPlan || hadSchedule;
}

// ── Saved plans (Task 8) ─────────────────────────────────────────────────────
//
// A user-named snapshot of the CURRENTLY ACTIVE WeeklyPlan, separate from
// saving an individual recipe (SaveButton/library.js). Persisted via
// storage.js's namespaced persistence wrapper (never a second storage
// mechanism) under its own key, as an array capped at MAX_SAVED_PLANS
// (config.js). Capping policy: BLOCK a new save at the cap with a clear
// `{ ok: false, reason: 'at-cap' }` result for the caller to surface as a
// message — never silently evict the oldest save (that would delete a named
// snapshot the user asked to keep without telling them) and never fabricate
// extra capacity.

// Saved WEEKS live under SAVED_PLANS_KEY, saved DAYS under SAVED_DAYS_KEY
// (both config.js). Same block-at-cap policy for both.

/** Unique-enough id for a saved entry. */
const entryId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * storage.js key for the "active saved plan" pointer (Task C/#16) — tracks
 * which saved entry (if any) the LIVE plan currently traces back to, and a
 * fingerprint of its content at that moment, so the Plan screen can detect
 * drift (edits made since) and offer "Save"/"Save as new" instead of only
 * ever creating a new entry.
 */
const ACTIVE_SAVED_PLAN_KEY = 'activeSavedPlan';

/**
 * @typedef {Object} SavedPlanEntry
 * @property {string} id
 * @property {string} name
 * @property {string} savedAt - ISO timestamp
 * @property {import('../state/dailyPlan.js').WeeklyPlan} plan - a snapshot,
 *   independent from this point on: loading it back (`loadSavedPlan`) copies
 *   it into the live `dailyPlan` store, and subsequent edits to either the
 *   live plan or this saved copy never affect the other.
 */

/**
 * @typedef {Object} ActiveSavedPlan
 * @property {string} id - the `SavedPlanEntry.id` the live plan traces back to.
 * @property {string} fingerprint - `planFingerprint()` of the plan at the
 *   moment it was saved/updated/loaded (see `planFingerprint` below).
 */

/**
 * List saved plans, oldest-saved first (insertion order). Never trims —
 * trimming to the cap only ever happens in `saveCurrentPlan`.
 * @returns {SavedPlanEntry[]}
 */
export function getSavedPlans() {
  const saved = storage.get(SAVED_PLANS_KEY, []);
  return Array.isArray(saved) ? saved : [];
}

/**
 * Restore a previously-deleted saved-plan ENTRY verbatim (id, name, savedAt,
 * plan all preserved) — the Plan screen's Undo action after `deleteSavedPlan`
 * (Task A/#14). Appended at the end, same as any other save; never subject
 * to `MAX_SAVED_PLANS` — undoing a delete hands back what the user already
 * had, it isn't a new save. No-op if an entry with this id already exists
 * (defensive against a double-invoked Undo).
 * @param {SavedPlanEntry} entry
 */
export function restoreSavedPlan(entry) {
  if (!entry || typeof entry.id !== 'string') return;
  const saved = getSavedPlans();
  if (saved.some((p) => p.id === entry.id)) return;
  storage.set(SAVED_PLANS_KEY, [...saved, entry]);
}

/**
 * The saved entry (if any) the LIVE plan currently traces back to — Task C
 * (#16). `null` when the live plan has never been saved/loaded, or was
 * cleared by a purge/new-plan event (see `clearActiveSavedPlan`'s call
 * sites: `generateWeekFromFavorites`, the conditions-change discard paths in
 * `ensurePlanForWeek`/`purgeDerivedDataForConditionsChange`, and deleting
 * this exact entry via `deleteSavedPlan`).
 * @returns {ActiveSavedPlan|null}
 */
export function getActiveSavedPlan() {
  const active = storage.get(ACTIVE_SAVED_PLAN_KEY, null);
  return active && typeof active === 'object' && typeof active.id === 'string' ? active : null;
}

/** Point the active-saved-plan pointer at `id`, fingerprinting `plan` now. */
function setActiveSavedPlan(id, plan) {
  storage.set(ACTIVE_SAVED_PLAN_KEY, { id, fingerprint: planFingerprint(plan) });
}

/**
 * Clear the active-saved-plan pointer — see `getActiveSavedPlan`'s doc for
 * every call site. No-op (safe to call unconditionally) if already clear.
 */
export function clearActiveSavedPlan() {
  storage.remove(ACTIVE_SAVED_PLAN_KEY);
}

/**
 * Restore a previously-captured active-saved-plan pointer verbatim — the
 * Plan screen's Undo action after `loadSavedPlan` replaced an unsaved plan
 * (Task A/#14): the caller captures `getActiveSavedPlan()` BEFORE the load,
 * and on Undo hands it back here — paired with restoring the plan itself via
 * `dailyPlan.js`'s `setPlan` — so the pointer and the live plan stay in
 * sync. `null` (or anything else not shaped like an `ActiveSavedPlan`)
 * clears it, same as `clearActiveSavedPlan`.
 * @param {ActiveSavedPlan|null} pointer
 */
export function restoreActiveSavedPlan(pointer) {
  if (pointer && typeof pointer === 'object' && typeof pointer.id === 'string') {
    storage.set(ACTIVE_SAVED_PLAN_KEY, pointer);
  } else {
    clearActiveSavedPlan();
  }
}

/**
 * Stable fingerprint of a plan's user-editable CONTENT — Task C (#16). Two
 * plans that hold the exact same picks/slot-items fingerprint
 * identically even if they were built on different calendar weeks, so
 * loading a snapshot back (which re-keys its days onto the current window —
 * see `refitPlanToWindow`) never reads as "dirty" against itself. Concretely:
 *   - Days are walked in SORTED (chronological) key order and identified by
 *     POSITION in that order, not by their real date key — shifting the
 *     7-day window (a new day rolling in, `handleChangeWeekStartDay`, a
 *     `refitPlanToWindow` reload) never changes the fingerprint on its own.
 *   - Per day: each slot's item ids IN ORDER (position within the slot is
 *     meaningful content — a reorder is a real edit). A constant `pinned: []`
 *     is still emitted (pins were removed Oct 2026, any stored `pinned` is
 *     ignored) so the string stays identical to what pre-removal pointers
 *     fingerprinted for a plan without pins.
 *   - `eaten` is deliberately excluded — marking something eaten isn't an
 *     edit to the PLAN, and would otherwise mark every saved plan dirty the
 *     moment its Today gets checked off.
 *   - `picksBySlot` (present on every plan built since Aug 2026) is
 *     fingerprinted by id list per slot — this is the user's actual
 *     "what did I choose" state, independent of which day currently shows it.
 * @param {import('../state/dailyPlan.js').WeeklyPlan|null} plan
 * @returns {string}
 */
export function planFingerprint(plan) {
  if (!plan) return '';

  const dayKeys = Object.keys(plan.days || {}).sort();
  const days = dayKeys.map((key) => {
    const day = plan.days[key] || {};
    const slots = {};
    for (const slotKey of PLAN_SLOT_KEYS) {
      slots[slotKey] = (day.slots?.[slotKey] || []).map((item) => item.id);
    }
    return { slots, pinned: [] };
  });

  const picksBySlot = plan.picksBySlot
    ? Object.fromEntries(
        PLAN_SLOT_KEYS.map((slotKey) => [slotKey, (plan.picksBySlot[slotKey] || []).map((item) => item.id)])
      )
    : null;

  return JSON.stringify({ picksBySlot, days });
}

/**
 * Save a snapshot of the currently active plan (`getPlan()`) under a name.
 * Marks the new entry as the ACTIVE saved plan (Task C/#16).
 * @param {string} [name] - trimmed; falls back to `Plan N` when blank.
 * @returns {{ ok: true, entry: SavedPlanEntry } | { ok: false, reason: 'no-plan'|'at-cap' }}
 */
export function saveCurrentPlan(name) {
  const plan = getPlan();
  if (!plan) return { ok: false, reason: 'no-plan' };

  const saved = getSavedPlans();
  if (saved.length >= MAX_SAVED_PLANS) return { ok: false, reason: 'at-cap' };

  const entry = {
    id: entryId(),
    name: (name || '').trim() || `Plan ${saved.length + 1}`,
    savedAt: new Date().toISOString(),
    plan,
  };
  storage.set(SAVED_PLANS_KEY, [...saved, entry]);
  setActiveSavedPlan(entry.id, plan);
  return { ok: true, entry };
}

/**
 * Overwrite an EXISTING saved-plan entry's `plan` snapshot + `savedAt` in
 * place — Task A (#14)/B (#15)'s "Save"/"Update" action on a plan that's
 * already been saved once. UNLIKE `saveCurrentPlan`, this never touches
 * `MAX_SAVED_PLANS` — it replaces an entry already counted against the cap
 * rather than appending a new one, so it's never blocked by it. Marks the
 * entry as the ACTIVE saved plan (Task C/#16), same as a fresh save.
 * @param {string} id
 * @returns {{ ok: true, entry: SavedPlanEntry } | { ok: false, reason: 'no-plan'|'not-found' }}
 */
export function updateSavedPlan(id) {
  const plan = getPlan();
  if (!plan) return { ok: false, reason: 'no-plan' };

  const saved = getSavedPlans();
  const index = saved.findIndex((p) => p.id === id);
  if (index === -1) return { ok: false, reason: 'not-found' };

  const entry = { ...saved[index], plan, savedAt: new Date().toISOString() };
  const next = saved.slice();
  next[index] = entry;
  storage.set(SAVED_PLANS_KEY, next);
  setActiveSavedPlan(entry.id, plan);
  return { ok: true, entry };
}

/**
 * Refit a saved snapshot's days onto the CURRENT rolling 7-day window
 * (`nextSevenDays()`) by day POSITION, not by matching the snapshot's
 * original date keys — Task A (#14). A saved snapshot's day keys are real
 * calendar dates as of when it was saved; loading it back later (or after a
 * `handleChangeWeekStartDay` change) would otherwise land every one of its
 * days OUTSIDE the live window and render as an empty week until the next
 * remount happened to re-derive `nextSevenDays()`. Each of the snapshot's
 * day keys, walked in sorted (chronological) order, is remapped onto the
 * live window's keys at the same index — everything on that day's state
 * (slots, `eaten`) carries over untouched. A
 * snapshot with fewer than 7 days simply leaves the window's remaining
 * trailing day(s) unset — the same "missing day" shape `ensurePlanForWeek`
 * already knows how to fill on its next call.
 * @param {import('../state/dailyPlan.js').WeeklyPlan} plan
 * @returns {import('../state/dailyPlan.js').WeeklyPlan}
 */
function refitPlanToWindow(plan) {
  const currentKeys = nextSevenDays().map((d) => d.key);
  const snapshotKeys = Object.keys(plan.days || {}).sort();
  const days = {};
  currentKeys.forEach((key, i) => {
    const sourceKey = snapshotKeys[i];
    if (sourceKey && plan.days[sourceKey]) {
      days[key] = plan.days[sourceKey];
    }
  });
  return { ...plan, days };
}

/**
 * Load a saved plan back into the live `dailyPlan` store, REPLACING whatever
 * plan is currently active — same whole-plan-overwrite contract every other
 * export here uses via `setPlan`. The saved entry is left in place; loading
 * is non-destructive to the saved list. The snapshot is refit onto the
 * current rolling window first (`refitPlanToWindow`) so it never silently
 * renders as an empty week. Marks this entry as the ACTIVE saved plan (Task
 * C/#16), fingerprinted from the REFITTED plan (position-based, so refitting
 * itself never reads as an edit).
 *
 * Returns false (loading nothing) both for an unknown id AND while a
 * condition-change prune is pending (`isFavoritesPrunePending()`): the UI
 * must resolve the prune first and check that flag itself to tell the two
 * apart.
 * @param {string} id
 * @returns {boolean} true if a matching saved plan was found and loaded.
 */
export function loadSavedPlan(id) {
  if (isFavoritesPrunePending()) return false;
  const entry = getSavedPlans().find((p) => p.id === id);
  if (!entry) return false;
  const refitted = refitPlanToWindow(entry.plan);
  setPlan(refitted);
  setActiveSavedPlan(entry.id, refitted);
  return true;
}

/**
 * Delete a saved plan by id. No-op (returns false) if not found. Clears the
 * active-saved-plan pointer (Task C/#16) if the deleted entry was the active
 * one — the live plan no longer traces back to anything once its saved copy
 * is gone.
 * @param {string} id
 * @returns {boolean}
 */
export function deleteSavedPlan(id) {
  const saved = getSavedPlans();
  const next = saved.filter((p) => p.id !== id);
  if (next.length === saved.length) return false;
  storage.set(SAVED_PLANS_KEY, next);
  if (getActiveSavedPlan()?.id === id) clearActiveSavedPlan();
  return true;
}

// ── Saved days ───────────────────────────────────────────────────────────────
//
// A named snapshot of ONE day's `slots` (Save Day / Load Day on the day page).
// Not tied to a date and no active-pointer: loading just copies the slots onto
// whichever day the user is looking at.

/**
 * @typedef {Object} SavedDayEntry
 * @property {string} id
 * @property {string} name
 * @property {string} savedAt - ISO timestamp
 * @property {Object<string, import('../state/dailyPlan.js').PlanItem[]>} slots
 */

/**
 * List saved days, oldest-saved first.
 * @returns {SavedDayEntry[]}
 */
export function getSavedDays() {
  const saved = storage.get(SAVED_DAYS_KEY, []);
  return Array.isArray(saved) ? saved : [];
}

/**
 * Save a snapshot of one live day's slots under a name. Blocks at
 * `MAX_SAVED_DAYS` (never evicts).
 * @param {string} dateKey - 'YYYY-MM-DD' key of a day in the live plan
 * @param {string} [name] - trimmed; falls back to `Day N` when blank.
 * @returns {{ ok: true, entry: SavedDayEntry } | { ok: false, reason: 'no-day'|'at-cap' }}
 */
export function saveDay(dateKey, name) {
  const day = getPlan()?.days?.[dateKey];
  if (!day) return { ok: false, reason: 'no-day' };

  const saved = getSavedDays();
  if (saved.length >= MAX_SAVED_DAYS) return { ok: false, reason: 'at-cap' };

  const entry = {
    id: entryId(),
    name: (name || '').trim() || `Day ${saved.length + 1}`,
    savedAt: new Date().toISOString(),
    slots: day.slots,
  };
  storage.set(SAVED_DAYS_KEY, [...saved, entry]);
  return { ok: true, entry };
}

/**
 * Delete a saved day by id. No-op (returns false) if not found.
 * @param {string} id
 * @returns {boolean}
 */
export function deleteSavedDay(id) {
  const saved = getSavedDays();
  const next = saved.filter((d) => d.id !== id);
  if (next.length === saved.length) return false;
  storage.set(SAVED_DAYS_KEY, next);
  return true;
}

/**
 * Put a previously-deleted saved day back verbatim (Undo). Appended; not
 * subject to the cap (it hands back what the user already had). No-op if the
 * id already exists.
 * @param {SavedDayEntry} entry
 */
export function restoreSavedDay(entry) {
  if (!entry || typeof entry.id !== 'string') return;
  const saved = getSavedDays();
  if (saved.some((d) => d.id === entry.id)) return;
  storage.set(SAVED_DAYS_KEY, [...saved, entry]);
}

/**
 * Replace a live day's slots with a saved day's slots and clear that day's
 * `eaten`. The saved entry is left in place and the live day gets its own
 * copy (storage hands back fresh objects), so later edits to either never
 * touch the other.
 * @param {string} id - saved day id
 * @param {string} dateKey - live day to overwrite
 * @returns {{ ok: true } | { ok: false, reason: 'prune-pending'|'not-found'|'no-day' }}
 */
export function loadSavedDay(id, dateKey) {
  if (isFavoritesPrunePending()) return { ok: false, reason: 'prune-pending' };
  const entry = getSavedDays().find((d) => d.id === id);
  if (!entry) return { ok: false, reason: 'not-found' };
  const plan = getPlan();
  const day = plan?.days?.[dateKey];
  if (!day) return { ok: false, reason: 'no-day' };
  setPlan({ ...plan, days: { ...plan.days, [dateKey]: { ...day, slots: entry.slots, eaten: [] } } });
  return { ok: true };
}
