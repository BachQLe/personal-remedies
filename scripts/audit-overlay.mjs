#!/usr/bin/env node
/**
 * scripts/audit-overlay.mjs — coverage/priority audit for the item curation
 * overlay (src/data/cache/itemOverlay.generated.json +
 * src/data/cache/itemOverlay.json, merged per src/api/localTables.js).
 *
 * Run manually:
 *   node scripts/audit-overlay.mjs          — human-readable report
 *   node scripts/audit-overlay.mjs --json   — machine-readable report
 *
 * WHAT THIS IS FOR: the Nutridigm item dictionary (src/data/cache/items.json,
 * ~1,485 rows) has no isSnack/isBeverage/imageFile columns — those live only
 * in the two-layer overlay (scripts/flag-snack-beverage.mjs's generated
 * guesses, then Sunny's hand-curated itemOverlay.json on top, generated
 * first per ITEM_OVERLAY_LAYERS in localTables.js so manual always wins).
 * This script tells Sunny which items still have NO overlay row at all
 * (coverage, broken out by food group so she can work group-by-group), which
 * ones have a row that looks like it disagrees with the item's own food
 * group (suspected mis-flags), and ranks the missing rows by how much the
 * shipped app actually depends on the flag today — reading that dependency
 * live off PLAN_SLOTS (src/api/config.js) and the (unexported)
 * SLOT_FLAG_KEY wiring in src/api/adapter.js's flaggedPoolAcrossGroups,
 * rather than assuming every group matters equally.
 *
 * READ-ONLY: this script only reads src/data/cache/*.json and
 * src/api/config.js. It never writes to src/data/cache/ (that directory's
 * contents are enforced by src/data/__tests__/cacheAllowlist.test.js) and
 * never touches the overlay files Sunny owns. Zero network calls.
 *
 * Pure analysis functions are exported and kept free of file I/O (see
 * scripts/audit-overlay.test.js, which exercises them against small
 * fixtures rather than the real 1,485-item file) — the file-reading /
 * source-extraction / printing code below them is the only part that
 * touches disk.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'src', 'data', 'cache');
const ITEMS_PATH = path.join(CACHE_DIR, 'items.json');
const GENERATED_OVERLAY_PATH = path.join(CACHE_DIR, 'itemOverlay.generated.json');
const MANUAL_OVERLAY_PATH = path.join(CACHE_DIR, 'itemOverlay.json');
const GROUPS_PATH = path.join(CACHE_DIR, 'groups.json');
const CONFIG_PATH = path.join(ROOT, 'src', 'api', 'config.js');

// ═════════════════════════════════════════════════════════════════════════
// Pure analysis functions — no fs/network access below this point until the
// "File I/O" section. Take plain data in, return plain data out.
// ═════════════════════════════════════════════════════════════════════════

/**
 * Mirrors src/api/adapter.js's (unexported, module-private) `SLOT_FLAG_KEY`
 * constant: `{ snacks: 'isSnack', beverages: 'isBeverage' }`. Not derivable
 * from PLAN_SLOTS' own shape (a slot entry has no "which overlay flag do I
 * consume" field), so this mapping is transcribed from adapter.js's source
 * rather than computed — verified by reading `flaggedPoolAcrossGroups` and
 * its call site in `getMealPlanSuggestionsRaw` directly. If adapter.js's
 * SLOT_FLAG_KEY ever changes, this constant needs a matching update.
 * @type {Record<string, 'isSnack'|'isBeverage'>}
 */
const SLOT_FLAG_KEY = { snacks: 'isSnack', beverages: 'isBeverage' };

/**
 * Slot keys whose flag actually gates a shipped candidate pool TODAY, per
 * adapter.js's own comment on `SLOT_FLAG_KEY`: "Only `beverages` is
 * actually wired to it below... `snacks` stays recipes-only... `isSnack` is
 * intentionally unused for now — kept here as the fast-follow hook." Read
 * literally from that comment, not inferred.
 * @type {Set<string>}
 */
const ACTIVE_SLOT_FLAG_KEYS = new Set(['beverages']);

