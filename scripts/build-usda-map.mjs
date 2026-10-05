#!/usr/bin/env node
/**
 * scripts/build-usda-map.mjs — offline USDA FoodData Central mapping pipeline.
 *
 * Run manually:
 *   node scripts/build-usda-map.mjs              # full run (all unresolved subset items)
 *   node scripts/build-usda-map.mjs --limit 40    # only attempt the first 40 unresolved items
 *
 * WHAT THIS DOES
 * For a fixed subset of Remedi's food items (plain foods only — never recipes),
 * this script searches USDA FoodData Central (FDC) for the best matching
 * Foundation/SR Legacy food record, fetches its energy/protein/carb/fat
 * nutrients (+ a usable serving portion when FDC provides one), and writes
 * two committed tables:
 *
 *   - src/data/usda/fdcMap.json    — foodItemID -> which FDC food it maps to
 *   - src/data/usda/nutrients.json — fdcId -> per-100g (+ per-serving) macros
 *
 * Those tables are read at runtime by a future `src/api/nutrition.js`
 * resolver (next wave — not built here). USDA FDC data is CC0 (public
 * domain), so committing a derived table is legal and keeps API keys and
 * rate limits entirely out of production. See docs/usda-pipeline.md for the
 * full runbook, matching rules, and how to hand-fix a bad match.
 *
 * SUBSET
 * The union of:
 *   1. items whose fineFoodGroup is one of Remedi's plan-slot groups
 *      (see PLAN_SLOT_FINE_GROUPS below — mirrors src/api/config.js's
 *      PLAN_SLOTS[*].fineGroups), and
 *   2. every foodItemID flagged in the overlay
 *      (src/data/cache/itemOverlay.generated.json).
 * Recipes (fineFoodGroup 'l') are explicitly excluded even if
 * overlay-flagged — recipe nutrition comes from C1 panels, not USDA.
 *
 * MATCHING (never Branded; never guess)
 *   - Query text: `item.displayAs || item.description`, sent to FDC's
 *     search as-is (FDC's own relevance ranking benefits from natural text).
 *   - Candidates are restricted to dataType ∈ DATA_TYPE_PRIORITY
 *     (Foundation, SR Legacy) — Branded is never eligible, full stop.
 *   - Candidates are scored locally by comparing NORMALIZED names
 *     (lowercase, parentheticals/punctuation stripped): exact match (1.0)
 *     > token-boundary "starts with" (0.85) > token-overlap recall
 *     (fraction of the target's own words found in the candidate, 0..1).
 *   - Only the best-scoring ALLOWED candidate is kept, and only if its
 *     score clears MATCH_THRESHOLD (0.75 — conservative on purpose). Ties
 *     prefer: higher score > stronger method (exact > startsWith >
 *     tokenOverlap) > earlier dataType in DATA_TYPE_PRIORITY (Foundation
 *     over SR Legacy) > shorter candidate name.
 *   - Anything that doesn't clear the threshold is UNMATCHED. Unmatched
 *     items are never written to fdcMap.json — absence from the map IS the
 *     "no data" signal (see the frozen guardrail in REMEDI_MASTER_PLAN.md:
 *     never fabricate a number).
 *
 * INCREMENTAL / HAND-EDITABLE
 * Rerunning this script only attempts subset items that have NO entry yet
 * in fdcMap.json — it never re-searches or overwrites an existing row,
 * matched or not, and `manualOverride: true` rows are additionally
 * guarded by `mergeMapEntries` even if that were to change. This means a
 * human (Sunny/Bach) can hand-edit a bad match in fdcMap.json, set
 * `manualOverride: true` on that row, and reruns will leave it alone
 * forever. To force a re-match, delete the row (and, if you want fresh
 * nutrients too, its corresponding nutrients.json entry) and rerun.
 *
 * RATE LIMITS
 * Politely paced (a delay between every FDC call) and DEMO_KEY-aware
 * (bigger delay on the free/shared tier). On an HTTP 429 the script stops
 * the current phase cleanly, keeps whatever it already resolved, and
 * records the stop reason in `_meta.lastRun` — see printed summary at the
 * end of a run for exact counts.
 *
 * .env PARSING
 * Modeled on scripts/snapshot-nutridigm.mjs: src/api/config.js reads
 * `import.meta.env`, which only exists inside a Vite-processed module, so
 * this plain Node script hand-parses .env / .env.local itself. Looks for
 * `USDA_API_KEY` (preferred) or `VITE_USDA_API_KEY`, falling back to the
 * public `DEMO_KEY` (data.gov's shared demo key — much lower rate limit,
 * fine for a pilot batch via `--limit`).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { searchFoods, getFoods, FdcApiError } from '../src/api/usda.js';
import { extractMicros, scaleMicros } from '../src/data/usda/nutrientCatalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const ITEMS_PATH = path.join(ROOT, 'src', 'data', 'cache', 'items.json');
const OVERLAY_PATH = path.join(ROOT, 'src', 'data', 'cache', 'itemOverlay.generated.json');
const OUT_DIR = path.join(ROOT, 'src', 'data', 'usda');
const MAP_PATH = path.join(OUT_DIR, 'fdcMap.json');
const NUTRIENTS_PATH = path.join(OUT_DIR, 'nutrients.json');

const DEMO_KEY = 'DEMO_KEY';

/** Delay between FDC calls (ms). DEMO_KEY is shared globally and heavily rate-limited. */
const DEMO_DELAY_MS = 3000;
/** Regular api.data.gov keys allow ~1000 req/hour => >= 3.6s/request on average. */
const LIVE_DELAY_MS = 3700;
/** Write checkpoint files every N attempted items. */
const CHECKPOINT_EVERY = 10;
/** Retry policy. 429 waits (Retry-After header, else this) then retries — up to MAX_429_RETRIES times. */
const RATE_LIMIT_WAIT_MS = 5 * 60 * 1000;
const MAX_429_RETRIES = 20;
const MAX_TRANSIENT_RETRIES = 3;
/** Max fdcIds per batch nutrient fetch — keeps individual requests/failures cheap. */
const BATCH_SIZE = 20;

