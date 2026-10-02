/**
 * localTables.js — static loader for the three Nutridigm dictionary tables
 * (food items, health conditions, food groups) plus the manual curation
 * overlay.
 *
 * Phase 1 of moving dictionaries off live API round-trips: the JSON files
 * under src/data/cache/ are committed snapshots (see
 * scripts/snapshot-nutridigm.mjs) and Vite statically imports/bundles them,
 * so reading a dictionary here costs zero network calls at runtime — it's
 * just reading an already-parsed in-memory array.
 *
 * Overlay layering: `itemOverlay.json` is the hand-curated layer (imageFile
 * / isBreakfast / isSnack / isBeverage per foodItemID, keyed as a string
 * since it's JSON). `itemOverlay.generated.json` (Phase 2, see
 * scripts/flag-snack-beverage.mjs) is a machine-generated layer inferring
 * isBreakfast/isSnack/isBeverage from fine food group + name heuristics.
 * `itemImages.generated.json` (a separate machine pipeline) is a third
 * layer contributing ONLY `imageFile` — per-item Unsplash photo URLs for
 * the ~1485 items the curated set doesn't cover. `ITEM_OVERLAY_LAYERS`
 * below applies both generated layers BEFORE the manual one, so hand
 * curation in `itemOverlay.json` always has the final say over any
 * machine-inferred flag OR machine-picked image.
 */

import itemsRaw from '../data/cache/items.json';
import conditionsRaw from '../data/cache/conditions.json';
import groupsRaw from '../data/cache/groups.json';
import generatedOverlay from '../data/cache/itemOverlay.generated.json';
import itemImages from '../data/cache/itemImages.generated.json';
import manualOverlay from '../data/cache/itemOverlay.json';

/**
 * Overlay layers applied to each item, in order — later layers win.
 * `generatedOverlay` (machine-inferred isBreakfast/isSnack/isBeverage) and
 * `itemImages` (machine-picked per-item imageFile) both go before
 * `manualOverlay` so the hand-curated `itemOverlay.json` layer can override
 * any individual row on either flags or image.
 * @type {Record<string, Object>[]}
 */
const ITEM_OVERLAY_LAYERS = [generatedOverlay, itemImages, manualOverlay];

/** @type {Array|null} Memoized merged item table (built lazily on first read). */
let _mergedItems = null;

/**
 * Build the merged item table: each raw item row plus its overlay columns
 * layered on top (later layers in ITEM_OVERLAY_LAYERS win on key conflicts).
 * Rows with no overlay entry pass through unchanged.
 * @returns {Array}
 */
function buildMergedItems() {
  return itemsRaw.map((item) => {
    const key = String(item.foodItemID);
    let merged = item;
    for (const layer of ITEM_OVERLAY_LAYERS) {
      const overlayRow = layer[key];
      if (overlayRow) merged = { ...merged, ...overlayRow };
    }
    return merged;
  });
}

/**
 * Full food item dictionary, each row merged with its curation overlay
 * (overlay columns — imageFile/isBreakfast/isSnack/isBeverage — win over any
 * same-named base field, though in practice the base API rows never define
 * those columns). Synchronous; memoized after first call.
 * @returns {Array}
 */
export function getItemTable() {
  if (!_mergedItems) _mergedItems = buildMergedItems();
  return _mergedItems;
}

/**
 * Raw health conditions dictionary, unmodified. Synchronous.
 * @returns {Array}
 */
export function getConditionTable() {
  return conditionsRaw;
}

/**
 * Raw food groups dictionary, unmodified. Synchronous.
 * @returns {Array}
 */
export function getGroupTable() {
  return groupsRaw;
}

/**
 * Look up the curated `imageFile` override for a single foodItemID, if any
 * — without requiring the caller to already have the merged item row from
 * getItemTable(). Works for a foodItemID from ANY source (the local
 * dictionary, or a live /suggest, /topdoordonts, /detailed response), since
 * it reads the overlay directly by ID rather than off an already-merged
 * item. Later layers in ITEM_OVERLAY_LAYERS win, same as `getItemTable`.
 * @param {number|string} foodItemID
 * @returns {string|undefined}
 */
export function getOverlayImageFile(foodItemID) {
  const key = String(foodItemID);
  let imageFile;
  for (const layer of ITEM_OVERLAY_LAYERS) {
    const row = layer[key];
    if (row && row.imageFile) imageFile = row.imageFile;
  }
  return imageFile;
}

/**
 * Look up the curated breakfast/snack/beverage flags for a single
 * foodItemID. Same by-ID, layer-ordered read as `getOverlayImageFile` —
 * deliberately NOT off an already-merged item row, so the UI can ask about
 * any id it holds, including one restored from a plan persisted before
 * these flags existed.
 *
 * This is the only path by which `isBreakfast`/`isSnack`/`isBeverage` reach
 * the UI at all: `flaggedPoolAcrossGroups` (src/api/adapter.js) consumes
 * them as a filter predicate and discards them, and `toPlanItem`
 * (src/api/planBuilder.js) keeps a strict whitelist that excludes them.
 * @param {number|string} foodItemID
 * @returns {{isBreakfast: boolean, isSnack: boolean, isBeverage: boolean}}
 */
export function getOverlayFlags(foodItemID) {
  const key = String(foodItemID);
  let isBreakfast = false;
  let isSnack = false;
  let isBeverage = false;
  for (const layer of ITEM_OVERLAY_LAYERS) {
    const row = layer[key];
    if (!row) continue;
    if (row.isBreakfast !== undefined) isBreakfast = !!row.isBreakfast;
    if (row.isSnack !== undefined) isSnack = !!row.isSnack;
    if (row.isBeverage !== undefined) isBeverage = !!row.isBeverage;
  }
  return { isBreakfast, isSnack, isBeverage };
}
