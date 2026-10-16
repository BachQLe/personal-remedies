import { describe, expect, it } from 'vitest';
import { pickRecipes } from './pickRecipes.js';

// mulberry32 — small seeded rng so the weighting checks are deterministic.
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const recipe = (id, numericId) => ({ id, kind: 'recipe', numericId });

describe('pickRecipes', () => {
  it('favours better matches in proportion to weight (best 4 : strong 3 : good 2 : neutral 1)', () => {
    const pool = [recipe('best', 1), recipe('strong', 2), recipe('good', 3), recipe('neutral', 4)];
    const rng = seeded(42);
    const draws = 8000;
    const firsts = { best: 0, strong: 0, good: 0, neutral: 0 };
    for (let i = 0; i < draws; i += 1) firsts[pickRecipes(pool, rng, 1)[0].id] += 1;
    expect(firsts.best / draws).toBeCloseTo(0.4, 1);
    expect(firsts.strong / draws).toBeCloseTo(0.3, 1);
    expect(firsts.good / draws).toBeCloseTo(0.2, 1);
    expect(firsts.neutral / draws).toBeCloseTo(0.1, 1);
    expect(firsts.best).toBeGreaterThan(firsts.neutral * 3);
  });

  it('never returns harmful (5-7), unscored, or non-recipe items', () => {
    const pool = [
      recipe('ok', 2),
      recipe('five', 5), recipe('six', 6), recipe('seven', 7),
      recipe('none', null), recipe('zero', 0),
      { id: 'food', kind: 'food', numericId: 1 },
    ];
    const rng = seeded(7);
    for (let i = 0; i < 200; i += 1) {
      expect(pickRecipes(pool, rng, 10).map((item) => item.id)).toEqual(['ok']);
    }
  });

  it('returns no duplicates, respects the count, and leaves the input untouched', () => {
    const pool = [recipe('a', 1), recipe('a', 1), recipe('b', 3), recipe('c', 4), recipe('d', 2)];
    const copy = JSON.stringify(pool);
    const picked = pickRecipes(pool, seeded(3), 3);
    expect(picked).toHaveLength(3);
    expect(new Set(picked.map((item) => item.id)).size).toBe(3);
    expect(pickRecipes(pool, seeded(3), 99)).toHaveLength(4);
    expect(JSON.stringify(pool)).toBe(copy);
  });

  it('is repeatable for a given seed, varies across seeds, and handles empty input', () => {
    const pool = Array.from({ length: 12 }, (_, i) => recipe(i, (i % 4) + 1));
    const ids = (seed) => pickRecipes(pool, seeded(seed), 5).map((item) => item.id).join();
    expect(ids(1)).toBe(ids(1));
    expect(new Set([1, 2, 3, 4, 5, 6].map(ids)).size).toBeGreaterThan(1);
    expect(pickRecipes([], seeded(1))).toEqual([]);
  });
});
