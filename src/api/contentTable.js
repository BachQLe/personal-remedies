// PR `contents` table seam (checklist 7.4). The real table arrives via AWS
// (credentials pending, Nov 2026); until then buildTable() fills the same shape
// from the old USDA snapshot. DEV ONLY: Mory ruled USDA out for users. When the
// AWS table lands, rewrite buildTable() only; exports stay the same. If the real
// table ships its own level column, use it instead of levelFor.
import itemsRaw from '../data/cache/items.json';
import { getServingSize } from './localTables.js';

// id = Nutridigm nutrient foodItemID, key = USDA snapshot key (placeholder only),
// dv = FDA Daily Value (null = no DV, never rated).
export const NUTRIENTS = [
  { id: 1052, key: 'calories', label: 'Calories', unit: 'kcal', dv: null, macro: true },
  { id: 1176, key: 'protein', label: 'Protein', unit: 'g', dv: 50, macro: true },
  { id: 1056, key: 'carbs', label: 'Carbohydrates', unit: 'g', dv: 275, macro: true },
  { id: 1099, key: 'fiber', label: 'Fiber', unit: 'g', dv: 28 },
  { id: 1205, key: 'sugars', label: 'Total sugar', unit: 'g', dv: null },
  { id: 1096, key: 'fat', label: 'Total fat', unit: 'g', dv: 78, macro: true },
  { id: 1095, key: 'satFat', label: 'Saturated fat', unit: 'g', dv: 20 },
  { id: 1068, key: 'cholesterol', label: 'Cholesterol', unit: 'mg', dv: 300 },
  { id: 1163, key: 'omega3', label: 'Omega-3', unit: 'g', dv: null },
  { id: 1200, key: 'sodium', label: 'Sodium', unit: 'mg', dv: 2300 },
  { id: 1173, key: 'potassium', label: 'Potassium', unit: 'mg', dv: 4700 },
  { id: 1050, key: 'calcium', label: 'Calcium', unit: 'mg', dv: 1300 },
  { id: 1129, key: 'iron', label: 'Iron', unit: 'mg', dv: 18 },
  { id: 1145, key: 'magnesium', label: 'Magnesium', unit: 'mg', dv: 420 },
  { id: 1237, key: 'zinc', label: 'Zinc', unit: 'mg', dv: 11 },
  { id: 1170, key: 'phosphorus', label: 'Phosphorus', unit: 'mg', dv: 1250 },
  { id: 1194, key: 'selenium', label: 'Selenium', unit: 'mcg', dv: 55 },
  { id: 1074, key: 'copper', label: 'Copper', unit: 'mg', dv: 0.9 },
  { id: 1147, key: 'manganese', label: 'Manganese', unit: 'mg', dv: 2.3 },
  { id: 1216, key: 'vitA', label: 'Vitamin A', unit: 'mcg RAE', dv: 900 },
  { id: 1223, key: 'vitC', label: 'Vitamin C', unit: 'mg', dv: 90 },
  { id: 1224, key: 'vitD', label: 'Vitamin D', unit: 'mcg', dv: 20 },
  { id: 1225, key: 'vitE', label: 'Vitamin E', unit: 'mg', dv: 15 },
  { id: 1226, key: 'vitK', label: 'Vitamin K', unit: 'mcg', dv: 120 },
  { id: 1103, key: 'folate', label: 'Folate', unit: 'mcg', dv: 400 },
  { id: 1218, key: 'vitB12', label: 'Vitamin B12', unit: 'mcg', dv: 2.4 },
  { id: 1222, key: 'vitB6', label: 'Vitamin B6', unit: 'mg', dv: 1.7 },
  { id: 1217, key: 'thiamin', label: 'Thiamin (B1)', unit: 'mg', dv: 1.2 },
  { id: 1219, key: 'riboflavin', label: 'Riboflavin (B2)', unit: 'mg', dv: 1.3 },
  { id: 1220, key: 'niacin', label: 'Niacin (B3)', unit: 'mg', dv: 16 },
  { id: 1140, key: 'choline', label: 'Choline', unit: 'mg', dv: 550 },
];

