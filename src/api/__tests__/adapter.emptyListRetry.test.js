/** An empty /detailed answer must not stick for 8h, or a retry can never recover (3.1). */
import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); });

describe('getCategoryDetail with an empty response', () => {
  it('asks the API again next time, then caches the real list', async () => {
    const fetchDetailed = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ foodItemID: 7, foodItemDisplayAs: 'Broccoli' }]);
    vi.doMock('../nutridigm.js', () => ({
      fetchSuggest: vi.fn(), fetchGoodFor: vi.fn(), fetchTopDoOrDonts: vi.fn(), fetchDetailed,
      fetchReferences: vi.fn(), NutridigmAuthError: class extends Error {},
    }));
    const adapter = await import('../adapter.js');
    const profile = { conditions: [1] };
    expect((await adapter.getCategoryDetail(profile, 'e', 'helpful')).items).toEqual([]);
    expect((await adapter.getCategoryDetail(profile, 'e', 'helpful')).items).toHaveLength(1);
    await adapter.getCategoryDetail(profile, 'e', 'helpful');
    expect(fetchDetailed).toHaveBeenCalledTimes(2);
  });
});
