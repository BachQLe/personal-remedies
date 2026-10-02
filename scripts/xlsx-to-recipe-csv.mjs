#!/usr/bin/env node
/**
 * scripts/xlsx-to-recipe-csv.mjs — extracts Mory's real recipe-coding
 * spreadsheet ("DB-Ready" sheet of Recipe_Coding_Master_File.xlsx) into
 * content/recipes.csv, the CSV that scripts/build-recipe-overlay.mjs and
 * scripts/validate-recipe-csv.mjs actually consume. This exists so
 * re-importing is reproducible the next time Mory sends an updated
 * workbook — re-run this one script instead of hand-copying cells.
 *
 * Run manually:
 *   node scripts/xlsx-to-recipe-csv.mjs path/to/Recipe_Coding_Master_File.xlsx
 *   node scripts/xlsx-to-recipe-csv.mjs path/to.xlsx --out content/recipes.csv
 *
 * SOURCE WORKBOOK SHAPE (verified against the real file, not assumed —
 * see "WHY WE RESOLVE THE SHEET BY NAME" below): four sheets ("Existing
 * Recipe", "Bach's 150 Recipe", "Combined (Existing & New)", "DB-Ready").
 * Only "DB-Ready" — 119 data rows, header in row 1 — is Mory's finished,
 * authoritative table; the other three are scratch/working sheets and are
 * never read by this script.
 *
 * DB-READY COLUMN LAYOUT (NOT contiguous — this is the single easiest
 * thing to get wrong when re-deriving this script from memory):
 *   A = FI            4-digit Nutridigm foodItemID, 5000-5123 in the real
 *                     file, no duplicates.
 *   B = FI_TEXT        recipe title.
 *   C = LONG_DESC      a free-text attribution/description cell, e.g.
 *                     "FN; Giada De Laurentiis" or "MedlinePlus; Zucchini
 *                     Pizza Boats; <url>". See build-recipe-overlay.mjs's
 *                     header for what we do with it.
 *   D = URL            source link. Exactly 3 rows have this blank (FI
 *                     5015 "Buiscuit Crust", 5024 "Chicken Piccata", 5026
 *                     "Quinoa Salad") and get dropped downstream since
 *                     sourceUrl is required.
 *   E-J               "Breakfast/Lunch/Dinner/Dessert/Snack/Beverage" flag
 *                     columns. DELIBERATELY IGNORED — see below.
 *   K, L               EMPTY. No header, no data. If you re-derive this
 *                     script from a fresh look at the sheet and don't
 *                     account for this 2-column gap, every column from M
 *                     onward will silently shift by two and this script
 *                     will read garbage into Meal/comments. This script
 *                     does not hardcode "M"/"N" as fixed offsets from A for
 *                     that exact reason — it reads by the cell's own `r=`
 *                     column letter, so a gap like this can't desync it.
 *   M = Meal           the categorization this script actually extracts.
 *   N = Sunny Comments free-text QA notes, not extracted (not needed by
 *                     the content pipeline; read the workbook directly if
 *                     you need to see them).
 *
 * WHY E-J (THE FLAG COLUMNS) ARE IGNORED: they look like the obvious place
 * to read meal categorization from (one boolean column per meal type), but
 * they are unreliable — only 9 of the 119 rows have any "X" in them at all,
 * and the sheet's own "Category Totals" row uses stale cached
 * COUNTBLANK() formula results that don't match the actual data. Column M
 * ("Meal"), by contrast, is fully populated for all 119 rows and is what
 * Mory actually uses to categorize each recipe — slash-delimited codes like
 * "L/D" or "B/Ds" (see scripts/lib/recipeRow.mjs's `normalizeMealCode` for
 * how those are parsed downstream). So: M is read, E-J are not.
 *
 * WHY WE RESOLVE THE SHEET BY NAME INSTEAD OF ASSUMING "sheet4.xml": a
 * workbook's sheetN.xml filenames are storage-order, not display-order, and
 * both can change if someone reorders/renames/re-adds sheets in Excel or
 * LibreOffice. This script reads xl/workbook.xml for the <sheet name=...
 * r:id=.../> entry matching TARGET_SHEET_NAME, then resolves that r:id to
 * an actual worksheet path via xl/_rels/workbook.xml.rels — exactly what a
 * spreadsheet application does — rather than hardcoding "sheet4.xml" (which
 * happens to be DB-Ready's current file today, verified, but is not
 * guaranteed to stay that way across a future export).
 *
 * ZERO-DEPENDENCY XLSX READING: an .xlsx is a zip of XML parts. House style
 * for scripts/ here is plain Node, no dependencies, so this file implements
 * just enough of the zip format itself (walk the End Of Central Directory
 * record -> central directory entries -> local file headers, and inflate
 * with node:zlib's `inflateRawSync`, which is what zip's DEFLATE method
 * needs) to pull out xl/workbook.xml, xl/_rels/workbook.xml.rels,
 * xl/sharedStrings.xml, and the resolved worksheet XML. Cell text is
 * resolved through the shared-strings table (`t="s"` cells, the common
 * case for repeated text) as well as inline strings (`t="inlineStr"`,
 * `<is><t>...</t></is>`) and formula-cached strings (`t="str"`); numeric
 * cells (`t="n"` or no `t` at all, e.g. the FI column) are read straight
 * off `<v>`.
 *
 * OUTPUT: content/recipes.csv (created if missing) with exactly the columns
 * `FI,FI_TEXT,LONG_DESC,Meal,URL` — the shape scripts/lib/recipeRow.mjs's
 * `extractRow` and scripts/build-recipe-overlay.mjs / validate-recipe-csv.mjs
 * expect. Uses a proper CSV-quoting routine (recipe titles and LONG_DESC
 * values routinely contain commas, e.g. "MedlinePlus; Zucchini Pizza Boats;
 * <url>").
 *
 * A row with no usable FI (blank separator row, or a stray totals/footer
 * row past the 119 real data rows) is skipped and reported, not written as
 * a garbage CSV row — this script does not know or enforce the
 * build-recipe-overlay.mjs-level rules (4-digit check, blank-URL drop,
 * etc.); that validation happens downstream, on purpose, so this script
 * stays a dumb, faithful transcription of the sheet and all business rules
 * live in one place (scripts/lib/recipeRow.mjs).
 *
 * `pathToFileURL` main guard so tests can import the pure helpers below
 * without running the CLI (same pattern as every other scripts/*.mjs file).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUT_PATH = path.join(ROOT, 'content', 'recipes.csv');

const TARGET_SHEET_NAME = 'DB-Ready';
const CSV_COLUMNS = ['FI', 'FI_TEXT', 'LONG_DESC', 'Meal', 'URL'];
/** Sheet columns (by their `r=` letter) we read, and what they map to. */
const COLUMN_MAP = { A: 'FI', B: 'FI_TEXT', C: 'LONG_DESC', D: 'URL', M: 'Meal' };