/**
 * Does foodItemID have an overlay row in ANY layer (generated or manual)?
 * "Has a row" means the key exists in that layer's object at all — not that
 * every flag on it is true. Mirrors the key lookup `localTables.js` does in
 * `buildMergedItems`/`getOverlayFlags`/`getOverlayImageFile`.
 * @param {number|string} foodItemID
 * @param {Record<string, Object>[]} layers - e.g. [generatedOverlay, manualOverlay]
 * @returns {boolean}
 */
export function hasOverlayRow(foodItemID, layers) {
  const key = String(foodItemID);
  return layers.some((layer) => Object.prototype.hasOwnProperty.call(layer, key));
}

/**
 * Resolve the merged isSnack/isBeverage/imageFile for one foodItemID exactly
 * as `getOverlayFlags`/`getOverlayImageFile` do in src/api/localTables.js:
 * layers applied in order, later layers win per-field (not per-row), and an
 * unset field is NOT treated as false-was-set — only a field the row
 * explicitly defines overrides an earlier layer's value for that field.
 * @param {number|string} foodItemID
 * @param {Record<string, Object>[]} layers
 * @returns {{isSnack: boolean, isBeverage: boolean, imageFile: string|undefined}}
 */
export function resolveOverlayFlags(foodItemID, layers) {
  const key = String(foodItemID);
  let isSnack;
  let isBeverage;
  let imageFile;
  for (const layer of layers) {
    const row = layer[key];
    if (!row) continue;
    if (row.isSnack !== undefined) isSnack = !!row.isSnack;
    if (row.isBeverage !== undefined) isBeverage = !!row.isBeverage;
    if (row.imageFile) imageFile = row.imageFile;
  }
  return { isSnack: !!isSnack, isBeverage: !!isBeverage, imageFile };
}

/**
 * Coverage totals overall and broken down by coarse AND fine food group, so
 * Sunny can work one group at a time instead of facing all missing rows as
 * one undifferentiated pile.
 * @param {Array<{foodItemID:number, coarseFoodGroup:string, fineFoodGroup:string}>} items
 * @param {Record<string, Object>[]} layers
 * @returns {{
 *   total: number, withOverlay: number, withNone: number,
 *   byCoarse: Record<string, {total:number, withOverlay:number, withNone:number}>,
 *   byFine: Record<string, {total:number, withOverlay:number, withNone:number, coarseFoodGroup:string}>
 * }}
 */
export function computeCoverage(items, layers) {
  const byCoarse = {};
  const byFine = {};
  let withOverlay = 0;

  for (const item of items) {
    const covered = hasOverlayRow(item.foodItemID, layers);
    if (covered) withOverlay++;

    const c = item.coarseFoodGroup;
    if (!byCoarse[c]) byCoarse[c] = { total: 0, withOverlay: 0, withNone: 0 };
    byCoarse[c].total++;
    if (covered) byCoarse[c].withOverlay++;
    else byCoarse[c].withNone++;

    const f = item.fineFoodGroup;
    if (!byFine[f]) byFine[f] = { total: 0, withOverlay: 0, withNone: 0, coarseFoodGroup: c };
    byFine[f].total++;
    if (covered) byFine[f].withOverlay++;
    else byFine[f].withNone++;
  }

  return {
    total: items.length,
    withOverlay,
    withNone: items.length - withOverlay,
    byCoarse,
    byFine,
  };
}

/**
 * Index PLAN_SLOTS by fine food group: fineGroup -> [slot keys that draw on
 * it]. A fine group can feed more than one slot (e.g. 'e' feeds both lunch
 * and dinner in the current config).
 * @param {Array<{key:string, fineGroups:string[]}>} planSlots
 * @returns {Record<string, string[]>}
 */
export function buildFineGroupSlotIndex(planSlots) {
  const index = {};
  for (const slot of planSlots) {
    for (const fine of slot.fineGroups) {
      if (!index[fine]) index[fine] = [];
      index[fine].push(slot.key);
    }
  }
  return index;
}

