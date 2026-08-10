/**
 * recommendations — Ranked meal recommendations via the real Nutridigm API.
 *
 * Fetches a meal plan from buildMealPlan and transforms each food item
 * into the Recommendation shape consumed by MealprepCarousel and prefetch.
 */

import { buildMealPlan, getConditionNames, dedupeNotes, getTopDosAndDonts } from './adapter.js';
import { DEFAULT_DEV_CONDITIONS } from './config.js';
import { storage } from './storage.js';
import { getIngredientImage } from './ingredientImages.js';

/** Cap for a cleaned notes-derived blurb, matching the group-label blurb length. */
const BLURB_MAX_LEN = 90;

/**
 * Clean a raw Nutridigm `notes` string into a short, presentable blurb.
 *
 * /topdoordonts notes sometimes duplicate segments, e.g.
 * "stay hydrated; use spring or filtered water;; stay hydrated; use spring or filtered water;"
 * — split on ';', trim, drop empties, dedupe case-insensitively (via
 * adapter.js's shared `dedupeNotes`), rejoin, sentence-case the result, and
 * cap the length with an ellipsis.
 *
 * Exported for reuse by note-rendering surfaces (e.g.
 * src/screens/suggestions/TopDosTab.jsx's lifestyle rows) so the cleaning
 * logic isn't duplicated.
 *
 * @param {string} [notes]
 * @returns {string} '' if notes is empty/whitespace-only.
 */
export function cleanNotes(notes) {
  if (!notes) return '';

  const deduped = dedupeNotes(notes);

  let text = deduped.join('; ').trim();
  if (!text) return '';

  // Sentence-case: capitalize the first letter, leave the rest as-is
  // (segments may already contain proper nouns / acronyms).
  text = text.charAt(0).toUpperCase() + text.slice(1);

  if (text.length > BLURB_MAX_LEN) {
    text = text.slice(0, BLURB_MAX_LEN - 1).trimEnd() + '…';
  }

  return text;
}

/** Cached slot data for the current session. */
let _cachedSlots = null;
/** In-flight load promise, so concurrent callers (e.g. prefetch racing
 * Home's carousel) share one buildMealPlan call + post-processing pass
 * instead of each running it. */
let _loading = null;

async function loadSlots() {
  if (_cachedSlots) return _cachedSlots;
  if (_loading) return _loading;

  _loading = (async () => {
    const profile = storage.get('profile', null);
    const conditions = profile?.conditions?.length ? profile.conditions : DEFAULT_DEV_CONDITIONS;

    // buildMealPlan already retries with DEFAULT_DEV_CONDITIONS via the
    // centralized withConditionFallback helper in adapter.js — just read the
    // propagated flag instead of duplicating the retry here.
    const plan = await buildMealPlan({ ...profile, conditions });
    const usedFallback = !!plan.usedFallback;

    // Cards render matchedConditions as display chips (ConditionTag), so
    // resolve the numeric healthConditionIDs to names once here.
    const resolvedConditions = usedFallback ? DEFAULT_DEV_CONDITIONS : conditions;
    const conditionNames = await getConditionNames(resolvedConditions).catch(() => []);

    const slots = {};
    for (const meal of plan.meals) {
      const slot = meal.slot.toLowerCase();
      slots[slot] = meal.items.map((food, i) => ({
        id: `${slot}-${i + 1}`,
        foodId: food.id,
        name: food.name,
        group: food.group,
        slot,
        rank: i + 1,
        // /topdoordonts (the source of these foods) carries no tier data —
        // rank still determines card ORDER, but no fabricated 'Top'/'Strong'/
        // 'Good' label is shown. Card components must treat tier: null as
        // "no badge" rather than falling back to a default label.
        tier: null,
        referenceCount: 0,
        blurb: cleanNotes(food.notes) || food.groupLabel || undefined,
        matchedConditions: conditionNames,
        image: getIngredientImage(food.name, food.group),
      }));
    }

    _cachedSlots = slots;
    return _cachedSlots;
  })();

  try {
    return await _loading;
  } finally {
    // Clear on both success and failure: on failure this allows a retry;
    // on success `_cachedSlots` is already set, so the top-of-function
    // early return short-circuits any future calls anyway.
    _loading = null;
  }
}

/**
 * Return the ranked slice for a slot.
 * @param {'breakfast'|'lunch'|'dinner'|'snack'} slot
 * @param {number} offset
 * @param {number} [limit]
 */
export async function getRecommendations(slot, offset, limit = 3) {
  const slots = await loadSlots();
  const all = slots[slot] ?? [];
  return all.slice(offset, offset + limit);
}

/**
 * Home carousel feed — same underlying list as the Top Dos & Don'ts "Do"
 * tab (getTopDosAndDonts(profile, 'consume')), so the home carousel and
 * Dietary Guidance stay consistent: both keep lifestyle/non-food items
 * (flagged via `isLifestyle`), unlike getRecommendations above which is
 * food-only. Returns raw Food-shaped items ({ id, name, group, fineGroup,
 * notes, isLifestyle, rank, groupLabel, ... }) — no `tier` field, and no
 * card-shape mapping here; callers adapt to their own card shape.
 *
 * @param {import('./types.js').Profile} profile
 * @param {number} [limit=8]
 * @returns {Promise<import('./types.js').Food[]>}
 */
export async function getHomeRecommendations(profile, limit = 8) {
  const { items } = await getTopDosAndDonts(profile, 'consume');
  return items.slice(0, limit);
}
