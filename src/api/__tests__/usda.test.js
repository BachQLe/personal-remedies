/**
 * usda.test.js — Guard tests for the thin USDA FoodData Central (FDC)
 * client (src/api/usda.js).
 *
 * src/api/usda.js is script-tier plumbing (see its file header) — it's
 * only ever imported by scripts/build-usda-map.mjs, never by the running
 * app. These tests mock `globalThis.fetch` directly — no real network
 * calls — and exist to pin the request shape (POST /foods/search,
 * POST /foods, api_key as a query param, never hardcoded) and error
 * behavior (FdcApiError carrying the HTTP status, so the build script can
 * special-case 429).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchFoods, getFoods, FdcApiError, FDC_DATA_TYPES } from '../usda.js';

/**
 * Build a minimal fetch Response stand-in.
 * @param {boolean} ok
 * @param {number} status
 * @param {any} body
 */
function fakeResponse(ok, status, body = {}) {
  return {
    ok,
    status,
    statusText: `status ${status}`,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('searchFoods', () => {
  it('requires an apiKey', async () => {
    await expect(searchFoods('peaches', {})).rejects.toThrow(/apiKey is required/);
  });

  it('requires a non-empty query', async () => {
    await expect(searchFoods('', { apiKey: 'DEMO_KEY' })).rejects.toThrow(/query must be a non-empty string/);
  });

  it('POSTs to /foods/search with api_key as a query param and the query/dataType/pageSize in the body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(fakeResponse(true, 200, { foods: [] }));

    await searchFoods('peaches raw', {
      apiKey: 'test-key-123',
      dataType: ['Foundation', 'SR Legacy'],
      pageSize: 10,
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = globalThis.fetch.mock.calls[0];
    const parsedUrl = new URL(url);
    expect(parsedUrl.pathname).toMatch(/\/foods\/search$/);
    expect(parsedUrl.searchParams.get('api_key')).toBe('test-key-123');
    expect(init.method).toBe('POST');

    const body = JSON.parse(init.body);
    expect(body.query).toBe('peaches raw');
    expect(body.dataType).toEqual(['Foundation', 'SR Legacy']);
    expect(body.pageSize).toBe(10);
  });

  it('never hardcodes an API key — the value sent is exactly what the caller passed', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(fakeResponse(true, 200, { foods: [] }));
    await searchFoods('cod', { apiKey: 'DEMO_KEY' });
    const url = new URL(globalThis.fetch.mock.calls[0][0]);
    expect(url.searchParams.get('api_key')).toBe('DEMO_KEY');
  });

  it('throws FdcApiError with the HTTP status on a non-ok response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(fakeResponse(false, 429, { error: 'rate limited' }));

    const err = await searchFoods('cod', { apiKey: 'DEMO_KEY' }).catch((e) => e);
    expect(err).toBeInstanceOf(FdcApiError);
    expect(err.status).toBe(429);
  });

  it('resolves with the parsed JSON body on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(fakeResponse(true, 200, { foods: [{ fdcId: 1 }] }));
    await expect(searchFoods('cod', { apiKey: 'DEMO_KEY' })).resolves.toEqual({ foods: [{ fdcId: 1 }] });
  });
});

describe('getFoods', () => {
  it('requires an apiKey', async () => {
    await expect(getFoods([1, 2], {})).rejects.toThrow(/apiKey is required/);
  });

  it('requires a non-empty fdcIds array', async () => {
    await expect(getFoods([], { apiKey: 'DEMO_KEY' })).rejects.toThrow(/fdcIds must be a non-empty array/);
    await expect(getFoods(undefined, { apiKey: 'DEMO_KEY' })).rejects.toThrow(/fdcIds must be a non-empty array/);
  });

  it('POSTs to the batch /foods endpoint with fdcIds and format:"full" by default', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(fakeResponse(true, 200, []));

    await getFoods([325430, 173944], { apiKey: 'test-key-123' });

    const [url, init] = globalThis.fetch.mock.calls[0];
    const parsedUrl = new URL(url);
    expect(parsedUrl.pathname).toMatch(/\/foods$/);
    expect(parsedUrl.searchParams.get('api_key')).toBe('test-key-123');
    expect(init.method).toBe('POST');

    const body = JSON.parse(init.body);
    expect(body.fdcIds).toEqual([325430, 173944]);
    expect(body.format).toBe('full');
  });

  it('honors an explicit format override', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(fakeResponse(true, 200, []));
    await getFoods([1], { apiKey: 'DEMO_KEY', format: 'abridged' });
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.format).toBe('abridged');
  });

  it('throws FdcApiError with the HTTP status on a non-ok response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(fakeResponse(false, 403, { error: 'forbidden' }));
    const err = await getFoods([1], { apiKey: 'bad-key' }).catch((e) => e);
    expect(err).toBeInstanceOf(FdcApiError);
    expect(err.status).toBe(403);
  });
});

describe('FDC_DATA_TYPES', () => {
  it('includes Branded — this module does not enforce the "never Branded" policy; the build script does', () => {
    expect(FDC_DATA_TYPES).toContain('Branded');
    expect(FDC_DATA_TYPES).toContain('Foundation');
    expect(FDC_DATA_TYPES).toContain('SR Legacy');
  });
});
