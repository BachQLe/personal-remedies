/**
 * CalorieGapSheet — shown after "Create meal plan" when the resulting week
 * lands well under the user's estimated daily need.
 *
 * A picks-only plan caps each slot at what the user actually chose, so picking
 * lightly produces a genuinely thin day (see `pickWindow` in
 * src/api/planBuilder.js). That's allowed — this sheet just makes it visible
 * and offers two explicit next steps. Dismissing it and living with the
 * shortfall is a valid outcome.
 *
 * Task 9 (2026-09): this used to render an inline, uncapped-feeling grid of
 * quick-add `FoodImageCard`s below the summary (a second picker stacked on
 * top of the picker) plus a plain "Back" button. That's replaced with two
 * explicit choices matching this sheet's real job — accept the shortfall, or
 * go get more choices from the full Recipes catalog:
 *   - "Continue anyway" (`onContinue`) — unchanged, accepts the shortfall.
 *   - "Choose more recipes" (`onChooseMore`) — navigates to /app/recipes
 *     (RecipesScreen) instead of returning to the picker's own rails.
 * Tapping the sheet's own X/backdrop (`onClose`) just dismisses it and
 * returns to the picker with every selection intact — the old "Back"
 * button's behavior, now implicit rather than a labeled footer action.
 *
 * Still the SAME single trigger point as before (`MealPlannerPicker`'s
 * `handleCreatePlan`, once, right after plan creation) — only this sheet's
 * body changed, not when/how often it fires. See the project rule: the gap
 * sheet fires ONCE at plan creation only, never a running/continuous tally.
 *
 * Rendered from inside MealPlannerPicker so `onClose` returns to the picker
 * with every selection intact.
 */

import BottomSheet from '../../components/shared/BottomSheet.jsx';

/**
 * @param {Object} props
 * @param {boolean} props.open
 * @param {number} props.need - estimated daily need (kcal); never null here
 * @param {number} props.total - current estimated total for today's plan day
 * @param {() => void} props.onClose - dismiss the sheet, stay in the picker
 * @param {() => void} props.onContinue - accept the shortfall and finish
 * @param {() => void} props.onChooseMore - go pick more recipes (navigates to /app/recipes)
 */
export default function CalorieGapSheet({
  open,
  need,
  total,
  onClose,
  onContinue,
  onChooseMore,
}) {
  const shortfall = Math.max(0, Math.round(need - total));
  const stillShort = shortfall > 0;

  return (
    <BottomSheet open={open} onClose={onClose} zClass="z-[70]">
      <div className="flex flex-col gap-1 mb-4">
        <h2 className="font-display text-lg font-semibold text-blue-950 tracking-tightish leading-snug">
          My meal plan doesn't reach enough calories
        </h2>
        <p className="font-sans text-sm text-char-500">What would you like to do?</p>
      </div>

      <div className="mb-2 rounded-xl bg-paper-200 px-4 py-3">
        <p className="font-sans text-sm text-blue-950">
          {`~${Math.round(total).toLocaleString()} of ~${need.toLocaleString()} cal planned`}
        </p>
        <p className="font-sans text-xs text-char-500 mt-0.5">
          {stillShort
            ? `About ${shortfall.toLocaleString()} short — all values are estimates.`
            : 'You’ve reached your estimated need — all values are estimates.'}
        </p>
      </div>

      <div className="sticky bottom-0 -mx-5 mt-4 flex items-center gap-3 bg-white px-5 pt-3 pb-1">
        <button
          onClick={onChooseMore}
          className="flex-1 rounded-pill border border-sand-200 bg-white py-3 font-sans text-sm font-semibold
            text-blue-950 transition-all duration-fast hover:bg-paper-200 active:scale-[0.99]"
        >
          Choose more recipes
        </button>
        <button
          onClick={onContinue}
          className="flex-1 rounded-pill bg-blue-950 py-3 font-sans text-sm font-semibold text-white
            transition-all duration-fast hover:bg-blue-900 active:scale-[0.99]"
        >
          Continue anyway
        </button>
      </div>
    </BottomSheet>
  );
}
