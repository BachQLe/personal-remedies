import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { nextSevenDays } from './planDates.js';
import { resolveDayTotals } from '../../api/nutrition.js';
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
 * SchedulerView — "List view" tab of the Plan screen: a 7-day accordion that
 * mirrors the REAL weekly plan (`planDays`, from `src/state/dailyPlan.js`),
 * not a separate manually-scheduled list. One day expanded at a time; each
 * expanded day groups its items by `PLAN_SLOTS` order, each row tagged with
 * its meal type, plus an estimated-calories header and a Nutrition Facts
 * button when it has items.
 */
export default function SchedulerView({ planDays, onSelectItem, onOpenFacts }) {
  const [expandedKey, setExpandedKey] = useState(null);
  const days = nextSevenDays();

  return (
    <div className="flex flex-col gap-2">
      {days.map((day) => {
        const dayState = planDays?.[day.key] ?? null;
        const slots = dayState?.slots ?? {};
        const eaten = dayState?.eaten ?? [];
        const allItems = PLAN_SLOTS.flatMap((slot) => slots[slot.key] ?? []);
        const expanded = expandedKey === day.key;
        const totals = resolveDayTotals(allItems);

        return (
          <div key={day.key}>
            <button
              onClick={() => setExpandedKey(expanded ? null : day.key)}
              className={`w-full bg-white rounded-xl px-4 py-3 flex items-center justify-between
                ${expanded ? 'rounded-b-none' : ''}`}
            >
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-blue-950">{day.label}</span>
                <span className="text-xs text-blue-950/50">{day.sublabel}</span>
              </div>
              <div className="flex items-center gap-2">
                {allItems.length > 0 && (
                  <span className="text-[11px] bg-sand-200 rounded-full px-2 py-0.5 text-blue-950/60">
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
                  <div className="bg-white rounded-xl rounded-t-none p-4">
                    {allItems.length === 0 ? (
                      <div className="border border-dashed border-blue-950/30 rounded-xl px-4 py-4 text-sm text-blue-950/60">
                        Nothing planned for this day yet.
                      </div>
                    ) : (
                      <>
                        {totals && (
                          <div className="flex items-center justify-between mb-3">
                            <p className="font-label text-[11px] tracking-widest uppercase text-blue-950/50">
                              Planned
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-blue-950 text-sm">
                                ~{totals.calories} kcal
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sand-200 text-char-500">
                                Estimated
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col gap-4">
                          {PLAN_SLOTS.map((slot) => {
                            const slotItems = slots[slot.key] ?? [];
                            if (slotItems.length === 0) return null;
                            return (
                              <div key={slot.key} className="flex flex-col gap-2">
                                {slotItems.map((item) => (
                                  <div key={item.id} className="flex items-center gap-3">
                                    <button
                                      onClick={() => onSelectItem(item)}
                                      aria-label={`View ${item.name}`}
                                      className="tap-target w-8 h-8 rounded-lg overflow-hidden shrink-0"
                                    >
                                      <img
                                        src={cardImage(item)}
                                        alt=""
                                        className="w-full h-full object-cover"
                                      />
                                    </button>
                                    <MealTypeTag mealKey={slot.key} />
                                    <span
                                      className={`flex-1 text-sm text-blue-950 truncate ${eaten.includes(item.id) ? 'line-through opacity-60' : ''}`}
                                    >
                                      {item.name}
                                    </span>
                                    <button
                                      onClick={() => (
                                        eaten.includes(item.id)
                                          ? unmarkEaten(day.key, item.id)
                                          : markEaten(day.key, item.id)
                                      )}
                                      aria-label={eaten.includes(item.id) ? 'Mark as not eaten' : 'Mark as eaten'}
                                      className={`tap-target w-7 h-7 rounded-full flex items-center justify-center shrink-0
                                        transition-all duration-fast active:scale-95
                                        ${eaten.includes(item.id) ? 'bg-forest-600 text-white' : 'bg-sand-200 text-blue-950/40'}`}
                                    >
                                      <Check size={14} aria-hidden="true" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>

                        <button
                          onClick={() => onOpenFacts({ day, items: allItems })}
                          className="mt-3 w-full bg-blue-950 text-white rounded-pill py-2.5 text-xs font-semibold"
                        >
                          Nutrition Facts
                        </button>
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
