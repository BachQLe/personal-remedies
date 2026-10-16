// @vitest-environment jsdom
/**
 * favoritesPrune.test.js — condition-change pruning of favorites, saved days
 * and saved weeks (checklist 1.26 / 3.4).
 *
 * Covers the pending flag, `findRecipesToPrune` (low-ranked ids only, unknown
 * ids kept, failed fetch is `{ ok: false }`, never "nothing to remove"),
 * `applyFavoritesPrune` (exact removal everywhere, score refresh, saved-week
 * re-stamp, flag cleared) and the refusals while the flag is pending.
 *
 * `getRecipes` is mocked; library/storage are real (jsdom).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../adapter.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getRecipes: vi.fn(),
  getConditionNames: vi.fn(async (ids) => ids.map((id) => `Condition ${id}`)),
}));

import { getRecipes } from '../adapter.js';
import {
  markFavoritesPrunePending,
  isFavoritesPrunePending,
  findRecipesToPrune,
  applyFavoritesPrune,
} from '../favoritesPrune.js';
import {
  generateWeekFromFavorites,
  loadSavedDay,
  loadSavedPlan,
  ensurePlanForWeek,
  getSavedDays,
  getSavedPlans,
} from '../planBuilder.js';
import { getLibrary, addToLibrary, reloadLibrary } from '../../state/library.js';
import { getPlan, setPlan, reloadPlan } from '../../state/dailyPlan.js';
import { storage } from '../storage.js';
import { todayKey } from '../../screens/plan/planDates.js';

const fav = (id, name, numericId = 1, tier = 'Top') => ({
  id, name, image: null, group: null, fineGroup: null, tier, numericId, kind: 'recipe',
});
const scored = (id, numericId, tier = null) => ({ id, numericId, tier });
const slots = (over = {}) => ({ breakfast: [], lunch: [], dinner: [], snacks: [], beverages: [], ...over });
const ids = (items) => items.map((i) => i.id);

const NEW_PROFILE = { conditions: [7, 8] };

function seed() {
  addToLibrary(fav(1, 'Low One'));
  addToLibrary(fav(2, 'Fine Two'));
  addToLibrary(fav(3, 'Low Three'));
  addToLibrary(fav(4, 'Unmentioned Four'));

  storage.set('savedDays', [
    { id: 'd1', name: 'Day A', savedAt: 'x', slots: slots({ breakfast: [fav(1, 'Low One'), fav(2, 'Fine Two')], lunch: [fav(9, 'Unknown Nine')] }) },
    { id: 'd2', name: 'Day B', savedAt: 'x', slots: slots({ dinner: [fav(3, 'Low Three')] }) },
  ]);
  const week = (id) => ({
    id,
    name: id,
    savedAt: 'x',
    plan: {
      version: 2,
      conditionsKey: 'old',
      conditionNames: ['Old'],
      days: { '2020-01-01': { slots: slots({ breakfast: [fav(1, 'Low One'), fav(2, 'Fine Two')], dinner: [fav(4, 'Unmentioned Four')] }), eaten: [] } },
      picksBySlot: slots({ breakfast: [fav(1, 'Low One'), fav(2, 'Fine Two')], dinner: [fav(4, 'Unmentioned Four')] }),
    },
  });
  storage.set('savedPlans', [week('w1'), week('w2')]);
}

/** The API now ranks 1 and 3 low, 2 fine (and nicer than before), 4 not at all. */
function mockScoring() {
  getRecipes.mockResolvedValue({
    recipes: [scored(1, 6, 'poor'), scored(2, 2, 'Strong'), scored(3, 5, 'poor'), scored(99, 7, 'poor')],
    unscorableReason: null,
  });
}

beforeEach(() => {
  storage.clear();
  reloadLibrary();
  reloadPlan();
  getRecipes.mockReset();
});
afterEach(() => {
  storage.clear();
  reloadLibrary();
  reloadPlan();
});

