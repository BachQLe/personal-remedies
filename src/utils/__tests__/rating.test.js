/**
 * rating.test.js — Guard test for `isHarmfulNumericId` (src/utils/rating.js),
 * the companion check to adapter.test.js's `numericIdToTier` pin. Together
 * they encode REMEDI_MASTER_PLAN.md §3.6: numericId 4 is neutral-or-no-data
 * (never a safety guarantee), and only 5-7 are the genuinely harmful,
 * skull-rated band that saveGate.js gates saves on.
 */
import { describe, expect, it } from 'vitest';
import { isHarmfulNumericId, numericIdToRating } from '../rating.js';

describe('isHarmfulNumericId (master plan §3.6)', () => {
  it('is true for the harmful band (5-7)', () => {
    expect(isHarmfulNumericId(5)).toBe(true);
    expect(isHarmfulNumericId(6)).toBe(true);
    expect(isHarmfulNumericId(7)).toBe(true);
  });

  // NOTE: 4 ("Neutral/OK") is explicitly NOT harmful here, but that is a
  // narrower claim than "safe" — see adapter.test.js's numericIdToTier
  // guard. isHarmfulNumericId only answers "should this be skull-gated",
  // not "does Nutridigm have positive data for this food".
  it('is false for 1-4 (positive tiers + neutral/no-data)', () => {
    expect(isHarmfulNumericId(1)).toBe(false);
    expect(isHarmfulNumericId(2)).toBe(false);
    expect(isHarmfulNumericId(3)).toBe(false);
    expect(isHarmfulNumericId(4)).toBe(false);
  });

  it('is false for missing/non-finite input rather than throwing', () => {
    expect(isHarmfulNumericId(undefined)).toBe(false);
    expect(isHarmfulNumericId(null)).toBe(false);
    expect(isHarmfulNumericId(NaN)).toBe(false);
  });
});

describe('numericIdToRating: 4 is an explicit neutral rating, distinct from out-of-range null', () => {
  // Unlike adapter.js's numericIdToTier (which collapses 4 into the same
  // null as "no data"), rating.js's 7-step ladder keeps 4 as its own
  // explicit `{ kind: 'neutral' }` entry — see RATING_BY_NUMERIC_ID. Only
  // truly missing/out-of-range numericIds fall through to null.
  it('maps 4 to the neutral rating (not null)', () => {
    expect(numericIdToRating(4)).toEqual({ kind: 'neutral', count: 0 });
  });

  it('maps missing/out-of-range numericIds to null', () => {
    expect(numericIdToRating(undefined)).toBeNull();
    expect(numericIdToRating(0)).toBeNull();
    expect(numericIdToRating(8)).toBeNull();
  });
});
