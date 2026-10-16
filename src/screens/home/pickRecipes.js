/**
 * pickRecipes — Home's recipe selection (checklist 4.19). Pure: (items, rng) →
 * an ordered subset, so it is testable with a seeded rng.
 *
 * Recipes only, and only numericId 1–4 (1 best … 4 neutral); anything harmful
 * (5–7) or unscored never qualifies. Each recipe's weight is `5 - numericId`
 * (best 4 : neutral 1), drawn without replacement (Efraimidis–Spirakis keys,
 * `rng() ** (1 / weight)`), so a better match is likelier to be shown AND
 * likelier to be shown first. The number itself is never rendered.
 *
 * @param {Array<{ id: *, kind?: string, numericId?: number }>} items
 * @param {() => number} [rng] - uniform [0, 1); defaults to Math.random.
 * @param {number} [count]
 */
export function pickRecipes(items, rng = Math.random, count = 6) {
  const seen = new Set();
  return items
    .filter((item) => {
      if (item.kind !== 'recipe' || !(item.numericId >= 1 && item.numericId <= 4) || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .map((item) => ({ item, key: rng() ** (1 / (5 - item.numericId)) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, count)
    .map(({ item }) => item);
}