/**
 * Rank every item with NO overlay row at all (coverage gap, not a
 * suspected-wrong-value — see `computeMisflags` for that) by how much the
 * shipped app depends on the flag its fine group would carry:
 *
 *   tier 0 — fine group feeds a slot whose flag is ACTIVE today (currently
 *            only 'h2' -> beverages/isBeverage): missing row starves a real,
 *            rendered product surface right now.
 *   tier 1 — fine group feeds a slot whose flag is designated but not yet
 *            wired up (currently 'h1'/'c3' -> snacks/isSnack): inert today,
 *            matters the moment that slot switches on.
 *   tier 2 — fine group is fetched for some PLAN_SLOTS entry, but that
 *            slot's candidates are recipes-only (breakfast/lunch/dinner) —
 *            the overlay flag doesn't affect slot output at all today.
 *   tier 3 — fine group isn't referenced by any PLAN_SLOTS entry — fully
 *            inert for the meal plan today.
 *
 * `excludedFineGroups` (EXCLUDED_FINE_GROUPS from config.js — 'x'/'j1'/'l')
 * is passed through as an `excludedFromFoodLists` flag per row so Sunny can
 * see at a glance that a tier-3 row is also filtered out of every food list
 * app-wide (isExcludedItem in adapter.js) — not merely low priority, but
 * arguably not worth curating at all.
 * @param {Array} items
 * @param {Record<string, Object>[]} layers
 * @param {Array<{key:string, fineGroups:string[]}>} planSlots
 * @param {string[]} [excludedFineGroups]
 * @returns {Array<{foodItemID:number, description:string, displayAs:string,
 *   coarseFoodGroup:string, fineFoodGroup:string, excludedFromFoodLists:boolean,
 *   slotKeys:string[], tier:number, reason:string}>}
 */
export function rankMissingOverlayItems(items, layers, planSlots, excludedFineGroups = []) {
  const fineGroupSlots = buildFineGroupSlotIndex(planSlots);
  const excluded = new Set(excludedFineGroups);

  const missing = items.filter((item) => !hasOverlayRow(item.foodItemID, layers));

  const ranked = missing.map((item) => {
    const fine = item.fineFoodGroup;
    const slotKeys = fineGroupSlots[fine] || [];
    const flagSlotKeys = slotKeys.filter((key) => SLOT_FLAG_KEY[key]);
    const activeFlagSlotKeys = flagSlotKeys.filter((key) => ACTIVE_SLOT_FLAG_KEYS.has(key));

    let tier;
    let reason;
    if (activeFlagSlotKeys.length > 0) {
      tier = 0;
      reason = `fine group '${fine}' feeds the ${activeFlagSlotKeys.join('/')} slot's LIVE candidate pool via ${activeFlagSlotKeys.map((k) => SLOT_FLAG_KEY[k]).join('/')} — missing row starves a shipped feature today`;
    } else if (flagSlotKeys.length > 0) {
      tier = 1;
      reason = `fine group '${fine}' is designated for the ${flagSlotKeys.join('/')} slot's flagged pool (${flagSlotKeys.map((k) => SLOT_FLAG_KEY[k]).join('/')}) but that slot is recipes-only today — inert until wired up`;
    } else if (slotKeys.length > 0) {
      tier = 2;
      reason = `fine group '${fine}' is fetched for the ${slotKeys.join('/')} slot(s), but that slot draws recipes only, not items — the overlay flag doesn't affect it today`;
    } else {
      tier = 3;
      reason = `fine group '${fine}' isn't referenced by any PLAN_SLOTS entry — fully inert for the meal plan today`;
    }

    return {
      foodItemID: item.foodItemID,
      description: item.description,
      displayAs: item.displayAs,
      coarseFoodGroup: item.coarseFoodGroup,
      fineFoodGroup: fine,
      excludedFromFoodLists: excluded.has(fine),
      slotKeys,
      tier,
      reason,
    };
  });

  ranked.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.fineFoodGroup !== b.fineFoodGroup) return a.fineFoodGroup < b.fineFoodGroup ? -1 : 1;
    return a.foodItemID - b.foodItemID;
  });

  return ranked;
}

