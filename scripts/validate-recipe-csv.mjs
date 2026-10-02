#!/usr/bin/env node
/**
 * scripts/validate-recipe-csv.mjs — read-only content-QA report for Mory's
 * recipe CSV (Track 1C, "checklist 7.1c tooling"). Run BEFORE
 * build-recipe-overlay.mjs ingests a new/updated CSV — this is the tool a
 * human (Bach/Sunny) reads to catch bad rows while they're still easy to
 * fix in the spreadsheet, not after they've silently vanished from
 * src/data/recipeOverlay.json.
 *
 * Run manually:
 *   node scripts/validate-recipe-csv.mjs                    # content/recipes.csv
 *   node scripts/validate-recipe-csv.mjs path/to.csv         # custom path
 *   node scripts/validate-recipe-csv.mjs path/to.csv --check-urls
 *                                                             # also HEAD (falling
 *                                                             # back to GET) every
 *                                                             # https URL and
 *                                                             # report non-2xx
 *
 * ZERO NETWORK CALLS by default — `--check-urls` is opt-in.
 *
 * Per row (against src/data/cache/items.json, read-only, no network):
 *   - FI is a 4-digit id
 *   - Meal is a slash-delimited code whose every token is one of
 *     B/L/D/S/Ds/Bv (breakfast/lunch/dinner/snack/dessert/beverage — see
 *     scripts/lib/recipeRow.mjs's `normalizeMealCode`; this is Mory's real
 *     spreadsheet format, e.g. "L/D" or "B/Ds" — NOT a single full word)
 *   - Calorie Count, WHEN PRESENT, is numeric AND within a sane 10-2500
 *     kcal/serving range (CALORIE_RANGE in scripts/lib/recipeRow.mjs —
 *     adjustable, see its comment; confirm changes with Mory). Mory's real
 *     source has no Calorie Count column at all, so an absent/blank cell is
 *     NOT an error (see `isBlank`) — only a present-but-garbage value is.
 *   - URL is https
 *   - FI is not a duplicate of an earlier row
 *   - FI_TEXT (name) is non-empty after trim
 * Plus two WARNs (not errors — don't affect the exit code):
 *   - FI not found in items.json at all. Mory's real spreadsheet
 *     pre-assigns ids (5054-5123, verified against the live Nutridigm API)
 *     for 70 of its 119 recipes before Nutridigm has loaded them — that's
 *     expected and not a problem with the row, just a "not live yet" state,
 *     so it's a warning, not an error. An FI that IS in items.json but
 *     isn't fineFoodGroup 'l', by contrast, is still a hard ERROR — that
 *     means a genuinely wrong id, not a pending one.
 *   - FI_TEXT and the item's items.json description share no token at all
 *     (only checked when the item was found), which is the signature of a
 *     wrong-FI typo (right shape, wrong id) rather than a genuinely
 *     differently-styled recipe title.
 *
 * Exit code 1 if any row has at least one ERROR (warnings alone exit 0).
 *
 * Shares its row-level rules with build-recipe-overlay.mjs via
 * scripts/lib/recipeRow.mjs and scripts/lib/csv.mjs, so "what counts as a
 * bad row" can't drift between the QA report and the actual loader.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { parseCsv } from './lib/csv.mjs';
import {
  CALORIE_RANGE,
  extractRow,
  isBlank,
  isFourDigitFI,
  isHttpsUrl,
  looksUnrelated,
  normalizeMealCode,
  parseCalories,
} from './lib/recipeRow.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ITEMS_PATH = path.join(ROOT, 'src', 'data', 'cache', 'items.json');
const DEFAULT_CSV_PATH = path.join(ROOT, 'content', 'recipes.csv');

// ═════════════════════════════════════════════════════════════════════════
// Pure functions — no fs/network access below this point until "File I/O".
// ═════════════════════════════════════════════════════════════════════════

/**
 * Validate every parsed CSV record against the QA rules described in the
 * header comment above. `rowNumber` is the 1-based spreadsheet row (header
 * row is 1, so the first data row is 2) so a reviewer can find the row in
 * their spreadsheet app directly.
 * @param {Array<Record<string, string>>} records
 * @param {Array<{foodItemID: number, fineFoodGroup: string, description: string}>} items
 * @returns {Array<{
 *   rowNumber: number, fi: string, foodItemID: number|null, name: string,
 *   mealType: string|null, alsoFits: string[], itemDescription: string|null,
 *   sourceUrl: string, errors: string[], warnings: string[]
 * }>}
 */
