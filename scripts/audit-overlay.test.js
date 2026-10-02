/**
 * audit-overlay.test.js — regression guard for the pure analysis functions
 * in scripts/audit-overlay.mjs (T7B).
 *
 * Deliberately uses tiny hand-built fixtures, NOT the real 1,485-item
 * src/data/cache/items.json — these functions are plain data-in/data-out
 * (no file I/O), so a handful of synthetic rows is enough to pin down their
 * behavior precisely and keeps the test fast and readable. See
 * scripts/check-contrast.test.js for the same house pattern (import pure
 * functions from the sibling .mjs, test against fixtures, no file access).
 */
import { describe, expect, it } from 'vitest';
import {
  hasOverlayRow,
  resolveOverlayFlags,
  computeCoverage,
  buildFineGroupSlotIndex,
  buildSlotFlagKeyIndex,
  rankMissingOverlayItems,
  computeMisflags,
  computeConflicts,
  computeImageFileCoverage,
  extractExportedConst,
} from './audit-overlay.mjs';

// ── Shared fixtures ─────────────────────────────────────────────────────────

/**
 * 11 synthetic items covering every branch the ranking/coverage/misflag
 * logic needs to distinguish. PLAN_SLOTS below mirrors the real
 * src/api/config.js shape post-category-scoped-selection: breakfast/snacks/
 * beverages all carry a non-null `itemFlagKey` (ALL THREE are wired live in
 * adapter.js today — there's no more "designated but inactive" slot), and
 * `lunch` stands in for the real lunch/dinner slots, which keep
 * `itemFlagKey: null` and stay recipes-only.
 *  - #1 Iced Tea    (h2) — HAS a generated isBeverage:true row
 *  - #2 Soda        (h2) — NO overlay row (the "h2 missing isBeverage" case; tier 0, beverages is ACTIVE)
 *  - #3 Chips       (h1) — HAS a generated isSnack:true row
 *  - #4 Honey       (h1) — NO overlay row (tier 0, snacks is ACTIVE)
 *  - #5 Orange Juice(d)  — HAS isBeverage:true despite living outside h2 (misflag case)
 *  - #6 Apple       (d)  — NO overlay row (tier 0, breakfast is ACTIVE)
 *  - #7 Beef        (zz) — NO overlay row, fine group feeds no PLAN_SLOTS entry at all (tier 2)
 *  - #8 Cashews     (c3) — NO overlay row (tier 0, snacks is ACTIVE)
 *  - #9 Salmon      (e)  — NO overlay row, fine group feeds `lunch`, whose itemFlagKey is null (tier 1)
 *  - #10 Oatmeal    (f)  — HAS a generated isBreakfast:true row (inside the classifier's expected 'f' group)
 *  - #11 Weird Bar  (c2) — HAS a generated isBreakfast:true row OUTSIDE f/g1 (the misflag anomaly case)
 */
const ITEMS = [
  { foodItemID: 1, description: 'Iced Tea', displayAs: 'Iced Tea', coarseFoodGroup: 'h', fineFoodGroup: 'h2' },
  { foodItemID: 2, description: 'Soda', displayAs: 'Soda', coarseFoodGroup: 'h', fineFoodGroup: 'h2' },
  { foodItemID: 3, description: 'Chips', displayAs: 'Chips', coarseFoodGroup: 'h', fineFoodGroup: 'h1' },
  { foodItemID: 4, description: 'Honey', displayAs: 'Honey', coarseFoodGroup: 'h', fineFoodGroup: 'h1' },
  { foodItemID: 5, description: 'Orange Juice', displayAs: 'Orange Juice', coarseFoodGroup: 'd', fineFoodGroup: 'd' },
  { foodItemID: 6, description: 'Apple', displayAs: 'Apple', coarseFoodGroup: 'd', fineFoodGroup: 'd' },
  { foodItemID: 7, description: 'Beef', displayAs: 'Beef', coarseFoodGroup: 'b', fineFoodGroup: 'zz' },
  { foodItemID: 8, description: 'Cashews', displayAs: 'Cashews', coarseFoodGroup: 'c', fineFoodGroup: 'c3' },
  { foodItemID: 9, description: 'Salmon', displayAs: 'Salmon', coarseFoodGroup: 'e', fineFoodGroup: 'e' },
  { foodItemID: 10, description: 'Oatmeal', displayAs: 'Oatmeal', coarseFoodGroup: 'f', fineFoodGroup: 'f' },
  { foodItemID: 11, description: 'Weird Bar', displayAs: 'Weird Bar', coarseFoodGroup: 'c', fineFoodGroup: 'c2' },
];

