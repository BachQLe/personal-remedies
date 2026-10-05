// @vitest-environment jsdom
/**
 * planBuilder.conditionsPurge.test.js — Guard tests for
 * REMEDI_MASTER_PLAN.md §3.4 / docs/storage-map.md §6 (gaps 1 and 3, closed
 * this wave).
 *
 * UPDATED THIS WAVE (T5D): the original version of this file pinned
 * `ensurePlanForWeek`'s changed-conditions behavior as "discard every day,
 * drop picksBySlot, REBUILD from the candidate pools." That behavior itself
 * was the storage-map.md §6 gap-3 defect — it silently downgraded a
 * picks-only plan back into a pool-auto-filled one instead of sending the
 * user back to the picker, contradicting the picks-only default
 * (`generatePlanFromPicks`'s own "re-picking is the honest reset" doc). The
 * fix changes the contract: a conditions change now DISCARDS the plan
 * entirely (never rebuilds from pools) and returns the same `{ plan: null,
 * usedFallback: false }` shape a first-ever build returns — the Plan screen
 * already renders its empty-state picker CTA for exactly that shape. The
 * first test below is updated accordingly (see its own comment for exactly
 * what changed and why); a new test pins the sibling "conditions unchanged"
 * path is NOT affected (existing days + picksBySlot survive intact,
 * including the rolling-window carry-over that fills missing trailing
 * days).
 *
 * Also covers `purgeDerivedDataForConditionsChange` (planBuilder.js) — the
 * new, synchronous, network-free export that closes gap 1: it performs the
 * same discard eagerly, at the moment a profile's conditions are saved
 * (called from profileSync.js's `storage.onWrite('profile', ...)` hook),
 * rather than waiting for `ensurePlanForWeek`'s next call.
 *
 * Needs jsdom because src/state/dailyPlan.js persists through
 * src/api/storage.js, which is a real localStorage wrapper (guards `typeof
 * window === 'undefined'` but that means it silently no-ops under plain
 * node — jsdom gives us a real window.localStorage to seed/read against).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// planBuilder.js's only Nutridigm-network touchpoint is getMealPlanSuggestions
// (via its internal loadCandidates helper) — mock exactly that so this test
// makes zero real network/cache calls and controls the candidate pools.
vi.mock('../adapter.js', () => ({
  getMealPlanSuggestions: vi.fn(async () => ({
    candidates: { breakfast: [], lunch: [], dinner: [], snacks: [] },
    conditionIds: [244],
    conditionNames: ['Condition 244'],
    usedFallback: false,
  })),
}));

import { getMealPlanSuggestions } from '../adapter.js';
import { ensurePlanForWeek, purgeDerivedDataForConditionsChange } from '../planBuilder.js';
import { setPlan, getPlan, reloadPlan } from '../../state/dailyPlan.js';
import { storage } from '../storage.js';
import { todayKey, nextSevenDays } from '../../screens/plan/planDates.js';

/** Minimal PlanItem shape (src/state/dailyPlan.js PlanItem typedef). */
const SEED_ITEM = {
  id: 1,
  name: 'Oatmeal',
  image: '',
  group: 'f',
  fineGroup: 'f',
  tier: 'Top',
  numericId: 1,
  kind: 'food',
};

beforeEach(() => {
  storage.clear();
  reloadPlan();
  getMealPlanSuggestions.mockClear();
});

afterEach(() => {
  storage.clear();
  reloadPlan();
});

describe('ensurePlanForWeek: conditions-change contract (storage-map.md §6, gap 3)', () => {
  it('discards the plan entirely (never rebuilds from pools) and returns the no-plan shape when conditions change', async () => {
    const key = todayKey(); // seed at TODAY so it would be in the rolling window if not for the conditions change
    const seededPlan = {
      version: 2,
      conditionsKey: '203',
      conditionNames: ['Condition 203'],
      usedFallback: false,
      generation: 0,
      days: {
        [key]: {
          generation: 0,
          offsets: {},
          slots: { breakfast: [SEED_ITEM], lunch: [], dinner: [], snacks: [] },
          eaten: [],
          pinned: [],
        },
      },
      picksBySlot: { breakfast: [SEED_ITEM], lunch: [], dinner: [], snacks: [] },
    };
    setPlan(seededPlan);

    // Sanity: confirm the seed actually persisted before exercising the code under test.
    expect(storage.get('dailyPlan').days[key].slots.breakfast).toHaveLength(1);
    expect(storage.get('dailyPlan').picksBySlot).toBeDefined();

    const result = await ensurePlanForWeek({ conditions: [244] });

    // UPDATED THIS WAVE: used to assert plan.conditionsKey === '244' with a
    // freshly rebuilt (pool-filled) day. Gap 3's fix means a conditions
    // change no longer rebuilds anything — it discards the plan outright and
    // hands back the same no-plan contract `MealQueueScreen` already renders
    // its "Build my meal plan" empty-state CTA for.
    expect(result).toEqual({ plan: null });

    // The stale plan must actually be cleared from storage too — not just
    // absent from the return value — so a later `getPlan()`/mount sees the
    // honest empty state, not the old (now conditions-mismatched) plan.
    expect(getPlan()).toBeNull();
    expect(storage.get('dailyPlan')).toBeNull();
  });
});

