/**
 * adapter.snacksPool.test.js — end-to-end guard that the snacks Plan slot
 * (Task 2, "Snacks missing" #9) actually produces candidates via the
 * flagged-item pooling path (`flaggedPoolAcrossGroups` + `mergeCandidatePools`
 * in adapter.js, driven by `PLAN_SLOTS`' `itemFlagKey: 'isSnack'` for the
 * `snacks` slot — config.js), exactly like `adapter.beveragesPool.test.js`
 * already guards the `beverages` slot's equivalent `isBeverage` path.
 *
 * Mocks the fetch layer (`../nutridigm.js`) and the local dictionary layer
 * (`../localTables.js`, which normally merges the base item dictionary with
 * `itemOverlay.generated.json`'s machine-inferred isSnack flags — see
 * localTables.js's doc) so this makes zero real network calls and fully
 * controls which foodItemIDs carry the curated `isSnack` flag.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../nutridigm.js', () => ({
  fetchSuggest: vi.fn(),
  fetchGoodFor: vi.fn(),
  fetchTopDoOrDonts: vi.fn(),
  fetchDetailed: vi.fn(),
  fetchReferences: vi.fn(),
  NutridigmAuthError: class NutridigmAuthError extends Error {},
}));

vi.mock('../localTables.js', () => ({
  getItemTable: vi.fn(),
  getConditionTable: vi.fn(),
  getGroupTable: vi.fn(() => []),
  getOverlayImageFile: vi.fn(() => undefined),
}));

import { fetchSuggest } from '../nutridigm.js';
import { getItemTable, getConditionTable } from '../localTables.js';
import { getMealPlanSuggestions } from '../adapter.js';

/**
 * Merged item-table rows (id + curated isSnack flag) — stands in for
 * localTables.js's getItemTable(), which normally merges the base item
 * dictionary with itemOverlay.generated.json's fine-group-h1/c3-derived
 * isSnack flags.
 */
const ITEM_TABLE = [
  { foodItemID: 901, isSnack: true }, // h1, numericId 1 -> IN
  { foodItemID: 902, isSnack: true }, // c3, numericId 3 -> IN
  { foodItemID: 903, isSnack: false }, // h1, numericId 1, NOT flagged -> OUT
  { foodItemID: 904, isSnack: true }, // h1, numericId 6 (poor, out of range) -> OUT
];

/** fineFoodGroup -> raw /suggest items, standing in for fetchSuggest's real HTTP response. */
const SUGGEST_RESPONSES = {
  h1: [
    { foodItemID: 901, foodItemDisplayAs: 'Roasted Almonds', descriptionNumericID: 1 },
    { foodItemID: 903, foodItemDisplayAs: 'Pie Crust', descriptionNumericID: 1 },
    { foodItemID: 904, foodItemDisplayAs: 'Poor Snack', descriptionNumericID: 6 },
  ],
  c3: [{ foodItemID: 902, foodItemDisplayAs: 'Mixed Seeds', descriptionNumericID: 3 }],
};

describe('getMealPlanSuggestions: snacks candidate pool is flag-driven end to end (Task 2, #9)', () => {
  /** @type {Awaited<ReturnType<typeof getMealPlanSuggestions>>} */
  let result;

  beforeAll(async () => {
    getItemTable.mockReturnValue(ITEM_TABLE);
    getConditionTable.mockReturnValue([{ healthConditionID: 9001, description: 'Test Condition' }]);
    fetchSuggest.mockImplementation(async (_csv, fineFoodGroup) => SUGGEST_RESPONSES[fineFoodGroup] ?? []);

    // No recipes whose mealType resolves to 'snack' at all — the pool must
    // still be non-empty purely from flagged items (the regression this
    // test guards: snacks used to come up empty when no snack recipes
    // existed in a given /suggest('l') response).
    result = await getMealPlanSuggestions({ conditions: [9001] });
  });

  it('is non-empty when /suggest returns flagged items and there are no snack recipes', () => {
    expect(result.candidates.snacks.length).toBeGreaterThan(0);
  });

  it('includes in-range isSnack-flagged items from both h1 and c3', () => {
    const ids = result.candidates.snacks.map((c) => c.id);
    expect(ids).toContain(901);
    expect(ids).toContain(902);
  });

  it('excludes an in-range h1 item that is not flagged isSnack', () => {
    const ids = result.candidates.snacks.map((c) => c.id);
    expect(ids).not.toContain(903);
  });

  it('excludes an isSnack item outside the safe numericId 1-4 range', () => {
    const ids = result.candidates.snacks.map((c) => c.id);
    expect(ids).not.toContain(904);
  });

  it('every candidate is a plain food item (no snack recipes existed to merge in)', () => {
    expect(result.candidates.snacks.every((c) => c.kind === 'food')).toBe(true);
  });
});
