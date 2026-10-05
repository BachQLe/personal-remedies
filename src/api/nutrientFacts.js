/**
 * nutrientFacts.js — real USDA nutrient lookups for Food Facts, nutrient
 * search ("calcium in milk") and Natural Sources ranking ("top sources of
 * fiber").
 *
 * Reads only the committed USDA tables (fdcMap.json -> nutrients.json), so
 * it is synchronous, offline and pure. A food with no USDA match resolves to
 * `null` — callers must say "Nutrition data not available", never estimate.
 * Group estimates (nutritionEstimates.js) are deliberately NOT used here.
 */
import fdcMapRaw from '../data/usda/fdcMap.json';
import nutrientsRaw from '../data/usda/nutrients.json';
import { NUTRIENT_CATALOG, PICKABLE_NUTRIENTS } from '../data/usda/nutrientCatalog.js';

const FDC_MAP = fdcMapRaw.items || {};
const NUTRIENTS = nutrientsRaw.nutrients || {};

export { PICKABLE_NUTRIENTS };

/** @param {string} key @returns {object|undefined} */
export function getNutrientMeta(key) {
  return PICKABLE_NUTRIENTS.find((n) => n.key === key);
}

const DRY_FORM = /\b(dry|dried|dehydrated|flour|powder|bran|meal|crude|uncooked)\b/i;
const STAPLE_RAW = /\b(beans?|peas?|lentils?|chickpeas?|lupins?|soybeans?|rice|oats?|wheat|corn|barley|rye|quinoa|millet|sorghum|buckwheat|cereals?|grains?)\b/i;

/**
 * Is USDA's portion for this record a realistic eaten serving? Portions for
 * dry/raw staples ("1 cup" of dry split peas, corn bran, raw beans) describe
 * the ingredient before cooking and give misleadingly large numbers, so no
 * per-serving figure is presented for them.
 * @param {string} matchedName USDA description
 * @param {string} [portionLabel]
 */
export function isRealisticServing(matchedName, portionLabel) {
  const name = matchedName || '';
  if (DRY_FORM.test(name)) return false;
  if (/\braw\b/i.test(name) && STAPLE_RAW.test(name)) return false;
  void portionLabel;
  return true;
}

/**
 * Raw USDA record for a Nutridigm foodItemID, or null when unmatched.
 * @param {number|string|null|undefined} foodItemID
 */
export function getUsdaRecord(foodItemID) {
  if (foodItemID == null) return null;
  const map = FDC_MAP[String(foodItemID)];
  if (!map) return null;
  const row = NUTRIENTS[String(map.fdcId)];
  if (!row || !row.per100g) return null;
  return { map, row };
}

/** Format a nutrient amount for display (no false precision). */
export function formatAmount(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '';
  if (v === 0) return '0';
  if (v >= 100) return String(Math.round(v));
  if (v >= 1) return String(Math.round(v * 10) / 10);
  if (v >= 0.01) return String(Math.round(v * 100) / 100);
  return '<0.01';
}

function rowsFrom(macros, micros) {
  const rows = [];
  const push = (key, label, unit, value) => {
    if (typeof value === 'number') rows.push({ key, label, unit, value });
  };
  push('calories', 'Calories', 'kcal', macros?.calories);
  push('protein', 'Protein', 'g', macros?.protein);
  push('carbs', 'Carbohydrate', 'g', macros?.carbs);
  push('fat', 'Total fat', 'g', macros?.fat);
  for (const n of NUTRIENT_CATALOG) push(n.key, n.label, n.unit, micros?.[n.key]);
  return rows;
}

/**
 * Full nutrient panel for one food.
 * @returns {null | {
 *   fdcId: number, matchedName: string, dataType: string,
 *   serving: {grams: number, label: string}|null,
 *   perServing: Array<{key,label,unit,value}>|null,
 *   per100g: Array<{key,label,unit,value}>,
 * }} null = no USDA data (never estimated)
 */
export function getNutrientPanel(foodItemID) {
  const rec = getUsdaRecord(foodItemID);
  if (!rec) return null;
  const { map, row } = rec;
  const hasServing = Boolean(row.perServing && row.perServing.amount) && isRealisticServing(map.matchedName, row.portionSource);
  return {
    fdcId: map.fdcId,
    matchedName: map.matchedName,
    dataType: map.dataType,
    serving: hasServing ? { grams: row.perServing.amount, label: row.portionSource || '' } : null,
    perServing: hasServing ? rowsFrom(row.perServing, row.micros?.perServing) : null,
    per100g: rowsFrom(row.per100g, row.micros?.per100g),
  };
}

