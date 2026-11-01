/**
 * /goodfor returns 400 XNOTALLOWED for any item in fine group 'x' (Smoking,
 * but also ~52 real foods like Beef and Eggs), so those cards showed nothing.
 * /detailed still lists them, and list membership is the verdict: the API
 * gives no descriptionNumericID for them, so no stars are ever made up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); });

const SMOKING = 986;

async function setup({ harmfulFor = [1], helpfulFor = [] } = {}) {
  class NutridigmAuthError extends Error {
    constructor(code, msg) { super(msg); this.name = 'NutridigmAuthError'; this.code = code; }
  }
  const fetchGoodFor = vi.fn(async () => { throw new Error('[nutridigm] Bad request: XNOTALLOWED'); });
  const fetchDetailed = vi.fn(async (csv, _group, listType) => {
    const ids = listType === 'harmful' ? harmfulFor : helpfulFor;
    return ids.includes(Number(csv)) ? [{ foodItemID: SMOKING, foodItemDisplayAs: 'Smoking/Tobacco', value: -2.5 }] : [];
  });
  vi.doMock('../nutridigm.js', () => ({
    fetchSuggest: vi.fn(), fetchGoodFor, fetchTopDoOrDonts: vi.fn(), fetchDetailed,
    fetchReferences: vi.fn(async () => ['NIH']), NutridigmAuthError,
  }));
  vi.doMock('../localTables.js', () => ({
    getItemTable: vi.fn(() => [{ foodItemID: SMOKING, description: 'Smoking/Tobacco', displayAs: 'Smoking/Tobacco', coarseFoodGroup: 'j', fineFoodGroup: 'x' }]),
    getConditionTable: vi.fn(() => [
      { healthConditionID: 1, description: 'High Cholesterol' },
      { healthConditionID: 2, description: 'High Blood Pressure' },
    ]),
    getGroupTable: vi.fn(() => []),
    getOverlayImageFile: vi.fn(() => undefined),
    getRecipeFlaggedItems: vi.fn(() => []),
  }));
  const adapter = await import('../adapter.js');
  return { adapter, fetchGoodFor, fetchDetailed };
}

describe('fine group x items on the food card', () => {
  it('never calls /goodfor, which rejects them', async () => {
    const { adapter, fetchGoodFor } = await setup();
    await adapter.assessFood(SMOKING, { conditions: [1] });
    expect(fetchGoodFor).not.toHaveBeenCalled();
  });

  it('reports a per-condition verdict from /detailed, with references and no stars', async () => {
    const { adapter } = await setup({ harmfulFor: [1], helpfulFor: [2] });
    const res = await adapter.assessFood(SMOKING, { conditions: [1, 2] });
    expect(res.perCondition[0]).toMatchObject({ conditionName: 'High Cholesterol', status: 'ok', verdict: 'harmful', numericId: null, referenceCount: 1 });
    expect(res.perCondition[1]).toMatchObject({ conditionName: 'High Blood Pressure', status: 'ok', verdict: 'helpful', numericId: null });
    expect(res.numericId).toBeNull();
  });

  it('says no data when /detailed lists the item under neither verdict', async () => {
    const { adapter } = await setup({ harmfulFor: [] });
    const res = await adapter.assessFood(SMOKING, { conditions: [1] });
    expect(res).toBeNull();
  });

  it('gives the Check against my profile sheet the same verdict', async () => {
    const { adapter } = await setup();
    const res = await adapter.getGoodForMe(SMOKING, { conditions: [1] });
    expect(res.rows[0]).toMatchObject({ status: 'ok', verdict: 'harmful', label: 'Ranked lower' });
    expect(res.overallNumericId).toBeNull();
  });
});