// ═════════════════════════════════════════════════════════════════════════
// Zip container reading — no XLSX-specific knowledge below this point.
// ═════════════════════════════════════════════════════════════════════════

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIR_SIGNATURE = 0x02014b50;
const LOCAL_HEADER_SIGNATURE = 0x04034b50;

/**
 * Walk a zip file's End Of Central Directory record and central directory
 * to build a map of entry name -> {compressionMethod, compressedSize,
 * localHeaderOffset}. Does not decompress anything yet.
 * @param {Buffer} buffer
 * @returns {Map<string, {compressionMethod: number, compressedSize: number, localHeaderOffset: number}>}
 */
export function readZipCentralDirectory(buffer) {
  let eocdOffset = -1;
  // EOCD is a fixed 22-byte record (plus an optional trailing comment) at
  // the end of the file; scan backwards for its signature.
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('Not a valid zip file: End Of Central Directory record not found');
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);

  const entries = new Map();
  let offset = centralDirOffset;
  for (let i = 0; i < totalEntries; i++) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== CENTRAL_DIR_SIGNATURE) {
      throw new Error(`Malformed zip: bad central directory entry signature at offset ${offset}`);
    }
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const filenameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const filename = buffer.toString('utf8', offset + 46, offset + 46 + filenameLen);

    entries.set(filename, { compressionMethod, compressedSize, localHeaderOffset });
    offset += 46 + filenameLen + extraLen + commentLen;
  }
  return entries;
}

/**
 * Extract and decompress one named entry from a zip, given the buffer and
 * the central directory map from `readZipCentralDirectory`.
 * @param {Buffer} buffer
 * @param {Map<string, {compressionMethod: number, compressedSize: number, localHeaderOffset: number}>} entries
 * @param {string} name
 * @returns {Buffer}
 */
