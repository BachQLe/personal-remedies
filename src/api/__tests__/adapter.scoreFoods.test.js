/**
 * scoreFoods (1.26, Prompt B 4): the profile-change prune re-scores every
 * stored recipe and item on /goodfor. A row /goodfor can't rate stays
 * unscored (kept); an outage rejects so the prune never reads it as "nothing
 * to remove".
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); });

const ITEMS = [
  { foodItemID: 502, displayAs: 'Whole-wheat English muffins', coarseFoodGroup: 'f', fineFoodGroup: 'f' },
  { foodItemID: 5028, displayAs: 'Smoothie', fineFoodGroup: 'l' },
  { foodItemID: 5029, displayAs: 'Not rated yet', fineFoodGroup: 'l' },
];

class NutridigmAuthError extends Error {
  constructor(code, msg) { super(msg); this.name = 'NutridigmAuthError'; this.code = code; }
}

async function setup(goodFor) {
  const fetchGoodFor = vi.fn(goodFor);
  vi.doMock('../nutridigm.js', () => ({
    fetchSuggest: vi.fn(async () => []), fetchGoodFor, fetchTopDoOrDonts: vi.fn(), fetchDetailed: vi.fn(),
    fetchReferences: vi.fn(async () => []), NutridigmAuthError,
  }));
  vi.doMock('../localTables.js', () => ({
    getItemTable: vi.fn(() => ITEMS),
    getConditionTable: vi.fn(() => [{ healthConditionID: 203, description: 'Aging' }]),
    getGroupTable: vi.fn(() => []),
    getOverlayImageFile: vi.fn(() => undefined),
    getRecipeFlaggedItems: vi.fn(() => []),
  }));
  return { adapter: await import('../adapter.js'), fetchGoodFor };
}

describe('scoreFoods', () => {
  it('rates every stored id, items included; a 400 or empty answer leaves it unscored; unknown ids are skipped', async () => {
    const { adapter, fetchGoodFor } = await setup(async (id) => {
      if (id === 5029) throw new Error('[nutridigm] Bad request: XNOTALLOWED');
      return { descriptionNumericID: id === 502 ? 6 : 2 };
    });
    const scores = await adapter.scoreFoods({ conditions: [203] }, [502, '5028', 5029, 502, 4242]);
    expect([...scores]).toEqual([['502', 6], ['5028', 2]]);
    expect(fetchGoodFor.mock.calls.map((c) => c[0]).sort()).toEqual([502, 5028, 5029]);
  });

  it('rejects on any other failure, so an outage is never "nothing to remove"', async () => {
    const { adapter } = await setup(async () => { throw new Error('[nutridigm] HTTP 503: Service Unavailable'); });
    await expect(adapter.scoreFoods({ conditions: [203] }, [502])).rejects.toThrow('503');
  });

  it('scores nothing without conditions', async () => {
    const { adapter, fetchGoodFor } = await setup(async () => ({ descriptionNumericID: 6 }));
    expect((await adapter.scoreFoods({ conditions: [] }, [502])).size).toBe(0);
    expect(fetchGoodFor).not.toHaveBeenCalled();
  });
});
