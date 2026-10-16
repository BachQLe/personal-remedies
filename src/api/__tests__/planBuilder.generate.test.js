// @vitest-environment jsdom
/**
 * planBuilder.generate.test.js — `favoritesBySlot` + `generateWeekFromFavorites`
 * (checklist 1.17 / 1.4 / 1.25 helper) and the rolling-window fill in
 * `ensurePlanForWeek` that shares its day-picking rules.
 *
 * The recipe overlay is mocked so meal types are deterministic; the injected
 * `rng` is a seeded PRNG so every assertion is repeatable.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { OVERLAY } = vi.hoisted(() => ({
  OVERLAY: [
    { foodItemID: 1, mealType: 'breakfast' },
    { foodItemID: 2, mealType: 'breakfast', alsoFits: ['beverage'] },
    { foodItemID: 10, mealType: 'lunch', alsoFits: ['dinner'] },
    { foodItemID: 11, mealType: 'lunch', alsoFits: ['dinner'] },
    { foodItemID: 12, mealType: 'lunch', alsoFits: ['dinner'] },
    { foodItemID: 13, mealType: 'lunch', alsoFits: ['dinner'] },
    { foodItemID: 14, mealType: 'lunch', alsoFits: ['dinner'] },
    { foodItemID: 20, mealType: 'dinner' },
    { foodItemID: 30, mealType: 'snack' },
    { foodItemID: 31, mealType: 'dessert' },
    { foodItemID: 40, mealType: 'beverage' },
  ],
}));

vi.mock('../recipeIngestion.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadRecipeOverlay: () => OVERLAY,
}));
vi.mock('../adapter.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getMealPlanSuggestions: vi.fn(),
  getConditionNames: vi.fn(async (ids) => ids.map((id) => `Condition ${id}`)),
}));

import { getMealPlanSuggestions } from '../adapter.js';
import {
  favoritesBySlot,
  generateWeekFromFavorites,
  ensurePlanForWeek,
  saveCurrentPlan,
  getActiveSavedPlan,
} from '../planBuilder.js';
import { PLAN_SLOTS, PLAN_SLOT_KEYS, RECIPES_PER_MEAL } from '../config.js';
import { getPlan, setPlan, reloadPlan } from '../../state/dailyPlan.js';
import { storage } from '../storage.js';
import { nextSevenDays } from '../../screens/plan/planDates.js';

const recipe = (id, name = `Recipe ${id}`, extra = {}) => ({
  id, name, image: null, group: null, fineGroup: null, tier: 'Top', numericId: 1, kind: 'recipe', ...extra,
});

/** mulberry32 — small seeded PRNG so "random" picks are repeatable. */
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ids = (items) => items.map((i) => i.id);
const PROFILE = { conditions: [203, 244] };

beforeEach(() => {
  storage.clear();
  reloadPlan();
  getMealPlanSuggestions.mockReset();
});
afterEach(() => {
  storage.clear();
  reloadPlan();
});

describe('3-per-meal constant', () => {
  it('RECIPES_PER_MEAL is 3 and every slot reads it', () => {
    expect(RECIPES_PER_MEAL).toBe(3);
    expect(PLAN_SLOTS.map((s) => s.size)).toEqual(PLAN_SLOT_KEYS.map(() => RECIPES_PER_MEAL));
  });
});

