/**
 * usda.js — thin client for the USDA FoodData Central (FDC) REST API.
 *
 * SCRIPT-TIER PLUMBING, NOT A RUNTIME MODULE. The Remedi app itself never
 * calls USDA at request time — see REMEDI_MASTER_PLAN.md Phase 2 and
 * docs/usda-pipeline.md. This client exists solely so
 * `scripts/build-usda-map.mjs` (a hand-run, offline pipeline) can search FDC
 * and fetch nutrient/portion data, which the script then writes into the
 * committed tables `src/data/usda/fdcMap.json` and
 * `src/data/usda/nutrients.json`. Those committed, CC0-licensed tables are
 * what the running app reads (via the next wave's `src/api/nutrition.js`
 * resolver) — no API key, no rate limit, and no network round trip ever
 * ships to production for USDA data.
 *
 * Node-compatible on purpose: this module is imported directly by a plain
 * Node script (not bundled by Vite), so it must not reference
 * `import.meta.env` (that only exists inside Vite-processed modules — see
 * scripts/snapshot-nutridigm.mjs's header for the same constraint on the
 * Nutridigm side). The API key is always accepted as an explicit function
 * argument, never read from an env var or hardcoded here — the caller
 * (build-usda-map.mjs) is responsible for loading it from `.env`.
 *
 * Uses the platform's native `fetch` (Node 18+) — no HTTP dependency added.
 *
 * FDC API reference: https://fdc.nal.usda.gov/api-guide.html
 */

const DEFAULT_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

/**
 * FDC `dataType` values, for reference/documentation only — this module
 * does not enforce the "never Branded" rule itself (see
 * build-usda-map.mjs's DATA_TYPE_PRIORITY / isAllowedDataType, which is
 * where that policy is actually applied). Kept here as the canonical list
 * of values FDC accepts on `dataType` filters.
 * @type {ReadonlyArray<string>}
 */
export const FDC_DATA_TYPES = Object.freeze(['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded']);

/**
 * Thrown when the FDC API responds with a non-ok status. Carries the HTTP
 * status so callers (build-usda-map.mjs) can special-case 429 (rate limit)
 * and stop cleanly instead of treating it like any other failure.
 */
export class FdcApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status - HTTP status code.
   * @param {string} [body] - Raw response body, if any, for debugging.
   */
  constructor(message, status, body) {
    super(message);
    this.name = 'FdcApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Search FDC by free-text query, restricted to the requested data types.
 * Uses POST /foods/search (the API also supports GET with query params;
 * POST is used here so multi-word queries and array params don't need
 * manual URL encoding).
 *
 * @param {string} query - Free-text search term (e.g. a normalized food name).
 * @param {object} options
 * @param {string} options.apiKey - FDC API key (or 'DEMO_KEY'). Required.
 * @param {string} [options.baseUrl] - Override the FDC base URL (tests only).
 * @param {string[]} [options.dataType] - FDC dataType filter, e.g.
 *   ['Foundation', 'SR Legacy']. Passing 'Branded' is the caller's choice —
 *   this client does not filter it out (policy lives in the build script).
 * @param {number} [options.pageSize] - Max results to return (FDC default 50, max 200).
 * @returns {Promise<{totalHits: number, foods: Array<object>}>} Parsed FDC search response.
 * @throws {FdcApiError} on a non-ok HTTP response.
 */
export async function searchFoods(query, options) {
  const { apiKey, baseUrl = DEFAULT_BASE_URL, dataType, pageSize } = options || {};
  if (!apiKey) {
    throw new Error('[usda] searchFoods: options.apiKey is required (pass DEMO_KEY for the free tier).');
  }
  if (!query || !query.trim()) {
    throw new Error('[usda] searchFoods: query must be a non-empty string.');
  }

  const url = new URL(`${baseUrl}/foods/search`);
  url.searchParams.set('api_key', apiKey);

  /** @type {Record<string, unknown>} */
  const body = { query, requireAllWords: false };
  if (dataType && dataType.length) body.dataType = dataType;
  if (pageSize) body.pageSize = pageSize;

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new FdcApiError(`[usda] searchFoods("${query}"): HTTP ${res.status} ${res.statusText}`, res.status, text);
  }

  return res.json();
}

/**
 * Fetch full food records (nutrients + portions) for a batch of FDC IDs.
 * Uses POST /foods (the batch endpoint — distinct from the singular
 * GET /food/{fdcId}). `format: 'full'` is requested by default because the
 * build pipeline needs `foodPortions`, which the abridged format omits.
 *
 * FDC does not document a hard cap on batch size, but the build script
 * should keep batches modest (tens, not hundreds) to stay polite and keep
 * failures cheap to retry — that chunking policy lives in
 * build-usda-map.mjs, not here.
 *
 * @param {number[]} fdcIds - FDC IDs to fetch, e.g. [325430, 173944].
 * @param {object} options
 * @param {string} options.apiKey - FDC API key (or 'DEMO_KEY'). Required.
 * @param {string} [options.baseUrl] - Override the FDC base URL (tests only).
 * @param {'full'|'abridged'} [options.format] - Defaults to 'full'.
 * @returns {Promise<Array<object>>} Array of FDC food records (order not guaranteed to match input).
 * @throws {FdcApiError} on a non-ok HTTP response.
 */
export async function getFoods(fdcIds, options) {
  const { apiKey, baseUrl = DEFAULT_BASE_URL, format = 'full' } = options || {};
  if (!apiKey) {
    throw new Error('[usda] getFoods: options.apiKey is required (pass DEMO_KEY for the free tier).');
  }
  if (!Array.isArray(fdcIds) || fdcIds.length === 0) {
    throw new Error('[usda] getFoods: fdcIds must be a non-empty array.');
  }

  const url = new URL(`${baseUrl}/foods`);
  url.searchParams.set('api_key', apiKey);

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fdcIds, format }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new FdcApiError(`[usda] getFoods([${fdcIds.join(',')}]): HTTP ${res.status} ${res.statusText}`, res.status, text);
  }

  return res.json();
}