// ── Subset definition ───────────────────────────────────────────────────────

/**
 * Fine food groups used by Remedi's plan slots — mirrors
 * src/api/config.js's `PLAN_SLOTS[*].fineGroups` union (that file is owned
 * by another workstream this task must not touch, so the list is
 * duplicated here deliberately rather than imported).
 * @type {string[]}
 */
export const PLAN_SLOT_FINE_GROUPS = ['f', 'd', 'g1', 'c2', 'e', 'b1', 'b3', 'h1', 'c3', 'h2'];

/** fineFoodGroup code for recipes — never mapped here (C1 panels cover recipes). */
export const RECIPE_FINE_GROUP = 'l';

/**
 * Compute the target subset: union of (plan-slot fine groups) and
 * (overlay-flagged foodItemIDs), always excluding recipes.
 * @param {Array<{foodItemID: number, fineFoodGroup: string}>} items - src/data/cache/items.json
 * @param {Record<string, object>} overlay - src/data/cache/itemOverlay.generated.json ({foodItemID: flags})
 * @returns {Array<object>} the subset of `items`
 */
export function computeTargetSubset(items, overlay) {
  const overlayIds = new Set(Object.keys(overlay || {}).map(Number));
  const groupSet = new Set(PLAN_SLOT_FINE_GROUPS);
  return (items || []).filter((item) => {
    if (item.fineFoodGroup === RECIPE_FINE_GROUP) return false;
    return groupSet.has(item.fineFoodGroup) || overlayIds.has(item.foodItemID);
  });
}

// ── Name normalization & scoring ────────────────────────────────────────────

/**
 * Normalize a food name for matching: lowercase, strip parenthetical
 * asides, strip punctuation, collapse whitespace.
 * @param {string} name
 * @returns {string}
 */
export function normalizeFoodName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} normalized - already-normalized name
 * @returns {string[]} whitespace-separated tokens
 */
export function tokenizeName(normalized) {
  return normalized ? normalized.split(' ').filter(Boolean).map(stemToken) : [];
}

/**
 * Crude singularizer so "clams" matches "clam" (FDC descriptions are
 * mostly singular, Nutridigm names mostly plural).
 * @param {string} t @returns {string}
 */
