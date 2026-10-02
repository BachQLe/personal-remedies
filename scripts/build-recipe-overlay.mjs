#!/usr/bin/env node
/**
 * scripts/build-recipe-overlay.mjs — CSV -> src/data/recipeOverlay.json
 * (Track 1C content pipeline). Regenerates the overlay WHOLESALE every run:
 * the output is fully recomputed from the CSV, never merged with whatever
 * was there before (same invariant as scripts/flag-snack-beverage.mjs's
 * generated overlay).
 *
 * Run manually:
 *   node scripts/build-recipe-overlay.mjs                 # content/recipes.csv -> src/data/recipeOverlay.json
 *   node scripts/build-recipe-overlay.mjs path/to.csv      # custom CSV path
 *   node scripts/build-recipe-overlay.mjs --out path.json  # custom output path
 *
 * SOURCE (Sept 2026): Mory's REAL 119-recipe spreadsheet, extracted from
 * "Recipe_Coding_Master_File.xlsx" (DB-Ready sheet) via
 * scripts/xlsx-to-recipe-csv.mjs into content/recipes.csv. This replaced an
 * earlier placeholder 5-column spec this file's comments used to describe —
 * see scripts/lib/recipeRow.mjs's header for the real column list. Maps
 * onto the `RecipeOverlayRow` shape in src/api/types.js (read-only
 * reference, not imported — see the house-style note below) as:
 *   FI          -> foodItemID (Number)
 *   FI_TEXT     -> name
 *   Meal        -> mealType + alsoFits (parsed from a slash-delimited code
 *                  like "L/D" or "B/Ds" via `normalizeMealCode` — an
 *                  unrecognized code is reported and the row DROPPED, never
 *                  guessed — see scripts/lib/recipeRow.mjs)
 *   URL         -> sourceUrl
 *                  fineFoodGroup: 'l' (constant — recipes are always
 *                  Nutridigm fine food group 'l')
 * Calorie Count / nutritionPerServing is OPTIONAL and, for this source, is
 * always absent — see "CALORIES" below.
 *
 * LONG_DESC / `attribution`: this source DOES have a LONG_DESC column
 * (unlike the old placeholder spec, which is why an earlier version of this
 * comment said attribution was "deliberately omitted" — that reasoning is
 * now stale). It was evaluated and NOT wired through, because its content
 * is inconsistent free text rather than a clean source label: most rows are
 * "SOURCE; Recipe Title; https://...url" (redundantly restating FI_TEXT and
 * URL, both already captured elsewhere in the row), some carry ad hoc
 * editorial asides ("FN; Giada De Laurentiis; separate recipe for Marinara
 * Sauce"), and at least one has a plain typo ("FN; Alto Brown" for "Alton
 * Brown"). A clean attribution ("FN", "MedlinePlus") COULD be derived by
 * splitting on the first ";" — but that's a heuristic transform this
 * pipeline deliberately avoids applying to free text (same "never guess"
 * principle as Meal-code/URL validation): if Mory ever gives LONG_DESC a
 * clean, single-purpose meaning, wire it through explicitly then. Until
 * then, src/utils/foodDetailCard.js's `resolveRecipeLinkTarget` already
 * falls back to the URL's hostname when `attribution` is absent
 * (`item.attribution || hostnameFromUrl(item.sourceUrl)`), so the app
 * degrades gracefully without it.
 *
 * CALORIES: Mory's real spreadsheet has NO calorie column at all (unlike
 * the old placeholder spec). `nutritionPerServing` is therefore omitted
 * ENTIRELY for every row from this source — never emitted as `{calories:
 * 0}` or `{}` (both would misrepresent "no data" as "zero" or "checked and
 * empty"). `parseCalories`/`isBlank` in scripts/lib/recipeRow.mjs exist so
 * a *future* source that does carry calories can still be validated
 * strictly when present, without this file treating "column doesn't exist"
 * as an error.
 *
 * CROSS-CHECKS AGAINST src/data/cache/items.json (read-only, no network):
 *   - non-4-digit FI, empty name, unrecognized Meal code, present-but-
 *     non-numeric calories, non-https URL, duplicate FI (keeps the first
 *     occurrence) -> DROPPED and reported, same as before.
 *   - FI found in items.json but NOT fineFoodGroup 'l' -> DROPPED and
 *     reported. This still indicates a genuinely wrong id, so it stays a
 *     hard drop.
 *   - FI NOT found in items.json at all -> now a WARNING, not a drop (Sept
 *     2026 change). Mory's real spreadsheet pre-assigns 70 of its 119 FIs
 *     (5054-5123, verified against the LIVE Nutridigm API, not just this
 *     repo's items.json snapshot) to recipes Nutridigm hasn't loaded into
 *     that id range yet. The user explicitly chose to import all 119 rows
 *     now rather than wait: `joinRecipeOverlay` (src/api/recipeIngestion.js)
 *     can only ever enrich a recipe the live API actually returned, never
 *     invent one, so an overlay row for an FI the API doesn't know about
 *     yet is structurally inert — it sits in recipeOverlay.json doing
 *     nothing until Nutridigm loads that id, then lights up automatically
 *     with no re-import needed. Dropping it instead would just mean
 *     re-running this whole pipeline later for no reason.
 *
 * House style follows scripts/flag-snack-beverage.mjs and
 * scripts/audit-overlay.mjs: plain Node, no dependencies, `fs` reads of
 * src/data/cache/items.json rather than importing src/api/localTables.js
 * (which uses Vite-style JSON imports that throw under bare `node`),
 * exported pure functions for testability, and a `pathToFileURL` main guard
 * so importing this file in tests never executes the CLI.
 *
 * Output is sorted ascending by foodItemID for deterministic diffs, written
 * as `JSON.stringify(rows, null, 2) + '\n'`.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { parseCsv } from './lib/csv.mjs';
import {
  extractRow,
  isBlank,
  isFourDigitFI,
  isHttpsUrl,
  normalizeMealCode,
  parseCalories,
} from './lib/recipeRow.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ITEMS_PATH = path.join(ROOT, 'src', 'data', 'cache', 'items.json');
const DEFAULT_CSV_PATH = path.join(ROOT, 'content', 'recipes.csv');
const DEFAULT_OUT_PATH = path.join(ROOT, 'src', 'data', 'recipeOverlay.json');

// ═════════════════════════════════════════════════════════════════════════
// Pure functions — no fs/network access below this point until "File I/O".
// ═════════════════════════════════════════════════════════════════════════

/**
 * Map one parsed CSV record to a `RecipeOverlayRow`, or report why it was
 * dropped. `seenFoodItemIds` is consulted (and mutated by the caller, not
 * here) so duplicate FIs are caught in the order rows appear — the first
 * successfully-built row for a given FI wins; a duplicate is only flagged
 * once a first row for that FI has actually been accepted (a first
 * occurrence dropped for some other reason doesn't "claim" the id).
 *
 * A row whose FI isn't in `itemsById` still succeeds (`ok: true`) but comes
 * back with a non-null `warning` — see the module header's CROSS-CHECKS
 * section for why a missing-from-items.json FI is a warning, not a drop.
 * @param {Record<string, string>} record
 * @param {{itemsById: Map<number, Object>, seenFoodItemIds: Set<number>}} ctx
 * @returns {{ok: true, foodItemID: number, row: Object, warning: string|null} | {ok: false, foodItemID: number|null, reason: string}}
 */
