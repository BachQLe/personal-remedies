/**
 * Recap — pinned bottom plan summary + Save CTA.
 *
 * Lists selected picks grouped by slot, shows a total count, and a forest
 * "Save plan" button. Empty state is a gentle prompt, never an error.
 *
 * Props:
 *   selectedBySlot — { breakfast: Rec[], lunch: Rec[], ... }
 *   total          — number of selected items
 *   saving         — boolean (Save in flight)
 *   onSave         — () => void
 *   onRemove       — (rec) => void
 */
import { motion, AnimatePresence } from "framer-motion";
import { MEAL_SLOTS } from "../../types/recommendations";
import PrimaryButton from "../../components/shared/PrimaryButton.jsx";

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function Recap({ selectedBySlot, total, saving, onSave, onRemove }) {
  const isEmpty = total === 0;

  return (
    <div className="bg-paper-100 border-t border-sand-200 shadow-sheet px-4 pt-3.5 pb-5">
      <div className="max-w-[360px] mx-auto w-full">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[13px] uppercase tracking-eyebrow text-char-500 font-sans font-bold">
            Your plan
          </div>
          {!isEmpty && (
            <span className="text-[13px] font-bold text-forest-700">
              <span className="font-mono">{total}</span>{" "}
              {total === 1 ? "item" : "items"} in your plan
            </span>
          )}
        </div>

        {isEmpty ? (
          <p className="text-[14px] text-char-500 leading-snug mb-3.5 font-medium">
            Nothing added yet — tap a pick above when something looks good.
          </p>
        ) : (
          <div className="max-h-[150px] overflow-y-auto mb-3.5 -mx-1 px-1">
            <AnimatePresence initial={false}>
              {MEAL_SLOTS.filter((slot) => selectedBySlot[slot]?.length).map(
                (slot) => (
                  <motion.div
                    key={slot}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
                    className="mb-2 last:mb-0"
                  >
                    <div className="text-[12px] font-bold uppercase tracking-eyebrow text-char-400 mb-1.5">
                      {cap(slot)}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {selectedBySlot[slot].map((rec) => (
                        <div
                          key={rec.id}
                          className="flex items-center gap-2.5 bg-white rounded-lg border border-sand-200 pl-1.5 pr-1.5 py-1.5"
                        >
                          {rec.image ? (
                            <img
                              src={rec.image}
                              alt=""
                              className="w-10 h-10 rounded-md object-cover flex-none"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-sand-100 flex items-center justify-center flex-none">
                              <span className="material-symbols-rounded text-char-300" style={{ fontSize: 18 }}>
                                restaurant
                              </span>
                            </div>
                          )}
                          <span className="flex-1 min-w-0 truncate text-[14px] font-semibold text-char-900">
                            {rec.name}
                          </span>
                          <button
                            onClick={() => onRemove(rec)}
                            aria-label={`Remove ${rec.name}`}
                            className="flex-none w-6 h-6 inline-flex items-center justify-center rounded-full text-char-400 hover:text-char-700 hover:bg-sand-100"
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
                              close
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ),
              )}
            </AnimatePresence>
          </div>
        )}

        <PrimaryButton onClick={onSave} loading={saving} disabled={isEmpty}>
          <span className="material-symbols-rounded" style={{ fontSize: 19 }}>
            bookmark_added
          </span>
          Save plan
        </PrimaryButton>
      </div>
    </div>
  );
}