describe('favoritesBySlot', () => {
  it('uses the overlay mealType + alsoFits, and puts a recipe in every slot it fits', () => {
    const b = favoritesBySlot([recipe(1), recipe(2), recipe(10), recipe(20), recipe(40)]);
    expect(ids(b.breakfast)).toEqual([1, 2]);
    expect(ids(b.lunch)).toEqual([10]);
    expect(ids(b.dinner)).toEqual([10, 20]);
    expect(ids(b.beverages)).toEqual([2, 40]);
    expect(b.snacks).toEqual([]);
  });

  it('maps both snack and dessert to the snacks slot', () => {
    expect(ids(favoritesBySlot([recipe(30), recipe(31)]).snacks)).toEqual([30, 31]);
  });

  it('falls back to the title guess when the id is not in the overlay', () => {
    const b = favoritesBySlot([recipe(900, 'Oatmeal with Berries'), recipe(901, 'Garden Salad'), recipe(902, 'Chicken Roast'), recipe(903, 'Apple Pie')]);
    expect(ids(b.breakfast)).toEqual([900]);
    expect(ids(b.lunch)).toEqual([901]);
    expect(ids(b.dinner)).toEqual([902]);
    expect(ids(b.snacks)).toEqual([903]);
  });

  it('excludes items the save gate blocks (low-ranked, unscored, non-recipe) and duplicate ids', () => {
    const b = favoritesBySlot([
      recipe(1),
      recipe(1),
      recipe(10, 'x', { numericId: 5, tier: 'poor' }),
      recipe(11, 'x', { numericId: null, tier: null }),
      recipe(12, 'x', { kind: 'food' }),
    ]);
    expect(ids(b.breakfast)).toEqual([1]);
    expect(b.lunch).toEqual([]);
    expect(b.dinner).toEqual([]);
  });

  it('returns all five slot keys even for no favorites', () => {
    expect(Object.keys(favoritesBySlot(undefined))).toEqual(PLAN_SLOT_KEYS);
  });
});

describe('generateWeekFromFavorites', () => {
  const FAVORITES = [
    recipe(1), recipe(2),
    recipe(10), recipe(11), recipe(12), recipe(13), recipe(14), recipe(20),
    recipe(30), recipe(31),
    recipe(40),
  ];

  it('builds the 7-day window with <=3 distinct picks per slot and no recipe in two slots of a day', async () => {
    const result = await generateWeekFromFavorites(PROFILE, FAVORITES, { rng: seeded(7) });

    expect(result.ok).toBe(true);
    const days = Object.entries(result.plan.days);
    expect(days.map(([key]) => key)).toEqual(nextSevenDays().map((d) => d.key));
    for (const [, day] of days) {
      const placed = [];
      for (const key of PLAN_SLOT_KEYS) {
        const slotIds = ids(day.slots[key]);
        expect(slotIds.length).toBeLessThanOrEqual(RECIPES_PER_MEAL);
        expect(new Set(slotIds).size).toBe(slotIds.length);
        placed.push(...slotIds);
      }
      expect(new Set(placed).size).toBe(placed.length);
    }
  });

  it('persists the plan, stores the buckets as picksBySlot, and stamps the conditions', async () => {
    const { plan } = await generateWeekFromFavorites(PROFILE, FAVORITES, { rng: seeded(1) });

    expect(plan.version).toBe(2);
    expect(plan.conditionsKey).toBe('203,244');
    expect(plan.conditionNames).toEqual(['Condition 203', 'Condition 244']);
    expect(ids(plan.picksBySlot.lunch)).toEqual([10, 11, 12, 13, 14]);
    expect(ids(plan.picksBySlot.snacks)).toEqual([30, 31]);
    expect(getPlan()).toEqual(plan);
    expect(storage.get('dailyPlan')).toEqual(plan);
  });

  it('is deterministic for a seed and varies with it', async () => {
    const run = async (seed) => (await generateWeekFromFavorites(PROFILE, FAVORITES, { rng: seeded(seed) })).plan.days;
    expect(await run(5)).toEqual(await run(5));
    expect(await run(5)).not.toEqual(await run(6));
  });

  it('gives a short bucket a short slot, never padding from another slot', async () => {
    const { plan } = await generateWeekFromFavorites(PROFILE, [recipe(1), recipe(30), recipe(31)], { rng: seeded(2) });
    for (const day of Object.values(plan.days)) {
      expect(ids(day.slots.breakfast)).toEqual([1]);
      expect(ids(day.slots.snacks).sort()).toEqual([30, 31]);
    }
  });

  it('leaves a slot with an empty bucket empty on every day', async () => {
    const { plan } = await generateWeekFromFavorites(PROFILE, [recipe(1), recipe(40)], { rng: seeded(3) });
    for (const day of Object.values(plan.days)) {
      expect(day.slots.lunch).toEqual([]);
      expect(day.slots.dinner).toEqual([]);
      expect(day.slots.snacks).toEqual([]);
    }
  });

  it('allows repeats across days (a 3-recipe bucket shows all 3 on every day)', async () => {
    const { plan } = await generateWeekFromFavorites(PROFILE, [recipe(10), recipe(11), recipe(12)], { rng: seeded(4) });
    // 10-12 fit lunch AND dinner; lunch is processed first (tie), so it keeps all three.
    for (const day of Object.values(plan.days)) {
      expect(ids(day.slots.lunch).sort()).toEqual([10, 11, 12]);
    }
  });

  it('does not let a two-slot recipe starve the scarcer slot (breakfast+beverage recipe still fills beverages)', async () => {
    const { plan } = await generateWeekFromFavorites(PROFILE, [recipe(1), recipe(2)], { rng: seeded(8) });
    for (const day of Object.values(plan.days)) {
      expect(ids(day.slots.beverages)).toEqual([2]);
      expect(ids(day.slots.breakfast)).toEqual([1]);
    }
  });

  it('leaves out blocked favorites', async () => {
    const blocked = recipe(10, 'x', { numericId: 6, tier: 'poor' });
    const { plan } = await generateWeekFromFavorites(PROFILE, [blocked, recipe(11)], { rng: seeded(9) });
    const everyId = Object.values(plan.days).flatMap((d) => Object.values(d.slots).flatMap(ids));
    expect(everyId).not.toContain(10);
    expect(everyId).toContain(11);
  });

  it('refuses with no-favorites and leaves the live plan alone when nothing is usable', async () => {
    const before = { version: 2, conditionsKey: '203,244', conditionNames: [], days: {} };
    setPlan(before);

    const result = await generateWeekFromFavorites(PROFILE, [recipe(10, 'x', { numericId: 7, tier: 'poor' })]);

    expect(result).toEqual({ ok: false, reason: 'no-favorites' });
    expect(getPlan()).toBe(before);
  });

  it('clears the active-saved-plan pointer', async () => {
    setPlan({ version: 2, conditionsKey: '1', conditionNames: [], days: { '2020-01-01': { slots: {}, eaten: [] } } });
    saveCurrentPlan('Old');
    expect(getActiveSavedPlan()).not.toBeNull();

    await generateWeekFromFavorites(PROFILE, FAVORITES, { rng: seeded(1) });

    expect(getActiveSavedPlan()).toBeNull();
  });

  it('never calls the suggestion pools', async () => {
    await generateWeekFromFavorites(PROFILE, FAVORITES, { rng: seeded(1) });
    expect(getMealPlanSuggestions).not.toHaveBeenCalled();
  });
});

