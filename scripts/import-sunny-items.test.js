import { describe, expect, it } from 'vitest';
import { parseCategories, buildOverlay } from './import-sunny-items.mjs';

describe('parseCategories', () => {
  it('reads Sunny\'s comma-separated codes, with or without spaces', () => {
    expect(parseCategories('R, L, D, S')).toEqual(['R', 'L', 'D', 'S']);
    expect(parseCategories('B,S')).toEqual(['B', 'S']);
    expect(parseCategories('')).toEqual([]);
  });

  it('throws on an unknown code rather than guessing what it means', () => {
    expect(() => parseCategories('L, X')).toThrow(/X/);
  });
});

describe('buildOverlay', () => {
  it('maps B/S/Bv to the item flags', () => {
    const overlay = buildOverlay([{ id: 1, categories: 'B,S' }, { id: 2, categories: 'Bv' }], {});
    expect(overlay).toEqual({ 1: { isBreakfast: true, isSnack: true }, 2: { isBeverage: true } });
  });

  it('records the meal types on R items only', () => {
    const overlay = buildOverlay(
      [{ id: 3, categories: 'R, L, D, S' }, { id: 4, categories: 'L, D' }],
      {}
    );
    expect(overlay[3]).toEqual({ isSnack: true, isRecipe: true, mealTypes: ['lunch', 'dinner', 'snack'] });
    expect(overlay[4]).toBeUndefined();
  });

  it('turns off a generated flag Sunny did not assign', () => {
    const overlay = buildOverlay(
      [{ id: 5, categories: 'L, D' }, { id: 6, categories: 'S' }],
      { 5: { isSnack: true }, 6: { isSnack: true, isBeverage: true } }
    );
    expect(overlay[5]).toEqual({ isSnack: false });
    expect(overlay[6]).toEqual({ isSnack: true, isBeverage: false });
  });
});
