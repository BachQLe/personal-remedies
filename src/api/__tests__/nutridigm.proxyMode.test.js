/**
 * nutridigm.proxyMode.test.js — Guard tests for the proxy-mode switch
 * (Task T3B): `NUTRIDIGM_PROXY_URL` in config.js and the URL-building branch
 * it drives in nutridigm.js's `request()`.
 *
 * Two URL shapes, chosen by config (REMEDI_MASTER_PLAN.md §3.1/§3.2):
 *   - Proxy mode (production) — `<NUTRIDIGM_PROXY_URL>/<endpoint>?<params>`,
 *     no `subscriptionID` sent (the deployed Supabase function injects its
 *     own from a secret and strips any client-supplied value).
 *   - Direct mode (local dev, proxy unset) — `<NUTRIDIGM_BASE_URL>/<endpoint>`
 *     + a `subscriptionID` query param, unchanged from pre-proxy behavior.
 * Proxy wins when both are set; neither set throws NutridigmConfigError.
 *
 * config.js reads `import.meta.env` into top-level `const` exports at
 * module-load time, and vitest.config.js globally pins the Nutridigm env
 * vars via `test.env` (see nutridigm.test.js's own comment on this) — so
 * unlike that file, these tests each need their OWN, different env
 * combination. The pattern (confirmed against this exact config.js/
 * nutridigm.js pair before writing this suite): `vi.stubEnv()` to set this
 * test's env vars (this CAN override the globally-pinned `test.env`
 * defaults), `vi.resetModules()` to clear vitest's module registry, then a
 * dynamic `await import(...)` of both modules so the fresh evaluation picks
 * up the stubbed values. `vi.unstubAllEnvs()` + another `resetModules()` in
 * `afterEach` returns every later test (in this file and others) to the
 * pinned defaults.
 *
 * All tests mock `globalThis.fetch` directly — no real network calls.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

/**
 * Stub the Nutridigm env vars for one test, reset the module registry, and
 * dynamically re-import `config.js` + `nutridigm.js` so this test gets a
 * clean module evaluation under its own env — fully isolated from every
 * other test in this file (and from the globally pinned `test.env`).
 * @param {{ proxyUrl?: string, subscriptionId?: string, baseUrl?: string }} [env]
 */
async function freshClient({ proxyUrl = '', subscriptionId = '', baseUrl = 'https://test.nutridigm.example/api/v2' } = {}) {
  vi.stubEnv('VITE_NUTRIDIGM_PROXY_URL', proxyUrl);
  vi.stubEnv('VITE_NUTRIDIGM_SUBSCRIPTION_ID', subscriptionId);
  vi.stubEnv('VITE_NUTRIDIGM_BASE_URL', baseUrl);
  vi.resetModules();
  const config = await import('../config.js');
  const nutridigm = await import('../nutridigm.js');
  return { config, nutridigm };
}

