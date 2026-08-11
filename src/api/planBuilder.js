/**
 * planBuilder.js — pure selection logic for the weekly Meal Plan (/app/plan).
 * Consumes `getMealPlanSuggestions` (network + 8h cache, see adapter.js) and
 * turns its candidate pools into a persisted `WeeklyPlan`
 * (src/state/dailyPlan.js) via `ensurePlanForWeek` / `regenerateDay` /
 * `regenerateWeek` / `shuffleSlot`. Zero network beyond the first
 * `getMealPlanSuggestions` call for a given condition set — everything else
 * here is in-memory bookkeeping over the memoized candidate pools.
 *
 * `purgeDerivedDataForConditionsChange` is the one synchronous, network-free
 * export in the mix — called from `profileSync.js`'s profile write hook so a
 * conditions change discards the plan the instant it's saved, not just the
 * next time `ensurePlanForWeek` happens to run (storage-map.md §6 gap 1).
 */

import { getMealPlanSuggestions } from './adapter.js';
import { PLAN_SLOTS, PLAN_SLOT_KEYS, MEAL_SLOT_MAP } from './config.js';
import { getPlan, setPlan, consumeLegacyQueue } from '../state/dailyPlan.js';
import { nextSevenDays } from '../screens/plan/planDates.js';
import { mealTypeForItem } from '../components/shared/mealTypeMeta.jsx';

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
 * Load (or reuse) the candidate pools for a profile's conditions. Single
 * internal entry point used by every export below — all condition-fallback
 * resolution and memoization live here so callers never talk to the adapter
 * directly.
 * @param {import('./types.js').Profile} profile
 * @returns {Promise<Awaited<ReturnType<typeof getMealPlanSuggestions>>>}
 */
async function loadCandidates(profile) {
  // Memo key is the PROFILE's conditions CSV (the request) rather than the
  // fallback-resolved one — the resolved csv is only knowable after the
  // fetch, and a given request resolves deterministically, so keying by
  // request is equivalent and lets a memo hit skip the await entirely.
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
 * Heuristic to bucket a food/recipe item into a Plan slot key — shared by
 * the legacy-queue migration (below) and Cookbook "add to plan". Mirrors
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
 * Strip a PlanCandidate (or legacy-queue item) down to the persisted
 * PlanItem fields before it goes into a slot — keeps the Supabase
 * `daily_plan` row small and matches dailyPlan.js's `PlanItem` typedef
 * exactly. Drops anything else (e.g. stray fields from older shapes).
 * @param {Object} candidate
 * @returns {import('../state/dailyPlan.js').PlanItem}
 */
function toPlanItem(candidate) {
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
  };
}

