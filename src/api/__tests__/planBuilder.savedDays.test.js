// @vitest-environment jsdom
/**
 * planBuilder.savedDays.test.js — Save Day / Load Day (checklist 1.20):
 * `saveDay`, `getSavedDays`, `deleteSavedDay`, `restoreSavedDay`,
 * `loadSavedDay`. Saved WEEKS are covered by planBuilder.savedPlans.test.js.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  saveDay,
  getSavedDays,
  deleteSavedDay,
  restoreSavedDay,
  loadSavedDay,
} from '../planBuilder.js';
import { MAX_SAVED_DAYS } from '../config.js';
import { getPlan, setPlan, reloadPlan, removeFromSlot, addToSlot } from '../../state/dailyPlan.js';
import { storage } from '../storage.js';

const item = (id) => ({ id, name: `Recipe ${id}`, image: null, tier: 'Top', numericId: 1, kind: 'recipe' });
const slots = (over = {}) => ({ breakfast: [], lunch: [], dinner: [], snacks: [], beverages: [], ...over });

const D1 = '2030-01-01';
const D2 = '2030-01-02';

function seedPlan() {
  setPlan({
    version: 2,
    conditionsKey: '1',
    conditionNames: [],
    days: {
      [D1]: { slots: slots({ breakfast: [item(1)], lunch: [item(2), item(3)] }), eaten: [1] },
      [D2]: { slots: slots({ dinner: [item(9)] }), eaten: [9] },
    },
  });
}

beforeEach(() => {
  storage.clear();
  reloadPlan();
});
afterEach(() => {
  storage.clear();
  reloadPlan();
});

describe('saveDay / getSavedDays', () => {
  it('starts empty, and snapshots only that day\'s slots under storage key savedDays', () => {
    expect(getSavedDays()).toEqual([]);
    seedPlan();

    const result = saveDay(D1, '  Easy Monday ');

    expect(result.ok).toBe(true);
    expect(result.entry).toEqual({
      id: expect.any(String),
      name: 'Easy Monday',
      savedAt: expect.any(String),
      slots: getPlan().days[D1].slots,
    });
    expect(result.entry).not.toHaveProperty('eaten');
    expect(getSavedDays()).toEqual([result.entry]);
    expect(storage.get('savedDays')).toEqual([result.entry]);
  });

  it('names a blank save "Day N"', () => {
    seedPlan();
    expect(saveDay(D1, '').entry.name).toBe('Day 1');
    expect(saveDay(D2, '   ').entry.name).toBe('Day 2');
    expect(saveDay(D1).entry.name).toBe('Day 3');
  });

  it('returns no-day for a date that is not in the live plan, or with no plan at all', () => {
    expect(saveDay(D1, 'x')).toEqual({ ok: false, reason: 'no-day' });
    seedPlan();
    expect(saveDay('1999-01-01', 'x')).toEqual({ ok: false, reason: 'no-day' });
    expect(getSavedDays()).toEqual([]);
  });

  it('blocks at MAX_SAVED_DAYS without evicting anything', () => {
    seedPlan();
    for (let i = 0; i < MAX_SAVED_DAYS; i++) expect(saveDay(D1, `Day ${i}`).ok).toBe(true);
    const before = getSavedDays();

    expect(saveDay(D1, 'one too many')).toEqual({ ok: false, reason: 'at-cap' });
    expect(getSavedDays()).toEqual(before);
  });

  it('keeps the snapshot independent of later edits to the live day', () => {
    seedPlan();
    const { entry } = saveDay(D1, 'Snap');
    addToSlot(D1, 'dinner', item(77));
    removeFromSlot(D1, 'lunch', 2);

    expect(getSavedDays()[0].slots).toEqual(entry.slots);
    expect(getSavedDays()[0].slots.lunch.map((i) => i.id)).toEqual([2, 3]);
  });
});

describe('deleteSavedDay / restoreSavedDay', () => {
  it('deletes by id (false when unknown) and restores the entry verbatim for Undo', () => {
    seedPlan();
    const { entry } = saveDay(D1, 'Keep');
    expect(deleteSavedDay('nope')).toBe(false);

    expect(deleteSavedDay(entry.id)).toBe(true);
    expect(getSavedDays()).toEqual([]);

    restoreSavedDay(entry);
    expect(getSavedDays()).toEqual([entry]);
    restoreSavedDay(entry); // double-invoked Undo
    expect(getSavedDays()).toHaveLength(1);
  });

  it('restore is not subject to the cap (hands back what the user had)', () => {
    seedPlan();
    for (let i = 0; i < MAX_SAVED_DAYS; i++) saveDay(D1, `Day ${i}`);
    const [first] = getSavedDays();
    deleteSavedDay(first.id);
    saveDay(D1, 'filled the freed slot');
    expect(getSavedDays()).toHaveLength(MAX_SAVED_DAYS);

    restoreSavedDay(first);
    expect(getSavedDays()).toHaveLength(MAX_SAVED_DAYS + 1);
  });

  it('ignores a malformed entry', () => {
    restoreSavedDay(null);
    restoreSavedDay({ name: 'no id' });
    expect(getSavedDays()).toEqual([]);
  });
});

describe('loadSavedDay', () => {
  it('replaces that day\'s slots, clears only that day\'s eaten, and leaves other days alone', () => {
    seedPlan();
    const { entry } = saveDay(D1, 'Easy Monday');

    const result = loadSavedDay(entry.id, D2);

    expect(result).toEqual({ ok: true });
    const plan = getPlan();
    expect(plan.days[D2].slots).toEqual(entry.slots);
    expect(plan.days[D2].eaten).toEqual([]);
    expect(plan.days[D1].eaten).toEqual([1]);
    expect(plan.days[D1].slots.breakfast.map((i) => i.id)).toEqual([1]);
    expect(storage.get('dailyPlan').days[D2].slots).toEqual(entry.slots);
  });

  it('hands the live day its own copy: editing it never changes the saved day', () => {
    seedPlan();
    const { entry } = saveDay(D1, 'Easy Monday');
    loadSavedDay(entry.id, D2);

    removeFromSlot(D2, 'lunch', 2);
    addToSlot(D2, 'dinner', item(55));

    expect(getSavedDays()[0].slots).toEqual(entry.slots);
    expect(getSavedDays()).toHaveLength(1); // entry stays in the list
  });

  it('reports not-found, no-day', () => {
    seedPlan();
    const { entry } = saveDay(D1, 'x');
    expect(loadSavedDay('missing', D1)).toEqual({ ok: false, reason: 'not-found' });
    expect(loadSavedDay(entry.id, '1999-01-01')).toEqual({ ok: false, reason: 'no-day' });
  });
});
