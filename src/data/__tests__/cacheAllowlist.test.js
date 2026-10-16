/**
 * cacheAllowlist.test.js — Guard tests for REMEDI_MASTER_PLAN.md §3.3:
 *
 *   "Cache allowlist: items, conditions, groups ONLY. Remedy and
 *   nutrient-content data are too large and not permitted under API terms.
 *   Enforce with an explicit allowlist plus a test that fails on any write
 *   outside it."
 *
 * Three angles on the same rule:
 *   (i)   nothing beyond the known 6 files is ever committed to
 *         src/data/cache/ (the overlay files are hand/machine-curated
 *         flags/images, not remedy data, hence allowed alongside the 3
 *         dictionaries — `itemImages.generated.json` is a per-item Unsplash
 *         `imageFile` layer, same non-remedy-data status as the other two
 *         overlay files, just image URLs instead of flags).
 *   (ii)  scripts/snapshot-nutridigm.mjs — the only writer of this
 *         directory — is statically limited to writing items/conditions/
 *         groups, by source inspection of its TABLES definition.
 *   (iii) every remedy-data cache TTL in adapter.js stays within a 48h
 *         bound (references is the one documented exception, at 7d).
 *   (iv)  the runtime response cache (src/api/cache.js, localStorage
 *         `remedi.cache.v1.*`) persists only its documented key families,
 *         and nothing but adapter.js/messages.js builds cache keys.
 *   (v)   the three reference tables are bundled JSON, so a group/item/
 *         condition lookup has no fetch that could be slow (4.11).
 */
import { describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// (v) every Nutridigm fetcher hangs forever: a lookup that resolves anyway
// provably isn't waiting on the network.
vi.mock('../../api/nutridigm.js', async (importOriginal) => {
  const hang = () => new Promise(() => {});
  return {
    ...(await importOriginal()),
    fetchFoodGroups: hang, fetchFoodItems: hang, fetchHealthConditions: hang,
    fetchSuggest: hang, fetchDetailed: hang, fetchTopDoOrDonts: hang,
    fetchGoodFor: hang, fetchReferences: hang,
  };
});

import { PERSISTED_KEY_PREFIXES } from '../../api/cache.js';
import {
  getFineFoodGroups, getFineGroupLabelsByCoarse, getGroupLabel, getGroupLabels,
  getConditions, getFoodDictionary,
} from '../../api/adapter.js';
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
  it('has exactly {items,conditions,groups,itemOverlay,itemOverlay.generated,itemImages.generated}.json — nothing else', () => {
    const cacheDir = path.join(ROOT, 'src', 'data', 'cache');
    const actual = readdirSync(cacheDir).sort();
    const allowed = [
      'conditions.json',
      'groups.json',
      'itemImages.generated.json',
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

describe('(iv) the runtime response cache persists only its documented key families', () => {
  // Strip block + full-line comments so prose mentioning `cachedFetch(` isn't a call site.
  const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  function sourceFiles(dir, out = []) {
    for (const name of readdirSync(dir)) {
      if (name === '__tests__') continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) sourceFiles(full, out);
      else if (/\.(js|jsx)$/.test(name) && !/\.test\./.test(name)) out.push(full);
    }
    return out;
  }

  it('adapter.js builds exactly the allowlisted key families (a new family, or a dead entry, fails here)', () => {
    const adapter = stripComments(readFileSync(path.join(ROOT, 'src/api/adapter.js'), 'utf8'));
    const messages = stripComments(readFileSync(path.join(ROOT, 'src/api/messages.js'), 'utf8'));
    const families = new Set([...adapter.matchAll(/`([a-z]+:)\$\{/g)].map((m) => m[1]));
    families.add(messages.match(/CACHE_KEY\s*=\s*'([^']+)'/)[1]);
    expect([...families].sort()).toEqual([...PERSISTED_KEY_PREFIXES].sort());
  });

  it('only adapter.js and messages.js call cachedFetch/cachedFetchWithMeta', () => {
    const callers = sourceFiles(path.join(ROOT, 'src'))
      .filter((f) => /\bcachedFetch(WithMeta)?\(/.test(stripComments(readFileSync(f, 'utf8'))))
      .map((f) => path.relative(ROOT, f).split(path.sep).join('/'))
      .filter((f) => f !== 'src/api/cache.js')
      .sort();
    expect(callers).toEqual(['src/api/adapter.js', 'src/api/messages.js']);
  });
});

describe('(v) reference tables (items, conditions, groups) never wait on the network', () => {
  const within = (promise) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('lookup waited on the network')), 1000)),
  ]);

  it('group, condition and item lookups resolve while every Nutridigm fetcher hangs', async () => {
    expect(await within(getFineFoodGroups())).toHaveLength(17);
    expect((await within(getGroupLabels())).coarse.get('b')).toBe('Meat, Fish & Poultry');
    expect(await within(getGroupLabel('b1'))).toBe('Fish & Seafood');
    expect((await within(getFineGroupLabelsByCoarse())).get('b')).toHaveLength(3);
    expect((await within(getConditions())).length).toBeGreaterThan(0);
    expect((await within(getFoodDictionary())).length).toBeGreaterThan(0);
  });
});
