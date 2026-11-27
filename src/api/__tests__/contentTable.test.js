import { describe, expect, it } from 'vitest';
import { getFoodContent, getTopSources, isContentNutrient, levelFor } from '../contentTable.js';

describe('levelFor', () => {
  it.each([
    [20, 100, 3], [19.9, 100, 2], [10, 100, 2], [9.9, 100, 1],
    [2, 100, 1], [1.9, 100, 0], [0, 100, 0], [5, null, null],
  ])('levelFor(%s, %s) = %s', (amount, dv, want) => {
    expect(levelFor(amount, dv)).toBe(want);
  });
});

describe('isContentNutrient', () => {
  it('knows nutrient ids', () => {
    expect(isContentNutrient(1050)).toBe(true);
    expect(isContentNutrient(596)).toBe(false);
  });
});

describe('getFoodContent', () => {
  it('rates Whole milk calcium as very high per serving', async () => {
    const c = await getFoodContent(596);
    expect(c.servingGrams).toBe(244);
    const calcium = c.rows.find((r) => r.id === 1050);
    expect(calcium.level).toBe(3);
    expect(calcium.percentDV).toBeGreaterThanOrEqual(20);
  });

  it('returns null for a food with no USDA match', async () => {
    expect(await getFoodContent(3)).toBeNull();
  });
});

describe('getTopSources', () => {
  it('is null for a non-nutrient', async () => {
    expect(await getTopSources(596)).toBeNull();
  });

  it('ranks calcium sources by serving amount', async () => {
    const top = await getTopSources(1050);
    expect(top.length).toBeGreaterThan(0);
    expect(top.length).toBeLessThanOrEqual(10);
    for (let i = 1; i < top.length; i++) expect(top[i - 1].amount).toBeGreaterThanOrEqual(top[i].amount);
    expect(top.every((r) => r.servingGrams)).toBe(true);
  });

  it('leaves level null for a nutrient with no Daily Value', async () => {
    const top = await getTopSources(1052);
    expect(top.length).toBeGreaterThan(0);
    expect(top.every((r) => r.level === null)).toBe(true);
  });
});