/**
 * Suspected mis-flags: rows where the MERGED flag value disagrees with the
 * item's own fine food group — the cases most likely to be wrong, since
 * 'h2' (Beverages) rows are expected to all be isBeverage, and 'h1' (Sweets
 * & Snacks) rows are expected to mostly be isSnack. Note some
 * "outside the expected group" rows are legitimate by design — e.g.
 * scripts/flag-snack-beverage.mjs deliberately tags fruit juices ('d'),
 * nut/seed milks ('c3'), dairy milks ('g1'), and rice milk ('f') as
 * isBeverage even though they don't live in 'h2' — this function surfaces
 * the disagreement either way and leaves the judgment call to Sunny/Mory.
 * @param {Array} items
 * @param {Record<string, Object>[]} layers
 * @returns {{
 *   h2MissingBeverage: Array, beverageOutsideH2: Array,
 *   h1MissingSnack: Array, snackOutsideH1: Array
 * }}
 */
export function computeMisflags(items, layers) {
  const h2MissingBeverage = [];
  const beverageOutsideH2 = [];
  const h1MissingSnack = [];
  const snackOutsideH1 = [];

  for (const item of items) {
    const flags = resolveOverlayFlags(item.foodItemID, layers);
    const fine = item.fineFoodGroup;
    const row = {
      foodItemID: item.foodItemID,
      description: item.description,
      displayAs: item.displayAs,
      coarseFoodGroup: item.coarseFoodGroup,
      fineFoodGroup: fine,
    };

    if (fine === 'h2' && !flags.isBeverage) h2MissingBeverage.push(row);
    if (fine !== 'h2' && flags.isBeverage) beverageOutsideH2.push(row);
    if (fine === 'h1' && !flags.isSnack) h1MissingSnack.push(row);
    if (fine !== 'h1' && flags.isSnack) snackOutsideH1.push(row);
  }

  return { h2MissingBeverage, beverageOutsideH2, h1MissingSnack, snackOutsideH1 };
}

/**
 * Field-level disagreements between the generated layer and the manual
 * layer, for any foodItemID present in BOTH. Not inherently a bug — the
 * manual layer is SUPPOSED to be able to override the generated one — but
 * worth surfacing as an audit trail once Sunny starts editing, and this
 * returns [] today since itemOverlay.json is still `{}`.
 * @param {Record<string, Object>} generatedOverlay
 * @param {Record<string, Object>} manualOverlay
 * @returns {Array<{foodItemID:string, field:string, generatedValue:*, manualValue:*}>}
 */
export function computeConflicts(generatedOverlay, manualOverlay) {
  const FIELDS = ['isSnack', 'isBeverage', 'imageFile'];
  const conflicts = [];
  for (const key of Object.keys(manualOverlay)) {
    const genRow = generatedOverlay[key];
    const manRow = manualOverlay[key];
    if (!genRow) continue;
    for (const field of FIELDS) {
      const g = genRow[field];
      const m = manRow[field];
      if (g !== undefined && m !== undefined && g !== m) {
        conflicts.push({ foodItemID: key, field, generatedValue: g, manualValue: m });
      }
    }
  }
  return conflicts;
}

/**
 * `imageFile` coverage — the seam for real item images (see
 * docs/probes/P4-item-images.md). No row sets it today, so this returns 0.
 * @param {Array} items
 * @param {Record<string, Object>[]} layers
 * @returns {{total:number, withImageFile:number, withoutImageFile:number, rows:Array}}
 */
export function computeImageFileCoverage(items, layers) {
  let withImageFile = 0;
  const rows = [];
  for (const item of items) {
    const flags = resolveOverlayFlags(item.foodItemID, layers);
    if (flags.imageFile) {
      withImageFile++;
      rows.push({ foodItemID: item.foodItemID, description: item.description, imageFile: flags.imageFile });
    }
  }
  return { total: items.length, withImageFile, withoutImageFile: items.length - withImageFile, rows };
}

/**
 * Pulls a top-level `export const NAME = <array-or-object literal>;` value
 * out of a source file's text by bracket-depth matching, then evaluates the
 * literal with `Function`. Safe here because the only source ever passed to
 * this is `src/api/config.js`, a trusted, version-controlled file whose
 * exported constants are plain string/number/boolean/array/object literals
 * — no calls, no template interpolation, no user input.
 *
 * WHY NOT JUST `import` config.js: it reads `import.meta.env` at module-eval
 * time, which only resolves inside a Vite-processed module — importing it
 * from plain `node` throws immediately. scripts/snapshot-nutridigm.mjs hits
 * the identical wall and hand-parses .env files instead of importing
 * config.js for the same reason; this is that same workaround applied here
 * so PLAN_SLOTS/EXCLUDED_FINE_GROUPS are actually READ from the live file
 * (per the task's "read PLAN_SLOTS, don't hardcode" requirement) instead of
 * being a hand-copied constant that silently goes stale.
 * @param {string} src
 * @param {string} name
 * @returns {*}
 */
