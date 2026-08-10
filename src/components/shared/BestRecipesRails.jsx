/**
 * BestRecipesRails — shared "5 meal-type carousels" layout.
 *
 * Stacked sections (Breakfast → Beverages, `PLAN_SLOTS` order), each a
 * `<MealTypeTag>` + label header over a horizontal snap rail of
 * `FoodImageCard`s. Reused by `MealPlannerPicker.jsx` (the "New meal plan"
 * recipe picker, selectable) and `SuggestionsScreen.jsx`'s Best Recipes tab
 * (read-only) — one carousel implementation, not two hand-rolled ones.
 *
 * Honesty rule: a slot with an empty pool renders a small muted "No options
 * yet" line under its header — never a fabricated/placeholder card.
 */

import { Plus, Check, ChevronRight } from 'lucide-react';
import FoodImageCard from './FoodImageCard.jsx';
import SaveButton from './SaveButton.jsx';
import MealTypeTag, { displayTagForItem } from './mealTypeMeta.jsx';
import { PLAN_SLOTS } from '../../api/config.js';

/**
 * @param {Object} props
 * @param {Record<string, import('../../api/types.js').PlanCandidate[]>} props.candidatesBySlot -
 *   slot key → ranked candidate pool (may be empty per slot).
 * @param {(item: Object) => void} [props.onSelectCard] - tapping a card body
 *   (not the "+" toggle).
 * @param {Set<number|string>} [props.selectedIds] - ids currently picked;
 *   only consulted when `showAdd` is true.
 * @param {(item: Object) => void} [props.onToggleSelect] - toggles a card's
 *   picked state; only wired when `showAdd` is true.
 * @param {boolean} [props.showAdd] - render the selectable "+"/check toggle.
 * @param {string} [props.edgeFadeClass] - bg class for the edge-fade bars,
 *   matching the surface this rail sits on (default cream `bg-paper-100`).
 * @param {boolean} [props.showScrollbar] - render a visible scrollbar beneath
 *   each rail (see `.rail-scrollbar` in index.css). Off by default — the rails
 *   read as touch-swipe carousels on mobile — but on a pointer device that bar
 *   is the only obvious way to get through a 12-card pool.
 * @param {(slotKey: string) => void} [props.onSeeMore] - shows a "See more"
 *   link in a slot's header (only when its pool is non-empty) that opens a
 *   full browse view for that slot.
 * @param {(message: string) => void} [props.onSaveBlocked] - forwarded to
 *   every card's `SaveButton`; the consuming screen routes this into its own
 *   snackbar.
 */
export default function BestRecipesRails({
  candidatesBySlot,
  onSelectCard,
  selectedIds,
  onToggleSelect,
  showAdd = false,
  edgeFadeClass = 'bg-paper-100',
  showScrollbar = false,
  onSeeMore,
  onSaveBlocked,
}) {
  return (
    <div className="flex flex-col gap-6">
      {PLAN_SLOTS.map((slot) => {
        const pool = candidatesBySlot?.[slot.key] || [];

        return (
          <section key={slot.key}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MealTypeTag mealKey={slot.key} />
                <p className="font-display text-sm font-semibold text-char-900">{slot.label}</p>
              </div>
              {onSeeMore && pool.length > 0 && (
                <button
                  onClick={() => onSeeMore(slot.key)}
                  className="inline-flex items-center gap-0.5 text-xs font-semibold font-sans
                    text-blue-950/70 hover:text-blue-950 transition-colors duration-fast"
                >
                  See more
                  <ChevronRight size={14} />
                </button>
              )}
            </div>

            {pool.length === 0 ? (
              <p className="text-xs font-sans text-char-500">No options yet</p>
            ) : (
              <div className="relative">
                <div
                  className={`flex gap-3 overflow-x-auto snap-x ${
                    showScrollbar
                      // `snap-proximity`, not `-mandatory`: mandatory snapping
                      // re-snaps on every frame of a scrollbar-thumb drag,
                      // which reads as the bar fighting the pointer.
                      ? 'snap-proximity pb-3 rail-scrollbar'
                      : 'snap-mandatory pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
                  }`}
                >
                  {pool.map((item) => {
                    const isSelected = showAdd && selectedIds?.has(item.id);

                    return (
                      <div key={item.id} className="snap-start shrink-0 w-[150px]" style={{ aspectRatio: '4/5' }}>
                        <FoodImageCard
                          id={item.id}
                          mealTag={displayTagForItem(item, slot.key)}
                          image={item.image}
                          title={item.name}
                          subtitle={item.sourceName || item.tier || undefined}
                          numericId={item.numericId}
                          onClick={() => onSelectCard?.(item)}
                          className="w-full h-full"
                          saveAction={() => <SaveButton item={item} onBlocked={onSaveBlocked} />}
                          action={
                            showAdd
                              ? () => (
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
                                    className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm
                                      transition-all duration-fast active:scale-95 cursor-pointer
                                      ${isSelected ? 'bg-forest-600 text-white' : 'bg-white/90 text-char-500 hover:bg-white hover:shadow-md'}`}
                                  >
                                    {isSelected ? <Check size={16} /> : <Plus size={16} />}
                                  </span>
                                )
                              : undefined
                          }
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Edge fade — fading vertical bars matching the parent bg
                    (project convention, see DESIGN_SYSTEM.md — never a CSS
                    gradient). Stops short of the bottom when a scrollbar is
                    shown, so the bars don't paint over its two ends. */}
                <div className={`absolute top-0 ${showScrollbar ? 'bottom-3' : 'bottom-0'} left-0
                  flex gap-[2px] items-stretch pointer-events-none z-10 -translate-x-[4px]`}>
                  {[0.6, 0.38, 0.2, 0.09, 0.03].map((op, i) => (
                    <div key={i} className={`w-[8px] ${edgeFadeClass}`} style={{ opacity: op }} />
                  ))}
                </div>
                <div className={`absolute top-0 ${showScrollbar ? 'bottom-3' : 'bottom-0'} right-0
                  flex flex-row-reverse gap-[2px] items-stretch pointer-events-none z-10 translate-x-[4px]`}>
                  {[0.6, 0.38, 0.2, 0.09, 0.03].map((op, i) => (
                    <div key={i} className={`w-[8px] ${edgeFadeClass}`} style={{ opacity: op }} />
                  ))}
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