/**
 * Fill (or refill) a set of slots for ONE day, honoring pinned positions and
 * (optionally) week-wide variety spreading.
 *
 * For each slot in `slotsList`:
 * - Positions carried over from `existingItems[slot.key]` whose id is in
 *   `pinnedIds` are kept exactly as-is (locked in place); every other
 *   position is a "hole" to refill. With no `existingItems`, every position
 *   is a hole — this is how a brand-new day is built from scratch.
 * - Holes are filled by walking that slot's candidate pool circularly from
 *   `offsets[key] % len`, in TWO bounded passes (each ≤ `len` probes — an
 *   infinite-loop guard for small/duplicate-heavy pools):
 *     Pass 1 skips ids in `dayExcludeIds` (cross-slot dedupe within this
 *       day, mutated in place as slots fill — an id used in breakfast can't
 *       also land in lunch), `pinnedIds` (never double-place a pinned item),
 *       and — if `weekUsedIds` was supplied — ids already used for this slot
 *       on ANOTHER day this week (mutated in place by the caller across
 *       multiple `fillSlots` calls; this is the week-variety spread).
 *     Pass 2 only runs if pass 1 still left holes AND `weekUsedIds` was the
 *       reason (the pool is too small to give every day of the week a
 *       unique pick for this slot): it clears that slot's week-variety set
 *       and retries, allowing a repeat rather than leaving the hole empty.
 * - A pool too small even for pass 2 (fewer unique, non-pinned candidates
 *   than holes) leaves the remaining holes unfilled — dropped from the
 *   output array. This is the honestly-empty behavior: it never invents
 *   items, and a hole is never left as a gap in the middle of the array.
 *
 * @param {typeof PLAN_SLOTS} slotsList - which slots to (re)fill; pass the
 *   full `PLAN_SLOTS` for a whole-day fill, or a single-entry array (from
 *   `PLAN_SLOTS.find`) for `shuffleSlot`'s single-slot refill.
 * @param {Record<string, import('./types.js').PlanCandidate[]>} candidates
 * @param {Object<string, number>} offsets - slotKey → cursor
 * @param {Object} [opts]
 * @param {Set<number|string>} [opts.dayExcludeIds] - mutated in place
 * @param {Set<number|string>} [opts.pinnedIds] - every id pinned ANYWHERE in
 *   this day (not just this slot) — never re-picked into a hole.
 * @param {Object<string, import('../state/dailyPlan.js').PlanItem[]>} [opts.existingItems]
 * @param {Map<string, Set<number|string>>} [opts.weekUsedIds] - slotKey → ids
 *   used for that slot elsewhere this week; mutated in place across the
 *   caller's multiple `fillSlots` calls (one per day). Omitted for
 *   single-day operations (shuffleSlot/regenerateDay), which don't spread
 *   variety across days.
 * @returns {Object<string, import('../state/dailyPlan.js').PlanItem[]>}
 */
function fillSlots(slotsList, candidates, offsets, opts = {}) {
  const { dayExcludeIds = new Set(), pinnedIds = new Set(), existingItems = null, weekUsedIds = null } = opts;
  /** @type {Object<string, import('../state/dailyPlan.js').PlanItem[]>} */
  const slots = {};

  for (const slot of slotsList) {
    const pool = candidates[slot.key] || [];
    const len = pool.length;
    const existing = existingItems?.[slot.key] || [];

    // Preserve pinned positions; every other position (including all of
    // them, if there's no existing array) starts as a hole to refill.
    const picked = existing.map((item) => (pinnedIds.has(item.id) ? item : null));
    while (picked.length < slot.size) picked.push(null);
    for (const item of picked) if (item) dayExcludeIds.add(item.id);

    let needed = picked.filter((p) => p === null).length;

    if (len > 0 && needed > 0) {
      const start = ((offsets[slot.key] || 0) % len + len) % len;
      const walk = Array.from({ length: len }, (_, i) => pool[(start + i) % len]);
      const weekSet = weekUsedIds ? (weekUsedIds.get(slot.key) ?? weekUsedIds.set(slot.key, new Set()).get(slot.key)) : null;

      // Pass 1: respect week-wide variety, if tracking it.
      for (const candidate of walk) {
        if (needed === 0) break;
        if (dayExcludeIds.has(candidate.id) || pinnedIds.has(candidate.id)) continue;
        if (weekSet && weekSet.has(candidate.id)) continue;
        dayExcludeIds.add(candidate.id);
        if (weekSet) weekSet.add(candidate.id);
        picked[picked.findIndex((p) => p === null)] = toPlanItem(candidate);
        needed--;
      }

      // Pass 2: pool too small to keep spreading variety — reset THIS
      // slot's week-variety set and allow a repeat rather than an empty hole.
      if (needed > 0 && weekSet) {
        weekSet.clear();
        for (const candidate of walk) {
          if (needed === 0) break;
          if (dayExcludeIds.has(candidate.id) || pinnedIds.has(candidate.id)) continue;
          dayExcludeIds.add(candidate.id);
          weekSet.add(candidate.id);
          picked[picked.findIndex((p) => p === null)] = toPlanItem(candidate);
          needed--;
        }
      }
    }

    slots[slot.key] = picked.filter(Boolean);
  }

  return slots;
}

