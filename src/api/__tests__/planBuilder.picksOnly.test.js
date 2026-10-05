// @vitest-environment jsdom
/**
 * planBuilder.picksOnly.test.js — Guard tests for T2A ("make picks-only the
 * default plan path", decision b).
 *
 * Covers:
 *  - `ensurePlanForWeek`'s NO-PLAN CONTRACT: with no existing plan, it
 *    returns `{ plan: null }` synchronously-ish (zero
 *    network calls — `getMealPlanSuggestions` is never touched) and writes
 *    nothing to storage. This is the contract the next wave's Plan-screen
 *    UI task builds its empty state against.
 *  - `generatePlanFromPicks` called with an EMPTY pick list produces
 *    honestly empty days for every slot on every day (no pool-fill
 *    fallback removed per decision b) and still attaches `picksBySlot`
 *    (every bucket empty) so the resulting plan is unambiguously
 *    picks-only from the moment it exists.
 *  - `regenerateDay`/`regenerateWeek` on a picks-only plan (picksBySlot
 *    present) draw exclusively from `picksBySlot` — an id that exists ONLY
 *    in the mocked candidate pool never appears in the regenerated output.
 *
 * jsdom needed for the same reason as the sibling guard tests:
 * src/state/dailyPlan.js persists through src/api/storage.js, a real
 * localStorage wrapper.
 *
 * Each test/describe block uses its OWN fake condition id so
 * `planBuilder.js`'s internal `loadCandidates` session memo (keyed by
 * conditions CSV, module-scoped) never serves one test's mocked pool to
 * another within this file.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../adapter.js', () => ({
  getMealPlanSuggestions: vi.fn(),
}));

import { getMealPlanSuggestions } from '../adapter.js';
import { ensurePlanForWeek, generatePlanFromPicks, regenerateDay, regenerateWeek } from '../planBuilder.js';
import { setPlan, reloadPlan, getPlan } from '../../state/dailyPlan.js';
import { storage } from '../storage.js';
import { todayKey } from '../../screens/plan/planDates.js';

/** Minimal PlanItem shape (src/state/dailyPlan.js PlanItem typedef). */
const PICKED_BREAKFAST = {
  id: 1,
  name: 'Picked Oatmeal',
  image: '',
  group: 'f',
  fineGroup: 'f',
  tier: 'Top',
  numericId: 1,
  kind: 'food',
};

/** Exists ONLY in the mocked candidate pool — must never leak into a picks-only plan's output. */
const POOL_ONLY_BREAKFAST = {
  id: 999,
  name: 'Pool-only Pancakes',
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
  getMealPlanSuggestions.mockReset();
});

afterEach(() => {
  storage.clear();
  reloadPlan();
});

describe('ensurePlanForWeek: no-plan contract (picks-only default, decision b)', () => {
  it('returns a null plan and makes zero network calls when no plan exists yet', async () => {
    expect(getPlan()).toBeNull();

    const result = await ensurePlanForWeek({ conditions: [244] });

    expect(result).toEqual({ plan: null });
    expect(getMealPlanSuggestions).not.toHaveBeenCalled();
    expect(getPlan()).toBeNull(); // nothing was written to storage either
  });
});

describe('generatePlanFromPicks: zero picks -> honestly empty (no pool-fill fallback)', () => {
  it('produces empty slots for every day and every slot, even though the candidate pool has items', async () => {
    getMealPlanSuggestions.mockResolvedValue({
      candidates: {
        breakfast: [POOL_ONLY_BREAKFAST],
        lunch: [],
        dinner: [],
        snacks: [],
        beverages: [],
      },
      conditionIds: [501],
      conditionNames: ['Condition 501'],
      usedFallback: false,
    });

    const { plan } = await generatePlanFromPicks({ conditions: [501] }, []);

    expect(Object.keys(plan.days).length).toBe(7);
    for (const day of Object.values(plan.days)) {
      for (const items of Object.values(day.slots)) {
        expect(items).toEqual([]);
      }
    }

    // picksBySlot is ALWAYS attached now (decision b), even with every
    // bucket empty, marking the plan picks-only from the moment it exists.
    expect(plan.picksBySlot).toBeDefined();
    for (const bucket of Object.values(plan.picksBySlot)) {
      expect(bucket).toEqual([]);
    }
  });
});

describe('regenerateDay / regenerateWeek on a picks-only plan: picksBySlot only, pool never consulted', () => {
  function seedPicksOnlyPlan(conditionsKey) {
    const key = todayKey();
    const day = {
      generation: 0,
      offsets: {},
      slots: { breakfast: [PICKED_BREAKFAST], lunch: [], dinner: [], snacks: [], beverages: [] },
      eaten: [],
      pinned: [],
    };
    setPlan({
      version: 2,
      conditionsKey,
      conditionNames: ['Test Condition'],
      usedFallback: false,
      generation: 0,
      days: { [key]: day },
      picksBySlot: { breakfast: [PICKED_BREAKFAST], lunch: [], dinner: [], snacks: [], beverages: [] },
    });
    return key;
  }

  it('regenerateDay never introduces the pool-only id', async () => {
    getMealPlanSuggestions.mockResolvedValue({
      candidates: {
        breakfast: [POOL_ONLY_BREAKFAST],
        lunch: [],
        dinner: [],
        snacks: [],
        beverages: [],
      },
      conditionIds: [502],
      conditionNames: ['Condition 502'],
      usedFallback: false,
    });
    const key = seedPicksOnlyPlan('502');

    const plan = await regenerateDay({ conditions: [502] }, key);

    const allIds = Object.values(plan.days[key].slots).flatMap((items) => items.map((i) => i.id));
    expect(allIds).not.toContain(POOL_ONLY_BREAKFAST.id);
    expect(allIds.every((id) => id === PICKED_BREAKFAST.id)).toBe(true);
  });

  it('regenerateWeek never introduces the pool-only id across any day', async () => {
    getMealPlanSuggestions.mockResolvedValue({
      candidates: {
        breakfast: [POOL_ONLY_BREAKFAST],
        lunch: [],
        dinner: [],
        snacks: [],
        beverages: [],
      },
      conditionIds: [503],
      conditionNames: ['Condition 503'],
      usedFallback: false,
    });
    seedPicksOnlyPlan('503');

    const plan = await regenerateWeek({ conditions: [503] });

    for (const day of Object.values(plan.days)) {
      const allIds = Object.values(day.slots).flatMap((items) => items.map((i) => i.id));
      expect(allIds).not.toContain(POOL_ONLY_BREAKFAST.id);
    }
  });
});
