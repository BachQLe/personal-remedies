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

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { searchFoods, getFoods, FdcApiError } from '../src/api/usda.js';

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
const LIVE_DELAY_MS = 400;
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
  return normalized ? normalized.split(' ').filter(Boolean) : [];
}

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

    const contender = {
      fdcId: candidate.fdcId,
      matchedName: candidate.description,
      dataType: candidate.dataType,
      matchScore: Math.round(score * 100) / 100,
      _methodRank: METHOD_RANK[method] ?? -1,
      _dataTypeRank: DATA_TYPE_PRIORITY.indexOf(candidate.dataType),
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
  if (a.matchScore !== b.matchScore) return a.matchScore > b.matchScore;
  if (a._methodRank !== b._methodRank) return a._methodRank > b._methodRank;
  if (a._dataTypeRank !== b._dataTypeRank) return a._dataTypeRank < b._dataTypeRank;
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
  const args = { limit: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--limit') {
      const val = Number(argv[i + 1]);
      if (Number.isFinite(val) && val > 0) args.limit = Math.floor(val);
      i++;
    }
  }
  return args;
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
  const existingMapItems = existingMapFile?.items || {};
  const existingNutrientsFile = loadJsonIfExists(NUTRIENTS_PATH);
  const existingNutrients = existingNutrientsFile?.nutrients || {};

  const toAttempt = subset.filter((item) => !existingMapItems[String(item.foodItemID)]);
  const attemptList = cli.limit ? toAttempt.slice(0, cli.limit) : toAttempt;

  console.log(
    `[build-usda-map] Subset size: ${subset.length}. Already resolved (matched or manually set): ${
      subset.length - toAttempt.length
    }. To attempt this run: ${attemptList.length}${cli.limit ? ` (--limit ${cli.limit})` : ''}.`
  );

  const newMapEntries = {};
  const unmatchedThisRun = [];
  let stoppedEarly = false;
  let stopReason = null;
  let attempted = 0;

  for (const item of attemptList) {
    attempted++;
    const rawName = item.displayAs || item.description || '';
    const normalizedTarget = normalizeFoodName(rawName);
    // FDC's POST /foods/search returns a hard 400 for any query containing
    // a "/" (observed on e.g. "Sugar/snap peas non-org") — strip it to a
    // space for the HTTP query only. rawName (with the slash) is still what
    // gets displayed/stored; normalizedTarget (used for scoring) already
    // strips punctuation independently, so match quality is unaffected.
    const searchQuery = rawName.replace(/\//g, ' ').replace(/\s+/g, ' ').trim();

    try {
      const searchRes = await searchFoods(searchQuery, { apiKey, dataType: DATA_TYPE_PRIORITY, pageSize: 10 });
      const candidates = searchRes.foods || [];
      const best = pickBestMatch(normalizedTarget, candidates, { threshold: DEFAULT_MATCH_THRESHOLD });

      if (best) {
        newMapEntries[String(item.foodItemID)] = {
          fdcId: best.fdcId,
          matchedName: best.matchedName,
          dataType: best.dataType,
          matchScore: best.matchScore,
          manualOverride: false,
        };
        console.log(
          `  [match] #${item.foodItemID} "${rawName}" -> fdcId ${best.fdcId} "${best.matchedName}" (${best.dataType}, score ${best.matchScore})`
        );
      } else {
        unmatchedThisRun.push({ foodItemID: item.foodItemID, name: rawName });
        console.log(`  [no match] #${item.foodItemID} "${rawName}"`);
      }
    } catch (err) {
      if (err instanceof FdcApiError && err.status === 429) {
        stoppedEarly = true;
        stopReason = '429 rate limited by FDC API during search phase';
      } else {
        stoppedEarly = true;
        stopReason = `search failed for #${item.foodItemID} "${rawName}": ${err.message}`;
      }
      console.warn(`[build-usda-map] Stopping search phase: ${stopReason} (${attempted - 1}/${attemptList.length} attempted this run before stopping).`);
      break;
    }

    await sleep(delayMs);
  }

  const mergedMapItems = mergeMapEntries(existingMapItems, newMapEntries);

  // Fetch nutrients for any fdcId the merged map references that we don't
  // already have cached — covers both newly-matched items AND fdcIds a
  // human pointed a manualOverride row at without a nutrients.json entry yet.
  const neededFdcIds = [...new Set(Object.values(mergedMapItems).map((e) => e.fdcId))].filter(
    (fdcId) => !existingNutrients[String(fdcId)]
  );

  const newNutrients = {};
  let fetchedThisRun = 0;

  if (!stoppedEarly) {
    for (let i = 0; i < neededFdcIds.length; i += BATCH_SIZE) {
      const batch = neededFdcIds.slice(i, i + BATCH_SIZE);
      try {
        const foods = await getFoods(batch, { apiKey, format: 'full' });
        for (const food of foods) {
          const per100g = extractPer100g(food.foodNutrients);
          const portion = pickServingPortion(food.foodPortions);
          const entry = { per100g, portionSource: portion ? portion.label : 'none' };
          if (portion) entry.perServing = scaleToServing(per100g, portion.gramWeight);
          newNutrients[String(food.fdcId)] = entry;
        }
        fetchedThisRun += foods.length;
        console.log(`  [nutrients] fetched batch of ${foods.length} (starting fdcId ${batch[0]})`);
      } catch (err) {
        if (err instanceof FdcApiError && err.status === 429) {
          stoppedEarly = true;
          stopReason = stopReason || '429 rate limited by FDC API during nutrients phase';
        } else {
          stoppedEarly = true;
          stopReason = stopReason || `nutrient fetch failed: ${err.message}`;
        }
        console.warn(`[build-usda-map] Stopping nutrient fetch: ${stopReason}`);
        break;
      }
      await sleep(delayMs);
    }
  } else if (neededFdcIds.length > 0) {
    console.log('[build-usda-map] Skipping nutrient fetch phase — search phase already stopped early.');
  }

  const mergedNutrients = { ...existingNutrients, ...newNutrients };

  const subsetIds = subset.map((it) => String(it.foodItemID));
  const matchedCount = subsetIds.filter((id) => mergedMapItems[id]).length;
  const unmatchedCount = subset.length - matchedCount;
  const generatedAt = new Date().toISOString();
  const fdcDataVersion = `FDC API v1 (accessed ${generatedAt.slice(0, 10)}); USDA does not expose a single unified dataset version via the API — each matched item's fdcId links to its own FDC record for provenance.`;

  const mapOut = {
    _meta: {
      generatedAt,
      fdcDataVersion,
      subsetSize: subset.length,
      matchedCount,
      unmatchedCount,
      matchThreshold: DEFAULT_MATCH_THRESHOLD,
      dataTypePriority: DATA_TYPE_PRIORITY,
      lastRun: {
        keyTier,
        limit: cli.limit,
        attempted,
        matchedThisRun: Object.keys(newMapEntries).length,
        unmatchedThisRun: unmatchedThisRun.length,
        stoppedEarly,
        stopReason,
      },
    },
    items: sortObjectKeysNumeric(mergedMapItems),
  };

  const nutrientsOut = {
    _meta: {
      generatedAt,
      fdcDataVersion,
      fdcIdCount: Object.keys(mergedNutrients).length,
      lastRun: { keyTier, fetchedThisRun, stoppedEarly, stopReason },
    },
    nutrients: sortObjectKeysNumeric(mergedNutrients),
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(MAP_PATH, JSON.stringify(mapOut, null, 2) + '\n', 'utf8');
  writeFileSync(NUTRIENTS_PATH, JSON.stringify(nutrientsOut, null, 2) + '\n', 'utf8');

  console.log(`\n[build-usda-map] Wrote ${MAP_PATH}`);
  console.log(`[build-usda-map] Wrote ${NUTRIENTS_PATH}`);
  console.log(
    `\n[build-usda-map] TOTALS — subset ${subset.length} | matched ${matchedCount} | unmatched ${unmatchedCount}` +
      `\n[build-usda-map] THIS RUN — attempted ${attempted} | matched ${Object.keys(newMapEntries).length} | unmatched ${unmatchedThisRun.length} | nutrients fetched ${fetchedThisRun}` +
      (stoppedEarly ? `\n[build-usda-map] STOPPED EARLY: ${stopReason}` : '')
  );

  if (unmatchedThisRun.length > 0) {
    console.log('\n[build-usda-map] Unmatched this run (absent from map — never guessed):');
    for (const u of unmatchedThisRun.slice(0, 50)) {
      console.log(`  #${u.foodItemID} "${u.name}"`);
    }
    if (unmatchedThisRun.length > 50) console.log(`  ... and ${unmatchedThisRun.length - 50} more`);
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((err) => {
    console.error('[build-usda-map]', err.message || err);
    process.exit(1);
  });
}