/**
 * Rotate a window of at most `size` items out of a user's pick bucket for one
 * day. This is the whole cycling rule for picks-only plans.
 *
 * `size` (a slot's `PLAN_SLOTS.size`) is a MAXIMUM, never a quota — a bucket
 * smaller than the slot yields a short slot rather than pulling in food the
 * user didn't pick. Two regimes fall out of the same expression:
 * - `bucket.length <= size` → `perDay === len`, so `start` is always 0 and
 *   every day shows the same full set of picks.
 * - `bucket.length > size` → the window advances by `perDay` each rotation, so
 *   all picks get used across the week instead of only the first `size`.
 * `perDay <= len` guarantees the window never wraps onto itself, so a day can
 * never show the same pick twice.
 *
 * @param {import('../state/dailyPlan.js').PlanItem[]} bucket
 * @param {number} size - slot capacity (max items for this slot)
 * @param {number} rotation - dayIndex, or a generation counter on regenerate
 * @returns {import('../state/dailyPlan.js').PlanItem[]}
 */
function pickWindow(bucket, size, rotation) {
  const len = bucket.length;
  if (len === 0) return [];
  const perDay = Math.min(size, len);
  const start = (((rotation * perDay) % len) + len) % len;
  return Array.from({ length: perDay }, (_, i) => bucket[(start + i) % len]);
}

/**
 * Build one day's slots purely from the user's picks — the picks-only
 * counterpart to `fillSlots`. Takes no candidate pools at all, so it is
 * structurally incapable of introducing an un-picked item.
 *
 * Pinned positions are preserved exactly as `fillSlots` does; the remaining
 * holes are filled from that slot's rotated `pickWindow`, skipping ids already
 * placed in the slot. A slot whose bucket is empty stays empty.
 *
 * @param {Object<string, import('../state/dailyPlan.js').PlanItem[]>} picksBySlot
 * @param {number} rotation - passed through to `pickWindow`
 * @param {Object} [opts]
 * @param {Set<number|string>} [opts.pinnedIds]
 * @param {Object<string, import('../state/dailyPlan.js').PlanItem[]>} [opts.existingItems]
 * @returns {Object<string, import('../state/dailyPlan.js').PlanItem[]>}
 */
function fillFromPicks(picksBySlot, rotation, opts = {}) {
  const { pinnedIds = new Set(), existingItems = null } = opts;
  const slots = {};

  for (const slot of PLAN_SLOTS) {
    const window = pickWindow(picksBySlot[slot.key] || [], slot.size, rotation);
    const existing = existingItems?.[slot.key] || [];

    const picked = existing.map((item) => (pinnedIds.has(item.id) ? item : null));
    while (picked.length < window.length) picked.push(null);

    const used = new Set(picked.filter(Boolean).map((item) => item.id));
    for (const candidate of window) {
      const hole = picked.indexOf(null);
      if (hole === -1) break;
      if (used.has(candidate.id)) continue;
      used.add(candidate.id);
      picked[hole] = candidate;
    }

    slots[slot.key] = picked.filter(Boolean);
  }

  return slots;
}

/**
 * Candidate-pool cursors for one day. Written on picks-only days too (where
 * slot content ignores them) because `shuffleSlot` — deliberately left as the
 * one escape hatch back to the suggestion pools — walks the pool from here.
 * @param {Record<string, import('./types.js').PlanCandidate[]>} candidates
 * @param {number} rotation
 * @returns {Object<string, number>}
 */
function slotOffsets(candidates, rotation) {
  const offsets = {};
  for (const slot of PLAN_SLOTS) {
    const len = (candidates[slot.key] || []).length;
    offsets[slot.key] = len > 0 ? (rotation * slot.size) % len : 0;
  }
  return offsets;
}

/**
 * Merge any leftover legacy `'queue'` items into a freshly-built day's slots
 * (first-ever-build only — see `generatePlanFromPicks`, the only place a
 * WeeklyPlan is built from scratch since the Aug 2026 picks-only default;
 * this used to be called from `ensurePlanForWeek`'s first-build path, which
 * no longer exists). Each item is bucketed via `inferSlotKey` and appended
 * after the picked items, deduped by id against everything already in the
 * day.
 * @param {Object<string, import('../state/dailyPlan.js').PlanItem[]>} slots
 * @returns {Object<string, import('../state/dailyPlan.js').PlanItem[]>}
 */
