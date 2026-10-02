/**
 * nutrition.js — layered nutrition resolver (Task T3D, REMEDI_MASTER_PLAN.md
 * 2.3/2.4).
 *
 * Resolves per-serving macros for a plan item by walking three tiers, most
 * to least authoritative, falling through only when a tier has no data.
 * NEVER averages, defaults, or 0-fills a missing macro — a missing value is
 * always `null`, and an item with no data anywhere resolves to `null`, full
 * stop.
 *
 *   1. PANEL    — `item.nutritionPerServing` (Recipe field populated by the
 *      C1 content overlay from the source recipe's own FDA Nutrition Facts
 *      panel — real, per-serving, human-transcribed).
 *      -> `{ ...macros, estimated: false, source: 'panel' }`
 *   2. USDA     — src/data/usda/fdcMap.json + nutrients.json, matched by
 *      foodItemID (`item.id` — Food/PlanItem/real-Recipe all key their
 *      Nutridigm foodItemID there, see types.js). Prefers a real serving
 *      (`perServing`, only present when FDC supplied a usable portion);
 *      falls back to `per100g` ONLY with an honest `basis` label, since
 *      100 g is not a serving.
 *      -> `{ ...macros, estimated: false, source: 'usda', basis: 'perServing'|'per100g' }`
 *   3. ESTIMATE — `estimateNutrition` (src/data/nutritionEstimates.js), the
 *      hand-labeled food-group/recipe-slot stand-in table.
 *      -> `{ ...macros, estimated: true, source: 'estimate' }`
 *   4. `null`   — no tier had data. Never guess.
 *
 * The USDA tables are statically imported the same way
 * src/api/localTables.js imports its committed cache JSON — Vite bundles
 * them, so a lookup costs zero network calls. Both tables ship empty today
 * (`fdcMap.json`'s `items: {}` / `nutrients.json`'s `nutrients: {}` — the
 * build pipeline's first real run got rate-limited, see fdcMap.json's
 * `_meta.lastRun`), so tier 2 is dormant-but-tested: every lookup misses and
 * falls through to tier 3 until Bach reruns scripts/build-usda-map.mjs with
 * a real API key. Tier 1 is similarly dormant until the C1 overlay
 * (src/data/recipeOverlay.json) has `nutritionPerServing` rows wired through
 * to plan items. With both tables empty, `resolveNutrition` is byte-for-byte
 * equivalent to the legacy `estimateNutrition` (see the equivalence test in
 * src/api/__tests__/nutrition.test.js) — this is the intended seam: nothing
 * downstream needs to change when real data starts arriving, only these two
 * JSON files (and the C1 overlay) need to fill in.
 *
 * Pure/core module — no DOM, no React. Screens (e.g. NutritionFactsSheet)
 * only render what this resolves and label it per `source`/`basis`.
 */

import fdcMapRaw from '../data/usda/fdcMap.json';
import nutrientsRaw from '../data/usda/nutrients.json';
import { estimateNutrition } from '../data/nutritionEstimates.js';

/** @type {Object<string, {fdcId: number, matchedName?: string, dataType?: string, matchScore?: number, manualOverride?: boolean}>} */
const FDC_MAP = fdcMapRaw.items || {};
/** @type {Object<string, {per100g: Object, perServing?: Object, portionSource?: string}>} */
const NUTRIENTS = nutrientsRaw.nutrients || {};

/**
 * @typedef {Object} ResolvedNutrition
 * @property {number|null} calories
 * @property {number|null} protein
 * @property {number|null} carbs
 * @property {number|null} fat
 * @property {boolean} estimated - true only for tier-3 (group/slot estimate)
 *   hits; false for real data (panel or USDA), regardless of `basis`.
 * @property {'panel'|'usda'|'estimate'} source
 * @property {'perServing'|'per100g'} [basis] - Only present when
 *   `source === 'usda'`. `'per100g'` means the number is per 100 grams, NOT
 *   a serving — callers must label it honestly (e.g. "per 100 g"), never
 *   render it as if it were a serving amount.
 */

/**
 * Look up one foodItemID in the committed USDA tables.
 * @param {number|string|undefined|null} foodItemID
 * @returns {ResolvedNutrition|null}
 */