export function stemToken(t) {
  if (t.length > 4 && t.endsWith('ies')) return `${t.slice(0, -3)}y`;
  if (t.length > 4 && /(ches|shes|sses|xes|oes)$/.test(t)) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') && !t.endsWith('us')) return t.slice(0, -1);
  return t;
}

/**
 * Words marking a processed/derived product or a different food. A candidate
 * containing one of these is rejected unless the target itself has the word
 * (e.g. target "clams" must not match "Clam chowder" or "Mushroom, oyster").
 */
const DERIVED_WORDS = new Set([
  'soup', 'juice', 'oil', 'beverage', 'sauce', 'chowder', 'babyfood', 'candy', 'cereal',
  'restaurant', 'cookie', 'cake', 'pie', 'bread', 'powder', 'syrup', 'drink', 'dessert',
  'snack', 'imitation', 'cooky', 'pastry', 'danish', 'ring', 'ham', 'topping', 'pizza', 'sandwich', 'pudding', 'pretzel', 'frosting', 'gravy', 'substitute', 'mushroom', 'emu', 'ostrich', 'game', 'extract', 'flavor',
]);

/**
 * Score how well an FDC candidate's raw description matches an
 * already-normalized target name.
 *
 * Priority: exact normalized match (1.0) > token-boundary "starts with"
 * (0.85, e.g. target "peaches" vs candidate "peaches, yellow, raw") >
 * token-overlap recall (0..1, the fraction of the TARGET's own words that
 * appear anywhere in the candidate — deliberately recall-oriented since
 * FDC descriptions often carry extra qualifiers like "raw"/"cooked" the
 * target name doesn't have).
 * @param {string} normalizedTarget
 * @param {string} candidateDescription - raw FDC `description` field
 * @returns {{score: number, method: 'exact'|'startsWith'|'tokenOverlap'|'none'}}
 */
export function scoreCandidate(normalizedTarget, candidateDescription) {
  const normalizedCandidate = normalizeFoodName(candidateDescription);
  if (!normalizedTarget || !normalizedCandidate) return { score: 0, method: 'none' };

  if (normalizedCandidate === normalizedTarget) return { score: 1, method: 'exact' };

  const targetTokens = tokenizeName(normalizedTarget);
  const candidateTokens = tokenizeName(normalizedCandidate);

  if (
    targetTokens.length > 0 &&
    candidateTokens.length >= targetTokens.length &&
    candidateTokens.slice(0, targetTokens.length).join(' ') === targetTokens.join(' ')
  ) {
    return { score: 0.85, method: 'startsWith' };
  }

  if (targetTokens.length === 0) return { score: 0, method: 'none' };
  const candidateSet = new Set(candidateTokens);
  const overlapCount = targetTokens.filter((t) => candidateSet.has(t)).length;
  return { score: overlapCount / targetTokens.length, method: 'tokenOverlap' };
}

/** Conservative acceptance threshold — anything scoring below this is left unmatched. */
export const DEFAULT_MATCH_THRESHOLD = 0.75;

/**
 * FDC dataType values eligible for matching, in preference order.
 * Branded is deliberately absent and NEVER eligible, regardless of score.
 * @type {string[]}
 */
export const DATA_TYPE_PRIORITY = ['Foundation', 'SR Legacy'];

/** @param {string} dataType @returns {boolean} */
export function isAllowedDataType(dataType) {
  return DATA_TYPE_PRIORITY.includes(dataType);
}

const METHOD_RANK = { exact: 2, startsWith: 1, tokenOverlap: 0, none: -1 };

/**
 * Pick the best allowed candidate for a normalized target name, or null if
 * nothing clears the threshold. See module header / scoreCandidate for the
 * scoring rules and tie-break order.
 * @param {string} normalizedTarget
 * @param {Array<{fdcId: number, description: string, dataType: string}>} candidates
 * @param {{threshold?: number}} [options]
 * @returns {{fdcId: number, matchedName: string, dataType: string, matchScore: number}|null}
 */
