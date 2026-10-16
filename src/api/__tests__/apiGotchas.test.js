/**
 * apiGotchas.test.js — checklist 3.6. The three Nutridigm API gotchas, pinned
 * across the client (nutridigm.js) AND the code that consumes it, so a
 * regression in either layer fails loudly:
 *
 *   1. HTTP 220 = success-with-empty (not an error, not data).
 *   2. Neutral/OK is never a safety guarantee — a neutral (numericId 4) or
 *      unscored item is never given a positive tier/rating or a "good"
 *      verdict, and unscored is never silently turned into neutral.
 *   3. `suggest` takes `fineFoodGroup`; `detailed` takes `coarseFoodGroup`.
 *
 * Overlaps nutridigm.test.js / saveGate.test.js / rating.test.js on purpose
 * only where needed; this file adds the other wrappers, the adapter hop and
 * the verdict layer. `fetch` is mocked — no real network calls.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchHealthConditions, fetchFoodItems, fetchFoodGroups, fetchGoodFor,
  fetchTopDoOrDonts, fetchSuggest, fetchDetailed, fetchReferences,
} from '../nutridigm.js';
import { numericIdToRating } from '../../utils/rating.js';
import { getSaveBlockReason, recipeToSaveItem } from '../../utils/saveGate.js';
import { summarizeGoodForMe } from '../../screens/search/goodForMe.js';

const res = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  statusText: `status ${status}`,
  json: vi.fn(async () => body),
});
// A real 220 carries no JSON body — parsing it would throw.
const res220 = () => ({
  ...res(220),
  json: vi.fn(async () => { throw new SyntaxError('Unexpected end of JSON input'); }),
});

const urlOf = (call) => new URL(call[0]);

/** Fresh adapter (fresh cache) over the REAL client, with only the local tables stubbed. */
async function freshAdapter() {
  vi.resetModules();
  vi.doMock('../localTables.js', () => ({
    getItemTable: vi.fn(() => [{ foodItemID: 7, description: 'Broccoli', displayAs: 'Broccoli', coarseFoodGroup: 'e', fineFoodGroup: 'e' }]),
    getConditionTable: vi.fn(() => [{ healthConditionID: 203, description: 'Aging' }]),
    getGroupTable: vi.fn(() => []),
    getOverlayImageFile: vi.fn(() => undefined),
  }));
  return import('../adapter.js');
}

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.doUnmock('../localTables.js');
});

describe('gotcha 1: HTTP 220 = success-with-empty', () => {
  it.each([
    ['fetchHealthConditions', () => fetchHealthConditions(), []],
    ['fetchFoodItems', () => fetchFoodItems(), []],
    ['fetchFoodGroups', () => fetchFoodGroups(), []],
    ['fetchTopDoOrDonts', () => fetchTopDoOrDonts('203', 'consume'), []],
    ['fetchSuggest', () => fetchSuggest('203', 'b1'), []],
    ['fetchDetailed', () => fetchDetailed('203', 'e'), []],
    ['fetchReferences', () => fetchReferences(203, 7), []],
    ['fetchGoodFor', () => fetchGoodFor(7, '203'), null],
  ])('%s resolves a 220 to its empty value without parsing a body', async (_name, call, empty) => {
    const response = res220();
    globalThis.fetch = vi.fn().mockResolvedValue(response);

    await expect(call()).resolves.toEqual(empty);
    expect(response.json).not.toHaveBeenCalled(); // empty, so not data
  });

  it('is specific to 220: other non-2xx statuses still reject', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(res(500, {}));
    await expect(fetchSuggest('203', 'b1')).rejects.toThrow(/HTTP 500/);
  });

  it('end to end, a 220 /goodfor is a "nodata" row (no tier, no numericId) and a verdict of "unknown"', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(res220());
    const adapter = await freshAdapter();

    const { rows } = await adapter.getGoodForMe(7, { conditions: [203] });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'nodata', tier: null, numericId: null });
    expect(summarizeGoodForMe(rows).kind).toBe('unknown');
  });
});

