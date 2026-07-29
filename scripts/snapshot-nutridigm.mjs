#!/usr/bin/env node
/**
 * scripts/snapshot-nutridigm.mjs — one-shot dictionary snapshotter.
 *
 * Run manually: `node scripts/snapshot-nutridigm.mjs`
 *
 * Fetches the three Nutridigm dictionary endpoints (/fooditems,
 * /healthconditions, /foodgroups) and writes them, verbatim and
 * pretty-printed, to src/data/cache/{items,conditions,groups}.json. Those
 * files are committed and statically imported at runtime (see
 * src/api/localTables.js) so the app never round-trips the network for
 * dictionary data.
 *
 * This script is intentionally standalone from the rest of the app:
 * src/api/config.js reads `import.meta.env`, which only exists inside a
 * Vite-processed module, so a plain Node script can't import it. Instead
 * this file hand-parses .env / .env.local itself (same two vars config.js
 * would have read) and speaks to the API directly via nutridigm.js's own
 * status-code conventions (200 ok, 220 ok-but-empty, 401 auth, 400 bad
 * param — see src/api/nutridigm.js).
 *
 * The Nutridigm API enforces a DAILY call limit, so this script is meant to
 * be run by hand occasionally (e.g. when the knowledgebase is known to have
 * changed), never in a loop or as part of CI/build.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'src', 'data', 'cache');

const DEFAULT_BASE_URL =
  'https://5jocnrfkfb.execute-api.us-east-1.amazonaws.com/PersonalRemedies/nutridigm/api/v2';

// ── .env parsing ─────────────────────────────────────────────────────────────

/**
 * Tiny hand-rolled .env parser — no external dependency needed for a script
 * that's run by hand a handful of times. Handles `KEY=value` lines, `#`
 * comments, blank lines, and optional surrounding quotes on the value.
 * @param {string} filePath
 * @returns {Record<string, string>}
 */
function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  const text = readFileSync(filePath, 'utf8');
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * Load env vars from .env then .env.local (.env.local wins on conflicts —
 * matches Vite's own precedence).
 * @returns {Record<string, string>}
 */
function loadEnv() {
  const base = parseEnvFile(path.join(ROOT, '.env'));
  const local = parseEnvFile(path.join(ROOT, '.env.local'));
  return { ...base, ...local };
}

const env = loadEnv();
const SUBSCRIPTION_ID = env.VITE_NUTRIDIGM_SUBSCRIPTION_ID || '';
const BASE_URL = env.VITE_NUTRIDIGM_BASE_URL || DEFAULT_BASE_URL;

if (!SUBSCRIPTION_ID) {
  console.error(
    '[snapshot-nutridigm] VITE_NUTRIDIGM_SUBSCRIPTION_ID is not set in .env or .env.local. ' +
    'Cannot fetch dictionaries without it — aborting.'
  );
  process.exit(1);
}

// ── HTTP ──────────────────────────────────────────────────────────────────────

/**
 * GET one Nutridigm dictionary endpoint. Mirrors nutridigm.js's status
 * handling: 220 = ok-but-empty (returns []), 401/400/other = throws.
 * @param {string} endpoint - e.g. 'fooditems'
 * @returns {Promise<Array>}
 */
async function fetchDictionary(endpoint) {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.searchParams.set('subscriptionID', SUBSCRIPTION_ID);

  const res = await fetch(url.toString());

  if (res.status === 220) return [];

  if (res.status === 401) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `[snapshot-nutridigm] /${endpoint}: 401 ${body.code || 'UNKNOWN_AUTH_ERROR'} — ${body.message || 'Unauthorized'}`
    );
  }

  if (res.status === 400) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`[snapshot-nutridigm] /${endpoint}: 400 ${body.code || body.message || res.statusText}`);
  }

  if (!res.ok) {
    throw new Error(`[snapshot-nutridigm] /${endpoint}: HTTP ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data ?? [];
}

// ── Diffing ───────────────────────────────────────────────────────────────────

/**
 * Deep equality check (plain-data only — these are JSON API responses, no
 * functions/dates/cycles), used to detect "changed" rows between snapshots.
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (typeof a !== 'object') return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => deepEqual(a[k], b[k]));
}

/**
 * Compare a freshly-fetched row array against whatever was previously
 * committed at `filePath` (if anything), keyed by `idField`, and print a
 * one-line-per-table summary of added/removed/changed row IDs. Makes
 * knowledgebase drift between Nutridigm snapshots visible at a glance
 * instead of silently overwriting.
 * @param {string} label - Human label for the table (e.g. "items")
 * @param {string} filePath - Path to the previously-committed JSON, if any
 * @param {Array} freshRows - Newly fetched + sorted rows
 * @param {string} idField - Field name that uniquely identifies a row
 */
function printDiffSummary(label, filePath, freshRows, idField) {
  let prevRows = [];
  if (existsSync(filePath)) {
    try {
      prevRows = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch {
      console.warn(`[snapshot-nutridigm] ${label}: existing file unreadable, treating as empty for diff purposes.`);
    }
  }

  const prevById = new Map(prevRows.map((r) => [r[idField], r]));
  const freshById = new Map(freshRows.map((r) => [r[idField], r]));

  const added = [...freshById.keys()].filter((id) => !prevById.has(id));
  const removed = [...prevById.keys()].filter((id) => !freshById.has(id));
  const changed = [...freshById.keys()].filter(
    (id) => prevById.has(id) && !deepEqual(prevById.get(id), freshById.get(id))
  );

  console.log(`\n[${label}] ${prevRows.length} → ${freshRows.length} rows`);
  console.log(`  added:   ${added.length}${added.length ? ` (${added.slice(0, 20).join(', ')}${added.length > 20 ? ', …' : ''})` : ''}`);
  console.log(`  removed: ${removed.length}${removed.length ? ` (${removed.slice(0, 20).join(', ')}${removed.length > 20 ? ', …' : ''})` : ''}`);
  console.log(`  changed: ${changed.length}${changed.length ? ` (${changed.slice(0, 20).join(', ')}${changed.length > 20 ? ', …' : ''})` : ''}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Sort rows ascending by their ID field for stable diffs across runs.
 * Handles both numeric (foodItemID, healthConditionID) and string
 * (foodGroupID) ID fields.
 * @param {Array} rows
 * @param {string} idField
 * @returns {Array}
 */
function sortById(rows, idField) {
  return [...rows].sort((a, b) => {
    const av = a[idField];
    const bv = b[idField];
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  });
}

const TABLES = [
  { label: 'items', endpoint: 'fooditems', file: 'items.json', idField: 'foodItemID' },
  { label: 'conditions', endpoint: 'healthconditions', file: 'conditions.json', idField: 'healthConditionID' },
  { label: 'groups', endpoint: 'foodgroups', file: 'groups.json', idField: 'foodGroupID' },
];

async function main() {
  console.log(`[snapshot-nutridigm] Fetching from ${BASE_URL} ...`);

  for (const table of TABLES) {
    const raw = await fetchDictionary(table.endpoint);
    const sorted = sortById(raw, table.idField);
    const filePath = path.join(OUT_DIR, table.file);

    printDiffSummary(table.label, filePath, sorted, table.idField);

    writeFileSync(filePath, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
    console.log(`  wrote ${filePath}`);
  }

  console.log('\n[snapshot-nutridigm] Done.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
