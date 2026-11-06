/**
 * itemSlotKeys (Prompt B 3): a plain item saves only into the Breakfast,
 * Snacks & Desserts and Beverages slots Sunny flagged, and never when it's a
 * non-food or excluded row, even if a flag is set on it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); });

const ROWS = [
  { foodItemID: 1, displayAs: 'Muffin', coarseFoodGroup: 'f', fineFoodGroup: 'f' },
  { foodItemID: 2, displayAs: 'Lifestyle row', coarseFoodGroup: 'j', fineFoodGroup: 'j2' }, // excluded by coarse j only
  { foodItemID: 3, displayAs: 'Recipe row', coarseFoodGroup: 'x', fineFoodGroup: 'l' }, // excluded by fine l only
  { foodItemID: 4, displayAs: 'Chicken', coarseFoodGroup: 'b', fineFoodGroup: 'b3' },
];
const FLAGS = { 1: { isBreakfast: true, isSnack: true }, 2: { isSnack: true }, 3: { isBeverage: true }, 4: {} };

async function load() {
  vi.doMock('../localTables.js', () => ({
    getItemTable: vi.fn(() => ROWS),
    getConditionTable: vi.fn(() => []),
    getGroupTable: vi.fn(() => []),
    getOverlayImageFile: vi.fn(() => undefined),
    getRecipeFlaggedItems: vi.fn(() => []),
    getOverlayFlags: vi.fn((id) => ({ isBreakfast: false, isSnack: false, isBeverage: false, ...FLAGS[id] })),
  }));
  return import('../adapter.js');
}

describe('itemSlotKeys', () => {
  it('maps Sunny flags to slots, never Lunch or Dinner', async () => {
    const { itemSlotKeys } = await load();
    expect(itemSlotKeys(1)).toEqual(['breakfast', 'snacks']);
    expect(itemSlotKeys('1')).toEqual(['breakfast', 'snacks']);
    expect(itemSlotKeys(4)).toEqual([]);
    expect(itemSlotKeys(999)).toEqual([]);
  });

  it('ignores flags on excluded rows (lifestyle, recipe rows)', async () => {
    const { itemSlotKeys } = await load();
    expect(itemSlotKeys(2)).toEqual([]);
    expect(itemSlotKeys(3)).toEqual([]);
  });
});
