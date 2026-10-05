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
 * A third reason, 'unscored' (Task T2C), blocks a recipe the live Nutridigm
 * API has never scored at all — no finite numericId AND no tier. See Track B
 * item 2 in REMEDI_MASTER_PLAN.md: the app's entire safety model runs off
 * numericId (adapter.js pre-filters plan candidates to numericId 1-4; this
 * file skull-blocks 5-7), so a recipe the API hasn't rated must be treated
 * as unknown, never as "safe by default." This matters most for the C1
 * content overlay (src/api/recipeIngestion.js) — an overlay row never
 * carries a numericId/tier (see `RecipeOverlayRow` in types.js), so without
 * this check a recipe whose overlay content exists but whose API scoring
 * doesn't (or hasn't loaded) would reach `recipeToSaveItem` as
 * `numericId: null, tier: null` and silently pass the gate. A July-2026
 * probe (P3) found today's live recipes are 100% scored 2-3, so this closes
 * a real hole with zero practical regression right now.
 *
 * This rule only ever blocks ADDING. An item already in the library (saved
 * before this gate existed, or saved while still valid) can always be
 * removed regardless of blockReason — see SaveButton.jsx.
 */

import { isHarmfulNumericId } from './rating.js';

/**
 * Whether an item can be saved, and why not if it can't.
 * Only recipes are saveable; a harmful (skull-rated) recipe still isn't,
 * and neither is one the API has never scored at all. Order matters:
 * 'ingredient' short-circuits before either score check runs, and
 * 'harmful' is checked before 'unscored' so a recipe carrying both a
 * harmful tier/numericId and (inconsistently) a missing counterpart is
 * always reported as the more serious 'harmful'.
 * @param {{ kind?: string, tier?: string|null, numericId?: number|null }} item
 * @returns {'ingredient' | 'harmful' | 'unscored' | null} null means saveable.
 */
export function getSaveBlockReason(item) {
  if (item?.kind !== 'recipe') return 'ingredient';
  if (isHarmful(item)) return 'harmful';
  if (isUnscored(item)) return 'unscored';
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

/**
 * True when an item carries NEITHER a finite numericId NOR a tier — i.e.
 * the live API has never scored it at all, as distinct from having scored
 * it neutral (numericId 4 maps to `tier: null` too — see `TierOrPoor` in
 * types.js — so this checks numericId's absence specifically, not just a
 * null tier). Loose `== null` deliberately covers both `null` and
 * `undefined`, since `recipeToSaveItem` normalizes to `null` but a raw
 * Recipe/PlanCandidate object may simply omit the field.
 * @param {{ tier?: string|null, numericId?: number|null }} item
 * @returns {boolean}
 */
function isUnscored(item) {
  return !Number.isFinite(item?.numericId) && item?.tier == null;
}

/** User-facing toast copy for each non-null getSaveBlockReason() value. */
export const SAVE_BLOCK_MESSAGES = {
  ingredient: 'This item is not available for save because it is an ingredient.',
  harmful: "Can't save — this one is ranked low for your conditions.",
  unscored: "Can't save yet — this recipe hasn't been rated for your conditions.",
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
