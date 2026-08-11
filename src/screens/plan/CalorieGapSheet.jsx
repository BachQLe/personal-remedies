/**
 * CalorieGapSheet — shown after "Create meal plan" when the resulting week
 * lands well under the user's estimated daily need.
 *
 * A picks-only plan caps each slot at what the user actually chose, so picking
 * lightly produces a genuinely thin day (see `pickWindow` in
 * src/api/planBuilder.js). That's allowed — this sheet just makes it visible
 * and offers a one-tap way to top it up, prioritizing the user's own saved
 * recipes. Dismissing it and living with the shortfall is a valid outcome.
 *
 * Rendered from inside MealPlannerPicker so "Back" returns to the picker with
 * every selection intact.
 */

import { useMemo } from 'react';
import { Plus, Check } from 'lucide-react';
import BottomSheet from '../../components/shared/BottomSheet.jsx';
import FoodImageCard from '../../components/shared/FoodImageCard.jsx';
import SaveButton from '../../components/shared/SaveButton.jsx';
import { estimateNutrition } from '../../data/nutritionEstimates.js';
import { displayTagForItem } from '../../components/shared/mealTypeMeta.jsx';

/**
 * @param {Object} props
 * @param {boolean} props.open
 * @param {number} props.need - estimated daily need (kcal); never null here
 * @param {number} props.total - current estimated total for today's plan day
 * @param {Array<Object>} props.suggestions - quick-add candidates, each tagged
 *   with `fromSlot` so it lands in the right slot when picked
 * @param {Set<number|string>} props.selectedIds
 * @param {(item: Object) => void} props.onToggleSelect
 * @param {() => void} props.onBack - close the sheet, stay in the picker
 * @param {() => void} props.onContinue - accept the shortfall and finish
 * @param {(message: string) => void} [props.onSaveBlocked] - forwarded to
 *   each card's `SaveButton`.
 */
export default function CalorieGapSheet({
  open,
  need,
  total,
  suggestions,
  selectedIds,
  onToggleSelect,
  onBack,
  onContinue,
  onSaveBlocked,
}) {
  const shortfall = Math.max(0, Math.round(need - total));
  const stillShort = shortfall > 0;

  const rows = useMemo(
    () =>
      suggestions.map((item) => ({
        item,
        calories: estimateNutrition(item, item.fromSlot)?.calories ?? null,
      })),
    [suggestions]
  );

  return (
    <BottomSheet open={open} onClose={onBack} zClass="z-[70]">
      <div className="flex flex-col gap-1 mb-4">
        <h2 className="font-display text-lg font-semibold text-blue-950 tracking-tightish leading-snug">
          Your meal plan does not reach sufficient calories!
        </h2>
        <p className="font-sans text-sm text-char-500">Consider adding these!</p>
      </div>

      <div className="mb-4 rounded-xl bg-paper-200 px-4 py-3">
        <p className="font-sans text-sm text-blue-950">
          {`~${Math.round(total).toLocaleString()} of ~${need.toLocaleString()} cal planned`}
        </p>
        <p className="font-sans text-xs text-char-500 mt-0.5">
          {stillShort
            ? `About ${shortfall.toLocaleString()} short — all values are estimates.`
            : 'You’ve reached your estimated need — all values are estimates.'}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="font-sans text-sm text-char-500 py-4">
          Nothing else to suggest right now — save some recipes and they’ll show up here.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {rows.map(({ item, calories }) => {
            const isSelected = selectedIds?.has(item.id);
            return (
              <div key={item.id} style={{ aspectRatio: '4/5' }}>
                <FoodImageCard
                  id={item.id}
                  image={item.image}
                  title={item.name}
                  subtitle={calories != null ? `~${calories} cal` : item.sourceName || undefined}
                  numericId={item.numericId}
                  mealTag={displayTagForItem(item, item.fromSlot)}
                  onClick={() => onToggleSelect(item)}
                  className="w-full h-full"
                  saveAction={() => <SaveButton item={item} onBlocked={onSaveBlocked} />}
                  action={() => (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect(item);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          onToggleSelect(item);
                        }
                      }}
                      aria-label={isSelected ? `Remove ${item.name}` : `Add ${item.name}`}
                      aria-pressed={!!isSelected}
                      className={`tap-target w-8 h-8 rounded-full flex items-center justify-center shadow-sm
                        transition-all duration-fast active:scale-95 cursor-pointer
                        ${isSelected ? 'bg-blue-950 text-white' : 'bg-white/90 text-char-500 hover:bg-white hover:shadow-md'}`}
                    >
                      {isSelected ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                    </span>
                  )}
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="sticky bottom-0 -mx-5 mt-4 flex items-center gap-3 bg-white px-5 pt-3 pb-1">
        <button
          onClick={onBack}
          className="flex-1 rounded-pill border border-sand-200 bg-white py-3 font-sans text-sm font-semibold
            text-blue-950 transition-all duration-fast hover:bg-paper-200 active:scale-[0.99]"
        >
          Back
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
