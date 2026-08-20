import { motion, AnimatePresence } from 'framer-motion';
import { Shuffle, X, BookmarkPlus } from 'lucide-react';
import FoodImageCard from '../../components/shared/FoodImageCard.jsx';
import SaveButton from '../../components/shared/SaveButton.jsx';
import { getIngredientImage } from '../../api/ingredientImages.js';
import { displayTagForItem } from '../../components/shared/mealTypeMeta.jsx';

const calmSpring = { type: 'spring', stiffness: 120, damping: 22, mass: 1 };

function cardImage(item) {
  return item.image || getIngredientImage(item.name, item.group);
}

/**
 * SlotSection — one meal-plan slot (Breakfast/Lunch/Dinner/Snacks/Beverages)
 * for a SINGLE day: header (label + Shuffle) and a 2-col FoodImageCard grid,
 * or a dashed-border empty state when the slot has no items.
 *
 * Each card carries a meal-type corner tag (the slot IS its meal type) and
 * two circular actions: Remove (drop from the plan, with Undo upstream, top
 * corner) and Save (bookmark to the user's library, bottom corner).
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
  ghost,
  shuffling,
  onSaveBlocked,
}) {
  const allPinned = items.length > 0 && items.every((item) => pinnedIds?.includes(item.id));
  const shuffleDisabled = ghost || items.length === 0 || shuffling || allPinned;

  return (
    <section className={ghost ? 'rm-ghost' : ''}>
      <div className="flex items-center justify-between mb-4">
        <p className="font-label text-xs tracking-widest uppercase text-blue-950/70">
          {slot.label}
        </p>

        <button
          onClick={() => onShuffle(slot.key)}
          disabled={shuffleDisabled}
          title={allPinned ? 'Everything here is pinned' : undefined}
          className={`inline-flex items-center gap-1.5 rounded-pill bg-sand-100 hover:bg-sand-200
            px-3 py-1.5 text-xs font-semibold text-blue-950/70 transition-all duration-fast
            ${shuffleDisabled ? 'opacity-40 pointer-events-none' : 'active:scale-95'}`}
        >
          <Shuffle size={14} className={shuffling ? 'animate-spin' : ''} aria-hidden="true" />
          Shuffle
        </button>
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
