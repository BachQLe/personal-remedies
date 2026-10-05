/**
 * nutrientCatalog.js — the micronutrients Remedi captures from USDA FDC.
 *
 * Shared by the offline pipeline (scripts/build-usda-map.mjs, plain Node) and
 * the app (Food Facts panel, Natural Sources ranking, nutrient search), so it
 * must stay dependency-free pure ESM.
 *
 * Each entry: `key` (storage key under nutrients.json `micros.per100g` /
 * `micros.perServing`), `label`, `unit`, `numbers` (FDC nutrient numbers in
 * preference order), `group`, and optional `fallback` conversions.
 * An absent value is NEVER stored as 0 — absence means FDC did not report it.
 */

export const NUTRIENT_CATALOG = [
  // Core
  { key: 'fiber', label: 'Fiber', unit: 'g', numbers: ['291'], group: 'Core', aliases: ['dietary fiber'] },
  { key: 'sugars', label: 'Sugars', unit: 'g', numbers: ['269', '269.3', '269.2'], group: 'Core', aliases: ['sugar'] },
  { key: 'satFat', label: 'Saturated fat', unit: 'g', numbers: ['606'], group: 'Core', aliases: ['saturated fat', 'sat fat'] },
  { key: 'cholesterol', label: 'Cholesterol', unit: 'mg', numbers: ['601'], group: 'Core', aliases: [] },
  { key: 'omega3', label: 'Omega-3', unit: 'g', numbers: [], group: 'Core', aliases: ['omega 3', 'omega-3s', 'omega3', 'omega 3s'], derived: true },
  // Minerals
  { key: 'sodium', label: 'Sodium', unit: 'mg', numbers: ['307'], group: 'Minerals', aliases: ['salt'] },
  { key: 'potassium', label: 'Potassium', unit: 'mg', numbers: ['306'], group: 'Minerals', aliases: [] },
  { key: 'calcium', label: 'Calcium', unit: 'mg', numbers: ['301'], group: 'Minerals', aliases: [] },
  { key: 'iron', label: 'Iron', unit: 'mg', numbers: ['303'], group: 'Minerals', aliases: [] },
  { key: 'magnesium', label: 'Magnesium', unit: 'mg', numbers: ['304'], group: 'Minerals', aliases: [] },
  { key: 'zinc', label: 'Zinc', unit: 'mg', numbers: ['309'], group: 'Minerals', aliases: [] },
  { key: 'phosphorus', label: 'Phosphorus', unit: 'mg', numbers: ['305'], group: 'Minerals', aliases: [] },
  { key: 'selenium', label: 'Selenium', unit: 'mcg', numbers: ['317'], group: 'Minerals', aliases: [] },
  { key: 'copper', label: 'Copper', unit: 'mg', numbers: ['312'], group: 'Minerals', aliases: [] },
  { key: 'manganese', label: 'Manganese', unit: 'mg', numbers: ['315'], group: 'Minerals', aliases: [] },
  // Vitamins
  { key: 'vitA', label: 'Vitamin A', unit: 'mcg RAE', numbers: ['320'], group: 'Vitamins', aliases: ['vitamin a', 'vit a'] },
  { key: 'vitC', label: 'Vitamin C', unit: 'mg', numbers: ['401'], group: 'Vitamins', aliases: ['vitamin c', 'vit c'] },
  { key: 'vitD', label: 'Vitamin D', unit: 'mcg', numbers: ['328'], group: 'Vitamins', aliases: ['vitamin d', 'vit d'], fallback: { number: '324', divideBy: 40 } },
  { key: 'vitE', label: 'Vitamin E', unit: 'mg', numbers: ['323'], group: 'Vitamins', aliases: ['vitamin e', 'vit e'] },
  { key: 'vitK', label: 'Vitamin K', unit: 'mcg', numbers: ['430'], group: 'Vitamins', aliases: ['vitamin k', 'vit k'] },
  { key: 'folate', label: 'Folate', unit: 'mcg', numbers: ['417', '432'], group: 'Vitamins', aliases: ['folic acid', 'vitamin b9', 'b9'] },
  { key: 'vitB12', label: 'Vitamin B12', unit: 'mcg', numbers: ['418'], group: 'Vitamins', aliases: ['vitamin b12', 'b12', 'b-12', 'vitamin b-12'] },
  { key: 'vitB6', label: 'Vitamin B6', unit: 'mg', numbers: ['415'], group: 'Vitamins', aliases: ['vitamin b6', 'b6', 'b-6', 'vitamin b-6'] },
  { key: 'thiamin', label: 'Thiamin (B1)', unit: 'mg', numbers: ['404'], group: 'Vitamins', aliases: ['thiamine', 'vitamin b1', 'b1'] },
  { key: 'riboflavin', label: 'Riboflavin (B2)', unit: 'mg', numbers: ['405'], group: 'Vitamins', aliases: ['vitamin b2', 'b2'] },
  { key: 'niacin', label: 'Niacin (B3)', unit: 'mg', numbers: ['406'], group: 'Vitamins', aliases: ['vitamin b3', 'b3'] },
  { key: 'choline', label: 'Choline', unit: 'mg', numbers: ['421'], group: 'Vitamins', aliases: [] },
];

/** Macros (already stored top-level) exposed as pickable nutrients too. */
export const MACRO_NUTRIENTS = [
  { key: 'protein', label: 'Protein', unit: 'g', group: 'Macros', aliases: [], macro: true },
];

/** All nutrients a user can pick / query, in display order. */
export const PICKABLE_NUTRIENTS = [...MACRO_NUTRIENTS, ...NUTRIENT_CATALOG];

/** Omega-3 components: ALA (851, or 619 18:3 undifferentiated), EPA, DPA, DHA. */
const OMEGA3_COMPONENTS = [['851', '619'], ['629'], ['631'], ['621']];

const round = (v) => Math.round(v * 10000) / 10000;

function entryNumber(e) {
  return e.nutrientNumber ?? e.nutrient?.number ?? null;
}
function entryAmount(e) {
  const v = e.value ?? e.amount;
  return typeof v === 'number' ? v : null;
}
function lookup(foodNutrients, numbers) {
  for (const num of numbers) {
    const e = (foodNutrients || []).find((x) => entryNumber(x) === num);
    const v = e ? entryAmount(e) : null;
    if (v != null) return v;
  }
  return null;
}

/**
 * Extract per-100g micronutrients from an FDC foodNutrients array. Keys FDC
 * did not report are omitted (never 0-filled).
 * @param {Array<object>} foodNutrients
 * @returns {Record<string, number>}
 */
export function extractMicros(foodNutrients) {
  const out = {};
  for (const n of NUTRIENT_CATALOG) {
    if (n.derived) continue;
    let v = lookup(foodNutrients, n.numbers);
    if (v == null && n.fallback) {
      const f = lookup(foodNutrients, [n.fallback.number]);
      if (f != null) v = f / n.fallback.divideBy;
    }
    if (v != null) out[n.key] = round(v);
  }
  let omega = null;
  for (const nums of OMEGA3_COMPONENTS) {
    const v = lookup(foodNutrients, nums);
    if (v != null) omega = (omega ?? 0) + v;
  }
  if (omega != null) out.omega3 = round(omega);
  return out;
}

/** Scale a per-100g micro map to `gramWeight` grams (pure proportional math). */
export function scaleMicros(per100g, gramWeight) {
  const f = gramWeight / 100;
  const out = {};
  for (const [k, v] of Object.entries(per100g || {})) if (typeof v === 'number') out[k] = round(v * f);
  return out;
}