export function readZipEntry(buffer, entries, name) {
  const meta = entries.get(name);
  if (!meta) {
    throw new Error(`Zip entry not found: ${name}`);
  }
  const lh = meta.localHeaderOffset;
  const signature = buffer.readUInt32LE(lh);
  if (signature !== LOCAL_HEADER_SIGNATURE) {
    throw new Error(`Malformed zip: bad local file header signature for ${name}`);
  }
  const filenameLen = buffer.readUInt16LE(lh + 26);
  const extraLen = buffer.readUInt16LE(lh + 28);
  const dataStart = lh + 30 + filenameLen + extraLen;
  const compressedData = buffer.subarray(dataStart, dataStart + meta.compressedSize);

  if (meta.compressionMethod === 0) return Buffer.from(compressedData); // stored, no compression
  if (meta.compressionMethod === 8) return inflateRawSync(compressedData); // deflate
  throw new Error(`Unsupported zip compression method ${meta.compressionMethod} for ${name}`);
}

// ═════════════════════════════════════════════════════════════════════════
// Minimal XML text extraction — regex-based, not a general XML parser.
// Safe here because OOXML parts are machine-generated with predictable,
// non-nested-attribute-quote formatting; not intended for arbitrary XML.
// ═════════════════════════════════════════════════════════════════════════

/**
 * Decode the handful of XML entities that appear in OOXML text content.
 * Numeric entities first, `&amp;` last (standard order — decoding `&amp;`
 * first would corrupt an already-escaped `&lt;` written as `&amp;lt;`).
 * @param {string} str
 * @returns {string}
 */
export function decodeXmlEntities(str) {
  return String(str)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Concatenate every `<t>`/`<t xml:space="preserve">` text run inside an XML
 * fragment (handles both a bare `<si><t>text</t></si>` and rich-text runs
 * `<si><r><t>a</t></r><r><t>b</t></r></si>`), decoding entities.
 * @param {string} fragment
 * @returns {string}
 */
function extractRunText(fragment) {
  const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  let out = '';
  let m;
  while ((m = tRe.exec(fragment))) out += decodeXmlEntities(m[1]);
  return out;
}

/**
 * Parse xl/sharedStrings.xml into an index-ordered array of strings.
 * @param {string} xml
 * @returns {string[]}
 */
export function parseSharedStrings(xml) {
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g;
  const strings = [];
  let m;
  while ((m = siRe.exec(xml))) {
    strings.push(m[1] !== undefined ? extractRunText(m[1]) : '');
  }
  return strings;
}

/**
 * Resolve the worksheet XML part path for `sheetName`, by reading
 * xl/workbook.xml (name -> r:id) and xl/_rels/workbook.xml.rels
 * (r:id -> Target) — see the header comment for why this isn't hardcoded.
 * @param {string} workbookXml
 * @param {string} relsXml
 * @param {string} sheetName
 * @returns {string} a zip entry path, e.g. "xl/worksheets/sheet4.xml"
 */
export function resolveSheetPath(workbookXml, relsXml, sheetName) {
  const sheetTagRe = /<sheet\b[^>]*\/>/g;
  let m;
  let rId = null;
  while ((m = sheetTagRe.exec(workbookXml))) {
    const tag = m[0];
    const nameMatch = /\bname="([^"]*)"/.exec(tag);
    if (nameMatch && decodeXmlEntities(nameMatch[1]) === sheetName) {
      const idMatch = /\br:id="([^"]*)"/.exec(tag);
      rId = idMatch ? idMatch[1] : null;
      break;
    }
  }
  if (!rId) {
    throw new Error(`Sheet "${sheetName}" not found in xl/workbook.xml`);
  }

  const relTagRe = /<Relationship\b[^>]*\/>/g;
  let relMatch;
  let target = null;
  while ((relMatch = relTagRe.exec(relsXml))) {
    const tag = relMatch[0];
    const idMatch = /\bId="([^"]*)"/.exec(tag);
    if (idMatch && idMatch[1] === rId) {
      const targetMatch = /\bTarget="([^"]*)"/.exec(tag);
      target = targetMatch ? targetMatch[1] : null;
      break;
    }
  }
  if (!target) {
    throw new Error(`Relationship "${rId}" (for sheet "${sheetName}") not found in xl/_rels/workbook.xml.rels`);
  }
  return target.startsWith('/') ? target.slice(1) : `xl/${target}`;
}

