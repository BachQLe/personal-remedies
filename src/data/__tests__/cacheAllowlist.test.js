/**
 * cacheAllowlist.test.js — Guard tests for REMEDI_MASTER_PLAN.md §3.3:
 *
 *   "Cache allowlist: items, conditions, groups ONLY. Remedy and
 *   nutrient-content data are too large and not permitted under API terms.
 *   Enforce with an explicit allowlist plus a test that fails on any write
 *   outside it."
 *
 * Three angles on the same rule:
 *   (i)   nothing beyond the known 5 files is ever committed to
 *         src/data/cache/ (the overlay files are hand/machine-curated
 *         flags, not remedy data, hence allowed alongside the 3 dictionaries).
 *   (ii)  scripts/snapshot-nutridigm.mjs — the only writer of this
 *         directory — is statically limited to writing items/conditions/
 *         groups, by source inspection of its TABLES definition.
 *   (iii) every remedy-data cache TTL in adapter.js stays within a 48h
 *         bound (references is the one documented exception, at 7d).
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TOPDOORDONTS_TTL_MS,
  RECIPES_TTL_MS,
  DETAILED_TTL_MS,
  GOODFOR_TTL_MS,
  SUGGEST_TTL_MS,
  REFERENCES_TTL_MS,
} from '../../api/adapter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

describe('(i) src/data/cache/ contains only the dictionary + overlay allowlist', () => {
  it('has exactly {items,conditions,groups,itemOverlay,itemOverlay.generated}.json — nothing else', () => {
    const cacheDir = path.join(ROOT, 'src', 'data', 'cache');
    const actual = readdirSync(cacheDir).sort();
    const allowed = [
      'conditions.json',
      'groups.json',
      'itemOverlay.generated.json',
      'itemOverlay.json',
      'items.json',
    ].sort();
    expect(actual).toEqual(allowed);
  });
});

describe('(ii) scripts/snapshot-nutridigm.mjs is statically limited to items/conditions/groups', () => {
  it('writes only under src/data/cache/, and only the three dictionary files', () => {
    const scriptPath = path.join(ROOT, 'scripts', 'snapshot-nutridigm.mjs');
    const src = readFileSync(scriptPath, 'utf8');

    // Output directory must be src/data/cache — the allowlisted directory.
    expect(src).toMatch(/OUT_DIR\s*=\s*path\.join\(ROOT,\s*'src',\s*'data',\s*'cache'\)/);

    // The TABLES definition is the sole source of what gets written — pull
    // every `file: '...'` entry out of it and assert the set is exactly
    // the three dictionaries. A remedy-data write (e.g. topdoordonts.json)
    // would show up here and fail this assertion.
    const fileEntries = [...src.matchAll(/file:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(fileEntries.sort()).toEqual(['conditions.json', 'groups.json', 'items.json'].sort());

    // Guard against someone adding a second writeFileSync call outside the
    // TABLES-driven loop (which would bypass the assertion above).
    const writeCalls = [...src.matchAll(/writeFileSync\(/g)];
    expect(writeCalls.length).toBe(1); // the single call inside the `for (const table of TABLES)` loop
  });
});

describe('(iii) remedy-data cache TTLs stay within 48h; references is the documented 7d exception', () => {
  const REMEDY_DATA_TTLS = {
    TOPDOORDONTS_TTL_MS,
    SUGGEST_TTL_MS,
    DETAILED_TTL_MS,
    GOODFOR_TTL_MS,
    RECIPES_TTL_MS,
  };

  it.each(Object.entries(REMEDY_DATA_TTLS))('%s is <= 48h', (_name, ttlMs) => {
    expect(ttlMs).toBeLessThanOrEqual(48 * HOUR_MS);
    expect(ttlMs).toBeGreaterThan(0);
  });

  // Exception, not a violation: /references returns bibliographic citation
  // strings (static, curated, not per-user remedy data), so master plan
  // §3.3's 48h remedy-data bound doesn't apply to it — it gets its own,
  // longer 7d bound instead. See adapter.js's REFERENCES_TTL_MS JSDoc.
  it('REFERENCES_TTL_MS (bibliographic citations, not remedy data) is <= 7d', () => {
    expect(REFERENCES_TTL_MS).toBeLessThanOrEqual(7 * DAY_MS);
    expect(REFERENCES_TTL_MS).toBeGreaterThan(48 * HOUR_MS); // confirms it IS the documented exception, not accidentally within the normal bound
  });
});
