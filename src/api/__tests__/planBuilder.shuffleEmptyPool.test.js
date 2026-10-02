// @vitest-environment jsdom
/**
 * planBuilder.shuffleEmptyPool.test.js — Guard test for the shuffle-deletes
 * bug fixed alongside Task 11-13 ("Shuffle bug: `shuffleSlot` with an empty
 * pool deletes unpinned items").
 *
 * `shuffleSlot` calls `fillSlots` for just the one slot being shuffled.
 * `fillSlots` treats every non-pinned position as a hole to refill and, with
 * zero candidates in the pool to refill from, used to just drop those holes
 * from its output — i.e. a slot whose candidate pool came back empty (a
 * quota outage, or a slot with no live /suggest data) would have its
 * unpinned items silently DELETED by a Shuffle tap, rather than nothing
 * happening. `shuffleSlot` now bails out and returns the plan unchanged
 * (an honest no-op) whenever that slot's pool is empty.
 *
 * Needs jsdom for the same reason as the sibling guard tests:
 * src/state/dailyPlan.js persists through src/api/storage.js, a real
 * localStorage wrapper.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../adapter.js', () => ({
  getMealPlanSuggestions: vi.fn(),
}));

import { getMealPlanSuggestions } from '../adapter.js';
import { shuffleSlot } from '../planBuilder.js';
import { setPlan, reloadPlan, getPlan } from '../../state/dailyPlan.js';
import { storage } from '../storage.js';
import { todayKey } from '../../screens/plan/planDates.js';

const EXISTING_ITEM = {
  id: 701,
  name: 'Existing Lunch Recipe',
  image: '',
  group: 'l',
  fineGroup: 'l',
  tier: 'Top',
  numericId: 1,
  kind: 'recipe',
};

function emptyCandidates() {
  return { breakfast: [], lunch: [], dinner: [], snacks: [], beverages: [] };
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

describe('shuffleSlot: empty candidate pool is a no-op, never deletes unpinned items', () => {
  it('leaves an unpinned item in place when the slot pool is empty', async () => {
    getMealPlanSuggestions.mockResolvedValue({
      candidates: emptyCandidates(), // lunch pool is empty
      conditionIds: [601],
      conditionNames: ['Condition 601'],
      usedFallback: false,
    });

    const key = todayKey();
    const day = {
      generation: 0,
      offsets: { lunch: 0 },
      slots: { breakfast: [], lunch: [EXISTING_ITEM], dinner: [], snacks: [], beverages: [] },
      eaten: [],
      pinned: [], // deliberately UNPINNED — this is exactly what used to vanish
    };
    setPlan({
      version: 2,
      conditionsKey: '601',
      conditionNames: ['Condition 601'],
      usedFallback: false,
      generation: 0,
      days: { [key]: day },
    });

    const plan = await shuffleSlot({ conditions: [601] }, key, 'lunch');

    expect(plan).not.toBeNull();
    expect(plan.days[key].slots.lunch).toEqual([EXISTING_ITEM]);
    // A genuine no-op: the stored plan is untouched too (getPlan() reflects
    // the same unchanged state shuffleSlot returned).
    expect(getPlan().days[key].slots.lunch).toEqual([EXISTING_ITEM]);
  });

  it('leaves the slot offset unchanged too', async () => {
    getMealPlanSuggestions.mockResolvedValue({
      candidates: emptyCandidates(),
      conditionIds: [602],
      conditionNames: ['Condition 602'],
      usedFallback: false,
    });

    const key = todayKey();
    const day = {
      generation: 0,
      offsets: { lunch: 5 },
      slots: { breakfast: [], lunch: [EXISTING_ITEM], dinner: [], snacks: [], beverages: [] },
      eaten: [],
      pinned: [],
    };
    setPlan({
      version: 2,
      conditionsKey: '602',
      conditionNames: ['Condition 602'],
      usedFallback: false,
      generation: 0,
      days: { [key]: day },
    });

    const plan = await shuffleSlot({ conditions: [602] }, key, 'lunch');

    expect(plan.days[key].offsets.lunch).toBe(5);
  });
});