function resolveUsda(foodItemID) {
  if (foodItemID === undefined || foodItemID === null) return null;

  const mapEntry = FDC_MAP[String(foodItemID)];
  if (!mapEntry) return null;

  const nutrientEntry = NUTRIENTS[String(mapEntry.fdcId)];
  if (!nutrientEntry) return null;

  if (nutrientEntry.perServing) {
    const { calories, protein, carbs, fat } = nutrientEntry.perServing;
    // `?? null` on every field: FDC doesn't always report all four macros
    // for a given food, and the module contract (see header) is that an
    // absent value is always `null`, never `undefined` — a bare destructure
    // would silently let `undefined` through for whichever field FDC
    // omitted.
    return {
      calories: calories ?? null,
      protein: protein ?? null,
      carbs: carbs ?? null,
      fat: fat ?? null,
      estimated: false,
      source: 'usda',
      basis: 'perServing',
    };
  }

  if (nutrientEntry.per100g) {
    const { calories, protein, carbs, fat } = nutrientEntry.per100g;
    return {
      calories: calories ?? null,
      protein: protein ?? null,
      carbs: carbs ?? null,
      fat: fat ?? null,
      estimated: false,
      source: 'usda',
      basis: 'per100g',
    };
  }

  return null;
}

/**
 * Resolve per-serving nutrition for one plan item, most-authoritative tier
 * first. See the module header for the full four-tier order.
 * @param {Object} item - Food/Recipe/PlanItem-shaped object. Recognized
 *   fields: `nutritionPerServing` (tier 1), `id` (foodItemID, tier 2), plus
 *   whatever `estimateNutrition` reads (`fineGroup`/`group`/`kind`, tier 3).
 * @param {string} [slotKey] - Originating slot key (e.g. a plan day's slot,
 *   or `item.fromSlot`). Passed through unchanged to `estimateNutrition`,
 *   which only consults it for its recipe-slot fallback.
 * @returns {ResolvedNutrition|null}
 */
export function resolveNutrition(item, slotKey) {
  if (!item) return null;

  // Tier 1 — recipe source panel (real, per-serving, from the C1 overlay).
  const panel = item.nutritionPerServing;
  if (panel && typeof panel === 'object') {
    const { calories, protein, carbs, fat } = panel;
    // `?? null` on every field, not a bare destructure: recipeIngestion.js's
    // validator now allows `nutritionPerServing` to be present with
    // `calories` (or any other macro) absent — Mory's real recipe source
    // has no calorie column at all (see recipeIngestion.js's "NUTRITION
    // RELAXATION" note) — and this module's own contract (see header) is
    // that a missing value is always `null`, NEVER `undefined`. A bare
    // destructure would let `undefined` leak through here, and a caller
    // like NutritionFactsSheet templating `${resolved.calories} kcal`
    // without a dedicated null-check would render the literal string
    // "undefined kcal" instead of the app's honest "no data" treatment.
    return {
      calories: calories ?? null,
      protein: protein ?? null,
      carbs: carbs ?? null,
      fat: fat ?? null,
      estimated: false,
      source: 'panel',
    };
  }

  // Tier 2 — USDA FDC table, matched by foodItemID.
  const usda = resolveUsda(item.id);
  if (usda) return usda;

  // Tier 3 — hand-labeled food-group / recipe-slot estimate.
  const estimate = estimateNutrition(item, slotKey);
  if (estimate) return { ...estimate, source: 'estimate' };

  // Tier 4 — nothing resolved anywhere. Never guess.
  return null;
}

/**
 * Sum resolved nutrition across a day's scheduled items — resolver-backed
 * sibling of `estimateDayTotals` (src/data/nutritionEstimates.js). Same
 * total shape, plus a source breakdown so callers can show how much of a
 * day's total is real data vs. a stand-in estimate vs. unresolved.
 *
 * A missing individual macro (possible on a `per100g` USDA hit — FDC
 * doesn't always report all four) contributes 0 to that macro's running
 * total rather than propagating `null`/`NaN` through the whole sum; it is
 * never reported as a real, measured 0 for that item (`resolveNutrition`'s
 * per-item result still carries the true `null`).
 * @param {Array<Object>} items - Same item shape `resolveNutrition` accepts;
 *   each item's own `fromSlot` (if present) is used as its slot key, mirroring
 *   `estimateDayTotals`.
 * @returns {{calories: number, protein: number, carbs: number, fat: number,
 *   itemCount: number, realCount: number, estimatedCount: number,
 *   noneCount: number}|null} `null` if `items` is empty.
 */
export function resolveDayTotals(items) {
  if (!items || items.length === 0) return null;

  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  let realCount = 0;
  let estimatedCount = 0;
  let noneCount = 0;

  for (const item of items) {
    const resolved = resolveNutrition(item, item.fromSlot);
    if (!resolved) {
      noneCount += 1;
      continue;
    }

    totals.calories += resolved.calories ?? 0;
    totals.protein += resolved.protein ?? 0;
    totals.carbs += resolved.carbs ?? 0;
    totals.fat += resolved.fat ?? 0;

    if (resolved.estimated) estimatedCount += 1;
    else realCount += 1;
  }

  return {
    ...totals,
    itemCount: items.length,
    realCount,
    estimatedCount,
    noneCount,
  };
}
