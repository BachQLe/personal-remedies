/**
 * scripts/lib/recipeRow.mjs — shared row-level logic for the Track 1C
 * content pipeline (build-recipe-overlay.mjs and validate-recipe-csv.mjs).
 * Node builtins only, no dependencies. Every export here is a pure
 * function: no fs/network access, so both scripts (and their tests) exercise
 * the exact same rules instead of two hand-copied implementations drifting
 * apart.
 *
 * SOURCE SCHEMA (Sept 2026 — Mory's REAL 119-recipe spreadsheet,
 * "DB-Ready" sheet of Recipe_Coding_Master_File.xlsx, extracted via
 * scripts/xlsx-to-recipe-csv.mjs; see that file's header for the sheet's
 * full column layout). This module reads five CSV columns:
 *   FI          4-digit Nutridigm foodItemID. Real fineFoodGroup 'l' ids
 *               are 5000-5053 today (see src/data/cache/items.json); the
 *               source spreadsheet pre-assigns ids up to 5123 for recipes
 *               Nutridigm hasn't loaded yet — see build-recipe-overlay.mjs's
 *               header for how that's handled (WARN, not drop).
 *   FI_TEXT     recipe title.
 *   LONG_DESC   free-text attribution string (e.g. "FN; Giada De
 *               Laurentiis"). Optional column — see `extractRow` below.
 *   Meal        a slash-delimited categorization CODE, e.g. "L/D" or
 *               "B/Ds" — NOT a single full word. This replaced an earlier,
 *               now-obsolete single-word "Dinner"/"Snacks"/etc. schema (see
 *               `normalizeMealType`, kept for back-compat below). Parsed by
 *               `normalizeMealCode`.
 *   URL         source link. This is the one column that's still genuinely
 *               required — a row with no URL is dropped downstream
 *               (sourceUrl is a required overlay field).
 * Calorie Count does NOT exist in this source at all (see `parseCalories`
 * below — it's now an optional column everywhere in this pipeline). This
 * module does NOT know about the rest of the (relaxed, see src/api/types.js
 * RecipeOverlayRow / src/api/recipeIngestion.js validateOverlayRow) overlay
 * schema — `rawIngredients`, `servings`, `totalTimeMinutes` etc. are simply
 * not in Mory's spreadsheet, and neither build-recipe-overlay.mjs nor this
 * module invents them.
 */

import { normalizeHeader } from './csv.mjs';

/**
 * @type {ReadonlyArray<'breakfast'|'lunch'|'dinner'|'snack'|'beverage'|'dessert'>}
 * Kept in sync with the identical list in src/api/recipeIngestion.js (that
 * file is the authority for the app-facing schema; this file mirrors it for
 * the content-pipeline side and must not drift from it). 'dessert' added
 * Sept 2026 alongside the real spreadsheet import: Mory's Meal column codes
 * 11 of the 119 recipes as dessert ("Ds"), and it's a first-class meal type
 * distinct from 'snack', not an alias for it.
 */
export const MEAL_TYPES = Object.freeze(['breakfast', 'lunch', 'dinner', 'snack', 'beverage', 'dessert']);

/**
 * Lowercased Meal-column value -> canonical mealType. Covers the six exact
 * values plus the obvious plurals/synonyms a spreadsheet author might type
 * ("Snacks", "Beverages", "Drink", "Drinks", "Dessert(s)"). Deliberately NOT
 * a fuzzy matcher — an unrecognized value is reported and dropped, never
 * guessed (per the task's "never guess" requirement), so this stays a
 * short, auditable allowlist rather than heuristic normalization.
 *
 * NOTE: this whole-word form is NOT what Mory's real spreadsheet's Meal
 * column contains (that's slash-delimited codes like "L/D" — see
 * `normalizeMealCode` below). Kept for back-compat with any caller still
 * expecting a single full-word Meal value.
 * @type {Record<string, typeof MEAL_TYPES[number]>}
 */
const MEAL_ALIASES = {
  breakfast: 'breakfast',
  breakfasts: 'breakfast',
  lunch: 'lunch',
  lunches: 'lunch',
  dinner: 'dinner',
  dinners: 'dinner',
  snack: 'snack',
  snacks: 'snack',
  beverage: 'beverage',
  beverages: 'beverage',
  drink: 'beverage',
  drinks: 'beverage',
  dessert: 'dessert',
  desserts: 'dessert',
};