export function pickBestMatch(normalizedTarget, candidates, options) {
  const threshold = options?.threshold ?? DEFAULT_MATCH_THRESHOLD;
  let best = null;

  for (const candidate of candidates || []) {
    if (!isAllowedDataType(candidate.dataType)) continue; // NEVER Branded (or anything else)
    const { score, method } = scoreCandidate(normalizedTarget, candidate.description);
    if (score < threshold) continue;
    // Restaurant/brand records in SR Legacy start with an ALL-CAPS name (e.g. "DENNY'S, onion rings").
    if (/^[A-Z][A-Z' .&-]{2,}(,|\s|$)/.test(candidate.description)) continue;
    // Search results carry nutrients: skip candidates that report no energy at all.
    if (Array.isArray(candidate.foodNutrients) && candidate.foodNutrients.length > 0 && extractPer100g(candidate.foodNutrients).calories == null) continue;
    const targetSet = new Set(tokenizeName(normalizedTarget));
    const candTokens = tokenizeName(normalizeFoodName(candidate.description));
    if (candTokens.some((t) => DERIVED_WORDS.has(t) && !targetSet.has(t))) continue;

    const contender = {
      fdcId: candidate.fdcId,
      matchedName: candidate.description,
      dataType: candidate.dataType,
      matchScore: Math.round(score * 100) / 100,
      _methodRank: METHOD_RANK[method] ?? -1,
      _dataTypeRank: DATA_TYPE_PRIORITY.indexOf(candidate.dataType),
      _raw: candTokens.includes('raw') ? 1 : 0,
      _precision: targetSet.size / Math.max(candTokens.length, 1),
      _nameLength: candidate.description.length,
    };

    if (!best || isBetterMatch(contender, best)) best = contender;
  }

  if (!best) return null;
  const { fdcId, matchedName, dataType, matchScore } = best;
  return { fdcId, matchedName, dataType, matchScore };
}

/** @param {object} a @param {object} b @returns {boolean} true if `a` should win over `b` */
function isBetterMatch(a, b) {
  // Method first: "Goose, meat only" (startsWith) must beat "Egg, goose" (full token overlap, score 1.0).
  if (a._methodRank !== b._methodRank) return a._methodRank > b._methodRank;
  if (a.matchScore !== b.matchScore) return a.matchScore > b.matchScore;
  if (a._dataTypeRank !== b._dataTypeRank) return a._dataTypeRank < b._dataTypeRank;
  if (a._raw !== b._raw) return a._raw > b._raw;
  if (a._precision !== b._precision) return a._precision > b._precision;
  return a._nameLength < b._nameLength;
}

// ── Nutrient extraction ──────────────────────────────────────────────────────

// USDA nutrient numbers are stable identifiers, more reliable than names.
// Energy: prefer the standard "Energy" (kcal) entry; some newer Foundation
// Foods records omit it and only report Atwater-factor energy — both are
// real USDA-reported kcal values, just different calculation methods, so
// falling back to them is not a fabrication.
const ENERGY_NUTRIENT_NUMBERS = ['208', '957', '958'];
const PROTEIN_NUTRIENT_NUMBERS = ['203'];
const CARBS_NUTRIENT_NUMBERS = ['205', '205.2']; // by difference, then by summation
const FAT_NUTRIENT_NUMBERS = ['204'];

/** Handles both the batch /foods "full" shape and the /foods/search shape. */
function getNutrientNumber(entry) {
  return entry.nutrientNumber ?? entry.nutrient?.number ?? null;
}
function getNutrientAmount(entry) {
  const v = entry.value ?? entry.amount;
  return typeof v === 'number' ? v : null;
}

/**
 * @param {Array<object>} foodNutrients
 * @param {string[]} numberPriority
 * @returns {number|null}
 */
function findNutrientValue(foodNutrients, numberPriority) {
  for (const num of numberPriority) {
    const entry = (foodNutrients || []).find((e) => getNutrientNumber(e) === num);
    if (entry) {
      const value = getNutrientAmount(entry);
      if (value != null) return value;
    }
  }
  return null;
}

/**
 * Extract per-100g macros from an FDC food record's `foodNutrients` array.
 * Any macro FDC doesn't report comes back `null` — never filled with a
 * guess.
 * @param {Array<object>} foodNutrients
 * @returns {{calories: number|null, protein: number|null, carbs: number|null, fat: number|null}}
 */
export function extractPer100g(foodNutrients) {
  return {
    calories: findNutrientValue(foodNutrients, ENERGY_NUTRIENT_NUMBERS),
    protein: findNutrientValue(foodNutrients, PROTEIN_NUTRIENT_NUMBERS),
    carbs: findNutrientValue(foodNutrients, CARBS_NUTRIENT_NUMBERS),
    fat: findNutrientValue(foodNutrients, FAT_NUTRIENT_NUMBERS),
  };
}

/**
 * Pick a usable serving portion from FDC's `foodPortions` array, if any.
 * Heuristic: the first portion (by FDC's own `sequenceNumber`, when
 * present) that carries a positive `gramWeight` — FDC lists portions in a
 * curated, roughly "most representative first" order. Returns null when
 * the food has no portions at all (per-100g-only is still fully usable).
 * @param {Array<object>} [foodPortions]
 * @returns {{gramWeight: number, label: string}|null}
 */
export function pickServingPortion(foodPortions) {
  if (!Array.isArray(foodPortions) || foodPortions.length === 0) return null;
  const valid = foodPortions.filter((p) => typeof p.gramWeight === 'number' && p.gramWeight > 0);
  if (valid.length === 0) return null;

  const chosen = [...valid].sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0))[0];
  const unitLabel = chosen.portionDescription || chosen.modifier || chosen.measureUnit?.name || 'portion';
  const amount = chosen.amount ?? 1;
  return { gramWeight: chosen.gramWeight, label: `${amount} ${unitLabel}`.trim() };
}

