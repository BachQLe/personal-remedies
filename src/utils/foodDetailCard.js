/**
 * foodDetailCard.js — pure helpers extracted from
 * src/components/FoodDetailCard.jsx (Task T4B).
 *
 * Split into their own file (rather than defined/exported inline in
 * FoodDetailCard.jsx) for two reasons:
 *   1. eslint's react-refresh/only-export-components rule flags a component
 *      file that also exports plain functions — fast refresh only works
 *      cleanly when a file exports components exclusively.
 *   2. This codebase has no @testing-library/react-style render harness
 *      (see vitest.config.js) — component logic worth guarding gets pulled
 *      out into plain functions like these and unit-tested directly
 *      instead of through a DOM render.
 */

/**
 * Decide whether an `item` handed to FoodDetailCard is a recipe or a plain
 * food/lifestyle entry. `item.isRecipe` (explicitly set by every screen
 * that seeds a recipe — RecipesScreen, SearchScreen, SuggestionsScreen,
 * MealQueueScreen, MealPlannerPicker, MealprepCarousel) always wins when
 * present. The fallback below only matters for the handful of call sites
 * that seed a bare `{ foodId, name }` food with no `isRecipe` at all
 * (GroupDetailScreen, SuggestionsScreen's Top Dos & Don'ts/Food Groups
 * tabs, SearchScreen's `openFood`) — none of those carry `kind`/
 * `sourceName`, so the fallback correctly resolves false for them.
 *
 * Deliberately does NOT look at `.ingredients` (the legacy alias
 * recipeDetail.js used to dual-publish) — that field is gone now, and
 * `.topFoodsForConditions` was never a reliable recipe/food signal anyway
 * (buildRecipeDetail populates it for plain foods too, see
 * MealprepCarousel's `isRecipe: false` override).
 * @param {Object} item
 * @returns {boolean}
 */
export function resolveIsRecipe(item) {
  if (!item) return false;
  if (item.isRecipe != null) return !!item.isRecipe;
  if (item.kind === 'recipe') return true;
  if (item.kind === 'food') return false;
  if (item.mealType) return true; // Recipe-only field (Breakfast/Lunch/...)
  return !!item.sourceName;
}

/**
 * Best-effort hostname for display (e.g. "medlineplus.gov"), stripped of a
 * leading "www.". Falls back to the raw url string if it isn't parseable
 * (never throws — this only feeds a button label).
 * @param {string} url
 * @returns {string}
 */
function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Decide where the recipe "get the recipe" CTA links out to, and what it's
 * labeled. `sourceUrl` (real C1 overlay content, public-domain attribution
 * required) always wins over the Google-search fallback — never shown as
 * equals. The attribution text is embedded directly in the label so it's
 * always visible whenever the button is (satisfies the public-domain
 * attribution requirement without a second UI element).
 * @param {Object} item - `{ sourceUrl?, attribution?, name?, sourceName? }`
 * @returns {{ url: string, label: string, isSource: boolean }}
 */
export function resolveRecipeLinkTarget(item) {
  if (item?.sourceUrl) {
    const attribution = item.attribution || hostnameFromUrl(item.sourceUrl);
    return { url: item.sourceUrl, label: `View recipe at ${attribution}`, isSource: true };
  }
  const query = `${item?.name ?? ''} ${item?.sourceName || 'Food Network'} recipe`.trim();
  return {
    url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    label: 'Get the recipe',
    isSource: false,
  };
}
