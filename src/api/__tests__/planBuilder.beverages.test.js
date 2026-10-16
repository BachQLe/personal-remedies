// @vitest-environment jsdom
/**
 * planBuilder.beverages.test.js — Guard tests for the Beverages meal slot.
 *
 * Covers:
 *  (i)  a pre-restoration ("4-slot era") plan fixture — a day whose
 *       `slots` object has NO `beverages` key at all — survives
 *       `ensurePlanForWeek` without crashing. The legacy day is KEPT
 *       untouched (not retrofitted with a `beverages` key), and reading it
 *       via the `?? []` tolerance pattern every consumer is expected to use
 *       (see config.js's `PLAN_SLOTS` doc) yields an honestly empty array.
 *       Every OTHER (freshly generated) day in the window gets a real
 *       `beverages` array drawn from the plan's `picksBySlot`.
 *  (vi) `inferSlotKey` routes fine group 'h2' to 'beverages' again (the
 *       restored short-circuit) instead of falling through to the
 *       default-to-'lunch' case.
 *
 * jsdom: src/state/dailyPlan.js persists through src/api/storage.js.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../adapter.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getMealPlanSuggestions: vi.fn(),
}));

import { ensurePlanForWeek, inferSlotKey } from '../planBuilder.js';
import { setPlan, reloadPlan } from '../../state/dailyPlan.js';
import { storage } from '../storage.js';
import { todayKey, nextSevenDays } from '../../screens/plan/planDates.js';

const BEVERAGE_PICK = {
  id: 9101,
  name: 'Green Tea',
  image: '',
  group: 'h',
  fineGroup: 'h2',
  tier: 'Top',
  numericId: 1,
  kind: 'food',
};

beforeEach(() => {
  storage.clear();
  reloadPlan();
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
  it('keeps the legacy day untouched and fills beverages from picks for the rest of the week', async () => {
    const key = todayKey();
    const legacyDay = {
      // NO `beverages` key — the exact shape a day persisted during the
      // July-August 2026 4-slot era has.
      slots: { breakfast: [], lunch: [], dinner: [], snacks: [] },
      eaten: [],
    };
    setPlan({
      version: 2,
      conditionsKey: '401',
      conditionNames: ['Condition 401'],
      days: { [key]: legacyDay },
      picksBySlot: { breakfast: [], lunch: [], dinner: [], snacks: [], beverages: [BEVERAGE_PICK] },
    });

    const { plan } = await ensurePlanForWeek({ conditions: [401] });

    // The legacy day survives completely untouched — no `beverages` key was
    // silently added to it (it's still inside the rolling window, so it's
    // "kept", never rebuilt).
    expect(plan.days[key]).toBe(legacyDay);
    expect(Object.prototype.hasOwnProperty.call(plan.days[key].slots, 'beverages')).toBe(false);
    expect(plan.days[key].slots.beverages ?? []).toEqual([]);

    const otherKeys = nextSevenDays().map((d) => d.key).filter((k) => k !== key);
    expect(otherKeys.length).toBeGreaterThan(0);
    for (const k of otherKeys) {
      expect(plan.days[k].slots.beverages).toEqual([expect.objectContaining({ id: BEVERAGE_PICK.id })]);
    }
  });
});