describe('ensurePlanForWeek: trailing-day fill follows the same rules', () => {
  it('fills a missing day from picksBySlot with <=3 distinct picks, no cross-slot duplicate, and drops rolled-out days', async () => {
    const FAVORITES = [recipe(10), recipe(11), recipe(12), recipe(13), recipe(14), recipe(20), recipe(1), recipe(2), recipe(40)];
    const { plan: generated } = await generateWeekFromFavorites(PROFILE, FAVORITES, { rng: seeded(11) });

    const keys = nextSevenDays().map((d) => d.key);
    const lastKey = keys[6];
    const { [lastKey]: removed, ...rest } = generated.days; // the day that "rolls in"
    expect(removed).toBeDefined();
    setPlan({ ...generated, days: { '2000-01-01': { slots: {}, eaten: [] }, ...rest } });

    const { plan } = await ensurePlanForWeek(PROFILE, { rng: seeded(12) });

    expect(Object.keys(plan.days).sort()).toEqual(keys);
    expect(plan.days[keys[0]]).toBe(rest[keys[0]]); // kept days untouched
    const placed = [];
    for (const key of PLAN_SLOT_KEYS) {
      const slotIds = ids(plan.days[lastKey].slots[key]);
      expect(slotIds.length).toBeLessThanOrEqual(RECIPES_PER_MEAL);
      expect(new Set(slotIds).size).toBe(slotIds.length);
      placed.push(...slotIds);
      for (const id of slotIds) expect(ids(plan.picksBySlot[key])).toContain(id);
    }
    expect(new Set(placed).size).toBe(placed.length);
  });
});