function mergeLegacyQueue(slots) {
  const legacyItems = consumeLegacyQueue();
  if (!legacyItems.length) return slots;
  const usedIds = new Set(Object.values(slots).flatMap((items) => items.map((i) => i.id)));
  let merged = slots;
  for (const item of legacyItems) {
    if (usedIds.has(item.id)) continue;
    usedIds.add(item.id);
    const slotKey = inferSlotKey(item);
    merged = { ...merged, [slotKey]: [...merged[slotKey], toPlanItem(item)] };
  }
  return merged;
}

/**
 * Ensure a valid 7-day WeeklyPlan exists, building/extending it as needed.
 * Idempotent — safe to call on every mount.
 *
 * Picks-only default (Aug 2026, decision b): this function no longer builds
 * a plan from scratch. If no plan exists yet (`getPlan()` returns null — the
 * user has never run the recipe picker), it returns `{ plan: null,
 * usedFallback: false }` immediately, with zero network calls and zero
 * writes. A plan only ever comes into existence via `generatePlanFromPicks`
 * (the "New meal plan" picker) — see that function's doc for why an
 * auto-filled, un-picked week is no longer the honest default. Every rule
 * documented below only applies once a plan already exists; the caller
 * (Plan screen) is expected to render its own empty state for the null case
 * and route the user to the picker.
 *
 * Conditions-change contract (product rule, storage-map.md §6 gap 3, closed
 * this wave): if the profile's resolved conditions no longer match the
 * existing plan's `conditionsKey`, the plan is DISCARDED outright — it is
 * never regenerated from the candidate pools — and this returns the exact
 * same `{ plan: null, usedFallback: false }` shape as the no-plan-yet case
 * above, so the caller lands on the same first-run empty state / picker CTA
 * either way. This used to rebuild every day from the candidate pools
 * (dropping `picksBySlot` in the process); that silently downgraded a
 * picks-only plan into an auto-filled one, which contradicts the picks-only
 * default — the user always chooses what goes in the plan, and re-picking
 * (not auto-filling) is the honest reset after conditions change (see
 * `generatePlanFromPicks`'s doc). Rolling-window carry-over/variety-spreading
 * below only ever runs once conditions are confirmed unchanged.
 *
 * See also `purgeDerivedDataForConditionsChange`, which performs the same
 * discard eagerly — the moment a profile's conditions are saved, rather than
 * waiting for this function's next call (which only happens on
 * `MealQueueScreen`'s mount) — so a stale plan never even transiently exists
 * locally or gets pushed to Supabase paired with the new conditions
 * (storage-map.md §6 gap 1).
 *
 * Rolling window: `nextSevenDays()` is the source of truth for which date
 * keys belong in the plan. Any existing day still inside that window carries
 * over completely untouched (pins, eaten, everything) — a day that rolls out
 * of the window (yesterday, once today advances) is simply dropped by not
 * being copied into the new `days` map. Only the missing trailing day(s) get
 * freshly generated.
 *
 * Variety spreading: newly generated days advance each slot's offset by
 * `dayIndex * slot.size` (dayIndex = 0..6, its absolute position in the
 * week) and share a week-wide `weekUsedIds` set per slot (seeded from days
 * already kept, so a freshly-added trailing day also avoids repeating what
 * the kept days already show) — see `fillSlots`' doc for the two-pass
 * exhaustion behavior. Skipped for picks-only plans, which spread variety by
 * rotation instead (`fillFromPicks`).
 *
 * Picks-only plans: if the existing plan carries `picksBySlot` (true of
 * every plan built since Aug 2026 — see `generatePlanFromPicks`), each
 * freshly generated trailing day is built from those picks (`fillFromPicks`)
 * rather than the candidate pools, and `picksBySlot` is carried onto the
 * rebuilt plan. Without this the picks-only guarantee would silently lapse
 * one day later, as tomorrow rolled into the window and got auto-filled. A
 * pre-Aug-2026 plan with no `picksBySlot` at all is the one remaining case
 * that still auto-fills its trailing days from the candidate pools below —
 * the legacy pool-built escape hatch (also see `regenerateDay`/
 * `regenerateWeek`, which branch the same way).
 *
 * Quota protection: if `getMealPlanSuggestions` comes back with every slot
 * empty (e.g. API/quota outage), the existing plan (for the same
 * conditions) is returned unchanged — never let a transient outage wipe (or
 * partially wipe) a good week down to honest-empty days. The next mount
 * retries (candidates are cached 8h, so a real recovery is picked up soon).
 * Picks-only plans skip this guard entirely: their slot content doesn't come
 * from the pools, so an empty pool can't degrade them.
 *
 * @param {import('./types.js').Profile} profile
 * @returns {Promise<{ plan: import('../state/dailyPlan.js').WeeklyPlan|null, usedFallback: boolean }>}
 *   `plan` is null when no plan exists yet OR the profile's conditions
 *   changed since the existing plan was built (both share the no-plan
 *   contract, above) — every other path returns a real plan.
 */