describe('pending flag', () => {
  it('is persisted through storage and starts clear', () => {
    expect(isFavoritesPrunePending()).toBe(false);
    markFavoritesPrunePending();
    expect(isFavoritesPrunePending()).toBe(true);
    expect(storage.get('favoritesPrunePending')).toBe(true);
  });
});

describe('findRecipesToPrune', () => {
  it('lists only newly low-ranked ids that are actually stored, deduped across favorites / days / weeks', async () => {
    seed();
    mockScoring();

    const result = await findRecipesToPrune(NEW_PROFILE);

    expect(result.ok).toBe(true);
    expect(result.recipes).toEqual([
      { id: 1, name: 'Low One' },
      { id: 3, name: 'Low Three' },
    ]); // 99 is low-ranked but nowhere stored; 2 fine; 4 and 9 not mentioned
    expect(getRecipes).toHaveBeenCalledWith(NEW_PROFILE);
  });

  it('finds a recipe that lives only in a saved week or saved day', async () => {
    storage.set('savedDays', [{ id: 'd', name: 'D', savedAt: 'x', slots: slots({ snacks: [fav(5, 'Day Only')] }) }]);
    storage.set('savedPlans', [{ id: 'w', name: 'W', savedAt: 'x', plan: { version: 2, conditionsKey: '', conditionNames: [], days: {}, picksBySlot: slots({ lunch: [fav(6, 'Pick Only')] }) } }]);
    getRecipes.mockResolvedValue({ recipes: [scored(5, 5, 'poor'), scored(6, 7, 'poor')], unscorableReason: null });

    const result = await findRecipesToPrune(NEW_PROFILE);

    expect(result.recipes.map((r) => r.id).sort()).toEqual([5, 6]);
  });

  it('returns ok:false when scoring cannot be fetched — never "nothing to remove"', async () => {
    seed();
    getRecipes.mockRejectedValue(new Error('network down'));

    expect(await findRecipesToPrune(NEW_PROFILE)).toEqual({ ok: false });
  });

  it('is ok with nothing to remove for no conditions or conditions the API cannot score', async () => {
    seed();
    getRecipes.mockResolvedValue({ recipes: [], unscorableReason: null });
    expect(await findRecipesToPrune({ conditions: [] })).toMatchObject({ ok: true, recipes: [] });

    getRecipes.mockResolvedValue({ recipes: [], unscorableReason: "We can't score food for X yet." });
    expect(await findRecipesToPrune(NEW_PROFILE)).toMatchObject({ ok: true, recipes: [] });
  });

  it('leaves recipes the new scoring returns unscored alone', async () => {
    seed();
    getRecipes.mockResolvedValue({ recipes: [scored(1, null, null)], unscorableReason: null });
    expect((await findRecipesToPrune(NEW_PROFILE)).recipes).toEqual([]);
  });
});

