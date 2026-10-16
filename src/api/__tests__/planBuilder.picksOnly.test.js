// @vitest-environment jsdom
/**
 * planBuilder.picksOnly.test.js — "no pool path survives" guard (checklist
 * 1.3): `ensurePlanForWeek` never consults the suggestion candidate pools.
 *
 *  - With no stored plan it returns `{ plan: null }` and writes nothing.
 *  - A legacy plan with no `picksBySlot` is returned as-is — missing trailing
 *    days are NOT auto-filled from the pools.
 *  - With `picksBySlot`, missing days come from the picks only.
 *  - In every case `getMealPlanSuggestions` is never called.
 *
 * jsdom: src/state/dailyPlan.js persists through src/api/storage.js.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../adapter.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getMealPlanSuggestions: vi.fn(),
}));

import { getMealPlanSuggestions } from '../adapter.js';
import { ensurePlanForWeek } from '../planBuilder.js';
import { setPlan, reloadPlan, getPlan } from '../../state/dailyPlan.js';
import { storage } from '../storage.js';
import { todayKey, nextSevenDays } from '../../screens/plan/planDates.js';

const PICKED_BREAKFAST = { id: 1, name: 'Picked Oatmeal', image: '', group: 'f', fineGroup: 'f', tier: 'Top', numericId: 1, kind: 'food' };

const emptySlots = () => ({ breakfast: [], lunch: [], dinner: [], snacks: [], beverages: [] });

function seedPlan(extra = {}) {
  const key = todayKey();
  setPlan({
    version: 2,
    conditionsKey: '502',
    conditionNames: ['Test Condition'],
    days: { [key]: { slots: { ...emptySlots(), breakfast: [PICKED_BREAKFAST] }, eaten: [] } },
    ...extra,
  });
  return key;
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

describe('ensurePlanForWeek: never touches the suggestion pools', () => {
  it('returns a null plan and writes nothing when no plan exists yet', async () => {
    expect(getPlan()).toBeNull();

    const result = await ensurePlanForWeek({ conditions: [244] });

    expect(result).toEqual({ plan: null });
    expect(getMealPlanSuggestions).not.toHaveBeenCalled();
    expect(getPlan()).toBeNull();
  });

  it('returns a legacy plan with no picksBySlot unchanged — trailing days are not pool-filled', async () => {
    seedPlan(); // no picksBySlot
    const before = getPlan();

    const { plan } = await ensurePlanForWeek({ conditions: [502] });

    expect(plan).toBe(before);
    expect(Object.keys(plan.days)).toHaveLength(1);
    expect(getMealPlanSuggestions).not.toHaveBeenCalled();
  });

  it('fills missing days from picksBySlot only, without calling the pools', async () => {
    const key = seedPlan({ picksBySlot: { ...emptySlots(), breakfast: [PICKED_BREAKFAST] } });

    const { plan } = await ensurePlanForWeek({ conditions: [502] });

    const others = nextSevenDays().map((d) => d.key).filter((k) => k !== key);
    expect(others).toHaveLength(6);
    for (const k of others) {
      const ids = Object.values(plan.days[k].slots).flatMap((items) => items.map((i) => i.id));
      expect(ids).toEqual([PICKED_BREAKFAST.id]);
    }
    expect(getMealPlanSuggestions).not.toHaveBeenCalled();
  });
});