describe('gotcha 2: Neutral/OK is never a safety guarantee', () => {
  it('numericIdToTier gives positive tiers to 1-3 only; 4 and anything unknown get none', async () => {
    const { numericIdToTier } = await freshAdapter();
    expect([1, 2, 3, 4, 5, 6, 7].map(numericIdToTier)).toEqual(['Top', 'Strong', 'Good', null, 'poor', 'poor', 'poor']);
    for (const bad of [undefined, null, 0, 8, NaN]) expect(numericIdToTier(bad)).toBeNull();
  });

  it('numericIdToRating shows stars for 1-3 only; 4 is neutral with nothing to show', () => {
    expect([1, 2, 3].map((n) => numericIdToRating(n).kind)).toEqual(['star', 'star', 'star']);
    expect(numericIdToRating(4)).toEqual({ kind: 'neutral', count: 0 });
    expect(numericIdToRating(undefined)).toBeNull();
  });

  it('getSaveBlockReason blocks an unscored recipe, so "no data" is never treated as saveable-by-default', () => {
    expect(getSaveBlockReason({ kind: 'recipe', numericId: null, tier: null })).toBe('unscored');
    expect(getSaveBlockReason({ kind: 'recipe' })).toBe('unscored');
    expect(getSaveBlockReason(recipeToSaveItem({ id: 1, title: 'No score yet' }))).toBe('unscored');
  });

  it('getSaveBlockReason only blocks ingredient/harmful/unscored: neutral is "scored", not safe', () => {
    // The gate is a block-list. A neutral recipe passes because it IS scored
    // (and not harmful); that is not an endorsement — its tier stays null.
    expect(getSaveBlockReason({ kind: 'recipe', numericId: 4, tier: null })).toBeNull();
    expect(getSaveBlockReason({ kind: 'food', numericId: 4, tier: null })).toBe('ingredient');
    expect(getSaveBlockReason({ kind: 'recipe', numericId: 5, tier: 'poor' })).toBe('harmful');
  });

  it('summarizeGoodForMe never turns neutral or unscored rows into a "good" verdict', () => {
    const neutral = { conditionName: 'A', status: 'ok', numericId: 4 };
    const nodata = { conditionName: 'B', status: 'nodata', numericId: null };

    expect(summarizeGoodForMe([neutral]).kind).toBe('neutral');
    expect(summarizeGoodForMe([neutral, nodata])).toMatchObject({ kind: 'neutral', unscored: 1 });
    expect(summarizeGoodForMe([nodata]).kind).toBe('unknown');
    // Only a real 1-3 can produce "good".
    expect(summarizeGoodForMe([{ conditionName: 'A', status: 'ok', numericId: 3 }]).kind).toBe('good');
  });
});

describe('gotcha 3: suggest takes fineFoodGroup, detailed takes coarseFoodGroup', () => {
  it('the client puts each group on the right endpoint under the right name', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(res(200, []));

    await fetchSuggest('203,244', 'b1');
    await fetchDetailed('203,244', 'e', 'harmful');

    const suggest = urlOf(globalThis.fetch.mock.calls[0]);
    expect(suggest.pathname).toMatch(/\/suggest$/);
    expect(Object.fromEntries(suggest.searchParams)).toEqual({
      subscriptionID: 'test-subscription-id',
      healthConditionID: '203,244',
      fineFoodGroup: 'b1',
    });

    const detailed = urlOf(globalThis.fetch.mock.calls[1]);
    expect(detailed.pathname).toMatch(/\/detailed$/);
    expect(Object.fromEntries(detailed.searchParams)).toEqual({
      subscriptionID: 'test-subscription-id',
      healthConditionID: '203,244',
      coarseFoodGroup: 'e',
      listType: 'harmful',
    });
  });

  it('detailed defaults to listType=helpful', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(res(200, []));
    await fetchDetailed('203', 'e');
    expect(urlOf(globalThis.fetch.mock.calls[0]).searchParams.get('listType')).toBe('helpful');
  });

  it('through the adapter: a fine group reaches /suggest and a coarse group reaches /detailed', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(res(200, []));
    const adapter = await freshAdapter();
    const profile = { conditions: [203] };

    await adapter.getFineGroupSuggestions(profile, 'b1');
    await adapter.getCategoryDetail(profile, 'e', 'helpful');

    const urls = globalThis.fetch.mock.calls.map(urlOf);
    const suggest = urls.find((u) => u.pathname.endsWith('/suggest'));
    const detailed = urls.find((u) => u.pathname.endsWith('/detailed'));
    expect(suggest.searchParams.get('fineFoodGroup')).toBe('b1');
    expect(suggest.searchParams.has('coarseFoodGroup')).toBe(false);
    expect(detailed.searchParams.get('coarseFoodGroup')).toBe('e');
    expect(detailed.searchParams.has('fineFoodGroup')).toBe(false);
  });
});
