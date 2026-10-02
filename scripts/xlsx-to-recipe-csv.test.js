/**
 * scripts/xlsx-to-recipe-csv.test.js — coverage for
 * scripts/xlsx-to-recipe-csv.mjs's pure helpers (Track 1C). No real .xlsx
 * file is read here (that's exercised manually against the real
 * Recipe_Coding_Master_File.xlsx, not committed to the repo) — instead this
 * builds small synthetic zip buffers and XML fragments, same house pattern
 * as the other scripts/*.test.js files.
 */
import { describe, expect, it } from 'vitest';
import {
  csvField,
  decodeXmlEntities,
  extractDbReadyRecords,
  parseSharedStrings,
  parseSheetRows,
  readZipCentralDirectory,
  readZipEntry,
  resolveCellValue,
  resolveSheetPath,
  toCsv,
} from './xlsx-to-recipe-csv.mjs';

// ═════════════════════════════════════════════════════════════════════════
// Zip container round-trip — hand-built "stored" (uncompressed) zip
// buffers, since that's enough to exercise the central-directory-walking
// and local-header-reading logic without needing node:zlib's deflate side.
// ═════════════════════════════════════════════════════════════════════════

/**
 * Build a minimal valid zip buffer (compression method 0 / "stored") from
 * `{name, data}` entries, for testing readZipCentralDirectory/readZipEntry
 * without a real .xlsx file. CRC32 is left as 0 — this reader (correctly)
 * never checks it.
 * @param {Array<{name: string, data: Buffer}>} entries
 * @returns {Buffer}
 */
function makeStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(0, 8); // compression method: stored
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0, 12); // mod date
    localHeader.writeUInt32LE(0, 14); // crc32
    localHeader.writeUInt32LE(data.length, 18); // compressed size
    localHeader.writeUInt32LE(data.length, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26); // filename length
    localHeader.writeUInt16LE(0, 28); // extra length
    localParts.push(localHeader, nameBuf, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0, 8); // flags
    centralHeader.writeUInt16LE(0, 10); // compression method
    centralHeader.writeUInt16LE(0, 12); // mod time
    centralHeader.writeUInt16LE(0, 14); // mod date
    centralHeader.writeUInt32LE(0, 16); // crc32
    centralHeader.writeUInt32LE(data.length, 20); // compressed size
    centralHeader.writeUInt32LE(data.length, 24); // uncompressed size
    centralHeader.writeUInt16LE(nameBuf.length, 28); // filename length
    centralHeader.writeUInt16LE(0, 30); // extra length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(offset, 42); // local header offset
    centralParts.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + data.length;
  }

  const localSection = Buffer.concat(localParts);
  const centralSection = Buffer.concat(centralParts);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with central dir
  eocd.writeUInt16LE(entries.length, 8); // total entries this disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(centralSection.length, 12); // central dir size
  eocd.writeUInt32LE(localSection.length, 16); // central dir offset
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([localSection, centralSection, eocd]);
}

