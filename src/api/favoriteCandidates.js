/**
 * favoriteCandidates.js — the My Favorites candidate rules from Implementation Notes for
 * Meal Planner (v11-20-26), as data + one pure selector. No network: adapter.js's
 * getFavoriteCandidates supplies the rated sources.
 *
 * Per slot, sources are tried in order; a later source is only read when the Limit isn't
 * reached yet (the notes' fast path — never the slower "gather all, sort, trim" option).
 * Rating gates use the 7-step ladder: helpful 1-3, neutral 4, negative 5-7. Unrated never passes.
 */
import mpDb from '../data/mpDb.json';

// ponytail: Mory hasn't picked the Limit (notes: "20 or 30"). One constant to change.
export const FAVORITES_LIMIT = 20;

const helpful = (n) => Number.isFinite(n) && n >= 1 && n <= 3;
const notNegative = (n) => Number.isFinite(n) && n >= 1 && n <= 4;

/**
 * A source is `{ from, meal?, ok }`:
 *  - 'suggest':  /suggest rows (group 'l' recipes, or fine groups for Snacks & Desserts / Beverages)
 *  - 'mp':       every MP-Recipes entry in `meal`, rated with /goodfor
 *  - 'more':     every MP-More entry in `meal`, rated with /goodfor
 * Meal codes: b breakfast, ld lunch/dinner, ds dessert, s snack, bev beverage.
 */
export const SLOT_RULES = {
  breakfast: [{ from: 'mp', meal: 'b', ok: notNegative }, { from: 'more', meal: 'b', ok: notNegative }],
  lunch: [{ from: 'suggest', ok: notNegative }, { from: 'mp', meal: 'ld', ok: notNegative }],
  dinner: [{ from: 'suggest', ok: notNegative }, { from: 'mp', meal: 'ld', ok: notNegative }],
  // Dessert and Snack share one rail (Sept 2026 product decision), so the /suggest query
  // (Snacks & Desserts) is gated by the stricter Snack rule.
  snacks: [
    { from: 'suggest', ok: helpful },
    { from: 'mp', meal: 'ds', ok: notNegative },
    { from: 'more', meal: 's', ok: helpful },
  ],
  beverages: [
    { from: 'suggest', ok: notNegative },
    { from: 'more', meal: 'bev', ok: notNegative },
    { from: 'mp', meal: 'bev', ok: notNegative },
  ],
};

/** FIs in MP-Recipes / MP-More carrying `meal`. @returns {number[]} */
export function mpIds(table, meal) {
  return Object.entries(mpDb[table]).filter(([, v]) => (table === 'recipes' ? v.meals : v).includes(meal)).map(([fi]) => Number(fi));
}

/** MP-Recipes row (url, meals, kcal) for an FI, if any. */
export const mpRecipe = (fi) => mpDb.recipes[fi];

/**
 * @param {Array<{from: string, meal?: string, ok: (n:number)=>boolean}>} rules
 * @param {(source: {from: string, meal?: string}) => Promise<Array<{id: number, numericId: number|null}>>} read
 * @param {number} [limit]
 * @returns {Promise<Array<{id: number, numericId: number}>>} accepted rows, best-rated first
 */
export async function selectCandidates(rules, read, limit = FAVORITES_LIMIT) {
  const picked = [];
  const seen = new Set();
  const seenUrl = new Set();
  for (const rule of rules) {
    if (picked.length >= limit) break;
    for (const row of await read(rule)) {
      if (picked.length >= limit) break;
      const url = mpRecipe(row.id)?.url;
      if (seen.has(row.id) || (url && seenUrl.has(url)) || !rule.ok(row.numericId)) continue;
      seen.add(row.id);
      if (url) seenUrl.add(url);
      picked.push(row);
    }
  }
  return picked.sort((a, b) => a.numericId - b.numericId);
}