/**
 * One nutrient's amounts for one food: `{ unit, perServing, per100g,
 * serving }` — any amount USDA did not report is null. Returns null when the
 * food is unmatched, or USDA reported this nutrient neither per serving nor
 * per 100 g.
 */
export function getNutrientAmount(foodItemID, nutrientKey) {
  const meta = getNutrientMeta(nutrientKey);
  const rec = getUsdaRecord(foodItemID);
  if (!meta || !rec) return null;
  const { row } = rec;
  const pick = (macros, micros) => {
    const v = meta.macro ? macros?.[nutrientKey] : micros?.[nutrientKey];
    return typeof v === 'number' ? v : null;
  };
  const per100g = pick(row.per100g, row.micros?.per100g);
  const realistic = Boolean(row.perServing) && isRealisticServing(rec.map.matchedName, row.portionSource);
  const perServing = realistic ? pick(row.perServing, row.micros?.perServing) : null;
  if (per100g == null && perServing == null) return null;
  return {
    unit: meta.unit,
    perServing,
    per100g,
    serving: realistic && row.perServing?.amount ? { grams: row.perServing.amount, label: row.portionSource || '' } : null,
    fdcId: rec.map.fdcId,
  };
}

/**
 * Rank foods by a nutrient PER 100 g (comparable across foods). Per-serving
 * is carried as secondary info and is null when the USDA portion is not a
 * realistic eaten serving. Only foods with real USDA data can rank. Foods
 * that share one USDA record (e.g. organic / non-organic twins) appear once.
 * @param {Array<{id:number,name:string}>} foods
 * @param {string} nutrientKey
 * @param {{limit?: number}} [opts]
 * @returns {Array<{food: object, unit: string, per100g: number, perServing: number|null, serving: object|null}>}
 */
export function rankFoodsByNutrient(foods, nutrientKey, opts = {}) {
  const limit = opts.limit ?? 20;
  const seenFdc = new Set();
  const rows = [];
  for (const food of foods || []) {
    const amt = getNutrientAmount(food.id, nutrientKey);
    if (!amt || amt.per100g == null || amt.per100g <= 0) continue;
    rows.push({ food, unit: amt.unit, per100g: amt.per100g, perServing: amt.perServing, serving: amt.serving, fdcId: amt.fdcId });
  }
  rows.sort(
    (a, b) =>
      b.per100g - a.per100g ||
      a.food.name.length - b.food.name.length ||
      a.food.name.localeCompare(b.food.name)
  );
  const out = [];
  for (const r of rows) {
    if (seenFdc.has(r.fdcId)) continue;
    seenFdc.add(r.fdcId);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

// ── Query parsing ────────────────────────────────────────────────────────────

const ALIAS_INDEX = (() => {
  const list = [];
  for (const n of PICKABLE_NUTRIENTS) {
    for (const term of [n.label.toLowerCase(), n.key.toLowerCase(), ...(n.aliases || [])]) {
      list.push([term, n.key]);
    }
  }
  // Longest phrase first so "vitamin c" wins over "vitamin", "saturated fat" over "fat".
  return list.sort((a, b) => b[0].length - a[0].length);
})();

const FILLER = /^(how much|how many|what is the|what's the|whats the|the|amount of|content of|does|do)\s+/;

/**
 * Parse a nutrient question out of a search string.
 *  "calcium in milk"            -> { nutrient: 'calcium', food: 'milk' }
 *  "how much vitamin c in kiwi" -> { nutrient: 'vitC', food: 'kiwi' }
 *  "fiber"                      -> { nutrient: 'fiber', food: '' }
 *  "iron content of spinach"    -> { nutrient: 'iron', food: 'spinach' }
 *  "milk calcium"               -> { nutrient: 'calcium', food: 'milk' }
 * Returns null when the text names no nutrient.
 * @param {string} query
 * @returns {{nutrient: string, food: string}|null}
 */
export function parseNutrientQuery(query) {
  let q = (query || '').toLowerCase().replace(/[?!.,]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!q) return null;
  q = q.replace(FILLER, '').replace(FILLER, '');
  q = q.replace(/\bcontent\b/g, ' ').replace(/\s+/g, ' ').trim();

  for (const [term, key] of ALIAS_INDEX) {
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // "<nutrient> in|of|per|from <food>"  (also "<nutrient>")
    let m = q.match(new RegExp(`^${esc}(?:\\s+(?:in|of|per|from|for)\\s+(.+))?$`));
    if (m) return { nutrient: key, food: (m[1] || '').trim() };
    // "<food> <nutrient>"
    m = q.match(new RegExp(`^(.+?)\\s+${esc}$`));
    if (m) return { nutrient: key, food: m[1].trim() };
  }
  return null;
}
