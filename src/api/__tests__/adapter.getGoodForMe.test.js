/**
 * adapter.getGoodForMe.test.js — per-condition "Good for me?" lookup:
 * one /goodfor call per condition, notes kept, unauthorized/error/no-data
 * isolated to their own row, no demo-condition fallback, cache reuse.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

async function setup(impl) {
  class NutridigmAuthError extends Error {
    constructor(code, msg) { super(msg); this.name = 'NutridigmAuthError'; this.code = code; }
  }
  const fetchGoodFor = vi.fn((foodId, csv) => impl(foodId, csv, NutridigmAuthError));
  vi.doMock('../nutridigm.js', () => ({
    fetchSuggest: vi.fn(), fetchGoodFor, fetchTopDoOrDonts: vi.fn(), fetchDetailed: vi.fn(),
    fetchReferences: vi.fn(async () => []), NutridigmAuthError,
  }));
  vi.doMock('../localTables.js', () => ({
    getItemTable: vi.fn(() => [{ foodItemID: 7, description: 'Broccoli', displayAs: 'Broccoli', coarseFoodGroup: 'e', fineFoodGroup: 'e' }]),
    getConditionTable: vi.fn(() => [
      { healthConditionID: 203, description: 'Aging' },
      { healthConditionID: 244, description: 'Pneumonia' },
      { healthConditionID: 999, description: 'Other' },
    ]),
    getGroupTable: vi.fn(() => []),
    getOverlayImageFile: vi.fn(() => undefined),
  }));
  const adapter = await import('../adapter.js');
  return { adapter, fetchGoodFor };
}

describe('getGoodForMe', () => {
  it('merges per-condition results with label, tier and notes', async () => {
    const { adapter, fetchGoodFor } = await setup(async (_f, csv) =>
      csv === '203'
        ? { value: 1.9, description: 'More Helpful', descriptionNumericID: 2, notes: ' Rich in X. ' }
        : { value: 0.1, description: 'Neutral / OK', descriptionNumericID: 4, notes: '' });
    const res = await adapter.getGoodForMe(7, { conditions: [203, 244] });
    expect(fetchGoodFor).toHaveBeenCalledTimes(2);
    expect(res.foodName).toBe('Broccoli');
    expect(res.rows[0]).toMatchObject({ conditionName: 'Aging', status: 'ok', tier: 'Strong', label: 'More Helpful', notes: 'Rich in X.' });
    expect(res.rows[1]).toMatchObject({ conditionName: 'Pneumonia', status: 'ok', numericId: 4, tier: null });
  });

  it('marks an unauthorized condition without failing the others or retrying demo conditions', async () => {
    const { adapter, fetchGoodFor } = await setup(async (_f, csv, Err) => {
      if (csv === '999') throw new Err('NOTAUTHORIZEDHEALTHID', 'nope');
      return { value: 1, description: 'Helpful', descriptionNumericID: 3, notes: '' };
    });
    const res = await adapter.getGoodForMe(7, { conditions: [203, 999] });
    expect(res.rows.map((r) => r.status)).toEqual(['ok', 'unauthorized']);
    expect(fetchGoodFor.mock.calls.map((c) => c[1])).toEqual(['203', '999']);
  });

  it('reports other failures as error and empty responses as nodata', async () => {
    const { adapter } = await setup(async (_f, csv, Err) => {
      if (csv === '203') throw new Err('APIDAILYLIMITREACHED', 'limit');
      return null;
    });
    const res = await adapter.getGoodForMe(7, { conditions: [203, 244] });
    expect(res.rows[0]).toMatchObject({ status: 'error', errorCode: 'APIDAILYLIMITREACHED' });
    expect(res.rows[1].status).toBe('nodata');
  });

  it('serves a repeat lookup from cache (no extra calls) and makes none for an empty profile', async () => {
    const { adapter, fetchGoodFor } = await setup(async () => ({ value: 1, description: 'Helpful', descriptionNumericID: 3, notes: '' }));
    await adapter.getGoodForMe(7, { conditions: [203] });
    await adapter.getGoodForMe(7, { conditions: [203] });
    expect(fetchGoodFor).toHaveBeenCalledTimes(1);
    const empty = await adapter.getGoodForMe(7, { conditions: [] });
    expect(empty.rows).toEqual([]);
    expect(fetchGoodFor).toHaveBeenCalledTimes(1);
  });
});