// Index = number of filled circles (0-3).
export const LEVELS = ['Little or none', 'Some', 'High', 'Very high'];

export function levelFor(amount, dv) {
  if (!dv || !Number.isFinite(amount)) return null;
  const pct = (amount / dv) * 100;
  if (pct >= 20) return 3;
  if (pct >= 10) return 2;
  if (pct >= 2) return 1;
  return 0;
}

const NUTRIENT_IDS = new Set(NUTRIENTS.map((n) => n.id));
export function isContentNutrient(foodId) {
  return NUTRIENT_IDS.has(Number(foodId));
}

export function formatAmount(v) {
  const out = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: v >= 10 ? 0 : v >= 1 ? 1 : 2,
  }).format(v);
  return v > 0 && out === '0' ? '<0.01' : out;
}

// Map<foodId, { servingGrams, amounts: { [nutrientId]: number } }>
async function buildTable() {
  const [fdcMap, nutrients] = await Promise.all([
    import('../data/usda/fdcMap.json').then((m) => m.default),
    import('../data/usda/nutrients.json').then((m) => m.default),
  ]);
  const table = new Map();
  for (const item of itemsRaw) {
    const fdcId = fdcMap.items?.[String(item.foodItemID)]?.fdcId;
    const row = fdcId != null ? nutrients.nutrients?.[String(fdcId)] : null;
    if (!row) continue;
    const grams = parseFloat(getServingSize(item.foodItemID));
    const servingGrams = Number.isFinite(grams) ? grams : null;
    const scale = servingGrams != null ? servingGrams / 100 : 1;
    const amounts = {};
    for (const n of NUTRIENTS) {
      const v = n.macro ? row.per100g?.[n.key] : row.micros?.per100g?.[n.key];
      if (typeof v === 'number' && Number.isFinite(v)) amounts[n.id] = v * scale;
    }
    table.set(item.foodItemID, { servingGrams, amounts });
  }
  return table;
}

let tablePromise = null;
function loadTable() {
  if (!tablePromise) {
    tablePromise = buildTable().catch((e) => { tablePromise = null; throw e; });
  }
  return tablePromise;
}

export async function getFoodContent(foodId) {
  const entry = (await loadTable()).get(Number(foodId));
  if (!entry) return null;
  const rows = NUTRIENTS.filter((n) => entry.amounts[n.id] != null).map((n) => {
    const amount = entry.amounts[n.id];
    return {
      id: n.id,
      label: n.label,
      unit: n.unit,
      amount,
      percentDV: n.dv ? Math.round((amount / n.dv) * 100) : null,
      level: levelFor(amount, n.dv),
    };
  });
  return { servingGrams: entry.servingGrams, rows };
}

const isNonFood = (g) => g === 'x' || /^[jkl]/.test(g ?? '');

export async function getTopSources(nutrientId, limit = 10) {
  if (!isContentNutrient(nutrientId)) return null;
  const nutrient = NUTRIENTS.find((n) => n.id === Number(nutrientId));
  const table = await loadTable();
  const out = [];
  for (const item of itemsRaw) {
    if (isNonFood(item.fineFoodGroup)) continue;
    const entry = table.get(item.foodItemID);
    // ponytail: foods without a PR serving size can't rank (one serving vs one
    // serving); the real table's coverage decides how many are left out.
    if (!entry || entry.servingGrams == null) continue;
    const amount = entry.amounts[nutrient.id];
    if (!(amount > 0)) continue;
    out.push({
      foodId: item.foodItemID,
      name: item.displayAs,
      amount,
      unit: nutrient.unit,
      servingGrams: entry.servingGrams,
      level: levelFor(amount, nutrient.dv),
    });
  }
  return out.sort((a, b) => b.amount - a.amount).slice(0, limit);
}
