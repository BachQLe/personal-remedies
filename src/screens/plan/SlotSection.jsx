import { motion, AnimatePresence } from 'framer-motion';
import { Shuffle, X, BookmarkPlus } from 'lucide-react';
import FoodImageCard from '../../components/shared/FoodImageCard.jsx';
import SaveButton from '../../components/shared/SaveButton.jsx';
import { getIngredientImage } from '../../api/ingredientImages.js';
import { getOverlayImageFile } from '../../api/localTables.js';
import { displayTagForItem } from '../../components/shared/mealTypeMeta.jsx';

const calmSpring = { type: 'spring', stiffness: 120, damping: 22, mass: 1 };

/**
 * Whether the per-slot suggestions link renders at all. Was off (2026-09,
 * user request) with the feature's wiring left fully in place underneath
 * (SuggestionsSheet and MealQueueScreen's whole swap/add plumbing never
 * stopped working) specifically so flipping this back to `true` would
 * restore it with no other changes — Wave 4 is that flip, per explicit
 * product direction ("bring back suggestions"). Kept as a named flag rather
 * than removed outright, in case it needs to come back off again.
 */
const SHOW_SUGGESTIONS = true;

function cardImage(item) {
  return item.image || getIngredientImage(item.name, item.group, getOverlayImageFile(item.id));
}

/**
 * SlotSection — one meal-plan slot (Breakfast/Lunch/Dinner/Snacks/Beverages)
 * for a SINGLE day: header (label + "See other healthy suggestions" +
 * Shuffle) and a 2-col FoodImageCard grid, or a dashed-border empty state
 * when the slot has no items.
 *
 * Each card carries a meal-type corner tag (the slot IS its meal type) and
 * two circular actions: Remove (drop from the plan, with Undo upstream, top
 * corner) and Save (bookmark to the user's library, bottom corner).
 *
 * The suggestions trigger (Task 11 — renamed + re-skinned from
 * "Substitutions" to "Suggestions"; Wave 4 — renamed again to "See other
 * healthy suggestions", per explicit product direction) is a plain text
 * LINK, not an icon button, and is still a per-SLOT affordance (one trigger
 * covering every item in the slot), not a per-card one — see
 * SuggestionsSheet.jsx's doc for why that distinction matters (it's what
 * keeps this feature structurally distinct from the deleted SwapSheet) and
 * for what opens when it's tapped (now the FULL 17-fine-group menu, not a
 * slot-specific subset — see that file's doc for the Wave 4 change).
 *
 * LAYOUT (Wave 4): the new label is ~2.5x longer than "Suggestions" and no
 * longer fits sharing one row with Shuffle at phone width. It now renders on
 * its own full-width row directly below the slot-label/Shuffle row (still
 * inside the same header block), right-aligned to match Shuffle's position,
 * so it has room to wrap onto two lines on narrow screens instead of
 * fighting Shuffle for space.
 */
export default function SlotSection({
  slot,
  items,
  pinnedIds,
  // Not read here — subtitle no longer derives a condition-match phrase
  // (kept as a documented, currently-unused prop; see eslint.config.js's
  // note on the underscore-prefix convention).
  conditionNames: _conditionNames,
  onShuffle,
  onSelect,
  onRemove,
  onOpenSuggestions,
  ghost,
  shuffling,
  onSaveBlocked,
}) {
  const allPinned = items.length > 0 && items.every((item) => pinnedIds?.includes(item.id));
  const shuffleDisabled = ghost || items.length === 0 || shuffling || allPinned;
  // Task 13 (still true under Wave 4's full-menu picker — see
  // SuggestionsSheet.jsx's doc): suggestions must stay open for an EMPTY
  // slot too. The full 17-group menu never depended on the slot's current
  // contents in the first place, so this was never actually at risk — only
  // ghost mode (no real plan to suggest into yet) disables it.
  const suggestionsDisabled = ghost;

  return (
    <section className={ghost ? 'rm-ghost' : ''}>
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center justify-between">
          <p className="font-label text-xs tracking-widest uppercase text-blue-950/70">
            {slot.label}
          </p>

          <button
            onClick={() => onShuffle(slot.key)}
            disabled={shuffleDisabled}
            title={allPinned ? 'Everything here is pinned' : undefined}
            className={`inline-flex items-center gap-1.5 rounded-pill bg-white hover:bg-sand-100
              px-3 py-1.5 text-xs font-semibold text-blue-950/70 transition-all duration-fast
              ${shuffleDisabled ? 'opacity-40 pointer-events-none' : 'active:scale-95'}`}
          >
            <Shuffle size={14} className={shuffling ? 'animate-spin' : ''} aria-hidden="true" />
            Shuffle
          </button>
        </div>

        {/* Own row (Wave 4) — "See other healthy suggestions" is too long
            to share the row above with Shuffle at phone width; right-aligned
            to line up under Shuffle, and free to wrap onto two lines rather
            than forcing a horizontal scroll. Tapping it opens
            SuggestionsSheet's full fine-group menu (see that file's doc),
            not a flat substitute-card list. */}
        {SHOW_SUGGESTIONS && (
          <div className="flex justify-end">
            <button
              onClick={() => onOpenSuggestions(slot.key)}
              disabled={suggestionsDisabled}
              className={`text-xs font-semibold text-blue-950/70 underline decoration-blue-950/30
                underline-offset-2 transition-colors duration-fast hover:text-blue-950 text-right
                ${suggestionsDisabled ? 'opacity-40 pointer-events-none' : ''}`}
            >
              See other healthy suggestions
            </button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex items-start gap-3 px-4 py-4 rounded-xl border border-dashed border-blue-950/30">
          <BookmarkPlus size={18} className="text-blue-950 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-blue-950 font-sans leading-snug">
            No scored suggestions for {slot.label} yet — add from your saved recipes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <AnimatePresence mode="popLayout">
            {items.map((item) => {
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.88 }}
                  transition={calmSpring}
                >
                  <FoodImageCard
                    id={item.id}
                    image={cardImage(item)}
                    numericId={item.numericId}
                    title={item.name}
                    subtitle={item.kind === 'recipe' ? item.sourceName : undefined}
                    mealTag={displayTagForItem(item, slot.key)}
                    aspectRatio="4/5"
                    onClick={() => onSelect(item)}
                    saveAction={() => <SaveButton item={item} onBlocked={onSaveBlocked} />}
                    action={() => (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); onRemove(slot.key, item); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            onRemove(slot.key, item);
                          }
                        }}
                        aria-label="Remove from plan"
                        className="tap-target w-8 h-8 rounded-full flex items-center justify-center shadow-sm
                          transition-all duration-fast active:scale-95 cursor-pointer
                          bg-white/90 hover:bg-white hover:shadow-md"
                      >
                        <X size={16} className="text-char-500" aria-hidden="true" />
                      </span>
                    )}
                    className="w-full"
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