export async function ensurePlanForWeek(profile) {
  const existing = getPlan();
  if (!existing) {
    return { plan: null, usedFallback: false };
  }

  const { candidates, conditionIds, conditionNames, usedFallback } = await loadCandidates(profile);
  const conditionsKey = conditionIds.join(',');

  if (existing.conditionsKey !== conditionsKey) {
    // Conditions changed since this plan was built — discard it entirely
    // (never regenerate from pools, never carry picks over) and hand back
    // the same no-plan shape a first-ever build returns. See the doc above.
    setPlan(null);
    return { plan: null, usedFallback: false };
  }

  const picksBySlot = existing.picksBySlot;

  const dayKeys = nextSevenDays().map((d) => d.key);

  const keptDays = {};
  for (const key of dayKeys) {
    if (existing.days[key]) keptDays[key] = existing.days[key];
  }
  const missingKeys = dayKeys.filter((key) => !keptDays[key]);

  const allEmpty = PLAN_SLOT_KEYS.every((key) => (candidates[key] || []).length === 0);
  if (allEmpty && !picksBySlot) {
    return { plan: existing, usedFallback: existing.usedFallback };
  }

  if (missingKeys.length === 0) {
    return { plan: existing, usedFallback: existing.usedFallback };
  }

  // Seed week-wide variety tracking from days we're keeping, so new trailing
  // days lean away from what's already showing this week, not just from
  // each other. Unused on picks-only plans, which spread by rotation instead.
  const weekUsedIds = picksBySlot ? null : new Map(PLAN_SLOTS.map((s) => [s.key, new Set()]));
  if (weekUsedIds) {
    for (const day of Object.values(keptDays)) {
      for (const slot of PLAN_SLOTS) {
        for (const item of day.slots[slot.key] || []) weekUsedIds.get(slot.key).add(item.id);
      }
    }
  }

  const newDays = {};
  for (const dateKey of missingKeys) {
    const dayIndex = dayKeys.indexOf(dateKey);
    const offsets = slotOffsets(candidates, dayIndex);

    const slots = picksBySlot
      ? fillFromPicks(picksBySlot, dayIndex)
      : fillSlots(PLAN_SLOTS, candidates, offsets, { weekUsedIds });

    newDays[dateKey] = { generation: 0, offsets, slots, eaten: [], pinned: [] };
  }

  const plan = {
    version: 2,
    conditionsKey,
    conditionNames,
    usedFallback,
    generation: existing.generation ?? 0,
    days: { ...keptDays, ...newDays },
    ...(picksBySlot ? { picksBySlot } : {}),
  };

  setPlan(plan);
  return { plan, usedFallback };
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
 * Deliberately synchronous and network-free — unlike `ensurePlanForWeek`,
 * this cannot await `loadCandidates`/`getMealPlanSuggestions` to resolve the
 * profile's conditions (that would mean a network round-trip on every
 * profile save, racing the caller's own write). Instead it compares the RAW
 * `newConditions` (joined in the same order `ensurePlanForWeek` uses to
 * derive `conditionsKey` when no condition-fallback is in play) against the
 * existing plan's `conditionsKey`. The one case this can diverge from
 * `ensurePlanForWeek`'s fully fallback-resolved comparison is when the demo
 * condition-fallback (`withConditionFallback` in adapter.js) is active for
 * BOTH the old and new conditions — this may then purge a plan that would
 * have resolved to the identical fallback candidate set. That is the safe
 * direction to be wrong in: it never leaves a stale/mismatched plan in
 * place, it only occasionally asks for an extra re-pick in that narrow
 * fallback-collision case.
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
  return true;
}

