// @vitest-environment jsdom
/**
 * planBuilder.savedPlans.test.js — Guard tests for Task A/B/C (#14/#15/#16,
 * 2026-09): `updateSavedPlan`, `planFingerprint`, `loadSavedPlan`'s
 * position-based refit onto the current rolling window, and the
 * active-saved-plan pointer's set/clear lifecycle.
 *
 * jsdom needed for the same reason as the sibling guard tests:
 * src/state/dailyPlan.js persists through src/api/storage.js, a real
 * localStorage wrapper.
 *
 * Each `describe` block uses its own fake condition id so planBuilder.js's
 * internal `loadCandidates` session memo (keyed by conditions CSV,
 * module-scoped) never serves one test's mocked pool to another within this
 * file.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../adapter.js', () => ({
  getMealPlanSuggestions: vi.fn(),
}));

import { getMealPlanSuggestions } from '../adapter.js';
import {
  saveCurrentPlan,
  updateSavedPlan,
  loadSavedPlan,
  deleteSavedPlan,
  getSavedPlans,
  planFingerprint,
  getActiveSavedPlan,
  clearActiveSavedPlan,
  generatePlanFromPicks,
  ensurePlanForWeek,
  purgeDerivedDataForConditionsChange,
} from '../planBuilder.js';
import { setPlan, reloadPlan, getPlan } from '../../state/dailyPlan.js';
import { storage } from '../storage.js';
import { nextSevenDays } from '../../screens/plan/planDates.js';
import { MAX_SAVED_PLANS } from '../config.js';

/** Minimal PlanItem shape (src/state/dailyPlan.js PlanItem typedef). */
const ITEM_A = { id: 1, name: 'Oatmeal', image: '', group: 'f', fineGroup: 'f', tier: 'Top', numericId: 1, kind: 'food' };
const ITEM_B = { id: 2, name: 'Yogurt', image: '', group: 'g', fineGroup: 'g1', tier: 'Top', numericId: 1, kind: 'food' };

function emptySlots() {
  return { breakfast: [], lunch: [], dinner: [], snacks: [], beverages: [] };
}

