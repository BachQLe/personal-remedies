/**
 * nutridigm.test.js — Guard tests for the raw Nutridigm HTTP client
 * (src/api/nutridigm.js), pinning the API gotchas from REMEDI_MASTER_PLAN.md
 * §3.6:
 *
 *   "HTTP 220 = success-with-empty (not an error) · `suggest` takes
 *   `fineFoodGroup`, `detailed` takes `coarseFoodGroup`."
 *
 * All tests mock `globalThis.fetch` directly — no real network calls.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchGoodFor, fetchSuggest, fetchDetailed } from '../nutridigm.js';
import { NUTRIDIGM_SUBSCRIPTION_ID, NUTRIDIGM_BASE_URL } from '../config.js';

/**
 * Build a minimal fetch Response stand-in. Only `status` and `json()` are
 * read by performRequest, so that's all this needs to implement.
 * @param {number} status
 * @param {any} body
 * @returns {{ status: number, json: () => Promise<any> }}
 */
function fakeResponse(status, body = {}) {
  return {
    status,
    statusText: `status ${status}`,
    json: async () => body,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('vitest env wiring (smoke check)', () => {
  it('reads deterministic Nutridigm config through import.meta.env', () => {
    // Pinned via vitest.config.js `test.env` — NOT the developer's local
    // .env — so this suite behaves identically on any machine/CI.
    expect(NUTRIDIGM_SUBSCRIPTION_ID).toBe('test-subscription-id');
    expect(NUTRIDIGM_BASE_URL).toBe('https://test.nutridigm.example/api/v2');
  });
});

describe('HTTP 220 = success-with-empty, not an error (master plan §3.3/§3.6)', () => {
  it('a raw (non-coalescing) wrapper resolves 220 to null — fetchGoodFor returns `request()`\'s result untouched', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(fakeResponse(220));

    await expect(fetchGoodFor(111, '203')).resolves.toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('a coalescing wrapper resolves 220 to [] — fetchSuggest applies `?? []` over the null', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(fakeResponse(220));

    await expect(fetchSuggest('203', 'b1')).resolves.toEqual([]);
  });

  it('400 NOFOODITEMSFORGROUP resolves to [] rather than throwing (data gap, not an error)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      fakeResponse(400, { code: 'NOFOODITEMSFORGROUP', message: 'no items for group' })
    );

    await expect(fetchDetailed('203', 'k', 'helpful')).resolves.toEqual([]);
  });

  it('any other 400 code still throws (only NOFOODITEMSFORGROUP is special-cased)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      fakeResponse(400, { code: 'IVHEALTHCONDITIONID', message: 'invalid condition id' })
    );

    await expect(fetchDetailed('999999', 'k', 'helpful')).rejects.toThrow(/IVHEALTHCONDITIONID/);
  });
});

describe('/suggest takes fineFoodGroup, /detailed takes coarseFoodGroup (master plan §3.6)', () => {
  it('fetchSuggest sends fineFoodGroup and NOT coarseFoodGroup', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(fakeResponse(200, []));

    await fetchSuggest('244', 'e');

    const calledUrl = new URL(globalThis.fetch.mock.calls[0][0]);
    expect(calledUrl.pathname).toMatch(/\/suggest$/);
    expect(calledUrl.searchParams.get('fineFoodGroup')).toBe('e');
    expect(calledUrl.searchParams.has('coarseFoodGroup')).toBe(false);
  });

  it('fetchDetailed sends coarseFoodGroup and NOT fineFoodGroup', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(fakeResponse(200, []));

    await fetchDetailed('244', 'k', 'harmful');

    const calledUrl = new URL(globalThis.fetch.mock.calls[0][0]);
    expect(calledUrl.pathname).toMatch(/\/detailed$/);
    expect(calledUrl.searchParams.get('coarseFoodGroup')).toBe('k');
    expect(calledUrl.searchParams.has('fineFoodGroup')).toBe(false);
  });
});