/**
 * Build a brand-new 7-day WeeklyPlan seeded from user-picked items — the
 * "New meal plan" recipe picker (`MealPlannerPicker.jsx`) and, since Aug
 * 2026 (decision b, picks-only default), the ONLY function that ever builds
 * a WeeklyPlan from scratch — `ensurePlanForWeek` no longer does (see its
 * doc: it returns a null plan when none exists yet). UNLIKE
 * `ensurePlanForWeek`'s window-maintenance path, this always rebuilds every
 * day of the rolling window from scratch (no "keep existing days"
 * carry-over) — the whole point of the picker is to hand back a fresh week
 * reflecting the current picks.
 *
 * `pickedItems` are bucketed by meal type (`mealTypeForItem` — honors an
 * item's own `fromSlot`/`slotKey` first, so a picker card tagged with the
 * rail it was shown under lands in that exact slot rather than being
 * re-inferred from its food group), and the resulting buckets become the
 * plan's `picksBySlot` — ALWAYS attached, even when every bucket is empty,
 * so a plan built here is unambiguously picks-only from the moment it
 * exists (see `regenerateDay`/`regenerateWeek`, which branch on
 * `picksBySlot`'s presence). Every day's slots are then drawn from those
 * buckets alone via `fillFromPicks`/`pickWindow` — the ranked candidate
 * pools are NEVER consulted for slot content, not even when `pickedItems`
 * is empty: a zero-pick call now honestly yields a week of empty days
 * rather than silently falling back to an auto-generated week nobody asked
 * for (the picker UI is expected to disable its own submit CTA when nothing
 * is picked, not rely on this function to degrade gracefully). A slot's
 * `size` acts as a per-day cap, so picking fewer items than a slot holds
 * yields a short slot (and an under-target day) rather than padding with
 * food the user didn't choose.
 *
 * Picks are deliberately NOT auto-pinned. Pinning previously existed only to
 * shield them from the candidate-pool backfill that no longer happens, and
 * leaving it on would permanently disable each slot's Shuffle button (which
 * `SlotSection` greys out when every card is pinned). Persisting
 * `picksBySlot` is what protects picks now — see `regenerateDay`/
 * `regenerateWeek`/`ensurePlanForWeek`.
 *
 * On the very first-ever build (no plan of any kind existed yet — checked
 * BEFORE this function's own `setPlan` overwrites it), leftover legacy
 * `'queue'` items are merged into TODAY's day (see `mergeLegacyQueue`) —
 * this used to live in `ensurePlanForWeek`'s now-removed auto-build path;
 * it moved here because this is the only remaining place a first-ever plan
 * gets built.
 *
 * @param {import('./types.js').Profile} profile
 * @param {Array<Object>} pickedItems - user-selected candidate/food items
 *   (PlanCandidate shape, optionally carrying `fromSlot`); may be empty.
 * @returns {Promise<{ plan: import('../state/dailyPlan.js').WeeklyPlan, usedFallback: boolean }>}
 */
