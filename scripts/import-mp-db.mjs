#!/usr/bin/env node
/**
 * scripts/import-mp-db.mjs — content/MP-DB.xlsx -> src/data/mpDb.json
 * (Meal Planner DB, Implementation Notes v11-20-26). Re-run when Mory sends a new workbook:
 *   node scripts/import-mp-db.mjs [path/to/MP-DB.xlsx]
 *
 * MP-Recipes (sheet 1): FI | URL | Breakfast | LD | Dessert | Beverage | Kcal. Rows under
 * "Candidates for deletion:" and the totals rows are skipped. URL "Commonly prepared" = a
 * prepared food with no link (stored as url: null). No Snack column: snacks never come from here.
 * MP-More (sheet 2): FI | Breakfast | Snack | Beverage — extra candidates only.
 * Row rules live in supabase/functions/_shared/mpDb.js.
 * Output: { recipes: { FI: { url, meals: ['b'|'ld'|'ds'|'bev'], kcal } }, more: { FI: ['b'|'s'|'bev'] } }
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { toMpDb, fetchMpDb } from '../supabase/functions/_shared/mpDb.js';

const unzip = (xlsx, part) => execFileSync('unzip', ['-p', xlsx, part], { encoding: 'utf8', maxBuffer: 1 << 26 });
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** @returns {Array<Record<string,string>>} one object per row, keyed by column letter, plus _r (row number) */
export function readSheet(xlsx, n) {
  const strings = [...unzip(xlsx, 'xl/sharedStrings.xml').matchAll(/<si>(.*?)<\/si>/gs)].map((m) =>
    decode([...m[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((t) => t[1]).join('')).trim()
  );
  return [...unzip(xlsx, `xl/worksheets/sheet${n}.xml`).matchAll(/<row r="(\d+)"[^>]*>(.*?)<\/row>/gs)].map(([, r, body]) => {
    const row = { _r: Number(r) };
    for (const c of body.matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>(?:<f>.*?<\/f>)?<v>(.*?)<\/v><\/c>)/gs)) {
      if (c[3] === undefined) continue;
      row[c[1]] = /t="s"/.test(c[2]) ? strings[Number(c[3])] : c[3];
    }
    return row;
  });
}

export function buildMpDb(xlsx) {
  // Header row -> column names, so xlsx rows look like MySQL rows and share one mapper.
  const named = (rows) => rows.slice(1).map((r) => Object.fromEntries(
    Object.entries(rows[0]).filter(([c]) => c !== '_r').map(([c, name]) => [name, r[c]])
  ));
  const rows1 = readSheet(xlsx, 1);
  const cutoff = rows1.findIndex((r) => /deletion/i.test(r.A ?? ''));
  return toMpDb(named(cutoff === -1 ? rows1 : rows1.slice(0, cutoff)), named(readSheet(xlsx, 2)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const live = args.includes('--live');
  let db;
  if (live) {
    try { process.loadEnvFile(); } catch { /* no .env: rely on the real environment */ }
    const { createConnection } = await import('mysql2/promise');
    db = await fetchMpDb(createConnection, (k) => process.env[k]);
  } else {
    db = buildMpDb(args.find((a) => !a.startsWith('--')) ?? 'content/MP-DB.xlsx');
  }
  const counts = `MP-Recipes ${Object.keys(db.recipes).length}, MP-More ${Object.keys(db.more).length}`;
  if (args.includes('--dry')) console.log(`${counts} (dry run, nothing written)`);
  else {
    writeFileSync('src/data/mpDb.json', JSON.stringify(db));
    console.log(`${counts} -> src/data/mpDb.json`);
  }
}