export function extractExportedConst(src, name) {
  const marker = `export const ${name} = `;
  const start = src.indexOf(marker);
  if (start === -1) {
    throw new Error(`extractExportedConst: "${name}" not found — source file shape may have changed`);
  }
  let i = start + marker.length;
  while (i < src.length && src[i] !== '[' && src[i] !== '{') i++;
  const open = src[i];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let j = i;
  for (; j < src.length; j++) {
    if (src[j] === open) depth++;
    else if (src[j] === close) {
      depth--;
      if (depth === 0) {
        j++;
        break;
      }
    }
  }
  const literal = src.slice(i, j);
  // eslint-disable-next-line no-new-func -- trusted local source file, see doc comment above
  return new Function(`"use strict"; return (${literal});`)();
}

// ═════════════════════════════════════════════════════════════════════════
// File I/O — everything below this point touches disk.
// ═════════════════════════════════════════════════════════════════════════

function loadJSON(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function loadPlanSlots() {
  const src = readFileSync(CONFIG_PATH, 'utf8');
  return extractExportedConst(src, 'PLAN_SLOTS');
}

function loadExcludedFineGroups() {
  const src = readFileSync(CONFIG_PATH, 'utf8');
  return extractExportedConst(src, 'EXCLUDED_FINE_GROUPS');
}

/** foodGroupID -> human label, for BOTH coarse and fine groups (real API labels, not the config.js coarse-only fallback). */
function loadGroupLabels() {
  const groups = loadJSON(GROUPS_PATH);
  const labels = {};
  for (const g of groups) labels[g.foodGroupID] = g.description;
  return labels;
}

function buildReport() {
  const items = loadJSON(ITEMS_PATH);
  const generatedOverlay = loadJSON(GENERATED_OVERLAY_PATH);
  const manualOverlay = loadJSON(MANUAL_OVERLAY_PATH);
  const groupLabels = loadGroupLabels();
  const planSlots = loadPlanSlots();
  const excludedFineGroups = loadExcludedFineGroups();
  const layers = [generatedOverlay, manualOverlay];

  const coverage = computeCoverage(items, layers);
  const ranked = rankMissingOverlayItems(items, layers, planSlots, excludedFineGroups);
  const misflags = computeMisflags(items, layers);
  const conflicts = computeConflicts(generatedOverlay, manualOverlay);
  const imageFileCoverage = computeImageFileCoverage(items, layers);

  return {
    generatedAt: new Date().toISOString(),
    source: {
      itemsCount: items.length,
      generatedOverlayRows: Object.keys(generatedOverlay).length,
      manualOverlayRows: Object.keys(manualOverlay).length,
    },
    groupLabels,
    planSlots,
    excludedFineGroups,
    coverage,
    ranked,
    misflags,
    conflicts,
    imageFileCoverage,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// Human-readable printer
// ═════════════════════════════════════════════════════════════════════════

function label(groupLabels, code) {
  return groupLabels[code] || '(unknown)';
}

function pct(n, total) {
  if (!total) return '0%';
  return `${((n / total) * 100).toFixed(1)}%`;
}

function printGroupTable(title, byGroup, groupLabels) {
  console.log(`\n${title}`);
  console.log('-'.repeat(78));
  const codes = Object.keys(byGroup).sort();
  for (const code of codes) {
    const row = byGroup[code];
    const name = `${code} (${label(groupLabels, code)})`.padEnd(38);
    console.log(
      `  ${name} total ${String(row.total).padStart(4)}   overlay ${String(row.withOverlay).padStart(4)}   missing ${String(row.withNone).padStart(4)}   ${pct(row.withOverlay, row.total).padStart(6)} covered`
    );
  }
}

function printRankedSample(ranked, tier, groupLabels, limit = 15) {
  const rows = ranked.filter((r) => r.tier === tier);
  if (rows.length === 0) return;
  console.log(`\n  Tier ${tier} — ${rows.length} item(s)`);
  console.log(`  ${rows[0].reason}`);
  for (const row of rows.slice(0, limit)) {
    const name = row.displayAs || row.description;
    console.log(
      `    #${row.foodItemID}  ${name}  [${row.fineFoodGroup} / ${label(groupLabels, row.fineFoodGroup)}]${row.excludedFromFoodLists ? '  (excluded from food lists)' : ''}`
    );
  }
  if (rows.length > limit) console.log(`    ... and ${rows.length - limit} more`);
}

function printMisflagList(title, rows, groupLabels, limit = 20) {
  console.log(`\n  ${title} — ${rows.length} item(s)`);
  for (const row of rows.slice(0, limit)) {
    const name = row.displayAs || row.description;
    console.log(`    #${row.foodItemID}  ${name}  [${row.fineFoodGroup} / ${label(groupLabels, row.fineFoodGroup)}]`);
  }
  if (rows.length > limit) console.log(`    ... and ${rows.length - limit} more`);
}

function printHumanReport(report) {
  const { coverage, ranked, misflags, conflicts, imageFileCoverage, groupLabels, planSlots, source } = report;

  console.log('\nRemedi item overlay audit');
  console.log('='.repeat(78));
  console.log(`items.json: ${source.itemsCount} items`);
  console.log(`itemOverlay.generated.json: ${source.generatedOverlayRows} rows`);
  console.log(`itemOverlay.json (manual): ${source.manualOverlayRows} rows`);

  console.log('\nPLAN_SLOTS (read live from src/api/config.js):');
  for (const slot of planSlots) {
    console.log(`  ${slot.key.padEnd(11)} fineGroups: [${slot.fineGroups.join(', ')}]`);
  }

  console.log('\n── Coverage ─────────────────────────────────────────────────────────────');
  console.log(
    `Overall: ${coverage.total} items, ${coverage.withOverlay} with an overlay row (${pct(coverage.withOverlay, coverage.total)}), ${coverage.withNone} with none (${pct(coverage.withNone, coverage.total)})`
  );
  printGroupTable('By coarse food group:', coverage.byCoarse, groupLabels);
  printGroupTable('By fine food group:', coverage.byFine, groupLabels);

  console.log('\n── Priority ranking (missing-overlay items only) ───────────────────────');
  console.log(`${ranked.length} items have no overlay row at all, ranked by product impact:`);
  for (let tier = 0; tier <= 3; tier++) printRankedSample(ranked, tier, groupLabels);

  console.log('\n── Suspected mis-flags (rows present but disagree with the fine group) ─');
  printMisflagList("h2 (Beverages) items NOT flagged isBeverage", misflags.h2MissingBeverage, groupLabels);
  printMisflagList('Items flagged isBeverage OUTSIDE h2', misflags.beverageOutsideH2, groupLabels);
  printMisflagList('h1 (Sweets & Snacks) items NOT flagged isSnack', misflags.h1MissingSnack, groupLabels);
  printMisflagList('Items flagged isSnack OUTSIDE h1', misflags.snackOutsideH1, groupLabels);

  console.log('\n── Manual-vs-generated conflicts ───────────────────────────────────────');
  console.log(`${conflicts.length} field-level disagreement(s) between itemOverlay.json and itemOverlay.generated.json`);
  for (const c of conflicts.slice(0, 20)) {
    console.log(`  #${c.foodItemID} ${c.field}: generated=${c.generatedValue} manual=${c.manualValue}`);
  }

  console.log('\n── imageFile coverage ───────────────────────────────────────────────────');
  console.log(
    `${imageFileCoverage.withImageFile} / ${imageFileCoverage.total} items have a curated imageFile (${pct(imageFileCoverage.withImageFile, imageFileCoverage.total)})`
  );

  console.log('\nDone. Run with --json for machine-readable output.\n');
}

// ═════════════════════════════════════════════════════════════════════════
// CLI entry point
// ═════════════════════════════════════════════════════════════════════════

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const report = buildReport();
  const asJson = process.argv.includes('--json');

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHumanReport(report);
  }
}