describe('ensurePlanForWeek: conditions UNCHANGED — existing plan/picks survive, rolling window still carries over', () => {
  it('keeps the existing day + picksBySlot intact and fills only the missing trailing days from picks (never the pool)', async () => {
    // OWN condition id (700), distinct from the other describe blocks in
    // this file — planBuilder.js's internal loadCandidates session memo is
    // keyed by conditions CSV and module-scoped (persists across tests
    // within this file), so reusing an id another test already resolved
    // would silently serve THAT test's cached (empty) candidates instead of
    // the pool-only item this test needs to prove never leaks in.
    getMealPlanSuggestions.mockResolvedValueOnce({
      candidates: { breakfast: [{ ...SEED_ITEM, id: 999, name: 'Pool-only Pancakes' }], lunch: [], dinner: [], snacks: [] },
      conditionIds: [700],
      conditionNames: ['Condition 700'],
      usedFallback: false,
    });

    const key = todayKey();
    const todayDay = {
      generation: 0,
      offsets: {},
      slots: { breakfast: [SEED_ITEM], lunch: [], dinner: [], snacks: [] },
      eaten: ['already-eaten-marker'],
      pinned: [SEED_ITEM.id],
    };
    const picksBySlot = { breakfast: [SEED_ITEM], lunch: [], dinner: [], snacks: [] };
    setPlan({
      version: 2,
      conditionsKey: '700',
      conditionNames: ['Condition 700'],
      usedFallback: false,
      generation: 0,
      days: { [key]: todayDay },
      picksBySlot,
    });

    const { plan } = await ensurePlanForWeek({ conditions: [700] });

    expect(plan).not.toBeNull();
    // Today's day carries over completely untouched — same object reference,
    // not just deep-equal content, confirming it was copied through rather
    // than rebuilt.
    expect(plan.days[key]).toBe(todayDay);
    // picksBySlot survives unchanged.
    expect(plan.picksBySlot).toBe(picksBySlot);

    // Rolling window still carries over: every one of the other 6 days got
    // freshly generated (missing trailing days filled in).
    const dayKeys = nextSevenDays().map((d) => d.key);
    const otherKeys = dayKeys.filter((k) => k !== key);
    expect(otherKeys.length).toBe(6);
    for (const k of otherKeys) {
      expect(plan.days[k]).toBeDefined();
      // Picks-only plan: freshly generated days are built from picksBySlot
      // (fillFromPicks), never the candidate pool — the pool-only id must
      // never leak in even though the mocked pool has stock for it.
      const allIds = Object.values(plan.days[k].slots).flatMap((items) => items.map((i) => i.id));
      expect(allIds).not.toContain(999);
    }

    expect(storage.get('dailyPlan')).toEqual(plan);
  });
});

describe('purgeDerivedDataForConditionsChange (storage-map.md §6, gap 1)', () => {
  it('purges an existing plan when the new conditions differ from the plan conditionsKey', () => {
    setPlan({
      version: 2,
      conditionsKey: '203',
      conditionNames: ['Condition 203'],
      usedFallback: false,
      generation: 0,
      days: {},
      picksBySlot: { breakfast: [], lunch: [], dinner: [], snacks: [] },
    });

    const purged = purgeDerivedDataForConditionsChange([244]);

    expect(purged).toBe(true);
    expect(getPlan()).toBeNull();
    expect(storage.get('dailyPlan')).toBeNull();
  });

  it('is a no-op (returns false, plan untouched) when the new conditions match the plan conditionsKey', () => {
    const seededPlan = {
      version: 2,
      conditionsKey: '203',
      conditionNames: ['Condition 203'],
      usedFallback: false,
      generation: 0,
      days: {},
      picksBySlot: { breakfast: [], lunch: [], dinner: [], snacks: [] },
    };
    setPlan(seededPlan);

    const purged = purgeDerivedDataForConditionsChange([203]);

    expect(purged).toBe(false);
    // Identity check, not just deep-equal: setPlan must never have been
    // called on a true no-op.
    expect(getPlan()).toBe(seededPlan);
  });

  it('is a no-op when there is no existing plan at all', () => {
    expect(getPlan()).toBeNull();
    const purged = purgeDerivedDataForConditionsChange([244]);
    expect(purged).toBe(false);
    expect(getPlan()).toBeNull();
  });

  it('filters non-numeric entries out of newConditions before comparing (mirrors profileSync.splitProfile)', () => {
    const seededPlan = {
      version: 2,
      conditionsKey: '203',
      conditionNames: ['Condition 203'],
      usedFallback: false,
      generation: 0,
      days: {},
    };
    setPlan(seededPlan);

    // A stray non-numeric entry must not change the effective key: '203'.
    const purged = purgeDerivedDataForConditionsChange([203, 'not-a-condition']);

    expect(purged).toBe(false);
    expect(getPlan()).toBe(seededPlan);
  });

  it('treats null/undefined newConditions as an empty set, purging any existing plan', () => {
    setPlan({
      version: 2,
      conditionsKey: '203',
      conditionNames: ['Condition 203'],
      usedFallback: false,
      generation: 0,
      days: {},
    });

    expect(purgeDerivedDataForConditionsChange(null)).toBe(true);
    expect(getPlan()).toBeNull();
  });
});