export async function generatePlanFromPicks(profile, pickedItems) {
  const isFirstEverBuild = !getPlan();
  const { candidates, conditionIds, conditionNames, usedFallback } = await loadCandidates(profile);
  const dayKeys = nextSevenDays().map((d) => d.key);

  // Bucket picks by slot, preserving pick order so `pickWindow`'s rotation is
  // deterministic.
  const picksBySlot = Object.fromEntries(PLAN_SLOT_KEYS.map((key) => [key, []]));
  for (const item of pickedItems || []) {
    const slotKey = mealTypeForItem(item);
    const bucket = picksBySlot[slotKey] || picksBySlot.lunch;
    bucket.push(toPlanItem(item));
  }

  const days = {};
  dayKeys.forEach((dateKey, dayIndex) => {
    // Offsets are still computed from the candidate pools (never consulted
    // for slot CONTENT here) because `shuffleSlot` — the one sanctioned
    // escape hatch back to the pools, even on a picks-only plan — walks the
    // pool from this cursor. See `slotOffsets`' doc.
    const offsets = slotOffsets(candidates, dayIndex);
    let slots = fillFromPicks(picksBySlot, dayIndex);
    if (isFirstEverBuild && dateKey === dayKeys[0]) {
      slots = mergeLegacyQueue(slots);
    }

    days[dateKey] = { generation: 0, offsets, slots, eaten: [], pinned: [] };
  });

  const plan = {
    version: 2,
    conditionsKey: conditionIds.join(','),
    conditionNames,
    usedFallback,
    generation: 0,
    days,
    picksBySlot,
  };

  setPlan(plan);
  return { plan, usedFallback };
}

/**
 * Regenerate ONE day: bump its `generation`, advance every slot's offset
 * deterministically (`generation * slot.size`, wrapped by that slot's
 * candidate count), and refill all NON-pinned positions (pinned items keep
 * their slot position). Clears that day's `eaten`. Deterministic and makes
 * zero API calls — it only re-walks already-memoized/cached data.
 *
 * On a picks-only plan (`picksBySlot` present) the refill comes from the
 * user's own picks via `fillFromPicks`, rotated by the new `generation`, so
 * regenerating reshuffles what they chose and never introduces an un-picked
 * item. Otherwise it refills from the ranked candidate pools via `fillSlots`.
 * @param {import('./types.js').Profile} profile
 * @param {string} dateKey
 * @returns {Promise<import('../state/dailyPlan.js').WeeklyPlan>}
 */
export async function regenerateDay(profile, dateKey) {
  const existing = getPlan();
  const day = existing?.days?.[dateKey];
  const { candidates, conditionIds, conditionNames, usedFallback } = await loadCandidates(profile);

  const generation = (day?.generation || 0) + 1;
  const offsets = slotOffsets(candidates, generation);

  const pinnedIds = new Set(day?.pinned || []);
  const slots = existing?.picksBySlot
    ? fillFromPicks(existing.picksBySlot, generation, {
        pinnedIds,
        existingItems: day?.slots || {},
      })
    : fillSlots(PLAN_SLOTS, candidates, offsets, {
        pinnedIds,
        existingItems: day?.slots || {},
      });

  const newDay = {
    generation,
    offsets,
    slots,
    eaten: [],
    pinned: day?.pinned || [],
  };

  const plan = {
    version: 2,
    conditionsKey: existing?.conditionsKey ?? conditionIds.join(','),
    conditionNames: existing?.conditionNames ?? conditionNames,
    usedFallback: existing?.usedFallback ?? usedFallback,
    generation: existing?.generation ?? 0,
    days: { ...(existing?.days || {}), [dateKey]: newDay },
    ...(existing?.picksBySlot ? { picksBySlot: existing.picksBySlot } : {}),
  };

  setPlan(plan);
  return plan;
}

/**
 * Regenerate the WHOLE week: bump the week-level `generation`, and for every
 * day currently in the plan, bump that day's own `generation` and refill its
 * non-pinned positions (pinned items keep their slot position in every day).
 * Zero API calls.
 *
 * On a picks-only plan (`picksBySlot` present) every day is refilled from the
 * user's own picks via `fillFromPicks` — never the candidate pools. Otherwise
 * it threads a week-wide `weekUsedIds` set per slot so the re-solved week
 * spreads variety across days exactly like a from-scratch build does.
 *
 * Both paths rotate by `generation + dayIndex` (rather than just dayIndex) so
 * a week-regenerate doesn't reproduce the exact selection the LAST regenerate
 * produced for this same relative day position.
 * @param {import('./types.js').Profile} profile
 * @returns {Promise<import('../state/dailyPlan.js').WeeklyPlan|null>} null if
 *   there's no plan to regenerate.
 */
