// @vitest-environment jsdom
/**
 * planBuilder.conditionsPurge.test.js — Guard test for
 * REMEDI_MASTER_PLAN.md §3.4:
 *
 *   "Cache invalidation: version/ETag + TTL + pull-to-refresh. Profile
 *   change purges derived data — already implemented in `ensurePlanForWeek`
 *   (conditions change discards every day including picks). Verify it
 *   holds."
 *
 * Pins the EXISTING-plan + changed-conditions path in
 * src/api/planBuilder.js's `ensurePlanForWeek` (~lines 371-377): when a
 * profile's conditions differ from the plan's `conditionsKey`, every
 * existing day is discarded (not carried over) and `picksBySlot` is dropped
 * — picks chosen against the old condition set may be poorly tiered (or
 * outright harmful) under the new one, so re-picking is the honest reset.
 *
 * Needs jsdom because src/state/dailyPlan.js persists through
 * src/api/storage.js, which is a real localStorage wrapper (guards `typeof
 * window === 'undefined'` but that means it silently no-ops under plain
 * node — jsdom gives us a real window.localStorage to seed/read against).
 *
 * NOTE: a separate, later wave changes first-ever-build behavior (no
 * existing plan → returns a null plan). This test deliberately seeds an
 * EXISTING plan first and asserts nothing about the no-plan path, per the
 * task brief — that path is out of scope here and will change out from
 * under an assertion added in this file.
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

import { ensurePlanForWeek } from '../planBuilder.js';
import { setPlan, reloadPlan } from '../../state/dailyPlan.js';
import { storage } from '../storage.js';
import { todayKey } from '../../screens/plan/planDates.js';

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

describe('ensurePlanForWeek: conditions-change purge (master plan §3.4, planBuilder.js:371-377)', () => {
  beforeEach(() => {
    storage.clear();
    reloadPlan();
  });

  afterEach(() => {
    storage.clear();
    reloadPlan();
  });

  it('discards every carried-over day and drops picksBySlot when the profile conditions change', async () => {
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

    const { plan } = await ensurePlanForWeek({ conditions: [244] });

    expect(plan.conditionsKey).toBe('244');
    expect(plan.picksBySlot).toBeUndefined(); // picks dropped, not just emptied

    // Today's day still exists (freshly rebuilt for the new conditions) but
    // is NOT the carried-over day — the old picked item is gone.
    expect(plan.days[key]).toBeDefined();
    expect(plan.days[key].slots.breakfast).toEqual([]);

    // Belt-and-suspenders: the old item must not have leaked into ANY slot
    // on ANY day of the rebuilt week.
    for (const day of Object.values(plan.days)) {
      for (const items of Object.values(day.slots)) {
        expect(items.some((i) => i.id === SEED_ITEM.id)).toBe(false);
      }
    }
  });
});
