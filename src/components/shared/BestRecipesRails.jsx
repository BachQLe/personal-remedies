/**
 * BestRecipesRails — shared "5 meal-type carousels" layout.
 *
 * Stacked sections (Breakfast → Beverages, `PLAN_SLOTS` order), each a
 * `<MealTypeTag>` + label header over a horizontal snap rail of
 * `FoodImageCard`s. Reused by `SuggestionsScreen.jsx`'s Recommendations tab
 * and `RecipesScreen.jsx` — one carousel implementation, not two hand-rolled ones.
 *
 * Honesty rule: a slot with an empty pool renders a small muted "No options
 * yet" line under its header — never a fabricated/placeholder card.
 *
 * Scrolling: every rail is a plain native `overflow-x: auto` scroller, so touch
 * swipe and trackpad work as-is; mouse click-and-drag comes from
 * `dragScrollProps`, and the draggable scrollbar from `showScrollbar` below.
 */

import { ChevronRight } from 'lucide-react';
import FoodImageCard from './FoodImageCard.jsx';
import SaveButton from './SaveButton.jsx';
import MealTypeTag, { displayTagForItem } from './mealTypeMeta.jsx';
import { PLAN_SLOTS } from '../../api/config.js';
import { dragScrollProps } from './dragScroll.js';

/**
 * @param {Object} props
 * @param {Record<string, import('../../api/types.js').PlanCandidate[]>} props.candidatesBySlot -
 *   slot key → ranked candidate pool (may be empty per slot).
 * @param {(item: Object) => void} [props.onSelectCard] - tapping a card body.
 * @param {boolean} [props.showScrollbar] - render a visible, draggable native
 *   scrollbar beneath each rail (see `.rail-scrollbar` in index.css). Off by
 *   default — the rails read as touch-swipe carousels on mobile — but on a
 *   pointer device that bar shows position in a 12-card pool.
 * @param {(slotKey: string) => void} [props.onSeeMore] - shows a "See more"
 *   link in a slot's header (only when its pool is non-empty) that opens a
 *   full browse view for that slot.
 * @param {(message: string) => void} [props.onSaveBlocked] - forwarded to
 *   every card's `SaveButton`; the consuming screen routes this into its own
 *   snackbar.
 * @param {string} [props.cardWidthClass] - Tailwind width for each card in
 *   the rail (default `w-[150px]`). The Recommendations tab runs wider cards
 *   since it's a browse surface, not a compact picker.
 * @param {boolean} [props.showSubtitle] - render the card's secondary line
 *   (source name / tier) under its title. On by default.
 * @param {boolean} [props.saveAtTop] - put the save bookmark in the card's
 *   top-right instead of bottom-right, leaving the bottom to the title (the
 *   home screen's card layout).
 * @param {boolean} [props.dimImages] - darken card photos so overlaid white
 *   text stays legible (home-screen brightness).
 */
export default function BestRecipesRails({
  candidatesBySlot,
  onSelectCard,
  showScrollbar = false,
  onSeeMore,
  onSaveBlocked,
  cardWidthClass = 'w-[150px]',
  showSubtitle = true,
  saveAtTop = false,
  dimImages = false,
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
                  className="tap-target inline-flex items-center gap-0.5 text-xs font-semibold font-sans
                    text-blue-950/70 hover:text-blue-950 transition-colors duration-fast"
                >
                  See more
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              )}
            </div>

            {pool.length === 0 ? (
              <p className="text-xs font-sans text-char-500">No options yet</p>
            ) : (
              <div
                {...dragScrollProps}
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
                  return (
                    <div key={item.id} className={`snap-start shrink-0 ${cardWidthClass}`} style={{ aspectRatio: '4/5' }}>
                      <FoodImageCard
                        id={item.id}
                        mealTag={displayTagForItem(item, slot.key)}
                        image={item.image}
                        title={item.name}
                        subtitle={showSubtitle ? (item.sourceName || item.tier || undefined) : undefined}
                        numericId={item.numericId}
                        onClick={() => onSelectCard?.(item)}
                        className="w-full h-full"
                        saveAction={() => <SaveButton item={item} onBlocked={onSaveBlocked} />}
                        saveActionPosition={saveAtTop ? 'top' : 'bottom'}
                        dimImage={dimImages}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
