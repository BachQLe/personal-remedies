/**
 * ConfirmationOverview — shows the full day's plan after all 4 meals are done.
 *
 * Props:
 *   picksBySlot    — { breakfast: Rec[], lunch: Rec[], dinner: Rec[], snack: Rec[] }
 *   autoFilledIds  — Set<string> of recipe IDs that were auto-filled (user skipped)
 *   onBuild        — () => void, the "Build my plan" action
 *   saving         — boolean
 */
import { motion, AnimatePresence } from 'framer-motion';

const chipSpring = { type: 'spring', stiffness: 500, damping: 30, mass: 0.8 };

const MEAL_META = {
  breakfast: { label: 'Breakfast', icon: 'sunny' },
  lunch: { label: 'Lunch', icon: 'restaurant' },
  dinner: { label: 'Dinner', icon: 'dinner_dining' },
  snack: { label: 'Snack', icon: 'cookie' },
};

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];

const sectionVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

export default function ConfirmationOverview({
  picksBySlot,
  autoFilledIds,
}) {
  return (
    <div className="flex flex-col gap-5 pb-8 max-w-[340px] mx-auto w-full">
      {/* ── Header ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
        className="text-center pt-2"
      >
        <span className="material-symbols-rounded text-[32px] text-forest-400 mb-1 block">
          task_alt
        </span>
        <h2
          className="text-[28px] font-bold tracking-tight text-white leading-none"
          style={{ fontFamily: 'Chillax, sans-serif' }}
        >
          Your daily plan
        </h2>
        <p className="text-[15px] text-white/50 mt-1.5 font-sans font-medium">
          Review your picks, then lock it in.
        </p>
      </motion.div>

      {/* ── Meal sections ───────────────────────────────────────── */}
      {MEAL_ORDER.map((slot, si) => {
        const meta = MEAL_META[slot];
        const picks = picksBySlot[slot] ?? [];
        if (picks.length === 0) return null;

        return (
          <motion.section
            key={slot}
            variants={sectionVariants}
            initial="initial"
            animate="animate"
            transition={{
              ...chipSpring,
              delay: si * 0.08,
            }}
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
          >
            {/* Section header */}
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/5">
              <span className="material-symbols-rounded text-[20px] text-white/50">
                {meta.icon}
              </span>
              <h3
                className="text-[16px] font-bold text-white/80 tracking-wide"
                style={{ fontFamily: 'Quantico, sans-serif' }}
              >
                {meta.label}
              </h3>
            </div>

            {/* Recipe rows */}
            <div className="divide-y divide-white/5">
              {picks.map((rec) => {
                const isAutoFilled = autoFilledIds.has(rec.id);
                return (
                  <div
                    key={rec.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    {/* Thumbnail */}
                    <div className="w-14 h-14 rounded-lg overflow-hidden flex-none bg-white/10">
                      {rec.image ? (
                        <img
                          src={rec.image}
                          alt={rec.name}
                          className="w-full h-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="material-symbols-rounded text-[22px] text-white/30">
                            restaurant
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <span className="flex-1 text-[16px] font-sans font-bold text-white/90 leading-snug truncate">
                      {rec.name}
                    </span>

                    {/* Auto-filled badge */}
                    {isAutoFilled && (
                      <span
                        className="flex-none inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-400/20"
                        title="Auto-selected for you"
                      >
                        <span
                          className="material-symbols-rounded text-yellow-400"
                          style={{ fontSize: 16 }}
                        >
                          auto_awesome
                        </span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.section>
        );
      })}

    </div>
  );
}