/**
 * Scale per-100g macros to a serving of `gramWeight` grams. Pure unit
 * conversion of real reported values — not an independent data point, and
 * not a guess.
 * @param {{calories: number|null, protein: number|null, carbs: number|null, fat: number|null}} per100g
 * @param {number} gramWeight
 * @returns {{amount: number, unit: 'g', calories: number|null, protein: number|null, carbs: number|null, fat: number|null}}
 */
export function scaleToServing(per100g, gramWeight) {
  const factor = gramWeight / 100;
  const scale = (v) => (typeof v === 'number' ? Math.round(v * factor * 100) / 100 : null);
  return {
    amount: gramWeight,
    unit: 'g',
    calories: scale(per100g.calories),
    protein: scale(per100g.protein),
    carbs: scale(per100g.carbs),
    fat: scale(per100g.fat),
  };
}

// ── Merge (incremental / manualOverride-safe) ───────────────────────────────

/**
 * Merge freshly-resolved fdcMap entries into the existing map. Any existing
 * row with `manualOverride: true` is NEVER replaced, even if `newEntries`
 * happens to contain a value for the same key — this is the guarantee that
 * lets Sunny/Bach hand-fix a bad match and trust it survives every rerun.
 * @param {Record<string, object>} existingItems
 * @param {Record<string, object>} newEntries
 * @returns {Record<string, object>}
 */
export function mergeMapEntries(existingItems, newEntries) {
  const merged = { ...(existingItems || {}) };
  for (const [id, entry] of Object.entries(newEntries || {})) {
    const existing = merged[id];
    if (existing && existing.manualOverride === true) continue;
    merged[id] = entry;
  }
  return merged;
}

// ── .env parsing (mirrors scripts/snapshot-nutridigm.mjs) ──────────────────

/**
 * Tiny hand-rolled .env parser — no external dependency needed for a
 * script run by hand. Handles `KEY=value`, `#` comments, blank lines, and
 * optional surrounding quotes on the value.
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

// ── CLI / misc helpers ───────────────────────────────────────────────────────

/**
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {{limit: number|null}}
 */
function parseArgs(argv) {
  const args = { limit: null, retryUnmatched: false, details: false, refreshDetails: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--retry-unmatched') args.retryUnmatched = true;
    if (argv[i] === '--details') args.details = true;
    if (argv[i] === '--refresh-details') { args.details = true; args.refreshDetails = true; }
    if (argv[i] === '--limit') {
      const val = Number(argv[i + 1]);
      if (Number.isFinite(val) && val > 0) args.limit = Math.floor(val);
      i++;
    }
  }
  return args;
}