const GENERATED_OVERLAY = {
  1: { isBeverage: true },
  3: { isSnack: true },
  5: { isBeverage: true },
  10: { isBreakfast: true },
  11: { isBreakfast: true },
};

const PLAN_SLOTS = [
  { key: 'breakfast', fineGroups: ['d'], itemFlagKey: 'isBreakfast' },
  { key: 'snacks', fineGroups: ['h1', 'c3'], itemFlagKey: 'isSnack' },
  { key: 'beverages', fineGroups: ['h2'], itemFlagKey: 'isBeverage' },
  { key: 'lunch', fineGroups: ['e'], itemFlagKey: null },
];

// ── hasOverlayRow / resolveOverlayFlags ─────────────────────────────────────

describe('hasOverlayRow', () => {
  it('is true when either layer has the key', () => {
    expect(hasOverlayRow(1, [GENERATED_OVERLAY, {}])).toBe(true);
    expect(hasOverlayRow('1', [GENERATED_OVERLAY, {}])).toBe(true); // numeric-or-string id both work
  });

  it('is false when no layer has the key', () => {
    expect(hasOverlayRow(2, [GENERATED_OVERLAY, {}])).toBe(false);
  });
});

describe('resolveOverlayFlags', () => {
  it('reads a flag straight through from a single layer', () => {
    expect(resolveOverlayFlags(1, [GENERATED_OVERLAY, {}])).toEqual({
      isBreakfast: false,
      isSnack: false,
      isBeverage: true,
      imageFile: undefined,
    });
  });

  it('reads isBreakfast straight through from a single layer', () => {
    expect(resolveOverlayFlags(10, [GENERATED_OVERLAY, {}])).toEqual({
      isBreakfast: true,
      isSnack: false,
      isBeverage: false,
      imageFile: undefined,
    });
  });

  it('defaults every flag to false/undefined when no layer has the id', () => {
    expect(resolveOverlayFlags(2, [GENERATED_OVERLAY, {}])).toEqual({
      isBreakfast: false,
      isSnack: false,
      isBeverage: false,
      imageFile: undefined,
    });
  });

  it('lets a later layer (manual) override an earlier one (generated), per-field', () => {
    const manual = { 1: { isBeverage: false } };
    expect(resolveOverlayFlags(1, [GENERATED_OVERLAY, manual]).isBeverage).toBe(false);
  });

  it('picks up imageFile only when a layer sets a truthy value', () => {
    const manual = { 1: { imageFile: 'iced-tea.jpg' } };
    expect(resolveOverlayFlags(1, [GENERATED_OVERLAY, manual]).imageFile).toBe('iced-tea.jpg');
  });
});

// ── computeCoverage ──────────────────────────────────────────────────────────

describe('computeCoverage', () => {
  const coverage = computeCoverage(ITEMS, [GENERATED_OVERLAY, {}]);

  it('counts overall totals correctly', () => {
    expect(coverage.total).toBe(11);
    expect(coverage.withOverlay).toBe(5); // #1, #3, #5, #10, #11
    expect(coverage.withNone).toBe(6);
  });

  it('breaks totals down by fine food group', () => {
    expect(coverage.byFine.h2).toEqual({ total: 2, withOverlay: 1, withNone: 1, coarseFoodGroup: 'h' });
    expect(coverage.byFine.h1).toEqual({ total: 2, withOverlay: 1, withNone: 1, coarseFoodGroup: 'h' });
    expect(coverage.byFine.d).toEqual({ total: 2, withOverlay: 1, withNone: 1, coarseFoodGroup: 'd' });
    expect(coverage.byFine.zz).toEqual({ total: 1, withOverlay: 0, withNone: 1, coarseFoodGroup: 'b' });
    expect(coverage.byFine.c3).toEqual({ total: 1, withOverlay: 0, withNone: 1, coarseFoodGroup: 'c' });
  });

  it('breaks totals down by coarse food group', () => {
    expect(coverage.byCoarse.h).toEqual({ total: 4, withOverlay: 2, withNone: 2 });
    expect(coverage.byCoarse.d).toEqual({ total: 2, withOverlay: 1, withNone: 1 });
  });
});