describe('applyFavoritesPrune', () => {
  it('removes exactly the listed ids from the library, saved days and saved weeks (days + picks)', async () => {
    seed();
    mockScoring();
    markFavoritesPrunePending();

    const result = await findRecipesToPrune(NEW_PROFILE);
    expect(await applyFavoritesPrune(result, NEW_PROFILE)).toEqual({ ok: true });

    expect(ids(getLibrary())).toEqual([2, 4]); // order preserved
    expect(ids(storage.get('library'))).toEqual([2, 4]);

    const [d1, d2] = getSavedDays();
    expect(ids(d1.slots.breakfast)).toEqual([2]);
    expect(ids(d1.slots.lunch)).toEqual([9]); // unknown id kept
    expect(d2.slots.dinner).toEqual([]);
    expect(d1.name).toBe('Day A');

    for (const week of getSavedPlans()) {
      expect(ids(week.plan.days['2020-01-01'].slots.breakfast)).toEqual([2]);
      expect(ids(week.plan.days['2020-01-01'].slots.dinner)).toEqual([4]);
      expect(ids(week.plan.picksBySlot.breakfast)).toEqual([2]);
      expect(ids(week.plan.picksBySlot.dinner)).toEqual([4]);
    }
  });

  it('refreshes numericId/tier on surviving favorites from the new scores, and leaves unmentioned ones as they were', async () => {
    seed();
    mockScoring();
    await applyFavoritesPrune(await findRecipesToPrune(NEW_PROFILE), NEW_PROFILE);

    const byId = Object.fromEntries(getLibrary().map((f) => [f.id, f]));
    expect(byId[2]).toMatchObject({ numericId: 2, tier: 'Strong', name: 'Fine Two' });
    expect(byId[4]).toMatchObject({ numericId: 1, tier: 'Top' });
  });

  it('re-stamps every saved week for the new profile, so a loaded week survives ensurePlanForWeek', async () => {
    seed();
    mockScoring();
    await applyFavoritesPrune(await findRecipesToPrune(NEW_PROFILE), NEW_PROFILE);

    for (const week of getSavedPlans()) {
      expect(week.plan.conditionsKey).toBe('7,8');
      expect(week.plan.conditionNames).toEqual(['Condition 7', 'Condition 8']);
    }

    expect(loadSavedPlan('w1')).toBe(true);
    const { plan } = await ensurePlanForWeek(NEW_PROFILE);
    expect(plan).not.toBeNull(); // not discarded as "built for other conditions"
    expect(getPlan()).not.toBeNull();
  });

  it('clears the flag even when nothing needed removing', async () => {
    seed();
    getRecipes.mockResolvedValue({ recipes: [scored(2, 2, 'Strong')], unscorableReason: null });
    markFavoritesPrunePending();

    const result = await findRecipesToPrune(NEW_PROFILE);
    expect(result.recipes).toEqual([]);
    await applyFavoritesPrune(result, NEW_PROFILE);

    expect(isFavoritesPrunePending()).toBe(false);
    expect(ids(getLibrary())).toEqual([1, 2, 3, 4]);
  });

  it('keeps the flag and removes nothing when handed a failed lookup', async () => {
    seed();
    getRecipes.mockRejectedValue(new Error('offline'));
    markFavoritesPrunePending();

    const result = await findRecipesToPrune(NEW_PROFILE);
    expect(await applyFavoritesPrune(result, NEW_PROFILE)).toEqual({ ok: false });

    expect(isFavoritesPrunePending()).toBe(true);
    expect(ids(getLibrary())).toEqual([1, 2, 3, 4]);
    expect(getSavedPlans()[0].plan.conditionsKey).toBe('old');
  });
});

describe('while the prune is pending', () => {
  const key = todayKey();
  const livePlan = () => ({ version: 2, conditionsKey: '7,8', conditionNames: [], days: { [key]: { slots: slots(), eaten: [] } } });

  it('generateWeekFromFavorites, loadSavedDay and loadSavedPlan refuse and change nothing', async () => {
    seed();
    setPlan(livePlan());
    storage.set('savedDays', [{ id: 'd1', name: 'A', savedAt: 'x', slots: slots({ lunch: [fav(2, 'Fine Two')] }) }]);
    markFavoritesPrunePending();
    const before = getPlan();

    expect(await generateWeekFromFavorites(NEW_PROFILE, getLibrary())).toEqual({ ok: false, reason: 'prune-pending' });
    expect(loadSavedDay('d1', key)).toEqual({ ok: false, reason: 'prune-pending' });
    expect(loadSavedPlan('w1')).toBe(false);

    expect(getPlan()).toBe(before);
  });

  it('works again once the prune has been applied', async () => {
    seed();
    mockScoring();
    setPlan(livePlan());
    markFavoritesPrunePending();

    await applyFavoritesPrune(await findRecipesToPrune(NEW_PROFILE), NEW_PROFILE);

    expect(loadSavedPlan('w1')).toBe(true);
    const generated = await generateWeekFromFavorites(NEW_PROFILE, getLibrary());
    expect(generated.ok).toBe(true);
  });
});