/**
 * Drop "organic"/"non-organic"/"non-org" qualifiers: they describe farming,
 * not the USDA food, and break matching ("Apples non-organic").
 * @param {string} name @returns {string}
 */
export function stripOrganicQualifiers(name) {
  return (name || '')
    .replace(/\bnon[\s-]*org(anic)?\b\.?/gi, ' ')
    .replace(/\borganic\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Make a free-text query safe for FDC /foods/search: anything other than
 * letters/digits/spaces becomes a space ("/" in particular causes HTTP 400).
 * @param {string} name @returns {string}
 */
export function sanitizeSearchQuery(name) {
  return (name || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Run an FDC call with rate-limit backoff + transient retry. Returns the
 * result, or throws the final error (caller logs + skips; never aborts).
 * @template T
 * @param {() => Promise<T>} fn
 * @param {string} label
 * @param {(ms: number) => Promise<void>} [sleepFn]
 * @returns {Promise<T>}
 */
export async function callWithRetry(fn, label, sleepFn = sleep) {
  let rateRetries = 0;
  let transientRetries = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      const status = err instanceof FdcApiError ? err.status : null;
      if (status === 429 && rateRetries < MAX_429_RETRIES) {
        rateRetries++;
        const ra = Number(err.retryAfter);
        const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : RATE_LIMIT_WAIT_MS;
        console.warn(`[build-usda-map] 429 on ${label}; waiting ${Math.round(wait / 1000)}s (retry ${rateRetries}/${MAX_429_RETRIES}).`);
        await sleepFn(wait);
        continue;
      }
      const transient = status === null || status >= 500;
      if (transient && transientRetries < MAX_TRANSIENT_RETRIES) {
        transientRetries++;
        await sleepFn(2000 * transientRetries);
        continue;
      }
      throw err;
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadJsonIfExists(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    console.warn(`[build-usda-map] ${filePath} exists but is not valid JSON — treating as empty.`);
    return null;
  }
}

/** @param {Record<string, unknown>} obj @returns {Record<string, unknown>} same entries, numeric-key-sorted */
function sortObjectKeysNumeric(obj) {
  const sorted = {};
  for (const key of Object.keys(obj).sort((a, b) => Number(a) - Number(b))) {
    sorted[key] = obj[key];
  }
  return sorted;
}

// ── Main pipeline ────────────────────────────────────────────────────────────

function atomicWrite(file, obj) {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  renameSync(tmp, file);
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  const apiKey = env.USDA_API_KEY || env.VITE_USDA_API_KEY || DEMO_KEY;
  const keyTier = apiKey === DEMO_KEY ? 'demo' : 'configured';
  const delayMs = keyTier === 'demo' ? DEMO_DELAY_MS : LIVE_DELAY_MS;

  console.log(
    keyTier === 'demo'
      ? '[build-usda-map] No USDA_API_KEY/VITE_USDA_API_KEY found in .env — using the public DEMO_KEY (heavily rate-limited; use --limit for a pilot).'
      : '[build-usda-map] Using configured USDA_API_KEY from .env.'
  );

  const items = JSON.parse(readFileSync(ITEMS_PATH, 'utf8'));
  const overlay = JSON.parse(readFileSync(OVERLAY_PATH, 'utf8'));
  const subset = computeTargetSubset(items, overlay).sort((a, b) => a.foodItemID - b.foodItemID);

  const existingMapFile = loadJsonIfExists(MAP_PATH);
  let mapItems = { ...(existingMapFile?.items || {}) };
  /** foodItemID -> {name, reason}: searched, nothing acceptable. Skipped on resume. */
  const unmatched = { ...(existingMapFile?.unmatched || {}) };
  if (cli.retryUnmatched) for (const k of Object.keys(unmatched)) delete unmatched[k];
  const existingNutrientsFile = loadJsonIfExists(NUTRIENTS_PATH);
  let nutrients = { ...(existingNutrientsFile?.nutrients || {}) };
  /** foodItemID -> {name, error}: failed this run; retried next run. */
  const errored = {};

  const toAttempt = subset.filter((item) => {
    const id = String(item.foodItemID);
    return !mapItems[id] && !unmatched[id];
  });
  const attemptList = cli.details ? [] : cli.limit ? toAttempt.slice(0, cli.limit) : toAttempt;

  console.log(
    `[build-usda-map] Subset size: ${subset.length}. Already resolved (matched/unmatched/manual): ${
      subset.length - toAttempt.length
    }. To attempt this run: ${attemptList.length}${cli.limit ? ` (--limit ${cli.limit})` : ''}.`
  );

  const stats = { attempted: 0, matched: 0, unmatched: 0, errored: 0, nutrientsFetched: 0 };
  let stopReason = null;

  function writeCheckpoint(final) {
    const generatedAt = new Date().toISOString();
    const fdcDataVersion = `FDC API v1 (accessed ${generatedAt.slice(0, 10)}); USDA does not expose a single unified dataset version via the API — each matched item's fdcId links to its own FDC record for provenance.`;
    const subsetIds = subset.map((it) => String(it.foodItemID));
    const matchedCount = subsetIds.filter((id) => mapItems[id]).length;
    const unmatchedCount = subsetIds.filter((id) => !mapItems[id] && unmatched[id]).length;
    const lastRun = {
      keyTier,
      limit: cli.limit,
      attempted: stats.attempted,
      matchedThisRun: stats.matched,
      unmatchedThisRun: stats.unmatched,
      erroredThisRun: stats.errored,
      complete: final && !stopReason,
      stoppedEarly: Boolean(stopReason),
      stopReason,
    };
    mkdirSync(OUT_DIR, { recursive: true });
    atomicWrite(MAP_PATH, {
      _meta: {
        generatedAt,
        fdcDataVersion,
        subsetSize: subset.length,
        matchedCount,
        unmatchedCount,
        pendingCount: subset.length - matchedCount - unmatchedCount,
        matchThreshold: DEFAULT_MATCH_THRESHOLD,
        dataTypePriority: DATA_TYPE_PRIORITY,
        lastRun,
      },
      items: sortObjectKeysNumeric(mapItems),
      unmatched: sortObjectKeysNumeric(unmatched),
    });
    atomicWrite(NUTRIENTS_PATH, {
      _meta: {
        generatedAt,
        fdcDataVersion,
        fdcIdCount: Object.keys(nutrients).length,
        lastRun: { keyTier, fetchedThisRun: stats.nutrientsFetched, stoppedEarly: Boolean(stopReason), stopReason },
      },
      nutrients: sortObjectKeysNumeric(nutrients),
    });
  }

  let interrupted = false;
  process.on('SIGINT', () => {
    interrupted = true;
    stopReason = 'interrupted (SIGINT)';
  });

  // Phase 1: search + match. One item failing is logged and skipped.
  for (const item of attemptList) {
    if (interrupted) break;
    stats.attempted++;
    const rawName = item.displayAs || item.description || '';
    const cleanName = stripOrganicQualifiers(rawName) || rawName;
    const normalizedTarget = normalizeFoodName(cleanName);
    const searchQuery = sanitizeSearchQuery(cleanName);
    const id = String(item.foodItemID);

    try {
      if (!searchQuery) throw new Error('empty query after sanitizing');
      const searchRes = await callWithRetry(
        () => searchFoods(searchQuery, { apiKey, dataType: DATA_TYPE_PRIORITY, pageSize: 10 }),
        `search #${id}`
      );
      const candidates = searchRes.foods || [];
      const best = pickBestMatch(normalizedTarget, candidates, { threshold: DEFAULT_MATCH_THRESHOLD });
      if (best) {
        mapItems[id] = {
          fdcId: best.fdcId,
          matchedName: best.matchedName,
          dataType: best.dataType,
          matchScore: best.matchScore,
          manualOverride: false,
        };
        stats.matched++;
        console.log(`  [match] #${id} "${rawName}" -> ${best.fdcId} "${best.matchedName}" (${best.dataType}, ${best.matchScore})`);
      } else {
        unmatched[id] = { name: rawName, reason: candidates.length ? 'below-threshold' : 'no-usda-candidates' };
        stats.unmatched++;
        console.log(`  [no match] #${id} "${rawName}" (${unmatched[id].reason})`);
      }
    } catch (err) {
      stats.errored++;
      errored[id] = { name: rawName, error: err.message };
      console.warn(`  [error-skipped] #${id} "${rawName}": ${err.message}`);
    }

    if (stats.attempted % CHECKPOINT_EVERY === 0) writeCheckpoint(false);
    await sleep(delayMs);
  }
  writeCheckpoint(false);

  // Phase 2: nutrients for any referenced fdcId not yet cached (also runs on
  // resume, and after a partial phase 1, since matches so far are real).
  const referencedIds = [...new Set(Object.values(mapItems).map((e) => e.fdcId))];
  const neededFdcIds = referencedIds.filter((fdcId) => {
    const row = nutrients[String(fdcId)];
    if (!row) return !cli.details; // details mode never adds macro-only rows by itself
    return cli.details && (cli.refreshDetails || !row.micros);
  });
  if (cli.details) console.log(`[build-usda-map] --details: ${neededFdcIds.length} fdcIds need micronutrients (batches of ${BATCH_SIZE}).`);
  for (let i = 0; i < neededFdcIds.length && !interrupted; i += BATCH_SIZE) {
    const batch = neededFdcIds.slice(i, i + BATCH_SIZE);
    try {
      const foods = await callWithRetry(() => getFoods(batch, { apiKey, format: 'full' }), `nutrients batch @${batch[0]}`);
      for (const food of foods) {
        const per100g = extractPer100g(food.foodNutrients);
        const existing = nutrients[String(food.fdcId)];
        let entry;
        if (existing) {
          entry = { ...existing }; // keep macros/portion untouched (backward compatible)
        } else {
          const portion = pickServingPortion(food.foodPortions);
          entry = { per100g, portionSource: portion ? portion.label : 'none' };
          if (portion) entry.perServing = scaleToServing(per100g, portion.gramWeight);
        }
        const micro100 = extractMicros(food.foodNutrients);
        entry.micros = { per100g: micro100 };
        if (entry.perServing?.amount) entry.micros.perServing = scaleMicros(micro100, entry.perServing.amount);
        nutrients[String(food.fdcId)] = entry;
      }
      stats.nutrientsFetched += foods.length;
      console.log(`  [nutrients] fetched batch of ${foods.length} (starting fdcId ${batch[0]})`);
      writeCheckpoint(false);
    } catch (err) {
      console.warn(`  [error-skipped] nutrient batch starting ${batch[0]}: ${err.message}`);
      stats.errored++;
    }
    await sleep(cli.details ? Math.min(delayMs, 1200) : delayMs);
  }

  writeCheckpoint(true);

  const pending = subset.filter((it) => !mapItems[String(it.foodItemID)] && !unmatched[String(it.foodItemID)]).length;
  console.log(`\n[build-usda-map] Wrote ${MAP_PATH}\n[build-usda-map] Wrote ${NUTRIENTS_PATH}`);
  console.log(
    `[build-usda-map] TOTALS — subset ${subset.length} | matched ${Object.keys(mapItems).length} | unmatched ${Object.keys(unmatched).length} | pending ${pending} | nutrients ${Object.keys(nutrients).length}` +
      `\n[build-usda-map] THIS RUN — attempted ${stats.attempted} | matched ${stats.matched} | unmatched ${stats.unmatched} | errored ${stats.errored} | nutrients fetched ${stats.nutrientsFetched}` +
      (stopReason ? `\n[build-usda-map] STOPPED EARLY: ${stopReason} — rerun \`npm run usda:map\` to resume.` : '')
  );
  const errIds = Object.keys(errored);
  if (errIds.length) {
    console.log('\n[build-usda-map] Errored (not recorded; retried next run):');
    for (const id of errIds) console.log(`  #${id} "${errored[id].name}": ${errored[id].error}`);
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((err) => {
    console.error('[build-usda-map]', err.message || err);
    process.exit(1);
  });
}