/**
 * Normalize a raw `Meal` cell to a canonical mealType, or `null` when it
 * isn't recognized. Case/whitespace-insensitive; no other fuzziness.
 * Single-value, whole-word back-compat helper — see the module header and
 * `normalizeMealCode` below for the real spreadsheet's slash-coded format.
 * @param {*} raw
 * @returns {typeof MEAL_TYPES[number]|null}
 */
export function normalizeMealType(raw) {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase();
  return MEAL_ALIASES[key] || null;
}

/**
 * Short-code -> canonical mealType allowlist for Mory's real Meal column
 * (e.g. "L/D", "B/Ds", "B/Bv"). Deliberately short and exact-match only —
 * comparing whole lowercased tokens, never prefixes, is what keeps 'D'
 * (dinner) and 'Ds' (dessert) distinct; a prefix/fuzzy match would
 * conflate them (both start with 'd'). An unrecognized code is the
 * caller's cue to drop-and-report, never guess.
 * @type {Record<string, typeof MEAL_TYPES[number]>}
 */
const MEAL_CODE_MAP = {
  b: 'breakfast',
  l: 'lunch',
  d: 'dinner',
  s: 'snack',
  bv: 'beverage',
  ds: 'dessert',
};

/**
 * Parse a slash-delimited `Meal` code cell (Mory's real spreadsheet format,
 * e.g. "L/D", "B/Ds", "B/L/D") into a primary `mealType` (the first token)
 * plus `alsoFits` (the remaining tokens, deduplicated against each other
 * AND against the primary mealType, order preserved). Returns `null` when
 * the cell is empty/non-string OR when ANY token fails to match
 * MEAL_CODE_MAP — a single bad code invalidates the whole row rather than
 * silently dropping just that token, per the "never guess" invariant: the
 * caller drops and reports the row.
 *
 * Tokens are compared as whole lowercased strings (never prefix-matched) —
 * see MEAL_CODE_MAP's comment for why that matters for 'D' vs 'Ds'.
 * @param {*} raw
 * @returns {{mealType: typeof MEAL_TYPES[number], alsoFits: Array<typeof MEAL_TYPES[number]>}|null}
 */
export function normalizeMealCode(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  const tokens = trimmed.split('/').map((t) => t.trim());
  if (tokens.some((t) => t === '')) return null; // e.g. "L//D" or a trailing "/"

  const mapped = tokens.map((t) => MEAL_CODE_MAP[t.toLowerCase()] || null);
  if (mapped.some((m) => m === null)) return null;

  const [mealType, ...rest] = mapped;
  const alsoFits = [];
  const seen = new Set([mealType]);
  for (const m of rest) {
    if (!seen.has(m)) {
      seen.add(m);
      alsoFits.push(m);
    }
  }

  return { mealType, alsoFits };
}

/**
 * Sane per-serving calorie range used by validate-recipe-csv.mjs's range
 * check. Wide on purpose — a legitimate recipe serving spans a light snack
 * (tens of kcal) to a full entrée (close to a thousand); this exists to
 * catch pipeline mistakes (a per-recipe TOTAL mistakenly entered as
 * per-serving, a stray "0" or transcription typo), not to police real
 * nutrition values. Adjustable — confirm any change with Mory before
 * loosening or tightening it.
 * @type {{min: number, max: number}}
 */
export const CALORIE_RANGE = Object.freeze({ min: 10, max: 2500 });

/**
 * Is `raw` a 4-digit foodItemID string (Sunny's `FI` column, e.g. "5000")?
 * Trims surrounding whitespace first (spreadsheet export artifact) but
 * requires exactly 4 digits, no sign, no decimal — matches the real
 * fineFoodGroup 'l' id range (5000-5053 today) and catches both truncated
 * ids and accidental non-numeric entries.
 * @param {*} raw
 * @returns {boolean}
 */
export function isFourDigitFI(raw) {
  return typeof raw === 'string' && /^\d{4}$/.test(raw.trim());
}

/**
 * Is `raw` a non-empty https:// URL? Mirrors `isHttpsUrl` in
 * src/api/recipeIngestion.js (read-only reference, not imported — that
 * module is a Vite-style ESM import graph this bare-node script doesn't
 * pull in; see the house-style note in build-recipe-overlay.mjs's header).
 * @param {*} raw
 * @returns {boolean}
 */
