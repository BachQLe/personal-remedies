/**
 * localTables.getOverlayFlags.test.js — regression guard for 1B's addition
 * of `isBreakfast` to `getOverlayFlags` (src/api/localTables.js), alongside
 * the pre-existing `isSnack`/`isBeverage`.
 *
 * Mocks the four static JSON imports localTables.js reads (items/conditions
 * /groups dictionaries + the two overlay layers) so this test controls the
 * exact overlay content instead of depending on the real, large, frequently
 * regenerated committed snapshots. `itemOverlay.generated.json` (machine,
 * see scripts/flag-snack-beverage.mjs) is layered BEFORE `itemOverlay.json`
 * (hand-curated) per `ITEM_OVERLAY_LAYERS` — manual always wins.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../data/cache/items.json', () => ({ default: [] }));
vi.mock('../../data/cache/conditions.json', () => ({ default: [] }));
vi.mock('../../data/cache/groups.json', () => ({ default: [] }));
vi.mock('../../data/cache/itemOverlay.generated.json', () => ({
  default: {
    '100': { isBreakfast: true },
    '101': { isBreakfast: true, isSnack: true },
    '102': { isBreakfast: true },
  },
}));
vi.mock('../../data/cache/itemOverlay.json', () => ({
  default: {
    // Manual override: generated says isBreakfast true, Sunny says false.
    '102': { isBreakfast: false },
  },
}));

import { getOverlayFlags } from '../localTables.js';

describe('getOverlayFlags', () => {
  it('returns isBreakfast: true from the generated layer when the manual layer has no row', () => {
    expect(getOverlayFlags(100)).toEqual({ isBreakfast: true, isSnack: false, isBeverage: false });
  });

  it('returns isBreakfast alongside isSnack when both are set on the same row', () => {
    expect(getOverlayFlags(101)).toEqual({ isBreakfast: true, isSnack: true, isBeverage: false });
  });

  it('lets the hand-curated manual layer override the generated isBreakfast flag', () => {
    expect(getOverlayFlags(102)).toEqual({ isBreakfast: false, isSnack: false, isBeverage: false });
  });

  it('defaults every flag to false for an id with no overlay row at all', () => {
    expect(getOverlayFlags(999)).toEqual({ isBreakfast: false, isSnack: false, isBeverage: false });
  });

  it('accepts a string foodItemID the same as a number (keys are stringified)', () => {
    expect(getOverlayFlags('100')).toEqual({ isBreakfast: true, isSnack: false, isBeverage: false });
  });
});
