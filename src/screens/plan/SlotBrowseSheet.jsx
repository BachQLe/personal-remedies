/**
 * SlotBrowseSheet — "See more" browse view for a single meal-type slot,
 * opened from `BestRecipesRails`' per-section "See more" link.
 *
 * Modeled on `CalorieGapSheet.jsx` (BottomSheet + zClass="z-[70]", 2-col grid
 * of FoodImageCards) but simpler: no calorie header, no Back/Continue footer
 * — closes via the sheet's own X/backdrop. Interaction mirrors
 * `BestRecipesRails`: tapping a card body opens the recipe detail
 * (`onSelectCard`), a separate Plus/Check pill toggles selection
 * (`onToggleSelect`), colored `bg-forest-600` when selected (matching
 * `BestRecipesRails`, not `CalorieGapSheet`'s blue).
 */

import { Plus, Check } from 'lucide-react';
import BottomSheet from '../../components/shared/BottomSheet.jsx';
import FoodImageCard from '../../components/shared/FoodImageCard.jsx';
import SaveButton from '../../components/shared/SaveButton.jsx';
import { MEAL_TYPE_META, displayTagForItem } from '../../components/shared/mealTypeMeta.jsx';

/**
 * @param {Object} props
 * @param {boolean} props.open
 * @param {string|null} props.slotKey - one of PLAN_SLOT_KEYS, or null when closed
 * @param {Array<Object>} props.pool - full (un-windowed) candidate pool for this slot
 * @param {Set<number|string>} props.selectedIds
 * @param {(item: Object) => void} props.onToggleSelect
 * @param {(item: Object) => void} props.onSelectCard
 * @param {() => void} props.onClose
 * @param {(message: string) => void} [props.onSaveBlocked] - forwarded to
 *   each card's `SaveButton`.
 */
export default function SlotBrowseSheet({
  open,
  slotKey,
  pool,
  selectedIds,
  onToggleSelect,
  onSelectCard,
  onClose,
  onSaveBlocked,
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      zClass="z-[70]"
      title={slotKey ? `${MEAL_TYPE_META[slotKey]?.label} options` : undefined}
    >
      {!pool || pool.length === 0 ? (
        <p className="font-sans text-sm text-char-500 py-4">No options yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {pool.map((item) => {
            const isSelected = selectedIds?.has(item.id);
            return (
              <div key={item.id} style={{ aspectRatio: '4/5' }}>
                <FoodImageCard
                  id={item.id}
                  mealTag={displayTagForItem(item, item.fromSlot ?? slotKey)}
                  image={item.image}
                  title={item.name}
                  subtitle={item.sourceName || item.tier || undefined}
                  numericId={item.numericId}
                  onClick={() => onSelectCard?.(item)}
                  className="w-full h-full"
                  saveAction={() => <SaveButton item={item} onBlocked={onSaveBlocked} />}
                  action={() => (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); onToggleSelect?.(item); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          onToggleSelect?.(item);
                        }
                      }}
                      aria-label={isSelected ? 'Remove from picks' : 'Add to picks'}
                      className={`tap-target w-8 h-8 rounded-full flex items-center justify-center shadow-sm
                        transition-all duration-fast active:scale-95 cursor-pointer
                        ${isSelected ? 'bg-forest-600 text-white' : 'bg-white/90 text-char-500 hover:bg-white hover:shadow-md'}`}
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
    </BottomSheet>
  );
}
