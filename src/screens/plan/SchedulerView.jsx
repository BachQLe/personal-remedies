import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { estimatePlanDayCalories, formatCalories } from '../../api/calorieNeeds.js';
import { markEaten, unmarkEaten } from '../../state/dailyPlan.js';
import { getIngredientImage } from '../../api/ingredientImages.js';
import { getOverlayImageFile } from '../../api/localTables.js';
import { PLAN_SLOTS } from '../../api/config.js';
import MealTypeTag from '../../components/shared/mealTypeMeta.jsx';

const calmSpring = { type: 'spring', stiffness: 120, damping: 22, mass: 1 };

function cardImage(item) {
  return item.image || getIngredientImage(item.name, item.group, getOverlayImageFile(item.id));
}

/**
 * SchedulerView - the "list view": an accordion of days, each expanding to its
 * meals (grouped by `PLAN_SLOTS` order, each row tagged with its meal type)
 * and a calorie line. Hidden from the plan screen; it renders the peeks of a
 * saved day / saved week in My Favorites.
 *
 * The day total is the same `estimatePlanDayCalories` call the plan's day view
 * uses, so the two never disagree. A lone day starts expanded.
 *
 * @param {Object} props
 * @param {Array<{key: string, label: string, sublabel?: string, slots: Object, eaten?: Array}>} props.days
 * @param {(item: Object) => void} props.onSelectItem
 * @param {boolean} [props.showEaten] - render the mark-as-eaten check on each row (live plan days only)
 */
export default function SchedulerView({ days, onSelectItem, showEaten = false }) {
  const [expandedKey, setExpandedKey] = useState(days.length === 1 ? days[0].key : null);

  return (
    <div className="flex flex-col gap-2">
      {days.map((day) => {
        const slots = day.slots ?? {};
        const eaten = day.eaten ?? [];
        const allItems = PLAN_SLOTS.flatMap((slot) => slots[slot.key] ?? []);
        const expanded = expandedKey === day.key;
        const { total } = estimatePlanDayCalories(slots);

        return (
          <div key={day.key}>
            <button
              type="button"
              onClick={() => setExpandedKey(expanded ? null : day.key)}
              aria-expanded={expanded}
              className={`flex min-h-[48px] w-full items-center justify-between rounded-xl bg-white px-4 py-3
                ${expanded ? 'rounded-b-none' : ''}`}
            >
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-blue-950">{day.label}</span>
                {day.sublabel && <span className="text-xs text-blue-950/50">{day.sublabel}</span>}
              </div>
              <div className="flex items-center gap-2">
                {allItems.length > 0 && (
                  <span className="rounded-full bg-sand-200 px-2 py-0.5 text-xs text-blue-950/60">
                    {allItems.length} item{allItems.length === 1 ? '' : 's'}
                  </span>
                )}
                <ChevronDown
                  size={16}
                  aria-hidden="true"
                  className={`text-blue-950/60 transition-transform duration-fast ${expanded ? 'rotate-180' : ''}`}
                />
              </div>
            </button>

            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  key="body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={calmSpring}
                  className="overflow-hidden"
                >
                  <div className="rounded-xl rounded-t-none bg-white p-4">
                    {allItems.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-blue-950/30 px-4 py-4 text-sm text-blue-950/60">
                        Nothing planned for this day yet.
                      </div>
                    ) : (
                      <>
                        {total > 0 && (
                          <div className="mb-3 flex items-center justify-between">
                            <p className="font-label text-xs uppercase tracking-widest text-blue-950/50">Planned</p>
                            <span className="text-sm font-semibold text-blue-950">{`${formatCalories(total)} cal`}</span>
                          </div>
                        )}

                        <div className="flex flex-col gap-4">
                          {PLAN_SLOTS.map((slot) => {
                            const slotItems = slots[slot.key] ?? [];
                            if (slotItems.length === 0) return null;
                            return (
                              <div key={slot.key} className="flex flex-col gap-2">
                                {slotItems.map((item) => {
                                  const isEaten = eaten.includes(item.id);
                                  return (
                                    <div key={item.id} className="flex items-center gap-3">
                                      <button
                                        type="button"
                                        onClick={() => onSelectItem(item)}
                                        aria-label={`View ${item.name}`}
                                        className="tap-target h-8 w-8 shrink-0 overflow-hidden rounded-lg"
                                      >
                                        <img src={cardImage(item)} alt="" width={32} height={32} loading="lazy" className="h-full w-full object-cover" />
                                      </button>
                                      <MealTypeTag mealKey={slot.key} />
                                      <span
                                        className={`flex-1 truncate text-sm text-blue-950 ${isEaten ? 'line-through opacity-60' : ''}`}
                                      >
                                        {item.name}
                                      </span>
                                      {showEaten && (
                                        <button
                                          type="button"
                                          onClick={() => (isEaten ? unmarkEaten(day.key, item.id) : markEaten(day.key, item.id))}
                                          aria-label={isEaten ? 'Mark as not eaten' : 'Mark as eaten'}
                                          className={`tap-target flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                                            transition duration-fast active:scale-95
                                            ${isEaten ? 'bg-forest-600 text-white' : 'bg-sand-200 text-blue-950/40'}`}
                                        >
                                          <Check size={14} aria-hidden="true" />
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
