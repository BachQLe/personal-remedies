/**
 * saveGate.js — Pure gating rule for whether an item can be saved to the
 * user's library (see src/state/library.js).
 *
 * Product rule: only recipes can be saved; plain food/ingredient items can
 * never be saved (ingredients were removed from the meal planner entirely,
 * so saving one is meaningless). Even a recipe can't be saved if it's
 * skull-rated (harmful) for the user's conditions — see `isHarmfulNumericId`
 * / `numericIdToTier` in src/utils/rating.js / src/api/adapter.js.
 *
 * This rule only ever blocks ADDING. An item already in the library (saved
 * before this gate existed, or saved while still valid) can always be
 * removed regardless of blockReason — see SaveButton.jsx.
 */

import { isHarmfulNumericId } from './rating.js';

/**
 * Whether an item can be saved, and why not if it can't.
 * Only recipes are saveable; a harmful (skull-rated) recipe still isn't.
 * @param {{ kind?: string, tier?: string|null, numericId?: number|null }} item
 * @returns {'ingredient' | 'harmful' | null} null means saveable.
 */
export function getSaveBlockReason(item) {
  if (item?.kind !== 'recipe') return 'ingredient';
  if (isHarmful(item)) return 'harmful';
  return null;
}

/**
 * `numericId` wins when it's a real number; `tier === 'poor'` is the
 * fallback for items carrying only `tier`.
 *
 * This fallback is LOAD-BEARING, not defensive padding: `FoodDetailCard`
 * builds its gate item as `{ kind, tier }` from an Assessment, and
 * `recipeToPlanCandidate` (adapter.js) could historically yield
 * `numericId: undefined` for a recipe whose tier wasn't one of
 * Top/Strong/Good. Since `numericIdToTier` maps descriptionNumericID 5/6/7
 * to `'poor'` and nothing else does, the two signals can never disagree —
 * the tier fallback only ever ADDS coverage, it never overrides a numericId
 * that says otherwise.
 * @param {{ tier?: string|null, numericId?: number|null }} item
 * @returns {boolean}
 */
function isHarmful(item) {
  if (Number.isFinite(item?.numericId)) return isHarmfulNumericId(item.numericId);
  return item?.tier === 'poor';
}

/** User-facing toast copy for each non-null getSaveBlockReason() value. */
export const SAVE_BLOCK_MESSAGES = {
  ingredient: 'This item is not available for save because it is an ingredient.',
  harmful: "Can't save — this one's skull-rated for your conditions.",
};

/**
 * Map a Recipe (adapter.js shape: `title`/`photo`) to the shape the library
 * (and `getSaveBlockReason`) expect (`name`/`image`). Recipes and the saved-
 * library item shape use different field names for the same data — spread
 * a raw Recipe directly into a saved item and you silently persist
 * `name: undefined, image: undefined` (nameless, imageless library rows).
 * This mapper is the one place that trap gets fixed, so every save-from-
 * recipe call site should route through it rather than hand-rolling the
 * field rename.
 * @param {import('../api/types.js').Recipe} recipe
 * @returns {{ id: number|string, name: string, image: string|null,
 *   group: null, fineGroup: null, tier: string|null, numericId: number|null,
 *   kind: 'recipe' }}
 */
export function recipeToSaveItem(recipe) {
  return {
    id: recipe.id,
    name: recipe.title,
    image: recipe.photo ?? null,
    group: null,
    fineGroup: null,
    tier: recipe.tier ?? null,
    numericId: recipe.numericId ?? null,
    kind: 'recipe',
  };
}
