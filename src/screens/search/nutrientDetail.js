import { getNutrientAmount, getNutrientMeta, formatAmount } from '../../api/nutrientFacts.js';

/**
 * The direct answer for a nutrient query ("calcium in milk") shown on a food
 * row: real USDA amount per serving + per 100 g, or an honest "no data".
 * @param {string|undefined} nutrientKey
 * @param {{id:number}} food
 * @returns {string|null}
 */
export function nutrientDetail(nutrientKey, food) {
  if (!nutrientKey) return null;
  const meta = getNutrientMeta(nutrientKey);
  const amt = getNutrientAmount(food.id, nutrientKey);
  if (!amt) return `${meta.label}: no USDA data`;
  const parts = [];
  if (amt.per100g != null) parts.push(`${formatAmount(amt.per100g)} ${amt.unit} per 100 g`);
  if (amt.perServing != null) {
    parts.push(`${formatAmount(amt.perServing)} ${amt.unit} per serving${amt.serving?.label ? ` (${amt.serving.label})` : ''}`);
  }
  return `${meta.label}: ${parts.join(' · ')}`;
}

/**
 * For "calcium in milk": whole-word name matches first, then foods that have
 * real USDA data for the nutrient (stable otherwise, so the dictionary order
 * is kept within each tier).
 */
export function sortForNutrientQuery(foods, parsed) {
  const word = new RegExp(`\\b${parsed.food.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:e?s)?\\b`, 'i');
  const isWord = (r) => word.test(r.food.name);
  // The group holding most whole-word matches is the "plain" food (dairy for
  // "milk"), so cow's milk outranks coconut milk and milk crackers.
  const counts = {};
  for (const r of foods) if (isWord(r)) counts[r.food.fineGroup] = (counts[r.food.fineGroup] || 0) + 1;
  const dominant = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  const exact = parsed.food.toLowerCase();
  const tier = (r) =>
    (isWord(r) ? 0 : 8) +
    (r.food.name.toLowerCase() === exact ? 0 : 4) +
    (r.food.fineGroup === dominant ? 0 : 2) +
    (getNutrientAmount(r.food.id, parsed.nutrient) ? 0 : 1);
  return foods.map((r, i) => [r, i]).sort((a, b) => tier(a[0]) - tier(b[0]) || a[1] - b[1]).map(([r]) => r);
}
