import { motion, AnimatePresence } from 'framer-motion';

const chipSpring = { type: 'spring', stiffness: 500, damping: 30, mass: 0.8 };

const CARD_COLORS = ['bg-forest-200', 'bg-yellow-200', 'bg-blue-200'];
const CHECK_BG = ['#628C22', '#C09000', '#2E46A8'];

const cardVariants = {
  initial: { opacity: 0, y: 24, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.97 },
};

export default function MealStepCards({ recipes, selectedIds, onToggle }) {
  return (
    <div className="flex flex-col gap-6 mt-6 px-4">
      <AnimatePresence mode="popLayout">
        {recipes.map((rec, i) => {
          const selected = selectedIds.has(rec.id);
          return (
            <motion.div
              key={rec.id}
              layout
              variants={cardVariants}
              initial="initial"
              animate={{
                opacity: 1,
                y: 0,
                scale: selected ? 1.02 : 1,
              }}
              exit="exit"
              transition={{
                ...chipSpring,
                delay: i * 0.06,
              }}
              whileTap={{ scale: selected ? 1.02 : 0.98 }}
              onClick={() => onToggle(rec)}
              className={`relative rounded-2xl cursor-pointer flex items-center px-4 py-5 ${CARD_COLORS[i] ?? CARD_COLORS[0]} ${selected ? 'ring-[5px] ring-white shadow-xl' : ''
                }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {rec.image ? (
                <div className="w-36 flex-none overflow-hidden rounded-xl" style={{ aspectRatio: '4/3' }}>
                  <img
                    src={rec.image}
                    alt={rec.name}
                    className="w-full h-full object-cover"
                    style={{ transform: 'scale(1.25)' }}
                    draggable={false}
                  />
                </div>
              ) : (
                <div className="w-36 flex-none flex items-center justify-center rounded-xl bg-white/20" style={{ aspectRatio: '4/3' }}>
                  <span className="material-symbols-rounded text-[28px] text-white/50">
                    restaurant
                  </span>
                </div>
              )}

              <div className="flex-1 px-4 flex flex-col justify-center">
                <h3 className="font-sans font-semibold text-[16px] leading-tight text-blue-950">
                  {rec.name}
                </h3>
                {rec.blurb && (
                  <p className="mt-1 text-[13px] leading-snug text-blue-950/60 font-sans line-clamp-2">
                    {rec.blurb}
                  </p>
                )}
              </div>

              <AnimatePresence>
                {selected && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={chipSpring}
                    className="absolute top-5 right-5 w-7.5 h-7.5 rounded-full backdrop-blur-sm flex items-center justify-center"
                    style={{ backgroundColor: CHECK_BG[i] ?? CHECK_BG[0] }}
                  >
                    <span
                      className="material-symbols-rounded text-white"
                      style={{ fontSize: 24, fontVariationSettings: "'wght' 600" }}
                    >
                      check
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
