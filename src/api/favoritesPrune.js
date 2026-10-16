/**
 * favoritesPrune.js — condition-change pruning of My Favorites, saved days and
 * saved weeks (checklist 1.26 / 3.4).
 *
 * A guidance-changing profile edit wipes the live plan (planBuilder.js) but
 * must NOT wipe the user's own collections — only recipes that are newly
 * low-ranked for the new profile come out, after the UI has shown a notice.
 * Flow the UI follows:
 *   1. profileSync calls `markFavoritesPrunePending()` on the change.
 *   2. UI sees `isFavoritesPrunePending()`, calls `findRecipesToPrune(profile)`.
 *      `{ ok: false }` (scoring unreachable) -> keep the flag, offer retry.
 *   3. UI lists `result.recipes` in a notice, then `applyFavoritesPrune(result,
 *      profile)`, which clears the flag.
 * While the flag is set, generation and loading saved days/weeks refuse
 * (planBuilder.js), so a stale, possibly low-ranked recipe can't re-enter a plan.
 *
 * Saved days/weeks are device-local (not synced); the library syncs through
 * profileSync's normal `library` write hook.
 */

import { getRecipes, getConditionNames } from './adapter.js';
import { storage } from './storage.js';
import { SAVED_PLANS_KEY, SAVED_DAYS_KEY } from './config.js';
import { getLibrary, reloadLibrary } from '../state/library.js';
import { isHarmfulNumericId } from '../utils/rating.js';

const PENDING_KEY = 'favoritesPrunePending';
// library.js keeps its key private; profileSync.js uses the same literal.
const LIBRARY_KEY = 'library';

export function markFavoritesPrunePending() {
  storage.set(PENDING_KEY, true);
}

/** @returns {boolean} true while a profile change is waiting on `applyFavoritesPrune`. */
export function isFavoritesPrunePending() {
  return storage.get(PENDING_KEY, false) === true;
}

const readList = (key) => {
  const value = storage.get(key, []);
  return Array.isArray(value) ? value : [];
};

/** Apply `fn` to every slot's item array in a `{ slotKey: items[] }` map. */
const mapSlots = (slots, fn) =>
  Object.fromEntries(Object.entries(slots ?? {}).map(([key, items]) => [key, fn(items)]));

/** Every stored item that a prune could remove: favorites, saved-day items, saved-week items + picks. */
function storedItems() {
  const flat = (slots) => Object.values(slots ?? {}).flat();
  return [
    ...getLibrary(),
    ...readList(SAVED_DAYS_KEY).flatMap((day) => flat(day.slots)),
    ...readList(SAVED_PLANS_KEY).flatMap(({ plan }) => [
      ...flat(plan?.picksBySlot),
      ...Object.values(plan?.days ?? {}).flatMap((day) => flat(day.slots)),
    ]),
  ];
}

/**
 * Re-score for the (new) profile and list the stored recipes that are now
 * low-ranked (`isHarmfulNumericId`, the rule `getSaveBlockReason` calls
 * 'harmful'). Recipes the new scoring does not mention (or leaves unscored) are kept. A profile with no / unscorable conditions
 * has nothing scored, so nothing is prunable.
 * @param {import('./types.js').Profile} profile
 * @returns {Promise<{ ok: true, recipes: Array<{ id: number|string, name: string }>,
 *   scores: Object<string, { numericId: number|null, tier: string|null }> } | { ok: false }>}
 *   `ok: false` means scoring could not be fetched — NEVER read that as "nothing to remove".
 */
export async function findRecipesToPrune(profile) {
  let recipes;
  try {
    ({ recipes } = await getRecipes(profile));
  } catch {
    return { ok: false };
  }

  const scores = {};
  const lowRanked = new Set();
  for (const recipe of recipes ?? []) {
    if (!Number.isFinite(recipe.numericId)) continue; // unscored = not mentioned -> kept as-is
    scores[recipe.id] = { numericId: recipe.numericId, tier: recipe.tier ?? null };
    if (isHarmfulNumericId(recipe.numericId)) lowRanked.add(String(recipe.id));
  }

  const found = new Map();
  for (const item of storedItems()) {
    const key = String(item.id);
    if (lowRanked.has(key) && !found.has(key)) found.set(key, { id: item.id, name: item.name });
  }
  return { ok: true, recipes: [...found.values()], scores };
}

/**
 * Remove exactly `result.recipes` from the library, every saved day and every
 * saved week (days' slots and `picksBySlot`); refresh `numericId`/`tier` on the
 * surviving favorites from the new scores; re-stamp each saved week's
 * `conditionsKey`/`conditionNames` for `profile` (else `ensurePlanForWeek`
 * would discard a loaded week as "built for other conditions"); clear the
 * pending flag. Removing nothing still does all of that. No-op
 * (`{ ok: false }`, flag kept) if handed a failed `findRecipesToPrune` result.
 * @param {Awaited<ReturnType<typeof findRecipesToPrune>>} result
 * @param {import('./types.js').Profile} profile
 * @returns {Promise<{ ok: boolean }>}
 */
export async function applyFavoritesPrune(result, profile) {
  if (!result?.ok) return { ok: false };

  const gone = new Set(result.recipes.map((r) => String(r.id)));
  const keep = (items) => (Array.isArray(items) ? items.filter((item) => !gone.has(String(item.id))) : items);
  const conditions = profile?.conditions || [];
  const conditionsKey = conditions.join(',');
  const conditionNames = await getConditionNames(conditions);

  // One write (not removeFromLibrary per id) so the same pass can refresh scores.
  const refresh = (item) => (result.scores?.[item.id] ? { ...item, ...result.scores[item.id] } : item);
  storage.set(LIBRARY_KEY, keep(getLibrary()).map(refresh));
  reloadLibrary();

  storage.set(
    SAVED_DAYS_KEY,
    readList(SAVED_DAYS_KEY).map((day) => ({ ...day, slots: mapSlots(day.slots, keep) }))
  );

  storage.set(
    SAVED_PLANS_KEY,
    readList(SAVED_PLANS_KEY).map((week) => {
      const { plan } = week;
      if (!plan) return week;
      const days = Object.fromEntries(
        Object.entries(plan.days ?? {}).map(([key, day]) => [key, { ...day, slots: mapSlots(day.slots, keep) }])
      );
      const picks = plan.picksBySlot ? { picksBySlot: mapSlots(plan.picksBySlot, keep) } : {};
      return { ...week, plan: { ...plan, conditionsKey, conditionNames, days, ...picks } };
    })
  );

  storage.remove(PENDING_KEY);
  return { ok: true };
}
