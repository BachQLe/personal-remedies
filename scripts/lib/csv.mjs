/**
 * scripts/lib/csv.mjs — minimal RFC4180-ish CSV parser (Track 1C content
 * pipeline). Node builtins only, no dependencies.
 *
 * WHY NOT `.split(',')`: recipe titles and URLs routinely contain commas
 * ("Vietnamese Noodle Soup, Light Broth") — a naive split silently corrupts
 * them into extra columns. This parser instead walks the text character by
 * character, tracking quote state, so quoted fields (with embedded commas,
 * newlines, and escaped `""`) round-trip correctly.
 *
 * Supported:
 *  - quoted fields: `"a,b"` → `a,b`; escaped quotes: `"say ""hi"""` → `say "hi"`
 *  - commas and newlines inside quoted fields
 *  - CRLF, LF, and lone-CR line endings (spreadsheet exports vary)
 *  - a leading UTF-8 BOM (common from Excel/Numbers CSV export) is stripped
 *  - header cells are trimmed; a fully blank trailing line is ignored
 *
 * NOT supported (out of scope for a manually-maintained ~50-row content
 * table): multiple header rows, typed columns, streaming/large files.
 *
 * `parseCsv` returns records keyed by the RAW (trimmed) header text — it
 * does not know or care what those headers mean. `normalizeHeader` /
 * `normalizeRecordKeys` below let a caller look a field up tolerant of case
 * and extra whitespace (e.g. Sunny's spreadsheet export saying
 * "Calorie Count" one day and "calorie count" the next), without this
 * module having any opinion on what the "real" column names are — that
 * belongs to the caller (scripts/lib/recipeRow.mjs).
 */

const BOM = '﻿';

/**
 * Tokenize CSV text into rows of raw string fields (no header handling).
 * @param {string} text
 * @returns {string[][]}
 */
function parseRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      if (text[i + 1] === '\n') i++; // CRLF: swallow the \n too
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i++;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  // Flush a trailing field/row that wasn't newline-terminated. When the
  // file DOES end in a newline, both `field` and `row` are already empty
  // here, so nothing spurious gets appended (no phantom blank last row).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Parse CSV text into an array of plain objects keyed by the (trimmed)
 * header row. Extra cells beyond the header width are dropped; missing
 * trailing cells on a data row are filled with `''`.
 * @param {string} text
 * @returns {Array<Record<string, string>>}
 */
export function parseCsv(text) {
  if (typeof text !== 'string') {
    throw new TypeError('parseCsv: expected a string');
  }
  const stripped = text.charCodeAt(0) === BOM.charCodeAt(0) ? text.slice(1) : text;
  const rows = parseRows(stripped);
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim());
  const records = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    // A fully blank single-cell row (e.g. trailing blank line some editors
    // add) carries no data — skip it rather than emitting an all-empty record.
    if (row.length === 1 && row[0] === '') continue;
    const record = {};
    for (let c = 0; c < header.length; c++) {
      record[header[c]] = row[c] !== undefined ? row[c] : '';
    }
    records.push(record);
  }
  return records;
}

/**
 * Normalize a header string for tolerant lookup: trim, lowercase, and
 * collapse internal whitespace runs to a single space. `"Calorie Count"`,
 * `"calorie count"`, and `"  Calorie   Count "` all normalize to the same
 * key. Does NOT touch underscores/punctuation — `"FI_TEXT"` normalizes to
 * `"fi_text"`, not `"fi text"`, since that's a distinct literal column name
 * in Mory's dictated schema, not incidental spreadsheet whitespace.
 * @param {string} header
 * @returns {string}
 */
export function normalizeHeader(header) {
  return String(header ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Re-key a single parsed record by normalized header, so callers can look
 * up `normalized['calorie count']` regardless of the source casing/spacing.
 * When two original headers normalize to the same key, the later one (as
 * `Object.entries` iterates) wins — acceptable for a hand-maintained content
 * CSV where that would itself indicate a duplicate-column authoring mistake.
 * @param {Record<string, string>} record
 * @returns {Record<string, string>}
 */
export function normalizeRecordKeys(record) {
  const out = {};
  for (const [key, value] of Object.entries(record)) {
    out[normalizeHeader(key)] = value;
  }
  return out;
}