describe('readZipCentralDirectory + readZipEntry', () => {
  it('round-trips multiple stored entries', () => {
    const buffer = makeStoredZip([
      { name: 'xl/workbook.xml', data: Buffer.from('<workbook/>', 'utf8') },
      { name: 'xl/worksheets/sheet4.xml', data: Buffer.from('<worksheet>hello</worksheet>', 'utf8') },
    ]);
    const entries = readZipCentralDirectory(buffer);
    expect(entries.size).toBe(2);
    expect(readZipEntry(buffer, entries, 'xl/workbook.xml').toString('utf8')).toBe('<workbook/>');
    expect(readZipEntry(buffer, entries, 'xl/worksheets/sheet4.xml').toString('utf8')).toBe(
      '<worksheet>hello</worksheet>'
    );
  });

  it('throws for a missing entry', () => {
    const buffer = makeStoredZip([{ name: 'a.xml', data: Buffer.from('x') }]);
    const entries = readZipCentralDirectory(buffer);
    expect(() => readZipEntry(buffer, entries, 'missing.xml')).toThrow(/not found/);
  });

  it('throws when the buffer has no End Of Central Directory record', () => {
    expect(() => readZipCentralDirectory(Buffer.from('not a zip'))).toThrow(/End Of Central Directory/);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// XML helpers.
// ═════════════════════════════════════════════════════════════════════════

describe('decodeXmlEntities', () => {
  it('decodes the standard named entities', () => {
    expect(decodeXmlEntities('a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;')).toBe(`a & b <c> "d" 'e'`);
  });

  it('decodes numeric entities (decimal and hex)', () => {
    expect(decodeXmlEntities('&#65;&#x42;')).toBe('AB');
  });

  it('decodes &amp; last so it does not corrupt an already-escaped entity', () => {
    expect(decodeXmlEntities('&amp;lt;')).toBe('&lt;');
  });
});

describe('resolveSheetPath', () => {
  const workbookXml = `<workbook><sheets>
    <sheet name="Existing Recipe" sheetId="1" state="visible" r:id="rId3"/>
    <sheet name="DB-Ready" sheetId="4" state="visible" r:id="rId6"/>
  </sheets></workbook>`;
  const relsXml = `<Relationships>
    <Relationship Id="rId3" Type="worksheet" Target="worksheets/sheet1.xml"/>
    <Relationship Id="rId6" Type="worksheet" Target="worksheets/sheet4.xml"/>
  </Relationships>`;

  it('resolves the named sheet to its zip-relative worksheet path', () => {
    expect(resolveSheetPath(workbookXml, relsXml, 'DB-Ready')).toBe('xl/worksheets/sheet4.xml');
  });

  it('resolves a different sheet name to a different path (verifies by name, not position)', () => {
    expect(resolveSheetPath(workbookXml, relsXml, 'Existing Recipe')).toBe('xl/worksheets/sheet1.xml');
  });

  it('throws when the sheet name is not found', () => {
    expect(() => resolveSheetPath(workbookXml, relsXml, 'Nonexistent')).toThrow(/not found in xl\/workbook\.xml/);
  });

  it('throws when the relationship id has no matching Relationship entry', () => {
    const brokenRels = `<Relationships><Relationship Id="rId999" Target="worksheets/sheet9.xml"/></Relationships>`;
    expect(() => resolveSheetPath(workbookXml, brokenRels, 'DB-Ready')).toThrow(/Relationship "rId6"/);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// Sheet row parsing, including the DB-Ready K/L empty-column gap: the real
// sheet has data in A-D, flag columns E-J, EMPTY K and L, then Meal at M.
// If a re-implementation ever read columns by position instead of by their
// own `r=` letter, that gap would silently shift M's value into K's slot
// (or vice versa). These tests build a row exactly like that shape and
// confirm M's value is still read as Meal, not desynced by the gap.
// ═════════════════════════════════════════════════════════════════════════

describe('parseSheetRows + resolveCellValue (K/L column gap)', () => {
  const sharedStrings = ['FI', 'FI_TEXT', 'LONG_DESC', 'Lemon-Garlic Shrimp and Grits', 'FN Kitchen', 'L/D', 'https://x'];

  it('reads column M correctly even though K and L are entirely absent from the row XML', () => {
    // Row 2: A (FI, numeric), B/C (shared strings), D (URL, shared string),
    // E-J omitted entirely (the unreliable flag columns), K and L likewise
    // omitted (genuinely empty, no cells at all — this is the real sheet's
    // shape), then M (Meal) and N (comments, also a shared string but not
    // read by extractDbReadyRecords).
    const rowXml = `<row r="2">
      <c r="A2" t="n"><v>5000</v></c>
      <c r="B2" t="s"><v>3</v></c>
      <c r="C2" t="s"><v>4</v></c>
      <c r="D2" t="s"><v>6</v></c>
      <c r="M2" t="s"><v>5</v></c>
    </row>`;
    const [row] = parseSheetRows(rowXml);
    expect(row.rowNumber).toBe(2);
    expect(resolveCellValue(row.cells['A'], sharedStrings)).toBe('5000');
    expect(resolveCellValue(row.cells['M'], sharedStrings)).toBe('L/D');
    // K and L genuinely have no cell entry at all — resolving an absent
    // column must not throw and must not "borrow" a neighboring value.
    expect(resolveCellValue(row.cells['K'], sharedStrings)).toBe('');
    expect(resolveCellValue(row.cells['L'], sharedStrings)).toBe('');
  });

  it('reads column M correctly even when K/L are present as empty self-closing cells', () => {
    // Some spreadsheet exports emit a self-closing cell for a styled-but-
    // empty column instead of omitting it outright — either shape must
    // resolve to the same result.
    const rowXml = `<row r="2">
      <c r="A2" t="n"><v>5000</v></c>
      <c r="K2" s="1"/>
      <c r="L2" s="1"/>
      <c r="M2" t="s"><v>5</v></c>
    </row>`;
    const [row] = parseSheetRows(rowXml);
    expect(resolveCellValue(row.cells['M'], sharedStrings)).toBe('L/D');
    expect(resolveCellValue(row.cells['K'], sharedStrings)).toBe('');
  });

  it('parses multiple rows in document order, skipping rows with no r= attribute', () => {
    const sheetXml = `<sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c></row>
      <row r="2"><c r="A2" t="n"><v>5000</v></c></row>
      <row r="3"><c r="A3" t="n"><v>5001</v></c></row>
    </sheetData>`;
    const rows = parseSheetRows(sheetXml);
    expect(rows.map((r) => r.rowNumber)).toEqual([1, 2, 3]);
  });
});

describe('parseSharedStrings', () => {
  it('extracts plain <t> text', () => {
    expect(parseSharedStrings('<sst><si><t>FI</t></si><si><t>FI_TEXT</t></si></sst>')).toEqual(['FI', 'FI_TEXT']);
  });

  it('concatenates multi-run rich text within one <si>', () => {
    const xml = '<sst><si><r><t>Lemon-</t></r><r><t>Garlic Shrimp</t></r></si></sst>';
    expect(parseSharedStrings(xml)).toEqual(['Lemon-Garlic Shrimp']);
  });

  it('decodes entities inside shared strings', () => {
    expect(parseSharedStrings('<sst><si><t>Mac &amp; Cheese</t></si></sst>')).toEqual(['Mac & Cheese']);
  });

  it('returns an empty string for a self-closing (empty) <si/>', () => {
    expect(parseSharedStrings('<sst><si/></sst>')).toEqual(['']);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// Full DB-Ready row extraction (integration of the pieces above).
// ═════════════════════════════════════════════════════════════════════════

describe('extractDbReadyRecords', () => {
  const sharedStrings = [
    'FI', 'FI_TEXT', 'LONG_DESC', 'Meal', 'URL', // header row strings (0-4), unused by extraction
    'Lemon-Garlic Shrimp and Grits', // 5
    'FN Kitchen', // 6
    'L/D', // 7
    'https://medlineplus.gov/x', // 8
    'Blank URL Recipe', // 9
    'Ds', // 10
  ];

  it('extracts data rows keyed by FI/FI_TEXT/LONG_DESC/Meal/URL, skipping the header row', () => {
    const sheetXml = `<sheetData>
      <row r="1">
        <c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c>
        <c r="D1" t="s"><v>4</v></c><c r="M1" t="s"><v>3</v></c>
      </row>
      <row r="2">
        <c r="A2" t="n"><v>5000</v></c>
        <c r="B2" t="s"><v>5</v></c>
        <c r="C2" t="s"><v>6</v></c>
        <c r="D2" t="s"><v>8</v></c>
        <c r="M2" t="s"><v>7</v></c>
      </row>
    </sheetData>`;
    const { records, skippedRowNumbers } = extractDbReadyRecords(sheetXml, sharedStrings);
    expect(records).toEqual([
      {
        FI: '5000',
        FI_TEXT: 'Lemon-Garlic Shrimp and Grits',
        LONG_DESC: 'FN Kitchen',
        Meal: 'L/D',
        URL: 'https://medlineplus.gov/x',
      },
    ]);
    expect(skippedRowNumbers).toEqual([]);
  });

  it('skips and reports a row with no FI value (blank spacer/footer row)', () => {
    const sheetXml = `<sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c></row>
      <row r="2">
        <c r="A2" t="n"><v>5000</v></c>
        <c r="B2" t="s"><v>5</v></c>
        <c r="M2" t="s"><v>7</v></c>
      </row>
      <row r="3"></row>
    </sheetData>`;
    const { records, skippedRowNumbers } = extractDbReadyRecords(sheetXml, sharedStrings);
    expect(records).toHaveLength(1);
    expect(skippedRowNumbers).toEqual([3]);
  });

  it('extracts a row with a genuinely blank URL rather than dropping it (dropping is build-recipe-overlay.mjs\'s job, not this extractor\'s)', () => {
    const sheetXml = `<sheetData>
      <row r="2">
        <c r="A2" t="n"><v>5015</v></c>
        <c r="B2" t="s"><v>9</v></c>
        <c r="M2" t="s"><v>10</v></c>
      </row>
    </sheetData>`;
    const { records } = extractDbReadyRecords(sheetXml, sharedStrings);
    expect(records).toEqual([{ FI: '5015', FI_TEXT: 'Blank URL Recipe', LONG_DESC: '', Meal: 'Ds', URL: '' }]);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// CSV writing.
// ═════════════════════════════════════════════════════════════════════════

describe('csvField', () => {
  it('leaves a plain field unquoted', () => {
    expect(csvField('Lemon-Garlic Shrimp and Grits')).toBe('Lemon-Garlic Shrimp and Grits');
  });

  it('quotes a field containing a comma', () => {
    expect(csvField('Vietnamese Noodle Soup, Light Broth')).toBe('"Vietnamese Noodle Soup, Light Broth"');
  });

  it('quotes and doubles embedded double quotes', () => {
    expect(csvField('Say "hi"')).toBe('"Say ""hi"""');
  });

  it('quotes a field containing a newline', () => {
    expect(csvField('a\nb')).toBe('"a\nb"');
  });

  it('renders null/undefined as an empty field', () => {
    expect(csvField(null)).toBe('');
    expect(csvField(undefined)).toBe('');
  });
});

describe('toCsv', () => {
  it('renders the header plus one line per record, in FI,FI_TEXT,LONG_DESC,Meal,URL order', () => {
    const records = [{ FI: '5000', FI_TEXT: 'X, Y', LONG_DESC: 'FN Kitchen', Meal: 'L/D', URL: 'https://x' }];
    expect(toCsv(records)).toBe('FI,FI_TEXT,LONG_DESC,Meal,URL\n5000,"X, Y",FN Kitchen,L/D,https://x\n');
  });

  it('produces just the header for no records', () => {
    expect(toCsv([])).toBe('FI,FI_TEXT,LONG_DESC,Meal,URL\n');
  });
});
