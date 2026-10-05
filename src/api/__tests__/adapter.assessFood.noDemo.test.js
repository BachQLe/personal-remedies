/**
 * assessFood: no demo-condition fallback; unauthorized conditions are
 * reported as unscorable rows; a single-condition profile yields its one row.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); });

async function setup(impl) {
  class NutridigmAuthError extends Error {
    constructor(code, msg) { super(msg); this.name = 'NutridigmAuthError'; this.code = code; }
  }
  const fetchGoodFor = vi.fn((foodId, csv) => impl(foodId, csv, NutridigmAuthError));
  vi.doMock('../nutridigm.js', () => ({
    fetchSuggest: vi.fn(), fetchGoodFor, fetchTopDoOrDonts: vi.fn(), fetchDetailed: vi.fn(),
    fetchReferences: vi.fn(async () => ['A study']), NutridigmAuthError,
  }));
  vi.doMock('../localTables.js', () => ({
    getItemTable: vi.fn(() => [{ foodItemID: 7, description: 'Broccoli', displayAs: 'Broccoli', coarseFoodGroup: 'e', fineFoodGroup: 'e' }]),
    getConditionTable: vi.fn(() => [
      { healthConditionID: 203, description: 'Aging' },
      { healthConditionID: 244, description: 'Pneumonia' },
      { healthConditionID: 50, description: 'Other' },
    ]),
    getGroupTable: vi.fn(() => []),
    getOverlayImageFile: vi.fn(() => undefined),
  }));
  const adapter = await import('../adapter.js');
  return { adapter, fetchGoodFor };
}

const ok = { value: 1.9, description: 'More Helpful', descriptionNumericID: 2, notes: '' };

describe('assessFood without demo fallback', () => {
  it('reports an unauthorized condition as unscorable and never retries other conditions', async () => {
    const { adapter, fetchGoodFor } = await setup(async (_f, csv, Err) => {
      if (csv.split(',').includes('50')) throw new Err('NOTAUTHORIZEDHEALTHID', 'nope');
      return ok;
    });
    const res = await adapter.assessFood(7, { conditions: [203, 50] });
    expect(res.perCondition).toHaveLength(2);
    expect(res.perCondition[0]).toMatchObject({ conditionId: 203, status: 'ok', numericId: 2 });
    expect(res.perCondition[1]).toMatchObject({ conditionId: 50, status: 'unauthorized', numericId: null, tier: null });
    const requested = fetchGoodFor.mock.calls.map((c) => c[1]);
    expect(requested).not.toContain('244');
    expect(requested).not.toContain('203,244');
  });

  it('returns an assessment of all-unscorable rows (not null) when every condition is unauthorized', async () => {
    const { adapter } = await setup(async (_f, _c, Err) => { throw new Err('NOTAUTHORIZEDHEALTHID', 'nope'); });
    const res = await adapter.assessFood(7, { conditions: [50] });
    expect(res.tier).toBeNull();
    expect(res.perCondition.map((r) => r.status)).toEqual(['unauthorized']);
  });

  it('produces the one row for a single-condition profile', async () => {
    const { adapter } = await setup(async () => ok);
    const res = await adapter.assessFood(7, { conditions: [203] });
    expect(res.perCondition).toHaveLength(1);
    expect(res.perCondition[0]).toMatchObject({ conditionName: 'Aging', status: 'ok', numericId: 2, referenceCount: 1 });
    expect(res.numericId).toBe(2);
  });

  it('returns null with no conditions', async () => {
    const { adapter, fetchGoodFor } = await setup(async () => ok);
    expect(await adapter.assessFood(7, { conditions: [] })).toBeNull();
    expect(fetchGoodFor).not.toHaveBeenCalled();
  });
});
