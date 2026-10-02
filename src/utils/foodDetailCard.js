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
 *
 * Exported (Track 1D, in-app recipe preview sheet) so
 * `resolveRecipePreview` below and `RecipeLinkSheet.jsx` can show the same
 * hostname text independently of `resolveRecipeLinkTarget`'s label string.
 * @param {string} url
 * @returns {string}
 */
export function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Decide where the recipe "open recipe" CTA links out to, and what it's
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
    label: 'Open recipe',
    isSource: false,
  };
}

/**
 * Build the display model for `RecipeLinkSheet.jsx` — the in-app preview
 * shown before the hand-off button, since medlineplus.gov (the only recipe
 * source) sends `x-frame-options: SAMEORIGIN` + `frame-ancestors 'self'`
 * and can never be framed.
 *
 * Pure and reuses `resolveRecipeLinkTarget` for the url/isSource decision
 * (never re-derives it) so the sheet and the CTA it's opened from can never
 * disagree about where the hand-off goes.
 *
 * `calories` reads `item.nutritionPerServing.calories` DIRECTLY — never
 * `resolveNutrition()`/`estimateNutrition()` (src/api/nutrition.js,
 * src/data/nutritionEstimates.js), which fall through to USDA and then to
 * group estimates. Fabricating a recipe calorie number from an estimate is
 * forbidden (REMEDI_MASTER_PLAN.md's calorie-provenance rule) — a recipe
 * with no transcribed source number shows `calories: null`, not a guess,
 * even when its `fineGroup` is one `estimateNutrition` could otherwise
 * produce a number for.
 *
 * `body`/`showHostname` carry the "Leaving Remedi" panel copy so the
 * component never has to branch on `isSource` itself (house convention —
 * copy decisions live in the pure resolver, not the JSX). When `isSource`
 * is false (no real `sourceUrl`, the Google-search fallback), the old copy
 * — "Directions are hosted by google.com." — was a false claim: Google
 * isn't hosting the recipe, it's just where we're sending the user to look
 * for it. That case gets honest copy instead ("We don't have a source link
 * for this recipe yet — search the web for it.") with no hostname caption
 * (`showHostname: false`), since there's no real host to name.
 * @param {Object} item - `{ name?, image?, sourceUrl?, attribution?,
 *   sourceName?, nutritionPerServing?: { calories?: number } }`
 * @returns {{
 *   title: string,
 *   image: string|null,
 *   calories: number|null,
 *   attribution: string,
 *   hostname: string,
 *   url: string,
 *   isSource: boolean,
 *   ctaLabel: string,
 *   eyebrow: string,
 *   body: string,
 *   showHostname: boolean,
 * }}
 */
export function resolveRecipePreview(item) {
  const target = resolveRecipeLinkTarget(item);
  const hostname = hostnameFromUrl(target.url);
  const calories = Number.isFinite(item?.nutritionPerServing?.calories)
    ? item.nutritionPerServing.calories
    : null;
  const attribution = item?.attribution || hostname;

  return {
    title: item?.name ?? '',
    image: item?.image ?? null,
    calories,
    attribution,
    hostname,
    url: target.url,
    isSource: target.isSource,
    ctaLabel: target.isSource ? `Open at ${hostname}` : 'Search for this recipe',
    eyebrow: 'Leaving Remedi',
    body: target.isSource
      ? `Directions are hosted by ${attribution}.`
      : "We don't have a source link for this recipe yet — search the web for it.",
    showHostname: target.isSource,
  };
}

/**
 * Bucket a food/recipe's per-condition assessment rows into three verdict
 * groups for the front face's "Best for:" chip row. Replaces the old
 * single-line, tier-filtered list (`tier === 'Top'/'Strong'/'Good'` only)
 * that silently dropped every other condition in the user's profile —
 * every entry in `perCondition` lands in exactly one bucket here, none are
 * dropped. Buckets by the RAW per-condition `numericId` (not `tier`, which
 * collapses 4 → null and can't distinguish a genuine "neutral" verdict from
 * "no data" — see rating.js's header for why the ladder is discrete):
 *   - `helps`   — numericId 1-3 (positive verdict)
 *   - `neutral` — numericId 4, or no numericId at all (missing/out-of-range
 *     reads the same as neutral here: neither is a reason to avoid)
 *   - `avoid`   — numericId 5-7 (harmful verdict)
 * Within each bucket, conditions with more supporting studies sort first
 * (the "more evidence first" ordering the old single-line list also used).
 * @param {Array<{conditionName?: string, numericId?: number|null, referenceCount?: number}>} perCondition
 * @returns {{ helps: string[], neutral: string[], avoid: string[] }}
 */
export function groupConditionsByVerdict(perCondition) {
  const byEvidence = (a, b) => (b.referenceCount ?? 0) - (a.referenceCount ?? 0);
  const helpsRows = [];
  const neutralRows = [];
  const avoidRows = [];

  for (const c of perCondition || []) {
    if (!c?.conditionName) continue;
    const id = c.numericId;
    if (id >= 1 && id <= 3) helpsRows.push(c);
    else if (id >= 5 && id <= 7) avoidRows.push(c);
    else neutralRows.push(c); // 4, null/undefined, or out-of-range
  }

  return {
    helps: helpsRows.sort(byEvidence).map((c) => c.conditionName),
    neutral: neutralRows.sort(byEvidence).map((c) => c.conditionName),
    avoid: avoidRows.sort(byEvidence).map((c) => c.conditionName),
  };
}

/**
 * Order the three verdict groups (from `groupConditionsByVerdict`) for
 * display, dropping any that are empty. Default order is
 * Helps → Neutral → Avoid for; when `listType` is `'harmful'` (the food was
 * opened from an "Avoid" category list), "Avoid for" leads instead — that's
 * the reason the user is looking at this item in the first place.
 * @param {{ helps: string[], neutral: string[], avoid: string[] }} grouped
 * @param {'helpful'|'harmful'} [listType]
 * @returns {Array<{ key: string, label: string, names: string[] }>} Non-empty
 *   groups only, in display order.
 */
export function orderVerdictGroups(grouped, listType) {
  const helps = { key: 'helps', label: 'Helps:', names: grouped?.helps || [] };
  const neutral = { key: 'neutral', label: 'Neutral:', names: grouped?.neutral || [] };
  const avoid = { key: 'avoid', label: 'Avoid for:', names: grouped?.avoid || [] };
  const ordered = listType === 'harmful' ? [avoid, helps, neutral] : [helps, neutral, avoid];
  return ordered.filter((g) => g.names.length > 0);
}

/**
 * Classify a settled `assessFood()` outcome into the back face's status
 * matrix (Task #4) — the fix for FoodDetailCard's old blanket
 * `.catch(() => null)`, which rendered a genuine empty result, an API
 * error, and a hung/timed-out request as the exact same "No data for this
 * item" state. Pure and takes the already-settled outcome (rather than a
 * promise) so it's testable without touching the network or a real timer.
 * @param {{ ok: boolean, value?: {perCondition?: Array}|null }} settled -
 *   `{ ok: true, value }` for a resolved `assessFood()` call (`value` may
 *   itself be null — a genuine "nothing for this pairing" response), or
 *   `{ ok: false }` for a rejected one (network error, or the 15s timeout
 *   race in FoodDetailCard's load effect).
 * @returns {'success'|'empty'|'error'}
 */
export function deriveAssessStatus(settled) {
  if (!settled?.ok) return 'error';
  const perCondition = settled.value?.perCondition;
  return Array.isArray(perCondition) && perCondition.length > 0 ? 'success' : 'empty';
}