export async function regenerateWeek(profile) {
  const existing = getPlan();
  if (!existing) return null;

  const { candidates, conditionIds, conditionNames, usedFallback } = await loadCandidates(profile);
  const dayKeys = Object.keys(existing.days).sort();
  const generation = (existing.generation || 0) + 1;
  const picksBySlot = existing.picksBySlot;
  const weekUsedIds = picksBySlot ? null : new Map(PLAN_SLOTS.map((s) => [s.key, new Set()]));

  const newDays = {};
  dayKeys.forEach((dateKey, dayIndex) => {
    const day = existing.days[dateKey];
    const dayGeneration = (day?.generation || 0) + 1;
    const rotation = generation + dayIndex;
    const offsets = slotOffsets(candidates, rotation);

    const pinnedIds = new Set(day?.pinned || []);
    const slots = picksBySlot
      ? fillFromPicks(picksBySlot, rotation, {
          pinnedIds,
          existingItems: day?.slots || {},
        })
      : fillSlots(PLAN_SLOTS, candidates, offsets, {
          pinnedIds,
          existingItems: day?.slots || {},
          weekUsedIds,
        });

    newDays[dateKey] = {
      generation: dayGeneration,
      offsets,
      slots,
      eaten: [],
      pinned: day?.pinned || [],
    };
  });

  const plan = {
    version: 2,
    conditionsKey: existing.conditionsKey ?? conditionIds.join(','),
    conditionNames: existing.conditionNames ?? conditionNames,
    usedFallback: existing.usedFallback ?? usedFallback,
    generation,
    days: newDays,
    ...(picksBySlot ? { picksBySlot } : {}),
  };

  setPlan(plan);
  return plan;
}

/**
 * Shuffle a single slot on a single day: advance that slot's offset by its
 * own size (wrapped by its candidate count) and refill only that slot's
 * NON-pinned positions — pinned items in the slot stay put. Skips ids
 * already present in any OTHER slot that day, ids already marked eaten, and
 * every id pinned anywhere that day. Other slots (and other days) are left
 * untouched. Zero API calls.
 * @param {import('./types.js').Profile} profile
 * @param {string} dateKey
 * @param {string} slotKey
 * @returns {Promise<import('../state/dailyPlan.js').WeeklyPlan|null>} null if
 *   there's no such day/plan or slotKey is unknown.
 */
export async function shuffleSlot(profile, dateKey, slotKey) {
  const existing = getPlan();
  const day = existing?.days?.[dateKey];
  if (!day || !PLAN_SLOT_KEYS.includes(slotKey)) return null;

  const { candidates } = await loadCandidates(profile);
  const slot = PLAN_SLOTS.find((s) => s.key === slotKey);
  const pool = candidates[slotKey] || [];
  const len = pool.length;

  const prevOffset = day.offsets[slotKey] || 0;
  const nextOffset = len > 0 ? (prevOffset + slot.size) % len : prevOffset;

  const pinnedIds = new Set(day.pinned);
  const otherIds = new Set(
    Object.entries(day.slots)
      .filter(([key]) => key !== slotKey)
      .flatMap(([, items]) => items.map((i) => i.id))
  );
  const dayExcludeIds = new Set([...otherIds, ...day.eaten]);

  const refilled = fillSlots([slot], { [slotKey]: pool }, { [slotKey]: nextOffset }, {
    dayExcludeIds,
    pinnedIds,
    existingItems: { [slotKey]: day.slots[slotKey] || [] },
  });

  const newDay = {
    ...day,
    offsets: { ...day.offsets, [slotKey]: nextOffset },
    slots: { ...day.slots, [slotKey]: refilled[slotKey] },
  };

  const plan = { ...existing, days: { ...existing.days, [dateKey]: newDay } };
  setPlan(plan);
  return plan;
}
