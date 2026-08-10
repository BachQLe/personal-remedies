#!/usr/bin/env node
/**
 * scripts/probe-suggest.mjs — one-off Phase 0 probe script (T1.2).
 *
 * NOT part of the app build. Modeled on scripts/snapshot-nutridigm.mjs's
 * .env parsing (src code uses import.meta.env, which only exists inside a
 * Vite-processed module, so a plain Node script can't import config.js —
 * this file hand-parses .env/.env.local itself, same as snapshot-nutridigm).
 *
 * Two subcommands, each backing one Phase 0 probe:
 *
 *   node scripts/probe-suggest.mjs suggest
 *     P3 — Condition-filter survival. Fires exactly 3 live calls:
 *       /suggest?fineFoodGroup=l&healthConditionID=203
 *       /suggest?fineFoodGroup=l&healthConditionID=244
 *       /suggest?fineFoodGroup=l&healthConditionID=203,244
 *     For each: total count, descriptionNumericID 1-4 survival (the
 *     normalizePlanGroup safety band), descriptionNumericID 1-3 survival
 *     (the ACTUAL recipeToPlanCandidate/TIER_TO_NUMERIC_ID band a recipe
 *     must clear to fill a Plan slot — Neutral/4 does not fill a slot),
 *     and a mealType distribution over the 1-4 survivors via a replica of
 *     adapter.js's guessMealType keyword heuristic.
 *
 *   node scripts/probe-suggest.mjs goodfor <foodItemID> [healthConditionID]
 *     P1 — "Good for me" feasibility. Fires ONE live call to
 *       /goodfor?foodItemID=<id>&healthConditionID=<conditionCSV, default 203,244>
 *     and dumps the raw JSON response verbatim, so its actual field shape
 *     (vs. the swagger doc's documented GoodFor schema) can be inspected.
 *
 * Every call this script makes counts against the shared daily Nutridigm
 * quota — run each subcommand at most the number of times the calling task
 * budgeted, never in a loop.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DEFAULT_BASE_URL =
  'https://5jocnrfkfb.execute-api.us-east-1.amazonaws.com/PersonalRemedies/nutridigm/api/v2';

// ── .env parsing (copied verbatim from snapshot-nutridigm.mjs) ─────────────

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
    '[probe-suggest] VITE_NUTRIDIGM_SUBSCRIPTION_ID is not set in .env or .env.local. Aborting.'
  );
  process.exit(1);
}

// ── HTTP (mirrors nutridigm.js status-code handling) ────────────────────────

async function get(endpoint, params) {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.searchParams.set('subscriptionID', SUBSCRIPTION_ID);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  console.log(`[probe-suggest] GET /${endpoint} ${JSON.stringify(params)}`);
  const res = await fetch(url.toString());

  if (res.status === 220) {
    console.log(`  -> 220 (ok, empty)`);
    return [];
  }
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`401 ${body.code || 'UNKNOWN'}: ${body.message || res.statusText}`);
  }
  if (res.status === 400) {
    const body = await res.json().catch(() => ({}));
    if (body.code === 'NOFOODITEMSFORGROUP') return [];
    throw new Error(`400 ${body.code || body.message || res.statusText}`);
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

// ── guessMealType replica (adapter.js RECIPE_MEAL_TYPE_KEYWORDS, verbatim) ──

const RECIPE_MEAL_TYPE_KEYWORDS = [
  ['oatmeal', 'breakfast'],
  ['pancake', 'breakfast'],
  ['omelet', 'breakfast'],
  ['scramble', 'breakfast'],
  ['granola', 'breakfast'],
  ['parfait', 'breakfast'],
  ['smoothie', 'breakfast'],
  ['soup', 'dinner'],
  ['chili', 'dinner'],
  ['stew', 'dinner'],
  ['roast', 'dinner'],
  ['salmon', 'dinner'],
  ['salad', 'lunch'],
  ['sandwich', 'lunch'],
  ['wrap', 'lunch'],
  ['guacamole', 'snack'],
  ['dip', 'snack'],
  ['bar', 'snack'],
  ['cake', 'snack'],
  ['cookie', 'snack'],
  ['pie', 'snack'],
  ['brownie', 'snack'],
  ['pudding', 'snack'],
  ['tart', 'snack'],
  ['ice cream', 'snack'],
  ['cheesecake', 'snack'],
  ['muffin', 'snack'],
];

function guessMealType(title) {
  const lower = (title || '').toLowerCase();
  for (const [keyword, mealType] of RECIPE_MEAL_TYPE_KEYWORDS) {
    if (lower.includes(keyword)) return mealType;
  }
  return 'dinner';
}

// isExcludedItem replica (adapter.js) — fine group in EXCLUDED_FINE_GROUPS
// ['x','j1','l'], or coarse 'j', or (no fine group AND coarse in ['x','l']).
const EXCLUDED_FINE_GROUPS = ['x', 'j1', 'l'];
function isExcludedItem(raw) {
  const fine = raw.fineFoodGroup;
  if (fine && EXCLUDED_FINE_GROUPS.includes(fine)) return true;
  if (raw.coarseFoodGroup === 'j') return true;
  if (!fine && ['x', 'l'].includes(raw.coarseFoodGroup)) return true;
  return false;
}

// ── suggest subcommand (P3) ──────────────────────────────────────────────────

async function runSuggest() {
  const conditionSets = ['203', '244', '203,244'];
  const summary = [];

  for (const cond of conditionSets) {
    const raw = await get('suggest', { healthConditionID: cond, fineFoodGroup: 'l' });
    const total = Array.isArray(raw) ? raw.length : 0;

    // Band 1: descriptionNumericID 1-4 (normalizePlanGroup's safety band —
    // used for non-recipe /suggest fine groups; recipes don't actually run
    // through normalizePlanGroup, see getRecipesRaw, but the task asks us to
    // apply this exact band to the 'l' recipe group for comparison).
    const band14 = (raw || []).filter(
      (i) => i.descriptionNumericID != null && i.descriptionNumericID >= 1 && i.descriptionNumericID <= 4
    );
    // Band 2: descriptionNumericID 1-3 (the REAL band a recipe must clear to
    // fill a Plan slot — recipeToPlanCandidate + TIER_TO_NUMERIC_ID excludes
    // Neutral/4; see adapter.js numericIdToTier + TIER_TO_NUMERIC_ID).
    const band13 = (raw || []).filter(
      (i) => i.descriptionNumericID != null && i.descriptionNumericID >= 1 && i.descriptionNumericID <= 3
    );
    // isExcludedItem note: fine group 'l' is itself in EXCLUDED_FINE_GROUPS,
    // so if isExcludedItem were applied to /suggest&fineFoodGroup=l results
    // it would exclude EVERYTHING. getRecipesRaw does NOT apply
    // isExcludedItem for this reason. Reported for completeness, matches 0.
    const wouldBeExcludedByIsExcludedItem = (raw || []).filter(isExcludedItem).length;

    const mealTypeCounts = { breakfast: 0, lunch: 0, dinner: 0, snack: 0, beverage: 0 };
    for (const item of band14) {
      const title = item.foodItemDisplayAs || item.foodDescription || item.description || '';
      const mt = guessMealType(title);
      mealTypeCounts[mt] = (mealTypeCounts[mt] || 0) + 1;
    }

    // numericID histogram (1-7) for full transparency on distribution shape.
    const histogram = {};
    for (const item of raw || []) {
      const id = item.descriptionNumericID ?? 'null';
      histogram[id] = (histogram[id] || 0) + 1;
    }

    const row = {
      conditions: cond,
      total,
      band14: band14.length,
      band14Pct: total ? ((band14.length / total) * 100).toFixed(1) + '%' : 'n/a',
      band13: band13.length,
      band13Pct: total ? ((band13.length / total) * 100).toFixed(1) + '%' : 'n/a',
      wouldBeExcludedByIsExcludedItem,
      mealTypeCounts,
      histogram,
    };
    summary.push(row);
    console.log(JSON.stringify(row, null, 2));
  }

  console.log('\n=== P3 SUMMARY (JSON) ===');
  console.log(JSON.stringify(summary, null, 2));
}

// ── goodfor subcommand (P1) ──────────────────────────────────────────────────

async function runGoodFor(foodItemID, healthConditionID) {
  if (!foodItemID) {
    console.error('Usage: node scripts/probe-suggest.mjs goodfor <foodItemID> [healthConditionID=203,244]');
    process.exit(1);
  }
  const cond = healthConditionID || '203,244';
  const raw = await get('goodfor', { foodItemID: String(foodItemID), healthConditionID: cond });
  console.log('\n=== P1 /goodfor raw response ===');
  console.log(JSON.stringify(raw, null, 2));
  console.log('\nTop-level keys:', raw && typeof raw === 'object' ? Object.keys(raw) : typeof raw);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const [, , cmd, ...rest] = process.argv;
  if (cmd === 'suggest') {
    await runSuggest();
  } else if (cmd === 'goodfor') {
    await runGoodFor(rest[0], rest[1]);
  } else {
    console.error('Usage:');
    console.error('  node scripts/probe-suggest.mjs suggest');
    console.error('  node scripts/probe-suggest.mjs goodfor <foodItemID> [healthConditionID]');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[probe-suggest] ERROR:', err.message || err);
  process.exit(1);
});
