/**
 * recommendations — Daily Picks data via the real Nutridigm API.
 *
 * Fetches a meal plan from buildMealPlan and transforms each food item
 * into the Recommendation shape the Daily Picks screen expects.
 */

import { buildMealPlan, getConditionNames } from './adapter.js';
import { DEFAULT_DEV_CONDITIONS } from './config.js';
import { storage } from './storage.js';
import { getIngredientImage } from './ingredientImages.js';

const PLAN_KEY = 'dailyPlan';

/** Cap for a cleaned notes-derived blurb, matching the group-label blurb length. */
const BLURB_MAX_LEN = 90;

/**
 * Clean a raw Nutridigm `notes` string into a short, presentable blurb.
 *
 * /topdoordonts notes sometimes duplicate segments, e.g.
 * "stay hydrated; use spring or filtered water;; stay hydrated; use spring or filtered water;"
 * — split on ';', trim, drop empties, dedupe (case-insensitive), rejoin, sentence-case
 * the result, and cap the length with an ellipsis.
 *
 * Exported for reuse by note-rendering surfaces (e.g. the Top Dos & Don'ts
 * screen's lifestyle rows) so the cleaning logic isn't duplicated.
 *
 * @param {string} [notes]
 * @returns {string} '' if notes is empty/whitespace-only.
 */
export function cleanNotes(notes) {
  if (!notes) return '';

  const segments = notes
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set();
  const deduped = [];
  for (const seg of segments) {
    const key = seg.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(seg);
    }
  }

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
/** True when the last load fell back to DEFAULT_DEV_CONDITIONS. */
let _usedFallback = false;

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

    _usedFallback = usedFallback;
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

/** True if the most recently loaded plan used the demo fallback conditions. */
export function getUsedFallback() {
  return _usedFallback;
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

/** How many ranked options exist for a slot. */
export function getSlotCount(slot) {
  return _cachedSlots?.[slot]?.length ?? 0;
}

/** Persist the user's accepted picks to the browser. */
export async function saveDailyPlan(selections) {
  const plan = { date: new Date().toISOString().split('T')[0], selections };
  storage.set(PLAN_KEY, plan);
  return plan;
}

/** Load a previously saved Daily Picks plan. */
export async function getDailyPlan() {
  return storage.get(PLAN_KEY, null);
}
