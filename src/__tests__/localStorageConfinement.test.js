/**
 * localStorageConfinement.test.js — Guard test for the "no window/document/
 * localStorage outside a thin adapter" rule (REMEDI_MASTER_PLAN.md Phase 8:
 * "While building the PWA, four rules keep this cheap: ... no window/
 * document/localStorage outside a thin adapter"), which exists so
 * `packages/core` can extract cleanly at native-conversion time.
 *
 * Recursively scans every text file under src/ for the literal string
 * `localStorage` and asserts it appears ONLY in the allowlisted thin-adapter
 * files. `src/api/browser.js` and `src/api/connectivity.js` are allowlisted
 * even though they don't exist yet as of this writing — another workstream
 * is adding them as thin adapters, same category as storage.js/cache.js.
 *
 * KNOWN_LEGACY: comment-only mentions of "localStorage" in a handful of
 * src/state/*.js files (and config.js/profileSync.js) that predate this
 * guard — none of these actually call the API, they just describe it in
 * prose. Listed explicitly with a TODO rather than silently allowlisted, so
 * this test still catches any NEW file (or new real usage) that isn't one
 * of the two categories below.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(__dirname, '..');

// Extensions worth reading as text. Binary assets can't contain the string
// meaningfully and some (png) aren't valid utf8, so skip them outright.
const TEXT_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.md']);

/**
 * True for the storage/cache/browser/connectivity thin adapters — the only
 * files allowed to call the real localStorage API.
 * @type {Set<string>}
 */
const ALLOWLIST = new Set([
  'src/api/storage.js',
  'src/api/cache.js',
  'src/api/browser.js', // not yet created as of this test's authoring
  'src/api/connectivity.js', // not yet created as of this test's authoring
]);

/**
 * Pre-existing comment-only mentions of "localStorage" that predate this
 * guard test. None of these call the API directly (verified by hand at
 * authoring time) — they're JSDoc prose describing where a store persists
 * to, via storage.js. TODO: reword these comments to say "storage.js" (or
 * "persisted state") instead of the raw API name, then remove from this
 * list so the allowlist stays exactly {storage.js, cache.js, browser.js,
 * connectivity.js}.
 * @type {Set<string>}
 */
const KNOWN_LEGACY = new Set([
  'src/state/dailyPlan.js',
  'src/state/queue.js',
  'src/state/library.js',
  'src/state/schedule.js',
  'src/api/config.js',
  'src/api/profileSync.js',
]);

/**
 * Recursively collect every file under `dir`, skipping test directories
 * and *.test.{js,jsx,ts,tsx} files (this suite — and any future test file that legitimately needs to write
 * the literal string "localStorage" in a mock/assertion — isn't production
 * source and shouldn't be scanned).
 * @param {string} dir
 * @param {string[]} out
 * @returns {string[]}
 */
function collectFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, out);
    } else if (!/\.test\.[jt]sx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('localStorage confinement (Phase 8: "no localStorage outside a thin adapter")', () => {
  it('the string "localStorage" appears only in the allowlist or documented KNOWN_LEGACY files', () => {
    const files = collectFiles(SRC_ROOT);
    const offenders = [];

    for (const file of files) {
      if (!TEXT_EXT.has(path.extname(file))) continue;
      if (!statSync(file).isFile()) continue;

      const text = readFileSync(file, 'utf8');
      if (!text.includes('localStorage')) continue;

      const relPath = 'src/' + path.relative(SRC_ROOT, file).split(path.sep).join('/');
      if (ALLOWLIST.has(relPath) || KNOWN_LEGACY.has(relPath)) continue;
      offenders.push(relPath);
    }

    expect(offenders, `New localStorage usage found outside the allowlist: ${offenders.join(', ')}`).toEqual([]);
  });
});
