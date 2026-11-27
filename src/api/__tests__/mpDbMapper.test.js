import { describe, it, expect } from 'vitest';
import { toMpDb } from '../../../supabase/functions/_shared/mpDb.js';

// MySQL rows may differ from the xlsx in column case and flag encoding (1 vs 'X').
describe('toMpDb (live MySQL row shape)', () => {
  it('maps rows case-insensitively and accepts 1/X flags', () => {
    const db = toMpDb(
      [
        { fi: 754, url: 'Commonly prepared', breakfast: null, ld: 'X', dessert: 0, beverage: null, kcal: 214 },
        { fi: 12, url: 'https://x.test/r', breakfast: 1, ld: 0, dessert: 0, beverage: 0, kcal: '90' },
      ],
      [{ FI: '207', Breakfast: '', Snack: 'X', Beverage: 1 }]
    );
    expect(db).toEqual({
      recipes: { 754: { url: null, meals: ['ld'], kcal: 214 }, 12: { url: 'https://x.test/r', meals: ['b'], kcal: 90 } },
      more: { 207: ['s', 'bev'] },
    });
  });

  it('names the real columns when the schema differs', () => {
    expect(() => toMpDb([{ FoodItemID: 1 }], [])).toThrow(/columns are: FoodItemID/);
  });
});
