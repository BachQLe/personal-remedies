import { describe, expect, it } from 'vitest';
import { getOverlayFlags, getRecipeFlaggedItems, getServingSize } from '../localTables.js';

describe('getServingSize (PR serving size, checklist 4.17)', () => {
  it('reads the numeric unitOfMeasure as grams, across the 2 g to several hundred g range', () => {
    expect(getServingSize(588)).toBe('20 g'); // Margarine (salted)
    expect(getServingSize(274)).toBe('248 g'); // Apple juice
  });

  it('never invents a size for a blank or non-numeric unitOfMeasure', () => {
    expect(getServingSize(382)).toBeNull(); // Daikon: blank
    expect(getServingSize(1099)).toBeNull(); // Fiber: 'gram', a unit with no amount
    expect(getServingSize(5053)).toBeNull(); // Guacamole recipe: 'srvg'
  });

  it('returns null for an id outside the item table', () => {
    expect(getServingSize(999999)).toBeNull();
    expect(getServingSize(null)).toBeNull();
  });
});

describe("Sunny's item list (checklist 7.6, 7.8)", () => {
  it('flags exactly the R items, each with its meal types', () => {
    const items = getRecipeFlaggedItems();
    expect(items).toHaveLength(13);
    expect(items.find((i) => i.foodItemID === 789)).toMatchObject({ displayAs: 'Pizza', mealTypes: ['lunch', 'dinner'] });
    expect(items.find((i) => i.foodItemID === 778).mealTypes).toEqual(['lunch', 'dinner', 'snack']);
  });

  it("overrides a generated flag with Sunny's classification", () => {
    expect(getOverlayFlags(267).isBeverage).toBe(true); // Soy milk: Bv
    expect(getOverlayFlags(1).isSnack).toBe(false); // Abalone: L, D
  });
});
