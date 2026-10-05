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

import { EXCLUDED_FINE_GROUPS } from '../api/config.js';

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
    // Unscorable rows (unauthorized/nodata/error) are not a verdict — omit from chips.
    if (c.status != null && c.status !== 'ok') continue;
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
  const helps = { key: 'helps', label: 'Ranked favorably for:', names: grouped?.helps || [] };
  const neutral = { key: 'neutral', label: 'Neutral:', names: grouped?.neutral || [] };
  const avoid = { key: 'avoid', label: 'Ranked lower for:', names: grouped?.avoid || [] };
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

/**
 * Resolve the plain-FOOD "other options" link target: this item's own fine
 * food group's Suggest page (`/app/suggestions/fine/:code`) when that code
 * resolves to something real and useful, else the coarse group's existing
 * page (`/app/suggestions/group/:code`), else no link at all.
 *
 * Fine wins over coarse UNLESS it's one of `EXCLUDED_FINE_GROUPS`
 * ('x'/'j1' lifestyle codes, plus every recipe's blanket 'l' — recipes
 * never reach this function at all, see `mealTypeToRecipesHref` below for
 * their own link, but 'l' is excluded here too for any plain-food item that
 * somehow carries it) — those codes are too generic to deep-link into, so
 * the coarse parent is used instead.
 *
 * `fineGroup`/`group` resolution mirrors the non-food icon lookup further
 * down this file EXACTLY: assessment's own Food (fresh off the /fooditems
 * dictionary) wins, then `facts` (getFoodFacts — which per that same
 * comment does NOT currently return these fields, so this layer is inert
 * until/unless that adapter export changes), then whatever the caller
 * already seeded on `item` (e.g. GroupDetailScreen passing through the
 * coarse group it's already browsing). Kept as its own function (duplicating
 * that lookup) rather than sharing one computation, because this one feeds
 * an effect that must be declared before this component's
 * `if (!open || !item) return null` early return, while the icon lookup is
 * a plain render-time expression after it.
 *
 * Deliberately independent of `topFoodsForConditions` (the rail rendered
 * just above this link) — that rail is gated on a DIFFERENT signal (the
 * /topdoordonts companions list) and can be empty while a perfectly good
 * group still resolves here, or vice versa. See the render site for why
 * this link is its own block rather than nested inside that rail's `&&`.
 *
 * @param {Object|null} item
 * @param {Object|null} facts
 * @param {Object|null} assessment
 * @returns {{ path: string, code: string, kind: 'fine'|'coarse' } | null}
 */
export function resolveGroupLinkTarget(item, facts, assessment) {
  const fineGroup = assessment?.food?.fineGroup ?? facts?.fineGroup ?? item?.fineGroup ?? null;
  const group = assessment?.food?.group ?? facts?.group ?? item?.group ?? null;

  if (fineGroup && !EXCLUDED_FINE_GROUPS.includes(fineGroup)) {
    return { path: `/app/suggestions/fine/${fineGroup}`, code: fineGroup, kind: 'fine' };
  }
  if (group) {
    return { path: `/app/suggestions/group/${group}`, code: group, kind: 'coarse' };
  }
  return null;
}

/**
 * Resolve a recipe's raw `mealType` (lowercase: breakfast/lunch/dinner/
 * snack/dessert/beverage — recipeIngestion.js's MEAL_TYPES) to the recipe
 * browser link its "other options" button should open: `/app/recipes`
 * pre-filtered to the matching tab via `?meal=`.
 *
 * `dessert` maps to the `Snack` tab, not a `Dessert` tab — there isn't one;
 * RecipesScreen's Snack tab deliberately shows snack AND dessert recipes
 * together (Task C1). `beverage` has no tab at all and, like a
 * missing/unrecognized mealType, falls back to a plain unfiltered
 * `/app/recipes` link rather than guessing one.
 *
 * @param {string|undefined|null} mealType
 * @returns {string}
 */
export function mealTypeToRecipesHref(mealType) {
  const lower = mealType?.toLowerCase?.();
  if (!lower) return '/app/recipes';
  if (lower === 'dessert') return '/app/recipes?meal=Snack';
  const match = RECIPE_MEAL_LABELS.find((label) => label.toLowerCase() === lower);
  return match ? `/app/recipes?meal=${match}` : '/app/recipes';
}

const RECIPE_MEAL_LABELS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
