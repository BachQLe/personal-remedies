/**
 * adapter.getFoodFacts.test.js — regression guard for getFoodFacts (adapter.js)
 * additively carrying the raw coarse `group`/`fineGroup` codes alongside its
 * existing display fields.
 *
 * FoodDetailCard's non-food icon rule (getNonFoodIcon) needs a group/
 * fineGroup pair even when the self-loaded assessFood() call fails/times
 * out and no assessment-sourced group is available. getFoodFacts is a
 * zero-network, dictionary-only lookup (unlike assessFood), so it's a safe
 * fallback source — this guards that it actually carries those codes.
 *
 * Aspirin (foodItemID 861) is a real dictionary entry: coarseFoodGroup 'j',
 * fineFoodGroup 'x' — `effectiveCoarseGroup` returns coarse as-is here
 * (only 'x' *coarse* triggers the fine-group-derived fallback), so
 * `group` stays 'j' while `fineGroup` is the raw 'x'.
 *
 * Mocks the local dictionary layer (`../localTables.js`) so this makes zero
 * real network calls and fully controls the fixture item.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../localTables.js', () => ({
  getItemTable: vi.fn(() => [
    {
      foodItemID: 861,
      description: 'Aspirin',
      displayAs: 'Aspirin',
      coarseFoodGroup: 'j',
      fineFoodGroup: 'x',
      longDescription: '',
    },
  ]),
  getConditionTable: vi.fn(() => []),
  getGroupTable: vi.fn(() => []),
  getOverlayImageFile: vi.fn(() => undefined),
}));

import { getFoodFacts } from '../adapter.js';

describe('getFoodFacts: additive group/fineGroup codes', () => {
  it('carries the raw coarse/fine codes for Aspirin (id 861) alongside the existing display fields', async () => {
    const facts = await getFoodFacts(861);
    expect(facts).not.toBeNull();
    expect(facts.group).toBe('j');
    expect(facts.fineGroup).toBe('x');
    // Existing fields stay intact (additive-only change).
    expect(facts.name).toBe('Aspirin');
    expect(typeof facts.groupLabel).toBe('string');
  });

  it('returns null for an id not in the dictionary (unchanged behavior)', async () => {
    const facts = await getFoodFacts(999999);
    expect(facts).toBeNull();
  });
});
