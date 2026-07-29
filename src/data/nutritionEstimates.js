/**
 * nutritionEstimates.js — Static per-serving nutrition ESTIMATES.
 *
 * The Nutridigm API has no nutrition data (no calories/macros on food or
 * recipe records) — this table is a deliberate, clearly-labeled stand-in so
 * the Plan screen can show *something* useful today. Every value here is a
 * hand-picked approximation, NOT vendor data. This is a seam: when a real
 * nutrition data source is wired in, this file (and the `estimated: true`
 * flag threaded through consumers) should be the first thing replaced/removed.
 *
 * Lookup order (see `estimateNutrition`):
 *   1. fine food group table, keyed by `item.fineGroup`
 *   2. coarse food group table, keyed by the first letter of `item.group`
 *   3. if `item.kind === 'recipe'`, per-slot table keyed by `slotKey`
 *   4. otherwise `null` — never fabricate a number without a group to hang
 *      it on.
 */

/** Per-serving estimates by FINE food group code. */
const FINE_GROUP_ESTIMATES = {
  b1: { calories: 180, protein: 25, carbs: 0, fat: 8 },  // fish
  b3: { calories: 200, protein: 27, carbs: 0, fat: 9 },  // poultry
  c2: { calories: 150, protein: 9, carbs: 25, fat: 2 },  // legumes
  c3: { calories: 170, protein: 6, carbs: 6, fat: 15 },  // nuts
  g1: { calories: 120, protein: 8, carbs: 9, fat: 5 },   // dairy
  h1: { calories: 150, protein: 4, carbs: 18, fat: 7 },  // snacks
  h2: { calories: 60, protein: 1, carbs: 14, fat: 0 },   // beverages
};

/** Per-serving estimates by COARSE food group code (fallback when fine group isn't listed above). */
const COARSE_GROUP_ESTIMATES = {
  b: { calories: 190, protein: 26, carbs: 0, fat: 8 },   // meat/fish/poultry
  c: { calories: 160, protein: 8, carbs: 15, fat: 8 },   // eggs/beans/nuts/seeds
  d: { calories: 80, protein: 1, carbs: 20, fat: 0 },    // fruit
  e: { calories: 50, protein: 2, carbs: 10, fat: 0 },    // vegetables
  f: { calories: 150, protein: 5, carbs: 30, fat: 2 },   // grains
  g: { calories: 120, protein: 8, carbs: 9, fat: 5 },    // dairy/fats/oils
  h: { calories: 100, protein: 2, carbs: 16, fat: 3 },   // desserts/snacks/beverages
  i: { calories: 20, protein: 1, carbs: 4, fat: 0 },     // herbs/spices/prepared
  k: { calories: 10, protein: 0, carbs: 2, fat: 0 },     // key nutrients/herbal
};

/** Per-serving estimates for recipes (no food group), keyed by PLAN_SLOTS slot key. */
const RECIPE_SLOT_ESTIMATES = {
  breakfast: { calories: 350, protein: 15, carbs: 45, fat: 12 },
  lunch: { calories: 450, protein: 25, carbs: 45, fat: 18 },
  dinner: { calories: 550, protein: 30, carbs: 50, fat: 22 },
  snacks: { calories: 200, protein: 5, carbs: 25, fat: 8 },
  beverages: { calories: 120, protein: 2, carbs: 24, fat: 1 },
};

/**
 * Estimate per-serving nutrition for a single item.
 * @param {{fineGroup?: string, group?: string, kind?: string}} item
 * @param {string} [slotKey] - originating slot (e.g. item.fromSlot), used
 *   only for recipes, which have no food group to key off of.
 * @returns {{calories: number, protein: number, carbs: number, fat: number, estimated: true}|null}
 */
export function estimateNutrition(item, slotKey) {
  if (!item) return null;

  if (item.fineGroup && FINE_GROUP_ESTIMATES[item.fineGroup]) {
    return { ...FINE_GROUP_ESTIMATES[item.fineGroup], estimated: true };
  }

  const coarseKey = item.group ? item.group.charAt(0) : '';
  if (coarseKey && COARSE_GROUP_ESTIMATES[coarseKey]) {
    return { ...COARSE_GROUP_ESTIMATES[coarseKey], estimated: true };
  }

  if (item.kind === 'recipe' && slotKey && RECIPE_SLOT_ESTIMATES[slotKey]) {
    return { ...RECIPE_SLOT_ESTIMATES[slotKey], estimated: true };
  }

  return null;
}

/**
 * Sum estimated nutrition across a day's scheduled items.
 * @param {Array<{fineGroup?: string, group?: string, kind?: string, fromSlot?: string}>} items
 * @returns {{calories: number, protein: number, carbs: number, fat: number, estimated: true, itemCount: number, estimatedCount: number}|null}
 *   null if `items` is empty.
 */
export function estimateDayTotals(items) {
  if (!items || items.length === 0) return null;

  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  let estimatedCount = 0;

  for (const item of items) {
    const estimate = estimateNutrition(item, item.fromSlot);
    if (!estimate) continue;
    totals.calories += estimate.calories;
    totals.protein += estimate.protein;
    totals.carbs += estimate.carbs;
    totals.fat += estimate.fat;
    estimatedCount += 1;
  }

  return {
    ...totals,
    estimated: true,
    itemCount: items.length,
    estimatedCount,
  };
}
