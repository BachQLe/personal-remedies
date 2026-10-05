import { describe, it, expect, beforeEach, vi } from 'vitest';

const store = {};
vi.mock('../storage.js', () => ({
  storage: {
    get: (k, f = null) => (k in store ? store[k] : f),
    set: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
  },
}));
vi.mock('../config.js', () => ({
  NUTRIDIGM_BASE_URL: 'https://example.test/api/v2',
  NUTRIDIGM_SUBSCRIPTION_ID: 'x',
  NUTRIDIGM_PROXY_URL: '',
  IS_CONFIGURED: true,
}));

import { fetchGoodFor, getDailyRequestCounts, getTodayRequestCounts } from '../nutridigm.js';

function localKey(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

describe('daily request counts', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    vi.useRealTimers();
    globalThis.fetch = vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ status: 200, data: [] }), text: async () => '[]',
    }));
  });

  it('persists a per-day, per-endpoint count for real requests', async () => {
    await fetchGoodFor('1', 'a').catch(() => {});
    await fetchGoodFor('2', 'b').catch(() => {});
    const today = getTodayRequestCounts();
    expect(Object.values(today).reduce((a, b) => a + b, 0)).toBe(2);
    expect(Object.keys(getDailyRequestCounts())).toEqual([localKey(new Date())]);
  });

  it('keeps only the last 14 days and returns copies', async () => {
    const days = {};
    for (let i = 1; i <= 20; i++) days[`2020-01-${String(i).padStart(2, '0')}`] = { goodfor: i };
    store.requestCounts = days;
    await fetchGoodFor('3', 'c').catch(() => {});
    const all = getDailyRequestCounts();
    expect(Object.keys(all)).toHaveLength(14);
    expect(all['2020-01-01']).toBeUndefined();
    expect(all['2020-01-20']).toEqual({ goodfor: 20 });
    all['2020-01-20'].goodfor = 999;
    expect(getDailyRequestCounts('2020-01-20')).toEqual({ goodfor: 20 });
  });

  it('tolerates corrupt stored data', async () => {
    store.requestCounts = 'garbage';
    expect(getDailyRequestCounts()).toEqual({});
    await fetchGoodFor('4', 'd').catch(() => {});
    expect(Object.values(getTodayRequestCounts()).reduce((a, b) => a + b, 0)).toBe(1);
  });
});
