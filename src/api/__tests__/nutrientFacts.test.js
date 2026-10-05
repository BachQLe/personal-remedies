import { describe, expect, it } from 'vitest';
import {
  parseNutrientQuery,
  rankFoodsByNutrient,
  getNutrientPanel,
  getNutrientAmount,
  formatAmount,
  isRealisticServing,
} from '../nutrientFacts.js';
import { extractMicros, scaleMicros } from '../../data/usda/nutrientCatalog.js';

describe('parseNutrientQuery', () => {
  it('parses "<nutrient> in <food>"', () => {
    expect(parseNutrientQuery('calcium in milk')).toEqual({ nutrient: 'calcium', food: 'milk' });
  });
  it('handles question phrasing and aliases', () => {
    expect(parseNutrientQuery('How much vitamin C in kiwi?')).toEqual({ nutrient: 'vitC', food: 'kiwi' });
    expect(parseNutrientQuery('iron content of spinach')).toEqual({ nutrient: 'iron', food: 'spinach' });
    expect(parseNutrientQuery('b12 in salmon')).toEqual({ nutrient: 'vitB12', food: 'salmon' });
  });
  it('parses "<food> <nutrient>" and bare nutrients', () => {
    expect(parseNutrientQuery('milk calcium')).toEqual({ nutrient: 'calcium', food: 'milk' });
    expect(parseNutrientQuery('fiber')).toEqual({ nutrient: 'fiber', food: '' });
    expect(parseNutrientQuery('saturated fat in butter')).toEqual({ nutrient: 'satFat', food: 'butter' });
  });
  it('returns null for plain food searches', () => {
    expect(parseNutrientQuery('spinach')).toBeNull();
    expect(parseNutrientQuery('sugar snap peas')).toBeNull();
    expect(parseNutrientQuery('')).toBeNull();
  });
});

describe('getNutrientAmount / getNutrientPanel (real USDA tables)', () => {
  it('whole milk (596) has real calcium ~120 mg/100 g and a per-serving value', () => {
    const a = getNutrientAmount(596, 'calcium');
    expect(a.unit).toBe('mg');
    expect(a.per100g).toBeGreaterThan(100);
    expect(a.per100g).toBeLessThan(140);
    expect(a.perServing).toBeCloseTo((a.per100g * a.serving.grams) / 100, 0);
  });
  it('spinach (440) is high in vitamin K and folate; salmon (148) has vitamin D', () => {
    expect(getNutrientAmount(440, 'vitK').per100g).toBeGreaterThan(300);
    expect(getNutrientAmount(440, 'folate').per100g).toBeGreaterThan(100);
    expect(getNutrientAmount(148, 'vitD').per100g).toBeGreaterThan(5);
  });
  it('builds a labelled panel for a matched food', () => {
    const p = getNutrientPanel(596);
    expect(p.matchedName).toMatch(/^Milk, whole/);
    expect(p.perServing.find((r) => r.key === 'calcium').unit).toBe('mg');
    expect(p.per100g[0].key).toBe('calories');
  });
  it('returns null (no estimate) for an unmatched food', () => {
    expect(getNutrientPanel(499)).toBeNull(); // Donuts: unmatched
    expect(getNutrientAmount(499, 'calcium')).toBeNull();
    expect(getNutrientPanel(null)).toBeNull();
    expect(getNutrientPanel(99999999)).toBeNull();
  });
});

describe('rankFoodsByNutrient', () => {
  const foods = [
    { id: 440, name: 'Spinach non-organic' },
    { id: 1414, name: 'Organic spinach' }, // same USDA record as 440
    { id: 596, name: 'Whole milk' },
    { id: 499, name: "Donuts" }, // unmatched: can never rank
    { id: 400, name: 'Kale non-organic' },
  ];
  it('ranks per 100 g, descending, with per-serving as secondary', () => {
    const r = rankFoodsByNutrient(foods, 'calcium', { limit: 20 });
    const amounts = r.map((x) => x.per100g);
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
    expect(r[0].unit).toBe('mg');
    expect(r.find((x) => x.food.id === 596).perServing).not.toBeNull();
  });
  it('gives no per-serving figure for dry/raw staples (corn bran, split peas)', () => {
    const r = rankFoodsByNutrient([{ id: 514, name: 'Oat bran' }], 'fiber');
    expect(r[0].per100g).toBeGreaterThan(10);
    expect(r[0].perServing).toBeNull();
    expect(r[0].serving).toBeNull();
    expect(getNutrientPanel(514).perServing).toBeNull();
  });
  it('excludes unmatched foods and de-duplicates shared USDA records', () => {
    const r = rankFoodsByNutrient(foods, 'calcium');
    expect(r.find((x) => x.food.id === 499)).toBeUndefined();
    expect(r.filter((x) => x.fdcId === r.find((y) => y.food.id === 440 || y.food.id === 1414).fdcId)).toHaveLength(1);
  });
  it('respects the limit and skips foods lacking the nutrient', () => {
    expect(rankFoodsByNutrient(foods, 'calcium', { limit: 2 })).toHaveLength(2);
    // whole milk has no fiber reported -> never ranked for fiber
    expect(rankFoodsByNutrient([{ id: 596, name: 'Whole milk' }], 'fiber')).toEqual([]);
  });
});

describe('isRealisticServing', () => {
  it('rejects dry/raw staples and accepts everyday foods', () => {
    expect(isRealisticServing('Peas, split, mature seeds, raw')).toBe(false);
    expect(isRealisticServing('Corn bran, crude')).toBe(false);
    expect(isRealisticServing('Lentils, dry')).toBe(false);
    expect(isRealisticServing('Flour, rice, brown')).toBe(false);
    expect(isRealisticServing('Spinach, raw')).toBe(true);
    expect(isRealisticServing('Milk, whole, 3.25% milkfat, with added vitamin D')).toBe(true);
  });
});

describe('catalog extraction', () => {
  const fn = (num, amount) => ({ nutrient: { number: num }, amount });
  it('extracts units-correct values, omits unreported nutrients, sums omega-3', () => {
    const m = extractMicros([fn('301', 120), fn('324', 40), fn('851', 0.1), fn('629', 0.2), fn('621', 0.3)]);
    expect(m.calcium).toBe(120);
    expect(m.vitD).toBe(1); // IU fallback: 40 IU = 1 mcg
    expect(m.omega3).toBeCloseTo(0.6, 4);
    expect('iron' in m).toBe(false);
  });
  it('scales to a serving', () => {
    expect(scaleMicros({ calcium: 120 }, 250)).toEqual({ calcium: 300 });
  });
  it('formats amounts without false precision', () => {
    expect(formatAmount(123.456)).toBe('123');
    expect(formatAmount(12.34)).toBe('12.3');
    expect(formatAmount(0.456)).toBe('0.46');
    expect(formatAmount(0)).toBe('0');
  });
});