export function validateCsvRows(records, items) {
  const itemsById = new Map(items.map((it) => [it.foodItemID, it]));
  const firstSeenAtRow = new Map();
  const results = [];

  records.forEach((record, i) => {
    const rowNumber = i + 2; // +1 for the header row, +1 to be 1-based
    const { fi, fiText, meal, calorieCount, url } = extractRow(record);
    const errors = [];
    const warnings = [];

    let foodItemID = null;
    if (!isFourDigitFI(fi)) {
      errors.push(`FI "${fi ?? ''}" must be a 4-digit id`);
    } else {
      foodItemID = Number(fi.trim());
    }

    let item = null;
    if (foodItemID !== null) {
      item = itemsById.get(foodItemID) || null;
      if (!item) {
        // WARN not ERROR: Mory's real spreadsheet pre-assigns FIs for
        // recipes Nutridigm hasn't loaded yet (see module header). A
        // genuinely wrong id is caught below instead, via the
        // fineFoodGroup check on an id that DOES exist.
        warnings.push(`FI ${foodItemID} not found in items.json (pending Nutridigm load, not necessarily wrong)`);
      } else if (item.fineFoodGroup !== 'l') {
        errors.push(
          `FI ${foodItemID} is fineFoodGroup '${item.fineFoodGroup}', expected 'l' (items.json description: "${item.description}")`
        );
      }

      if (firstSeenAtRow.has(foodItemID)) {
        errors.push(`duplicate FI ${foodItemID} (first seen at row ${firstSeenAtRow.get(foodItemID)})`);
      } else {
        firstSeenAtRow.set(foodItemID, rowNumber);
      }
    }

    const name = typeof fiText === 'string' ? fiText.trim() : '';
    if (!name) errors.push('FI_TEXT (name) is empty');

    const mealCode = normalizeMealCode(meal);
    if (!mealCode) errors.push(`Meal "${meal ?? ''}" is not a valid B/L/D/S/Ds/Bv slash-delimited code`);

    let calories = null;
    if (!isBlank(calorieCount)) {
      calories = parseCalories(calorieCount);
      if (calories === null) {
        errors.push(`Calorie Count "${calorieCount}" is not numeric`);
      } else if (calories < CALORIE_RANGE.min || calories > CALORIE_RANGE.max) {
        errors.push(`Calorie Count ${calories} is outside the ${CALORIE_RANGE.min}-${CALORIE_RANGE.max} kcal sane range`);
      }
    }

    const sourceUrl = typeof url === 'string' ? url.trim() : '';
    if (!isHttpsUrl(sourceUrl)) errors.push(`URL "${sourceUrl}" must be https`);

    if (item && name && looksUnrelated(name, item.description)) {
      warnings.push(
        `FI_TEXT "${name}" shares no word with items.json description "${item.description}" — possible wrong FI`
      );
    }

    results.push({
      rowNumber,
      fi: fi ?? '',
      foodItemID,
      name,
      mealType: mealCode ? mealCode.mealType : null,
      alsoFits: mealCode ? mealCode.alsoFits : [],
      itemDescription: item ? item.description : null,
      sourceUrl,
      errors,
      warnings,
    });
  });

  return results;
}

/**
 * Totals + per-meal counts across a `validateCsvRows` result set.
 * `byMeal` keys unrecognized/missing Meal values under `'(invalid)'` so
 * they're still visible in the count, not silently absent.
 * @param {ReturnType<typeof validateCsvRows>} results
 * @returns {{
 *   totals: {rows: number, rowsWithErrors: number, rowsWithWarnings: number, errors: number, warnings: number},
 *   byMeal: Record<string, number>
 * }}
 */
export function summarizeResults(results) {
  const totals = { rows: results.length, rowsWithErrors: 0, rowsWithWarnings: 0, errors: 0, warnings: 0 };
  const byMeal = {};
  for (const r of results) {
    if (r.errors.length > 0) totals.rowsWithErrors++;
    if (r.warnings.length > 0) totals.rowsWithWarnings++;
    totals.errors += r.errors.length;
    totals.warnings += r.warnings.length;
    const key = r.mealType || '(invalid)';
    byMeal[key] = (byMeal[key] || 0) + 1;
  }
  return { totals, byMeal };
}