// ── buildFineGroupSlotIndex ──────────────────────────────────────────────────

describe('buildFineGroupSlotIndex', () => {
  it('indexes each fine group to every slot key that draws on it', () => {
    expect(buildFineGroupSlotIndex(PLAN_SLOTS)).toEqual({
      d: ['breakfast'],
      h1: ['snacks'],
      c3: ['snacks'],
      h2: ['beverages'],
      e: ['lunch'],
    });
  });

  it('lists a fine group under more than one slot if more than one references it', () => {
    const slots = [
      { key: 'lunch', fineGroups: ['e'] },
      { key: 'dinner', fineGroups: ['e'] },
    ];
    expect(buildFineGroupSlotIndex(slots)).toEqual({ e: ['lunch', 'dinner'] });
  });
});

// ── buildSlotFlagKeyIndex ────────────────────────────────────────────────────

describe('buildSlotFlagKeyIndex', () => {
  it('maps each slot key to its itemFlagKey, read straight off PLAN_SLOTS', () => {
    expect(buildSlotFlagKeyIndex(PLAN_SLOTS)).toEqual({
      breakfast: 'isBreakfast',
      snacks: 'isSnack',
      beverages: 'isBeverage',
    });
  });

  it('omits a slot whose itemFlagKey is null (lunch/dinner, recipes-only)', () => {
    const index = buildSlotFlagKeyIndex(PLAN_SLOTS);
    expect(Object.prototype.hasOwnProperty.call(index, 'lunch')).toBe(false);
  });
});

// ── rankMissingOverlayItems ──────────────────────────────────────────────────

describe('rankMissingOverlayItems', () => {
  const ranked = rankMissingOverlayItems(ITEMS, [GENERATED_OVERLAY, {}], PLAN_SLOTS, ['zz']);

  it('only includes items with no overlay row in any layer', () => {
    const ids = ranked.map((r) => r.foodItemID).sort((a, b) => a - b);
    expect(ids).toEqual([2, 4, 6, 7, 8, 9]); // #1, #3, #5, #10, #11 already have a row, excluded
  });

  it('puts an item in an ACTIVE flag slot fine group (h2/beverages) at tier 0', () => {
    const soda = ranked.find((r) => r.foodItemID === 2);
    expect(soda.tier).toBe(0);
    expect(soda.slotKeys).toEqual(['beverages']);
  });

  it('puts items in the snacks flag slot (h1/c3 -> isSnack) at tier 0 — snacks is ACTIVE today', () => {
    const honey = ranked.find((r) => r.foodItemID === 4);
    const cashews = ranked.find((r) => r.foodItemID === 8);
    expect(honey.tier).toBe(0);
    expect(cashews.tier).toBe(0);
  });

  it('puts an item in the breakfast flag slot (d -> isBreakfast) at tier 0 — breakfast is ACTIVE today', () => {
    const apple = ranked.find((r) => r.foodItemID === 6);
    expect(apple.tier).toBe(0);
    expect(apple.slotKeys).toEqual(['breakfast']);
  });

  it('puts an item in a plan-slot fine group whose itemFlagKey is null (lunch, recipes-only) at tier 1', () => {
    const salmon = ranked.find((r) => r.foodItemID === 9);
    expect(salmon.tier).toBe(1);
    expect(salmon.slotKeys).toEqual(['lunch']);
  });

  it('puts items whose fine group is in no PLAN_SLOTS entry at tier 2, and flags them excluded', () => {
    const beef = ranked.find((r) => r.foodItemID === 7);
    expect(beef.tier).toBe(2);
    expect(beef.slotKeys).toEqual([]);
    expect(beef.excludedFromFoodLists).toBe(true); // 'zz' passed in excludedFineGroups
  });

  it('does NOT mark a non-excluded fine group as excludedFromFoodLists', () => {
    const soda = ranked.find((r) => r.foodItemID === 2);
    expect(soda.excludedFromFoodLists).toBe(false);
  });

  it('sorts ascending by tier first', () => {
    const tiers = ranked.map((r) => r.tier);
    const sorted = [...tiers].sort((a, b) => a - b);
    expect(tiers).toEqual(sorted);
  });
});

// ── computeMisflags ──────────────────────────────────────────────────────────