/**
 * Split a `<row>...</row>` block's inner XML into `{col: {type, rawValue}}`
 * cells, keyed by column letter (from each cell's own `r="A2"` reference —
 * NOT by position, which is what makes the K/L empty-column gap harmless).
 * `rawValue` is the raw (still shared-string-index-or-literal) `<v>`/`<is>`
 * content; resolving it to real text/number happens in `resolveCellValue`.
 * @param {string} rowInner
 * @returns {Record<string, {type: string, rawValue: string|null}>}
 */
function parseRowCells(rowInner) {
  const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  const cells = {};
  let m;
  while ((m = cellRe.exec(rowInner))) {
    const attrs = m[1];
    const inner = m[2];
    const refMatch = /\br="([A-Z]+)\d+"/.exec(attrs);
    if (!refMatch) continue;
    const col = refMatch[1];
    const typeMatch = /\bt="([a-zA-Z]+)"/.exec(attrs);
    const type = typeMatch ? typeMatch[1] : 'n';

    let rawValue = null;
    if (inner) {
      if (type === 'inlineStr') {
        const isMatch = /<is>([\s\S]*?)<\/is>/.exec(inner);
        rawValue = isMatch ? extractRunText(isMatch[1]) : '';
      } else {
        const vMatch = /<v>([\s\S]*?)<\/v>/.exec(inner);
        rawValue = vMatch ? vMatch[1] : null;
      }
    }
    cells[col] = { type, rawValue };
  }
  return cells;
}

/**
 * Parse a worksheet XML document into `{rowNumber, cells}` entries, in
 * document order. `rowNumber` is the sheet's own 1-based `r=` attribute
 * (so it lines up with what a human sees in the spreadsheet app), not a
 * recomputed index — a sparse sheet can skip row numbers.
 * @param {string} sheetXml
 * @returns {Array<{rowNumber: number, cells: Record<string, {type: string, rawValue: string|null}>}>}
 */
export function parseSheetRows(sheetXml) {
  const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  const rows = [];
  let m;
  while ((m = rowRe.exec(sheetXml))) {
    const attrs = m[1];
    const inner = m[2] || '';
    const rowNumMatch = /\br="(\d+)"/.exec(attrs);
    if (!rowNumMatch) continue;
    rows.push({ rowNumber: Number(rowNumMatch[1]), cells: parseRowCells(inner) });
  }
  return rows;
}

/**
 * Resolve one parsed cell to its actual text/number value.
 * @param {{type: string, rawValue: string|null}|undefined} cell
 * @param {string[]} sharedStrings
 * @returns {string}
 */
export function resolveCellValue(cell, sharedStrings) {
  if (!cell || cell.rawValue === null || cell.rawValue === undefined) return '';
  if (cell.type === 's') {
    const idx = Number(cell.rawValue);
    return sharedStrings[idx] !== undefined ? sharedStrings[idx] : '';
  }
  if (cell.type === 'b') {
    return cell.rawValue === '1' ? 'TRUE' : 'FALSE';
  }
  // 'inlineStr' text was already resolved (decoded) in parseRowCells.
  // 'str' (cached formula string) and 'n'/absent (numeric) are plain
  // <v> text — still worth an entity-decode pass for the 'str' case.
  return cell.type === 'inlineStr' ? cell.rawValue : decodeXmlEntities(cell.rawValue);
}

// ═════════════════════════════════════════════════════════════════════════
// DB-Ready sheet -> CSV records — the XLSX-specific logic.
// ═════════════════════════════════════════════════════════════════════════

/**
 * Extract the DB-Ready sheet's data rows (everything after row 1, the
 * header) into `{FI, FI_TEXT, LONG_DESC, Meal, URL}` records, using
 * COLUMN_MAP to read by each cell's own column letter. A row with no FI
 * value at all (blank spacer row, stray footer) is skipped and its sheet
 * row number reported in `skippedRowNumbers` — it is not a data row, so it
 * is not written to the CSV, but it's surfaced rather than silently eaten
 * in case it actually mattered.
 * @param {string} sheetXml
 * @param {string[]} sharedStrings
 * @returns {{records: Array<Record<string, string>>, skippedRowNumbers: number[]}}
 */