/** A minimal but shape-valid WeeklyPlan (version 2), one day. */
function makePlan({ conditionsKey = '1', dateKey, slots, eaten = [], pinned = [] }) {
  return {
    version: 2,
    conditionsKey,
    conditionNames: [],
    usedFallback: false,
    generation: 0,
    days: {
      [dateKey]: { generation: 0, offsets: {}, slots: { ...emptySlots(), ...slots }, eaten, pinned },
    },
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

describe('planFingerprint', () => {
  it('is stable across different day KEYS as long as day POSITION (sorted order) and content match', () => {
    const planA = makePlan({ dateKey: '2020-01-01', slots: { breakfast: [ITEM_A] } });
    const planB = makePlan({ dateKey: '2099-06-15', slots: { breakfast: [ITEM_A] } });
    expect(planFingerprint(planA)).toBe(planFingerprint(planB));
  });

  it('ignores `eaten` status', () => {
    const planA = makePlan({ dateKey: '2020-01-01', slots: { breakfast: [ITEM_A] }, eaten: [] });
    const planB = makePlan({ dateKey: '2020-01-01', slots: { breakfast: [ITEM_A] }, eaten: [ITEM_A.id] });
    expect(planFingerprint(planA)).toBe(planFingerprint(planB));
  });

  it('is order-independent for `pinned` (membership, not toggle order, matters)', () => {
    const planA = makePlan({ dateKey: '2020-01-01', slots: { breakfast: [ITEM_A, ITEM_B] }, pinned: [ITEM_A.id, ITEM_B.id] });
    const planB = makePlan({ dateKey: '2020-01-01', slots: { breakfast: [ITEM_A, ITEM_B] }, pinned: [ITEM_B.id, ITEM_A.id] });
    expect(planFingerprint(planA)).toBe(planFingerprint(planB));
  });

  it('changes when a slot item is added/removed/reordered', () => {
    const base = makePlan({ dateKey: '2020-01-01', slots: { breakfast: [ITEM_A] } });
    const added = makePlan({ dateKey: '2020-01-01', slots: { breakfast: [ITEM_A, ITEM_B] } });
    const reordered = makePlan({ dateKey: '2020-01-01', slots: { breakfast: [ITEM_B, ITEM_A] } });
    expect(planFingerprint(base)).not.toBe(planFingerprint(added));
    expect(planFingerprint(added)).not.toBe(planFingerprint(reordered));
  });

  it('changes when pinned membership changes', () => {
    const unpinned = makePlan({ dateKey: '2020-01-01', slots: { breakfast: [ITEM_A] }, pinned: [] });
    const pinned = makePlan({ dateKey: '2020-01-01', slots: { breakfast: [ITEM_A] }, pinned: [ITEM_A.id] });
    expect(planFingerprint(unpinned)).not.toBe(planFingerprint(pinned));
  });

  it('is fingerprinted by picksBySlot ids when present, independent of which day currently shows them', () => {
    const withPicks = { ...makePlan({ dateKey: '2020-01-01', slots: {} }), picksBySlot: { breakfast: [ITEM_A], lunch: [], dinner: [], snacks: [], beverages: [] } };
    const withDifferentPicks = { ...makePlan({ dateKey: '2020-01-01', slots: {} }), picksBySlot: { breakfast: [ITEM_B], lunch: [], dinner: [], snacks: [], beverages: [] } };
    expect(planFingerprint(withPicks)).not.toBe(planFingerprint(withDifferentPicks));
  });

  it('returns the empty string for a null plan', () => {
    expect(planFingerprint(null)).toBe('');
  });
});

describe('updateSavedPlan', () => {
  it('returns { ok: false, reason: "no-plan" } when there is no live plan', () => {
    expect(getPlan()).toBeNull();
    const result = updateSavedPlan('anything');
    expect(result).toEqual({ ok: false, reason: 'no-plan' });
  });

  it('returns { ok: false, reason: "not-found" } for an unknown id', () => {
    setPlan(makePlan({ dateKey: '2020-01-01', slots: { breakfast: [ITEM_A] } }));
    const result = updateSavedPlan('does-not-exist');
    expect(result).toEqual({ ok: false, reason: 'not-found' });
  });

  it('overwrites the matching entry\'s plan + savedAt IN PLACE, leaving id/name/others untouched', () => {
    setPlan(makePlan({ dateKey: '2020-01-01', slots: { breakfast: [ITEM_A] } }));
    const { entry } = saveCurrentPlan('My Week');

    setPlan(makePlan({ dateKey: '2020-01-01', slots: { breakfast: [ITEM_A, ITEM_B] } }));
    const result = updateSavedPlan(entry.id);

    expect(result.ok).toBe(true);
    expect(result.entry.id).toBe(entry.id);
    expect(result.entry.name).toBe('My Week');
    expect(result.entry.plan.days['2020-01-01'].slots.breakfast).toHaveLength(2);
    expect(typeof result.entry.savedAt).toBe('string');

    const saved = getSavedPlans();
    expect(saved).toHaveLength(1); // overwritten, not appended
    expect(saved[0].id).toBe(entry.id);
    expect(saved[0].plan.days['2020-01-01'].slots.breakfast).toHaveLength(2);
  });

  it('is NOT subject to MAX_SAVED_PLANS — updating an already-saved entry works even at the cap', () => {
    for (let i = 0; i < MAX_SAVED_PLANS; i++) {
      setPlan(makePlan({ dateKey: '2020-01-01', slots: { breakfast: [ITEM_A] } }));
      saveCurrentPlan(`Plan ${i}`);
    }
    expect(getSavedPlans()).toHaveLength(MAX_SAVED_PLANS);
    const targetId = getSavedPlans()[0].id;

    setPlan(makePlan({ dateKey: '2020-01-01', slots: { breakfast: [ITEM_A, ITEM_B] } }));
    const result = updateSavedPlan(targetId);

    expect(result.ok).toBe(true);
    expect(getSavedPlans()).toHaveLength(MAX_SAVED_PLANS); // still capped count, no new entry
  });

  it('marks the entry as the active saved plan', () => {
    setPlan(makePlan({ dateKey: '2020-01-01', slots: { breakfast: [ITEM_A] } }));
    const { entry } = saveCurrentPlan('My Week');
    clearActiveSavedPlan();
    expect(getActiveSavedPlan()).toBeNull();

    updateSavedPlan(entry.id);

    const active = getActiveSavedPlan();
    expect(active?.id).toBe(entry.id);
    expect(active?.fingerprint).toBe(planFingerprint(getPlan()));
  });
});

describe('loadSavedPlan: refit onto the current window by day POSITION', () => {
  it('remaps a single-day snapshot with an unrelated real date key onto the CURRENT window\'s first day', () => {
    const snapshotDay = { generation: 0, offsets: {}, slots: { ...emptySlots(), breakfast: [ITEM_A] }, eaten: [999], pinned: [ITEM_A.id] };
    const snapshotPlan = { version: 2, conditionsKey: '1', conditionNames: [], usedFallback: false, generation: 0, days: { '2020-01-01': snapshotDay } };
    storage.set('savedPlans', [{ id: 'entry-1', name: 'Old Week', savedAt: '2020-01-01T00:00:00.000Z', plan: snapshotPlan }]);

    const ok = loadSavedPlan('entry-1');
    expect(ok).toBe(true);

    const currentKeys = nextSevenDays().map((d) => d.key);
    const live = getPlan();
    expect(Object.keys(live.days)).toEqual([currentKeys[0]]);
    expect(live.days[currentKeys[0]]).toEqual(snapshotDay);
    // never shows an empty week: the day's actual content carried over.
    expect(live.days[currentKeys[0]].slots.breakfast).toEqual([ITEM_A]);
  });

  it('remaps multiple days by SORTED (chronological) position, regardless of insertion order', () => {
    const dayFor = (id) => ({ generation: 0, offsets: {}, slots: { ...emptySlots(), breakfast: [{ ...ITEM_A, id }] }, eaten: [], pinned: [] });
    const snapshotPlan = {
      version: 2,
      conditionsKey: '1',
      conditionNames: [],
      usedFallback: false,
      generation: 0,
      // Inserted out of chronological order on purpose.
      days: {
        '2020-01-03': dayFor('third'),
        '2020-01-01': dayFor('first'),
        '2020-01-02': dayFor('second'),
      },
    };
    storage.set('savedPlans', [{ id: 'entry-2', name: 'Old Week', savedAt: '2020-01-01T00:00:00.000Z', plan: snapshotPlan }]);

    loadSavedPlan('entry-2');

    const currentKeys = nextSevenDays().map((d) => d.key);
    const live = getPlan();
    expect(live.days[currentKeys[0]].slots.breakfast[0].id).toBe('first');
    expect(live.days[currentKeys[1]].slots.breakfast[0].id).toBe('second');
    expect(live.days[currentKeys[2]].slots.breakfast[0].id).toBe('third');
  });

  it('does not dirty the loaded plan against itself (fingerprint survives the re-key)', () => {
    const snapshotDay = { generation: 0, offsets: {}, slots: { ...emptySlots(), breakfast: [ITEM_A] }, eaten: [], pinned: [] };
    const snapshotPlan = { version: 2, conditionsKey: '1', conditionNames: [], usedFallback: false, generation: 0, days: { '2020-01-01': snapshotDay } };
    storage.set('savedPlans', [{ id: 'entry-3', name: 'Old Week', savedAt: '2020-01-01T00:00:00.000Z', plan: snapshotPlan }]);

    loadSavedPlan('entry-3');

    const active = getActiveSavedPlan();
    expect(active?.id).toBe('entry-3');
    expect(active?.fingerprint).toBe(planFingerprint(getPlan()));
    // Also equals the ORIGINAL snapshot's fingerprint — refitting is
    // position-based, so re-keying the day never reads as a content change.
    expect(active?.fingerprint).toBe(planFingerprint(snapshotPlan));
  });

  it('returns false and touches nothing for an unknown id', () => {
    expect(loadSavedPlan('missing')).toBe(false);
    expect(getPlan()).toBeNull();
  });
});

describe('active-saved-plan pointer: set/clear lifecycle', () => {
  it('starts null, and saveCurrentPlan sets it', () => {
    expect(getActiveSavedPlan()).toBeNull();
    setPlan(makePlan({ dateKey: '2020-01-01', slots: { breakfast: [ITEM_A] } }));
    const { entry } = saveCurrentPlan('My Week');
    expect(getActiveSavedPlan()).toEqual({ id: entry.id, fingerprint: planFingerprint(getPlan()) });
  });

  it('generatePlanFromPicks clears it — a freshly-picked week is not an edit of the old active save', async () => {
    getMealPlanSuggestions.mockResolvedValue({
      candidates: { breakfast: [], lunch: [], dinner: [], snacks: [], beverages: [] },
      conditionIds: [777],
      conditionNames: ['Condition 777'],
      usedFallback: false,
    });
    setPlan(makePlan({ dateKey: '2020-01-01', slots: { breakfast: [ITEM_A] } }));
    saveCurrentPlan('My Week');
    expect(getActiveSavedPlan()).not.toBeNull();

    await generatePlanFromPicks({ conditions: [777] }, []);

    expect(getActiveSavedPlan()).toBeNull();
  });

  it('deleteSavedPlan clears the pointer only when deleting the ACTIVE entry', () => {
    setPlan(makePlan({ dateKey: '2020-01-01', slots: { breakfast: [ITEM_A] } }));
    const { entry: entryA } = saveCurrentPlan('A');
    const { entry: entryB } = saveCurrentPlan('B');
    // saveCurrentPlan always re-points active at the entry it just created.
    expect(getActiveSavedPlan()?.id).toBe(entryB.id);

    deleteSavedPlan(entryA.id);
    expect(getActiveSavedPlan()?.id).toBe(entryB.id); // untouched — A wasn't active

    deleteSavedPlan(entryB.id);
    expect(getActiveSavedPlan()).toBeNull(); // B was active — cleared
  });

  it('ensurePlanForWeek clears the pointer when it discards the plan for a conditions change', async () => {
    getMealPlanSuggestions.mockResolvedValue({
      candidates: { breakfast: [], lunch: [], dinner: [], snacks: [], beverages: [] },
      conditionIds: [888],
      conditionNames: ['Condition 888'],
      usedFallback: false,
    });
    setPlan(makePlan({ conditionsKey: 'stale', dateKey: '2020-01-01', slots: { breakfast: [ITEM_A] } }));
    saveCurrentPlan('My Week');
    expect(getActiveSavedPlan()).not.toBeNull();

    const result = await ensurePlanForWeek({ conditions: [888] });

    expect(result.plan).toBeNull();
    expect(getActiveSavedPlan()).toBeNull();
  });

  it('purgeDerivedDataForConditionsChange clears the pointer alongside the plan', () => {
    setPlan(makePlan({ conditionsKey: '1', dateKey: '2020-01-01', slots: { breakfast: [ITEM_A] } }));
    saveCurrentPlan('My Week');
    expect(getActiveSavedPlan()).not.toBeNull();

    const purged = purgeDerivedDataForConditionsChange([999]);

    expect(purged).toBe(true);
    expect(getPlan()).toBeNull();
    expect(getActiveSavedPlan()).toBeNull();
  });

  it('clearActiveSavedPlan is a safe no-op when already clear', () => {
    expect(getActiveSavedPlan()).toBeNull();
    expect(() => clearActiveSavedPlan()).not.toThrow();
    expect(getActiveSavedPlan()).toBeNull();
  });
});
