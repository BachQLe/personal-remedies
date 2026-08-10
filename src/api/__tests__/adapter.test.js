/**
 * adapter.test.js — Guard test for `numericIdToTier` (src/api/adapter.js),
 * pinning REMEDI_MASTER_PLAN.md §3.6:
 *
 *   "`Neutral`/`OK` = neutral *or* no data, never a safety guarantee."
 *
 * numericId 4 ("Neutral/OK") and a missing/out-of-range numericId are
 * INDISTINGUISHABLE at the tier level — both map to `null`. Callers must
 * never read a `null` tier as "this food is safe" — it may simply mean
 * Nutridigm has no data for this food+condition pair. See also
 * src/api/types.js's TierOrPoor typedef and adapter.js's `assessFood`
 * JSDoc, which keeps the raw `numericId` alongside `tier` for exactly this
 * reason (so UI that needs to distinguish "genuinely neutral" from
 * "unknown" can look past the collapsed tier).
 */
import { describe, expect, it } from 'vitest';
import { numericIdToTier } from '../adapter.js';

describe('numericIdToTier (master plan §3.6 — neutral/no-data is never a safety guarantee)', () => {
  it('maps 1/2/3 to the positive tiers', () => {
    expect(numericIdToTier(1)).toBe('Top');
    expect(numericIdToTier(2)).toBe('Strong');
    expect(numericIdToTier(3)).toBe('Good');
  });

  it('maps 5/6/7 to "poor" (harmful)', () => {
    expect(numericIdToTier(5)).toBe('poor');
    expect(numericIdToTier(6)).toBe('poor');
    expect(numericIdToTier(7)).toBe('poor');
  });

  // NOTE (guard, do not "fix"): numericId 4 collapses to null, the SAME
  // value returned for "no data at all" (undefined/out-of-range). A null
  // tier must never be rendered or treated as "safe" — it is neutral-OR-
  // unknown, not a positive safety claim. Downstream code that needs to
  // tell the two apart must consult the raw numericId (see
  // ConditionAssessment.numericId in adapter.js), not the tier.
  it('maps 4 (Neutral/OK) to null — NOT a safety guarantee, indistinguishable from "no data"', () => {
    expect(numericIdToTier(4)).toBeNull();
  });

  it('maps missing/out-of-range numericIds to null, same as 4', () => {
    expect(numericIdToTier(undefined)).toBeNull();
    expect(numericIdToTier(null)).toBeNull();
    expect(numericIdToTier(0)).toBeNull();
    expect(numericIdToTier(8)).toBeNull();
  });
});