export function buildOverlayRow(record, { itemsById, seenFoodItemIds }) {
  const { fi, fiText, meal, calorieCount, url } = extractRow(record);

  if (!isFourDigitFI(fi)) {
    return { ok: false, foodItemID: null, reason: `FI "${fi ?? ''}" is not a 4-digit id` };
  }
  const foodItemID = Number(fi.trim());

  const item = itemsById.get(foodItemID);
  let warning = null;
  if (item) {
    if (item.fineFoodGroup !== 'l') {
      return {
        ok: false,
        foodItemID,
        reason: `FI ${foodItemID}: fineFoodGroup is '${item.fineFoodGroup}', not 'l' (item: "${item.description}")`,
      };
    }
  } else {
    warning = `FI ${foodItemID}: not found in items.json (pending Nutridigm load — row still imported, inert until it lands)`;
  }

  if (seenFoodItemIds.has(foodItemID)) {
    return { ok: false, foodItemID, reason: `FI ${foodItemID}: duplicate (kept first occurrence)` };
  }

  const name = typeof fiText === 'string' ? fiText.trim() : '';
  if (!name) {
    return { ok: false, foodItemID, reason: `FI ${foodItemID}: FI_TEXT is empty` };
  }

  const mealCode = normalizeMealCode(meal);
  if (!mealCode) {
    return { ok: false, foodItemID, reason: `FI ${foodItemID}: unrecognized Meal code "${meal ?? ''}"` };
  }

  let calories = null;
  if (!isBlank(calorieCount)) {
    calories = parseCalories(calorieCount);
    if (calories === null) {
      return { ok: false, foodItemID, reason: `FI ${foodItemID}: Calorie Count "${calorieCount}" is not numeric` };
    }
  }

  const sourceUrl = typeof url === 'string' ? url.trim() : '';
  if (!isHttpsUrl(sourceUrl)) {
    return { ok: false, foodItemID, reason: `FI ${foodItemID}: URL "${sourceUrl}" is not https` };
  }

  const row = {
    foodItemID,
    name,
    mealType: mealCode.mealType,
    ...(mealCode.alsoFits.length > 0 ? { alsoFits: mealCode.alsoFits } : {}),
    fineFoodGroup: 'l',
    ...(calories !== null ? { nutritionPerServing: { calories } } : {}),
    sourceUrl,
  };

  return { ok: true, foodItemID, row, warning };
}