describe('computeMisflags', () => {
  const misflags = computeMisflags(ITEMS, [GENERATED_OVERLAY, {}]);

  it('finds h2 items that are NOT flagged isBeverage', () => {
    expect(misflags.h2MissingBeverage.map((r) => r.foodItemID)).toEqual([2]); // Soda
  });

  it('finds items flagged isBeverage OUTSIDE h2', () => {
    expect(misflags.beverageOutsideH2.map((r) => r.foodItemID)).toEqual([5]); // Orange Juice, fine group 'd'
  });

  it('finds h1 items that are NOT flagged isSnack', () => {
    expect(misflags.h1MissingSnack.map((r) => r.foodItemID)).toEqual([4]); // Honey
  });

  it('finds items flagged isSnack OUTSIDE h1', () => {
    expect(misflags.snackOutsideH1).toEqual([]); // only #3 (Chips) is isSnack, and it IS h1
  });

  it('finds items flagged isBreakfast outside the classifier-expected f/g1 groups', () => {
    expect(misflags.breakfastOutsideExpectedGroups.map((r) => r.foodItemID)).toEqual([11]); // Weird Bar, fine group 'c2'
  });

  it('does not flag an isBreakfast item that IS inside f/g1', () => {
    const ids = misflags.breakfastOutsideExpectedGroups.map((r) => r.foodItemID);
    expect(ids).not.toContain(10); // Oatmeal, fine group 'f'
  });
});

// ── computeConflicts ─────────────────────────────────────────────────────────

describe('computeConflicts', () => {
  it('returns nothing when the manual layer is empty (matches the real repo state today)', () => {
    expect(computeConflicts(GENERATED_OVERLAY, {})).toEqual([]);
  });

  it('reports a field-level disagreement when manual overrides generated to a different value', () => {
    const manual = { 1: { isBeverage: false } };
    expect(computeConflicts(GENERATED_OVERLAY, manual)).toEqual([
      { foodItemID: '1', field: 'isBeverage', generatedValue: true, manualValue: false },
    ]);
  });

  it('does not report agreement as a conflict', () => {
    const manual = { 1: { isBeverage: true } };
    expect(computeConflicts(GENERATED_OVERLAY, manual)).toEqual([]);
  });

  it('ignores a manual row for an id the generated layer never touched', () => {
    const manual = { 999: { isSnack: true } };
    expect(computeConflicts(GENERATED_OVERLAY, manual)).toEqual([]);
  });

  it('reports a field-level disagreement on isBreakfast', () => {
    const manual = { 10: { isBreakfast: false } };
    expect(computeConflicts(GENERATED_OVERLAY, manual)).toEqual([
      { foodItemID: '10', field: 'isBreakfast', generatedValue: true, manualValue: false },
    ]);
  });
});

// ── computeImageFileCoverage ─────────────────────────────────────────────────

describe('computeImageFileCoverage', () => {
  it('reports zero when no layer sets imageFile anywhere (matches the real repo state today)', () => {
    const coverage = computeImageFileCoverage(ITEMS, [GENERATED_OVERLAY, {}]);
    expect(coverage.withImageFile).toBe(0);
    expect(coverage.rows).toEqual([]);
  });

  it('counts and lists items once a layer sets imageFile', () => {
    const manual = { 1: { imageFile: 'iced-tea.jpg' } };
    const coverage = computeImageFileCoverage(ITEMS, [GENERATED_OVERLAY, manual]);
    expect(coverage.withImageFile).toBe(1);
    expect(coverage.rows).toEqual([{ foodItemID: 1, description: 'Iced Tea', imageFile: 'iced-tea.jpg' }]);
  });
});

// ── extractExportedConst ─────────────────────────────────────────────────────

describe('extractExportedConst', () => {
  const SRC = [
    "export const FOO = [1, 2, { a: 'b', c: [3, 4] }];",
    "export const BAR = ['x', 'y'];",
    '',
  ].join('\n');

  it('extracts an array-of-mixed-values literal, including a nested array', () => {
    expect(extractExportedConst(SRC, 'FOO')).toEqual([1, 2, { a: 'b', c: [3, 4] }]);
  });

  it('extracts a flat string array literal', () => {
    expect(extractExportedConst(SRC, 'BAR')).toEqual(['x', 'y']);
  });

  it('throws when the named export is not found', () => {
    expect(() => extractExportedConst(SRC, 'MISSING')).toThrow(/MISSING/);
  });
});