beforeEach(() => {
  // config.js logs console.error when unconfigured (expected noise from the
  // "neither configured" test below) — keep test output clean.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('proxy mode URL building', () => {
  it('targets <proxy>/<endpoint>, forwards params, and sends no subscriptionID', async () => {
    const { nutridigm } = await freshClient({
      proxyUrl: 'https://proj.supabase.co/functions/v1/nutridigm-proxy',
    });
    globalThis.fetch = vi.fn().mockResolvedValue(fakeResponse(200, []));

    await nutridigm.fetchTopDoOrDonts('203,244', 'consume', 30);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const calledUrl = globalThis.fetch.mock.calls[0][0];
    const parsed = new URL(calledUrl);
    expect(parsed.origin).toBe('https://proj.supabase.co');
    expect(parsed.pathname).toBe('/functions/v1/nutridigm-proxy/topdoordonts');
    expect(parsed.searchParams.get('healthConditionID')).toBe('203,244');
    expect(parsed.searchParams.get('consumeOrAvoid')).toBe('consume');
    expect(parsed.searchParams.get('limit')).toBe('30');
    expect(calledUrl).not.toContain('subscriptionID');
  });

  it('joins proxy URL + endpoint without a double slash, even with a trailing slash in the env var', async () => {
    const { config, nutridigm } = await freshClient({
      proxyUrl: 'https://proj.supabase.co/functions/v1/nutridigm-proxy/',
    });
    // config.js itself trims the trailing slash off NUTRIDIGM_PROXY_URL.
    expect(config.NUTRIDIGM_PROXY_URL).toBe('https://proj.supabase.co/functions/v1/nutridigm-proxy');

    globalThis.fetch = vi.fn().mockResolvedValue(fakeResponse(200, []));
    await nutridigm.fetchFoodGroups();

    const parsed = new URL(globalThis.fetch.mock.calls[0][0]);
    expect(parsed.pathname).toBe('/functions/v1/nutridigm-proxy/foodgroups');
  });

  it('proxy wins when both a proxy URL and a subscription ID are set', async () => {
    const { nutridigm } = await freshClient({
      proxyUrl: 'https://proj.supabase.co/functions/v1/nutridigm-proxy',
      subscriptionId: 'a-direct-mode-key',
      baseUrl: 'https://test.nutridigm.example/api/v2',
    });
    globalThis.fetch = vi.fn().mockResolvedValue(fakeResponse(200, []));

    await nutridigm.fetchFoodItems();

    const calledUrl = globalThis.fetch.mock.calls[0][0];
    expect(calledUrl).toContain('proj.supabase.co');
    expect(calledUrl).not.toContain('test.nutridigm.example');
    expect(calledUrl).not.toContain('subscriptionID');
    expect(calledUrl).not.toContain('a-direct-mode-key');
  });
});

describe('direct mode URL building (unchanged, byte-for-byte, when proxy is unset)', () => {
  it('targets <base>/<endpoint> with a subscriptionID query param', async () => {
    const { nutridigm } = await freshClient({
      subscriptionId: 'test-subscription-id',
      baseUrl: 'https://test.nutridigm.example/api/v2',
    });
    globalThis.fetch = vi.fn().mockResolvedValue(fakeResponse(200, []));

    await nutridigm.fetchFoodGroups();

    const parsed = new URL(globalThis.fetch.mock.calls[0][0]);
    expect(parsed.origin + parsed.pathname).toBe('https://test.nutridigm.example/api/v2/foodgroups');
    expect(parsed.searchParams.get('subscriptionID')).toBe('test-subscription-id');
  });
});

describe('config error — neither proxy URL nor subscription ID configured', () => {
  it('throws NutridigmConfigError and never calls fetch', async () => {
    const { nutridigm } = await freshClient(); // both proxyUrl and subscriptionId default to ''
    globalThis.fetch = vi.fn();

    await expect(nutridigm.fetchFoodGroups()).rejects.toThrow(nutridigm.NutridigmConfigError);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe('220 handling is unchanged in proxy mode (status-based, not mode-based)', () => {
  it('fetchGoodFor (raw wrapper) resolves 220 to null through the proxy', async () => {
    const { nutridigm } = await freshClient({
      proxyUrl: 'https://proj.supabase.co/functions/v1/nutridigm-proxy',
    });
    globalThis.fetch = vi.fn().mockResolvedValue(fakeResponse(220));

    await expect(nutridigm.fetchGoodFor(111, '203')).resolves.toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('fetchSuggest (coalescing wrapper) resolves 220 to [] through the proxy', async () => {
    const { nutridigm } = await freshClient({
      proxyUrl: 'https://proj.supabase.co/functions/v1/nutridigm-proxy',
    });
    globalThis.fetch = vi.fn().mockResolvedValue(fakeResponse(220));

    await expect(nutridigm.fetchSuggest('203', 'b1')).resolves.toEqual([]);
  });
});

describe('request-counter instrumentation preserved in proxy mode', () => {
  it('increments the per-endpoint counter for proxy-mode requests', async () => {
    const { nutridigm } = await freshClient({
      proxyUrl: 'https://proj.supabase.co/functions/v1/nutridigm-proxy',
    });
    globalThis.fetch = vi.fn().mockResolvedValue(fakeResponse(200, []));

    expect(nutridigm.getRequestCounts()).toEqual({});
    await nutridigm.fetchFoodGroups();
    expect(nutridigm.getRequestCounts()).toEqual({ foodgroups: 1 });
    await nutridigm.fetchFoodGroups();
    expect(nutridigm.getRequestCounts()).toEqual({ foodgroups: 2 });
  });
});
