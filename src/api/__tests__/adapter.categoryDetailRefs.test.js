/**
 * adapter.categoryDetailRefs.test.js — perf regression guard for
 * `getCategoryDetail` (Food Groups list drill-down, adapter.js's
 * `getCategoryDetailRaw`).
 *
 * A `/detailed` response can carry 100-130+ items. `getCategoryDetailRaw`
 * used to fan a per-item `/references` fetch out over ALL of them
 * concurrently just to populate a "N studies" count, which overwhelmed
 * Nutridigm (HTTP 500s, "Connection problem" failures cascading into
 * downstream card loads). It must now populate `referenceTotal` CACHE-ONLY
 * via `getCachedRefCount` — exactly like TopDosTab's list view — and make
 * ZERO `/references` calls from this path, no matter how many items come
 * back.
 *
 * Mocks the fetch layer (`../nutridigm.js`) and the local dictionary layer
 * (`../localTables.js`) so this makes zero real network calls, following
 * the same mocking pattern as adapter.snacksPool.test.js /
 * adapter.categoryScoped.test.js.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../nutridigm.js', () => ({
  fetchSuggest: vi.fn(),
  fetchGoodFor: vi.fn(),
  fetchTopDoOrDonts: vi.fn(),
  fetchDetailed: vi.fn(),
  fetchReferences: vi.fn(),
  NutridigmAuthError: class NutridigmAuthError extends Error {},
}));

vi.mock('../localTables.js', () => ({
  getItemTable: vi.fn(),
  getConditionTable: vi.fn(),
  getGroupTable: vi.fn(() => []),
  getOverlayImageFile: vi.fn(() => undefined),
}));

import { fetchDetailed, fetchReferences } from '../nutridigm.js';
import { getCategoryDetail } from '../adapter.js';

/** Stand-in for a large `/detailed` response — big enough to make a fan-out obvious if reintroduced. */
const DETAILED_ITEMS = Array.from({ length: 120 }, (_, i) => ({
  foodItemID: 1000 + i,
  foodItemDisplayAs: `Item ${i}`,
  description: `Item ${i}`,
  notes: '',
  value: 1,
  healthConditionID: 9001,
}));

describe('getCategoryDetail: study count is cache-only, never fans out /references (perf fix)', () => {
  /** @type {Awaited<ReturnType<typeof getCategoryDetail>>} */
  let result;

  beforeAll(async () => {
    fetchDetailed.mockResolvedValue(DETAILED_ITEMS);

    result = await getCategoryDetail({ conditions: [9001] }, 'b', 'helpful');
  });

  it('returns every item from the /detailed response', () => {
    expect(result.items.length).toBe(DETAILED_ITEMS.length);
  });

  it('makes ZERO /references calls, even for a 120-item list', () => {
    expect(fetchReferences).not.toHaveBeenCalled();
  });

  it('leaves referenceTotal null (unknown) for items with no already-cached reference data', () => {
    for (const item of result.items) {
      expect(item.referenceTotal).toBeNull();
    }
  });
});
