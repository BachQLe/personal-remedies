import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus } from 'lucide-react';
import FoodImageCard from '../../components/shared/FoodImageCard.jsx';
import SaveButton from '../../components/shared/SaveButton.jsx';
import { getIngredientImage } from '../../api/ingredientImages.js';
import { getOverlayImageFile } from '../../api/localTables.js';
import { MEAL_TYPE_META } from '../../components/shared/mealTypeMeta.jsx';
import { COPY } from './plannerCopy.js';

const calmSpring = { type: 'spring', stiffness: 120, damping: 22, mass: 1 };

/**
 * Whether the per-slot "See other suggestions" link renders. Off while its
 * retirement awaits the owner's confirmation (checklist Open Question #11);
 * flip back to `true` to restore it, SuggestionsSheet wiring is untouched.
 */
const SHOW_SUGGESTIONS = false;

function cardImage(item) {
  return item.image || getIngredientImage(item.name, item.group, getOverlayImageFile(item.id));
}

/**
 * SlotSection - one meal (Breakfast/Lunch/Dinner/Snacks/Beverages) of a single
 * day: its label, a 2-col grid of recipe cards (each with an X to remove it and
 * a bookmark), then an "Add from favorites" tile. The tile is the only thing in
 * an empty meal.
 */
export default function SlotSection({
  slot,
  items,
  onSelect,
  onRemove,
  onAdd,
  onOpenSuggestions,
  ghost,
  onSaveBlocked,
}) {
  const SlotIcon = MEAL_TYPE_META[slot.key]?.Icon;
  return (
    <section className={ghost ? 'rm-ghost' : ''}>
      <div className="mb-4 flex flex-col gap-2">
        <p className="flex items-center gap-1.5 font-label text-xs uppercase tracking-widest text-blue-950/70">
          {SlotIcon && <SlotIcon size={14} strokeWidth={2} aria-hidden="true" />}
          {slot.label}
        </p>

        {SHOW_SUGGESTIONS && (
          <div className="flex justify-end">
            <button
              onClick={() => onOpenSuggestions(slot.key)}
              disabled={ghost}
              className={`text-right text-xs font-semibold text-blue-950/70 underline decoration-blue-950/30
                underline-offset-2 transition-colors duration-fast hover:text-blue-950
                ${ghost ? 'pointer-events-none opacity-40' : ''}`}
            >
              See other suggestions
            </button>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-3">
          <AnimatePresence mode="popLayout">
            {items.map((item) => (
              <motion.div
                key={item.id}
                className="w-[calc(50%-0.375rem)] min-w-0"
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
                      aria-label={`Remove ${item.name} from plan`}
                      className="tap-target flex h-8 w-8 cursor-pointer items-center justify-center rounded-full
                        bg-white/90 shadow-sm transition duration-fast hover:bg-white hover:shadow-md active:scale-95"
                    >
                      <X size={16} className="text-char-500" aria-hidden="true" />
                    </span>
                  )}
                  className="w-full"
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <button
        type="button"
        onClick={() => onAdd(slot.key)}
        disabled={ghost}
        aria-label={`${COPY.addFromFavorites} to ${slot.label}`}
        className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-dashed
          border-blue-950/30 px-4 py-3 font-sans text-sm font-semibold text-blue-950
          transition duration-fast hover:bg-white/60 active:scale-[0.99]
          ${ghost ? 'pointer-events-none opacity-40' : ''}`}
      >
        <Plus size={16} aria-hidden="true" />
        {COPY.addFromFavorites}
      </button>
    </section>
  );
}