export function isHttpsUrl(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return false;
  try {
    return new URL(raw.trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Parse a `Calorie Count` cell into a finite number, or `null` when it
 * isn't a plain numeric literal. Deliberately stricter than `Number(raw)`:
 * `Number('')` is `0` and `Number(' ')` is `0`, both of which would silently
 * fabricate a calorie count for a blank cell, so this requires the trimmed
 * text to look like an actual number first.
 *
 * OPTIONAL COLUMN (Sept 2026): Mory's real spreadsheet has NO Calorie Count
 * column at all — this function's strictness is unchanged for the rare case
 * a value IS present (e.g. a future manually-added figure), but callers
 * (build-recipe-overlay.mjs, validate-recipe-csv.mjs) must NOT treat
 * `parseCalories(raw) === null` as an error on its own anymore; `null` is
 * the correct, non-error result for an absent/blank cell (see `isBlank`
 * below), and only a genuinely non-blank-but-non-numeric cell (e.g. "lots")
 * is a validation error. This function alone can't tell those two cases
 * apart (both are blank-vs-garbage text to it) — that distinction is the
 * caller's job, using `isBlank` first.
 * @param {*} raw
 * @returns {number|null}
 */
export function parseCalories(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/**
 * Is `raw` an absent/blank cell (undefined, not a string, or all
 * whitespace)? Small shared helper so callers can distinguish "this
 * optional column is simply not populated" (not an error) from "this
 * column has a value but it's garbage" (an error) — needed now that
 * Calorie Count has no data at all in Mory's real spreadsheet. See
 * `parseCalories`'s header for why this can't just live inside that
 * function.
 * @param {*} raw
 * @returns {boolean}
 */
export function isBlank(raw) {
  return typeof raw !== 'string' || raw.trim() === '';
}

/**
 * Pull the expected columns off a `parseCsv` record, tolerant of header
 * case/spacing via `normalizeHeader` (see scripts/lib/csv.mjs). A missing
 * column simply comes back `undefined` — callers treat that the same as an
 * empty cell. `longDesc` (LONG_DESC) and `calorieCount` (Calorie Count) are
 * both genuinely optional in Mory's real spreadsheet — LONG_DESC is present
 * for every real row but isn't required by any downstream validation, and
 * Calorie Count doesn't exist in the source at all (see `parseCalories`'s
 * header). `normalizeHeader` doesn't touch underscores, so "LONG_DESC"
 * normalizes to "long_desc", matching the literal column name.
 * @param {Record<string, string>} record
 * @returns {{fi: string|undefined, fiText: string|undefined, longDesc: string|undefined, meal: string|undefined, calorieCount: string|undefined, url: string|undefined}}
 */
export function extractRow(record) {
  const normalized = {};
  for (const [key, value] of Object.entries(record || {})) {
    normalized[normalizeHeader(key)] = value;
  }
  return {
    fi: normalized['fi'],
    fiText: normalized['fi_text'],
    longDesc: normalized['long_desc'],
    meal: normalized['meal'],
    calorieCount: normalized['calorie count'],
    url: normalized['url'],
  };
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'with', 'of', 'in', 'on', 'for', 'to',
  'style', 'recipe', 'recipes', 'homemade', 'easy', 'quick', 'classic',
]);

/**
 * Lowercase + split on non-alphanumeric runs, dropping single-character and
 * stopword tokens. Shared by `looksUnrelated` below.
 * @param {*} str
 * @returns {string[]}
 */
function tokenize(str) {
  return String(str ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * WARN-level heuristic (never an error — see validate-recipe-csv.mjs) for
 * catching a likely wrong-FI typo: does the CSV's `FI_TEXT` share literally
 * ANY meaningful word with the target item's own items.json `description`?
 * Recipe titles legitimately diverge in style from a plain food-item
 * description, so this only flags total non-overlap, not a low-but-nonzero
 * similarity score — that would false-positive constantly on real recipe
 * names.
 * @param {*} fiText
 * @param {*} itemDescription
 * @returns {boolean} true when the two strings share NO token
 */
export function looksUnrelated(fiText, itemDescription) {
  const a = tokenize(fiText);
  const b = new Set(tokenize(itemDescription));
  if (a.length === 0 || b.size === 0) return false; // not enough signal to call it unrelated
  return !a.some((t) => b.has(t));
}
