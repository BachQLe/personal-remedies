/**
 * adapter.beveragesPool.test.js — Guard tests for T2A's beverages
 * candidate pool (decision a): `getMealPlanSuggestions`'s `beverages`
 * entry is item-driven via `flaggedPoolAcrossGroups`/`SLOT_FLAG_KEY.beverages`
 * (restored Aug 2026) — the ONE Plan slot that still carries plain food
 * items, since zero recipes carry `mealType: 'beverage'` yet. Every other
 * slot stays recipes-only.
 *
 * Mocks the fetch layer (`../nutridigm.js`'s `fetchSuggest`) and the local
 * dictionary layer (`../localTables.js`, which normally reads committed
 * JSON snapshots) so this makes zero real network calls and fully controls
 * which foodItemIDs carry the curated `isBeverage` flag. All assertions
 * are exercised against a SINGLE `getMealPlanSuggestions` call (in
 * `beforeAll`) so `adapter.js`'s internal `_foodItemsCache` (populated once,
 * lazily, and never invalidated within a module instance — see
 * `ensureFoodItems`) can't go stale between assertions.
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
import { PLAN_SLOTS } from '../config.js';

/**
 * Merged item-table rows (id + curated isBeverage flag) — stands in for
 * localTables.js's getItemTable(), which normally merges the base item
 * dictionary with the curation overlay (itemOverlay.json).
 */
const ITEM_TABLE = [
  { foodItemID: 501, isBeverage: true }, // h2, numericId 2 -> IN
  { foodItemID: 502, isBeverage: true }, // h2, numericId 6 (poor, out of range) -> OUT
  { foodItemID: 503, isBeverage: true }, // f (breakfast group), numericId 1 -> IN (cross-group pooling)
  { foodItemID: 504, isBeverage: false }, // h2, numericId 1, NOT flagged -> OUT
  { foodItemID: 601, isBeverage: true }, // h2, numericId 1, raw carries fineFoodGroup 'j1' -> OUT (excluded)
  { foodItemID: 602, isBeverage: true }, // h2, numericId 1, raw carries coarseFoodGroup 'j' -> OUT (excluded)
  { foodItemID: 701, isBeverage: true }, // f, numericId 3, flagged — must not surface on the (recipes-only) breakfast slot
];

/** fineFoodGroup -> raw /suggest items, standing in for fetchSuggest's real HTTP response. */
const SUGGEST_RESPONSES = {
  h2: [
    { foodItemID: 501, foodItemDisplayAs: 'Green Tea', descriptionNumericID: 2 },
    { foodItemID: 502, foodItemDisplayAs: 'Poor Beverage', descriptionNumericID: 6 },
    { foodItemID: 504, foodItemDisplayAs: 'Unflagged Water', descriptionNumericID: 1 },
    // Defensive/malformed cases: a raw item returned under the 'h2' /suggest
    // call but carrying an excluded fine/coarse group of its own.
    { foodItemID: 601, foodItemDisplayAs: 'Mislabeled beverage', descriptionNumericID: 1, fineFoodGroup: 'j1' },
    { foodItemID: 602, foodItemDisplayAs: 'Also mislabeled', descriptionNumericID: 1, coarseFoodGroup: 'j' },
  ],
  f: [
    { foodItemID: 503, foodItemDisplayAs: 'Oat Milk', descriptionNumericID: 1 },
    { foodItemID: 701, foodItemDisplayAs: 'Flagged Oat Item', descriptionNumericID: 3 },
  ],
};

describe('PLAN_SLOTS never fetches an excluded fine group for any slot', () => {
  it('never requests lifestyle (x/j1), recipe (l), or key-nutrient (k-prefixed) fine groups', () => {
    const groups = PLAN_SLOTS.flatMap((s) => s.fineGroups);
    for (const g of groups) {
      expect(['x', 'l', 'j1']).not.toContain(g);
      expect(g.startsWith('k')).toBe(false);
    }
  });
});

describe('getMealPlanSuggestions: beverages candidate pool is item-driven (T2A decision a)', () => {
  /** @type {Awaited<ReturnType<typeof getMealPlanSuggestions>>} */
  let result;

  beforeAll(async () => {
    getItemTable.mockReturnValue(ITEM_TABLE);
    getConditionTable.mockReturnValue([{ healthConditionID: 9001, description: 'Test Condition' }]);
    fetchSuggest.mockImplementation(async (_csv, fineFoodGroup) => SUGGEST_RESPONSES[fineFoodGroup] ?? []);

    result = await getMealPlanSuggestions({ conditions: [9001] });
  });

  it('includes an in-range (1-4) isBeverage item from its own h2 pool', () => {
    const ids = result.candidates.beverages.map((c) => c.id);
    expect(ids).toContain(501);
  });

  it('excludes an isBeverage item outside numericId 1-4, even from the h2 pool', () => {
    const ids = result.candidates.beverages.map((c) => c.id);
    expect(ids).not.toContain(502);
  });

  it('excludes an in-range h2 item that is NOT flagged isBeverage', () => {
    const ids = result.candidates.beverages.map((c) => c.id);
    expect(ids).not.toContain(504);
  });

  it('includes an isBeverage item flagged from a DIFFERENT already-fetched pool (cross-group pooling)', () => {
    const ids = result.candidates.beverages.map((c) => c.id);
    expect(ids).toContain(503);
  });

  it('excludes an isBeverage item whose raw payload carries an excluded fine/coarse group (defense in depth)', () => {
    const ids = result.candidates.beverages.map((c) => c.id);
    expect(ids).not.toContain(601);
    expect(ids).not.toContain(602);
  });

  it('every surfaced beverages candidate carries numericId within 1-4', () => {
    expect(result.candidates.beverages.length).toBeGreaterThan(0);
    for (const c of result.candidates.beverages) {
      expect(c.numericId).toBeGreaterThanOrEqual(1);
      expect(c.numericId).toBeLessThanOrEqual(4);
    }
  });

  it('every other slot stays recipes-only — an in-range, flagged item never surfaces on breakfast', () => {
    expect(result.candidates.breakfast).toEqual([]);
  });
});
