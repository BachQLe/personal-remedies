// @vitest-environment jsdom
/**
 * planBuilder.beverages.test.js — Guard tests for T2A ("Restore the
 * Beverages meal slot").
 *
 * Covers:
 *  (i)  a pre-restoration ("4-slot era") plan fixture — a day whose
 *       `slots` object has NO `beverages` key at all — survives
 *       `ensurePlanForWeek` without crashing. The legacy day is KEPT
 *       untouched (not retrofitted with a `beverages` key), and reading it
 *       via the `?? []` tolerance pattern every consumer is expected to use
 *       (see config.js's `PLAN_SLOTS` doc) yields an honestly empty array.
 *       Every OTHER (freshly generated) day in the window gets a real
 *       `beverages` array from the candidate pool, proving the restored
 *       slot works end to end.
 *  (ii) `shuffleSlot(profile, dateKey, 'beverages')` fills the slot from a
 *       mocked candidate pool — `beverages` is a real, shuffleable
 *       `PLAN_SLOTS` entry again.
 *  (vi) `inferSlotKey` routes fine group 'h2' to 'beverages' again (the
 *       restored short-circuit) instead of falling through to the
 *       default-to-'lunch' case.
 *
 * Needs jsdom for the same reason as planBuilder.conditionsPurge.test.js:
 * src/state/dailyPlan.js persists through src/api/storage.js, a real
 * localStorage wrapper (guards `typeof window === 'undefined'`, so plain
 * node would silently no-op every write/read).
 *
 * Each `describe` block that reaches `ensurePlanForWeek`/`shuffleSlot` uses
 * its OWN fake condition id so `planBuilder.js`'s internal
 * `loadCandidates` session memo (keyed by conditions CSV, module-scoped —
 * see planBuilder.js:26-28) never serves one test's mocked pool to another.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../adapter.js', () => ({
  getMealPlanSuggestions: vi.fn(),
}));

import { getMealPlanSuggestions } from '../adapter.js';
import { ensurePlanForWeek, shuffleSlot, inferSlotKey } from '../planBuilder.js';
import { setPlan, reloadPlan } from '../../state/dailyPlan.js';
import { storage } from '../storage.js';
import { todayKey, nextSevenDays } from '../../screens/plan/planDates.js';

/** Minimal PlanCandidate shape (src/api/types.js). */
const BEVERAGE_CANDIDATE = {
  id: 9101,
  name: 'Green Tea',
  image: '',
  group: 'h',
  fineGroup: 'h2',
  tier: 'Top',
  numericId: 1,
  kind: 'food',
};

function emptyCandidates(overrides = {}) {
  return {
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: [],
    beverages: [],
    ...overrides,
  };
}

beforeEach(() => {
  storage.clear();
  reloadPlan();
  getMealPlanSuggestions.mockReset();
});

afterEach(() => {
  storage.clear();
  reloadPlan();
});

describe('inferSlotKey: fine group h2 -> beverages (restored short-circuit)', () => {
  it('routes an h2 item to beverages, not the coarse-group default (lunch)', () => {
    expect(inferSlotKey({ fineGroup: 'h2', group: 'h' })).toBe('beverages');
  });

  it('still routes h1 to snacks (sibling short-circuit, unaffected by the restoration)', () => {
    expect(inferSlotKey({ fineGroup: 'h1', group: 'h' })).toBe('snacks');
  });
});

describe('ensurePlanForWeek: a pre-restoration (4-slot era) day tolerates a missing beverages key', () => {
  it('keeps the legacy day untouched and builds beverages honestly for the rest of the week', async () => {
    getMealPlanSuggestions.mockResolvedValue({
      candidates: emptyCandidates({ beverages: [BEVERAGE_CANDIDATE] }),
      conditionIds: [401],
      conditionNames: ['Condition 401'],
      usedFallback: false,
    });

    const key = todayKey();
    const legacyDay = {
      generation: 0,
      offsets: {},
      // NO `beverages` key — the exact shape a day persisted during the
      // July-August 2026 4-slot era has.
      slots: { breakfast: [], lunch: [], dinner: [], snacks: [] },
      eaten: [],
      pinned: [],
    };
    setPlan({
      version: 2,
      conditionsKey: '401',
      conditionNames: ['Condition 401'],
      usedFallback: false,
      generation: 0,
      days: { [key]: legacyDay },
    });

    const { plan } = await ensurePlanForWeek({ conditions: [401] });

    // The legacy day survives completely untouched — no `beverages` key was
    // silently added to it (it's still inside the rolling window, so it's
    // "kept", never rebuilt).
    expect(plan.days[key]).toBe(legacyDay);
    expect(Object.prototype.hasOwnProperty.call(plan.days[key].slots, 'beverages')).toBe(false);
    // Every consumer must read a day's beverages via `?? []` — confirm that
    // tolerance actually yields an honest empty array.
    expect(plan.days[key].slots.beverages ?? []).toEqual([]);

    // Every OTHER (freshly built) day in the window DOES get a real
    // beverages array, drawn from the mocked pool.
    const dayKeys = nextSevenDays().map((d) => d.key);
    const otherKeys = dayKeys.filter((k) => k !== key);
    expect(otherKeys.length).toBeGreaterThan(0);
    for (const k of otherKeys) {
      expect(plan.days[k].slots.beverages).toEqual([
        expect.objectContaining({ id: BEVERAGE_CANDIDATE.id }),
      ]);
    }
  });
});

describe('shuffleSlot: beverages is a real, shuffleable slot again', () => {
  it('fills the beverages slot from the mocked candidate pool', async () => {
    const pool = [
      BEVERAGE_CANDIDATE,
      { ...BEVERAGE_CANDIDATE, id: 9102, name: 'Herbal Infusion', numericId: 2, tier: 'Strong' },
    ];
    getMealPlanSuggestions.mockResolvedValue({
      candidates: emptyCandidates({ beverages: pool }),
      conditionIds: [402],
      conditionNames: ['Condition 402'],
      usedFallback: false,
    });

    const key = todayKey();
    const day = {
      generation: 0,
      offsets: { beverages: 0 },
      slots: { breakfast: [], lunch: [], dinner: [], snacks: [], beverages: [] },
      eaten: [],
      pinned: [],
    };
    setPlan({
      version: 2,
      conditionsKey: '402',
      conditionNames: ['Condition 402'],
      usedFallback: false,
      generation: 0,
      days: { [key]: day },
    });

    const plan = await shuffleSlot({ conditions: [402] }, key, 'beverages');

    expect(plan).not.toBeNull();
    // PLAN_SLOTS' beverages entry has size: 1.
    expect(plan.days[key].slots.beverages.length).toBe(1);
    expect(pool.map((c) => c.id)).toContain(plan.days[key].slots.beverages[0].id);
    // Every other slot is untouched by the beverages-only shuffle.
    expect(plan.days[key].slots.breakfast).toEqual([]);
  });
});
