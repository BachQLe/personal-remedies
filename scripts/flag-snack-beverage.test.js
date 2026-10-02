/**
 * flag-snack-beverage.test.js — regression guard for the pure
 * `classifyBreakfast`/`buildOverlay` functions in
 * scripts/flag-snack-beverage.mjs (1B — category-scoped selection rule).
 *
 * Deliberately uses tiny hand-built fixtures, NOT the real ~1,485-item
 * src/data/cache/items.json — these functions are plain data-in/data-out
 * (no file I/O), so a handful of synthetic rows pins down behavior
 * precisely and keeps the test fast. Importing the sibling .mjs module must
 * NOT run its file-reading/writing build (guarded by the `isMain` check at
 * the bottom of that file) — see scripts/audit-overlay.test.js for the same
 * house pattern.
 */
import { describe, expect, it } from 'vitest';
import { classifyBreakfast, buildOverlay } from './flag-snack-beverage.mjs';

describe('classifyBreakfast', () => {
  it('tags a fineFoodGroup f item matching the breakfast-grain allowlist', () => {
    expect(classifyBreakfast({ fineFoodGroup: 'f', displayAs: 'Oatmeal (cereal)' })).toBe(true);
    expect(classifyBreakfast({ fineFoodGroup: 'f', displayAs: 'Bagels (plain)' })).toBe(true);
    expect(classifyBreakfast({ fineFoodGroup: 'f', displayAs: 'Waffles' })).toBe(true);
    expect(classifyBreakfast({ fineFoodGroup: 'f', displayAs: 'Corn muffins' })).toBe(true);
  });

  it('does not tag an unrelated fineFoodGroup f item (meal component, not breakfast-specific)', () => {
    expect(classifyBreakfast({ fineFoodGroup: 'f', displayAs: 'White bread' })).toBe(false);
    expect(classifyBreakfast({ fineFoodGroup: 'f', displayAs: 'Crackers' })).toBe(false);
  });

  it('tags a fineFoodGroup g1 item matching yogurt/cottage cheese', () => {
    expect(classifyBreakfast({ fineFoodGroup: 'g1', displayAs: 'Yogurt (Plain)' })).toBe(true);
    expect(classifyBreakfast({ fineFoodGroup: 'g1', displayAs: 'Cottage cheese' })).toBe(true);
  });

  it('does not tag an unrelated fineFoodGroup g1 item', () => {
    expect(classifyBreakfast({ fineFoodGroup: 'g1', displayAs: 'Butter' })).toBe(false);
    expect(classifyBreakfast({ fineFoodGroup: 'g1', displayAs: 'Cheddar cheese' })).toBe(false);
  });

  it('never blanket-tags fruit (fineFoodGroup d), even with a breakfast-adjacent name', () => {
    expect(classifyBreakfast({ fineFoodGroup: 'd', displayAs: 'Granola-topped berries' })).toBe(false);
    expect(classifyBreakfast({ fineFoodGroup: 'd', displayAs: 'Banana' })).toBe(false);
  });

  it('falls back to `description` when `displayAs` is absent', () => {
    expect(classifyBreakfast({ fineFoodGroup: 'f', description: 'Granola cereal' })).toBe(true);
  });

  it('is false for any other fineFoodGroup', () => {
    expect(classifyBreakfast({ fineFoodGroup: 'h2', displayAs: 'Oatmeal drink' })).toBe(false);
    expect(classifyBreakfast({ fineFoodGroup: undefined, displayAs: 'Oatmeal' })).toBe(false);
  });
});

describe('buildOverlay', () => {
  const ITEMS = [
    { foodItemID: 1, fineFoodGroup: 'h2', displayAs: 'Iced Tea' },
    { foodItemID: 2, fineFoodGroup: 'h1', displayAs: 'Potato chips' },
    { foodItemID: 3, fineFoodGroup: 'h1', displayAs: 'Honey' }, // exclusion by id below
    { foodItemID: 688, fineFoodGroup: 'h1', displayAs: 'Honey' }, // real exclusion id
    { foodItemID: 4, fineFoodGroup: 'd', displayAs: 'Orange juice' },
    { foodItemID: 5, fineFoodGroup: 'd', displayAs: 'Apple' },
    { foodItemID: 6, fineFoodGroup: 'f', displayAs: 'Granola bars' }, // isSnack AND isBreakfast
    { foodItemID: 7, fineFoodGroup: 'f', displayAs: 'Oatmeal (cereal)' }, // isBreakfast only
    { foodItemID: 8, fineFoodGroup: 'f', displayAs: 'White bread' }, // untagged
    { foodItemID: 9, fineFoodGroup: 'g1', displayAs: 'Yogurt (Plain)' }, // isSnack AND isBreakfast
    { foodItemID: 10, fineFoodGroup: 'g1', displayAs: 'Whole milk' }, // isBeverage only
  ];

  const { overlay, counts, resolvedExclusions, breakfastTagged } = buildOverlay(ITEMS);

  it('merges isBreakfast onto an item that already carries isSnack from the same fine group', () => {
    expect(overlay['6']).toEqual({ isSnack: true, isBreakfast: true });
    expect(overlay['9']).toEqual({ isSnack: true, isBreakfast: true });
  });

  it('tags isBreakfast alone when no other flag applies', () => {
    expect(overlay['7']).toEqual({ isBreakfast: true });
  });

  it('leaves a non-matching f item with no isBreakfast key at all', () => {
    expect(overlay['8']).toBeUndefined();
  });

  it('does not add isBreakfast to an isBeverage-only g1 item', () => {
    expect(overlay['10']).toEqual({ isBeverage: true });
  });

  it('still applies the pre-existing h1 exclusion-by-id rule unaffected by the new rule', () => {
    expect(overlay['688']).toBeUndefined();
    expect(resolvedExclusions).toContain('688 Honey');
  });

  it('counts and lists every isBreakfast-tagged row', () => {
    expect(counts.fBreakfast).toBe(2);
    expect(counts.g1Breakfast).toBe(1);
    expect(breakfastTagged).toEqual(
      expect.arrayContaining(['6 Granola bars', '7 Oatmeal (cereal)', '9 Yogurt (Plain)'])
    );
    expect(breakfastTagged).toHaveLength(3);
  });
});