export function extractDbReadyRecords(sheetXml, sharedStrings) {
  const rows = parseSheetRows(sheetXml);
  const records = [];
  const skippedRowNumbers = [];

  for (const { rowNumber, cells } of rows) {
    if (rowNumber === 1) continue; // header row

    const record = {};
    for (const [col, field] of Object.entries(COLUMN_MAP)) {
      record[field] = resolveCellValue(cells[col], sharedStrings).trim();
    }

    if (record.FI === '') {
      skippedRowNumbers.push(rowNumber);
      continue;
    }
    records.push(record);
  }

  return { records, skippedRowNumbers };
}

// ═════════════════════════════════════════════════════════════════════════
// CSV writing.
// ═════════════════════════════════════════════════════════════════════════

/**
 * Quote a single CSV field when needed (contains a comma, double quote, or
 * newline), doubling any embedded double quotes. Recipe titles and
 * LONG_DESC values routinely contain commas, so this can't be a plain join.
 * @param {*} value
 * @returns {string}
 */
export function csvField(value) {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Render extracted records as CSV text (header + one line per record, in
 * CSV_COLUMNS order), `\n`-terminated including the final line.
 * @param {Array<Record<string, string>>} records
 * @returns {string}
 */
export function toCsv(records) {
  const lines = [CSV_COLUMNS.join(',')];
  for (const record of records) {
    lines.push(CSV_COLUMNS.map((col) => csvField(record[col])).join(','));
  }
  return lines.join('\n') + '\n';
}

// ═════════════════════════════════════════════════════════════════════════
// File I/O + CLI — everything below this point touches disk.
// ═════════════════════════════════════════════════════════════════════════

function parseArgs(argv) {
  const args = { xlsxPath: null, outPath: null };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') {
      args.outPath = argv[i + 1] || null;
      i++;
    } else {
      positional.push(argv[i]);
    }
  }
  args.xlsxPath = positional[0] || null;
  return args;
}

function main() {
  const cli = parseArgs(process.argv.slice(2));
  if (!cli.xlsxPath) {
    console.error('[xlsx-to-recipe-csv] usage: node scripts/xlsx-to-recipe-csv.mjs <path-to.xlsx> [--out path.csv]');
    process.exitCode = 1;
    return;
  }
  const xlsxPath = path.resolve(process.cwd(), cli.xlsxPath);
  const outPath = cli.outPath ? path.resolve(ROOT, cli.outPath) : DEFAULT_OUT_PATH;

  if (!existsSync(xlsxPath)) {
    console.error(`[xlsx-to-recipe-csv] file not found: ${xlsxPath}`);
    process.exitCode = 1;
    return;
  }

  const buffer = readFileSync(xlsxPath);
  const entries = readZipCentralDirectory(buffer);

  const workbookXml = readZipEntry(buffer, entries, 'xl/workbook.xml').toString('utf8');
  const relsXml = readZipEntry(buffer, entries, 'xl/_rels/workbook.xml.rels').toString('utf8');
  const sheetPath = resolveSheetPath(workbookXml, relsXml, TARGET_SHEET_NAME);
  console.log(`[xlsx-to-recipe-csv] resolved sheet "${TARGET_SHEET_NAME}" -> ${sheetPath}`);

  const sharedStrings = entries.has('xl/sharedStrings.xml')
    ? parseSharedStrings(readZipEntry(buffer, entries, 'xl/sharedStrings.xml').toString('utf8'))
    : [];
  const sheetXml = readZipEntry(buffer, entries, sheetPath).toString('utf8');

  const { records, skippedRowNumbers } = extractDbReadyRecords(sheetXml, sharedStrings);

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, toCsv(records));

  console.log(`[xlsx-to-recipe-csv] extracted ${records.length} row(s) from "${TARGET_SHEET_NAME}"`);
  if (skippedRowNumbers.length > 0) {
    console.log(`[xlsx-to-recipe-csv] skipped ${skippedRowNumbers.length} row(s) with no FI: sheet row(s) ${skippedRowNumbers.join(', ')}`);
  }
  console.log(`[xlsx-to-recipe-csv] wrote ${outPath}`);
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) main();