/**
 * Build the full overlay from parsed CSV records + the item snapshot.
 * Rows are sorted ascending by foodItemID for deterministic diffs.
 * @param {Array<Record<string, string>>} records
 * @param {Array<{foodItemID: number, fineFoodGroup: string, description: string}>} items
 * @returns {{rows: Array<Object>, dropped: string[], warnings: string[]}}
 */
export function buildOverlay(records, items) {
  const itemsById = new Map(items.map((it) => [it.foodItemID, it]));
  const seenFoodItemIds = new Set();
  const rows = [];
  const dropped = [];
  const warnings = [];

  for (const record of records) {
    const result = buildOverlayRow(record, { itemsById, seenFoodItemIds });
    if (result.ok) {
      seenFoodItemIds.add(result.foodItemID);
      rows.push(result.row);
      if (result.warning) warnings.push(result.warning);
    } else {
      dropped.push(result.reason);
    }
  }

  rows.sort((a, b) => a.foodItemID - b.foodItemID);
  return { rows, dropped, warnings };
}

// ═════════════════════════════════════════════════════════════════════════
// File I/O + CLI — everything below this point touches disk.
// ═════════════════════════════════════════════════════════════════════════

/**
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {{csvPath: string|null, outPath: string|null}}
 */
function parseArgs(argv) {
  const args = { csvPath: null, outPath: null };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') {
      args.outPath = argv[i + 1] || null;
      i++;
    } else {
      positional.push(argv[i]);
    }
  }
  args.csvPath = positional[0] || null;
  return args;
}

function main() {
  const cli = parseArgs(process.argv.slice(2));
  const csvPath = cli.csvPath ? path.resolve(ROOT, cli.csvPath) : DEFAULT_CSV_PATH;
  const outPath = cli.outPath ? path.resolve(ROOT, cli.outPath) : DEFAULT_OUT_PATH;

  if (!existsSync(csvPath)) {
    console.error(`[build-recipe-overlay] CSV not found: ${csvPath}`);
    process.exitCode = 1;
    return;
  }

  const csvText = readFileSync(csvPath, 'utf8');
  const records = parseCsv(csvText);
  const items = JSON.parse(readFileSync(ITEMS_PATH, 'utf8'));

  const { rows, dropped, warnings } = buildOverlay(records, items);

  writeFileSync(outPath, JSON.stringify(rows, null, 2) + '\n');

  console.log(`[build-recipe-overlay] read ${records.length} row(s) from ${csvPath}`);
  console.log(`[build-recipe-overlay] wrote ${rows.length} row(s) to ${outPath}`);
  console.log(`[build-recipe-overlay] dropped ${dropped.length} row(s)`);
  for (const reason of dropped) console.log(`  - ${reason}`);
  console.log(`[build-recipe-overlay] ${warnings.length} warning(s)`);
  for (const warning of warnings) console.log(`  - ${warning}`);
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) main();