/**
 * HEAD (falling back to GET on 405/501, which some servers return for HEAD)
 * a single URL with a timeout, for the opt-in `--check-urls` pass. Takes an
 * injectable `fetchImpl` purely so this stays unit-testable without a real
 * network call — production calls always use the ambient global `fetch`
 * (Node 22+ ships one; no dependency needed).
 * @param {string} url
 * @param {{fetchImpl?: typeof fetch, timeoutMs?: number}} [opts]
 * @returns {Promise<{ok: boolean, status: number|null, error?: string}>}
 */
export async function checkUrl(url, { fetchImpl = fetch, timeoutMs = 6000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res = await fetchImpl(url, { method: 'HEAD', signal: controller.signal });
    if (res.status === 405 || res.status === 501) {
      res = await fetchImpl(url, { method: 'GET', signal: controller.signal });
    }
    return { ok: res.status >= 200 && res.status < 300, status: res.status };
  } catch (err) {
    return { ok: false, status: null, error: err && err.message ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

// ═════════════════════════════════════════════════════════════════════════
// File I/O + CLI — everything below this point touches disk (and,
// opt-in via --check-urls, the network).
// ═════════════════════════════════════════════════════════════════════════

function parseArgs(argv) {
  const args = { csvPath: null, checkUrls: false };
  const positional = [];
  for (const arg of argv) {
    if (arg === '--check-urls') args.checkUrls = true;
    else positional.push(arg);
  }
  args.csvPath = positional[0] || null;
  return args;
}

function printReport(results, summary) {
  console.log('\nRemedi recipe CSV validation');
  console.log('='.repeat(78));
  console.log(`${summary.totals.rows} row(s) checked`);
  console.log(
    `${summary.totals.rowsWithErrors} row(s) with errors (${summary.totals.errors} total), ` +
      `${summary.totals.rowsWithWarnings} row(s) with warnings (${summary.totals.warnings} total)`
  );

  console.log('\nPer-meal counts:');
  for (const key of Object.keys(summary.byMeal).sort()) {
    console.log(`  ${key.padEnd(12)} ${summary.byMeal[key]}`);
  }

  const problemRows = results.filter((r) => r.errors.length > 0 || r.warnings.length > 0);
  if (problemRows.length === 0) {
    console.log('\nNo per-row problems found.');
  } else {
    console.log('\nPer-row problems:');
    for (const r of problemRows) {
      console.log(`\n  Row ${r.rowNumber} — FI ${r.fi || '(missing)'} "${r.name || '(no name)'}"`);
      for (const e of r.errors) console.log(`    ERROR: ${e}`);
      for (const w of r.warnings) console.log(`    WARN:  ${w}`);
    }
  }
  console.log('');
}

async function runUrlChecks(results) {
  console.log('── URL reachability (--check-urls) ─────────────────────────────────────');
  const httpsRows = results.filter((r) => isHttpsUrl(r.sourceUrl));
  let badCount = 0;
  for (const r of httpsRows) {
    const result = await checkUrl(r.sourceUrl);
    if (!result.ok) {
      badCount++;
      const detail = result.status !== null ? `status ${result.status}` : `error: ${result.error}`;
      console.log(`  Row ${r.rowNumber} FI ${r.fi}: ${detail} — ${r.sourceUrl}`);
    }
  }
  console.log(`${httpsRows.length} URL(s) checked, ${badCount} non-2xx/unreachable.`);
  console.log('');
  return badCount;
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const csvPath = cli.csvPath ? path.resolve(ROOT, cli.csvPath) : DEFAULT_CSV_PATH;

  if (!existsSync(csvPath)) {
    console.error(`[validate-recipe-csv] CSV not found: ${csvPath}`);
    process.exitCode = 1;
    return;
  }

  const csvText = readFileSync(csvPath, 'utf8');
  const records = parseCsv(csvText);
  const items = JSON.parse(readFileSync(ITEMS_PATH, 'utf8'));

  const results = validateCsvRows(records, items);
  const summary = summarizeResults(results);
  printReport(results, summary);

  let urlErrors = 0;
  if (cli.checkUrls) urlErrors = await runUrlChecks(results);

  if (summary.totals.errors > 0 || urlErrors > 0) {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) await main();
