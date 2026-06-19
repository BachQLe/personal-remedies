import { motion } from 'framer-motion';

export default function StepWelcome({ onNext }) {
  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6 pb-8 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="w-20 h-20 rounded-full flex items-center justify-center bg-forest-100 mb-8"
      >
        <span className="material-symbols-rounded fill text-forest-700 text-[44px]">
          eco
        </span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        <h1 className="font-display font-semibold tracking-tightish text-3xl text-char-900 leading-tight mb-3">
          Food that works with
          <br />
          your body, not against it.
        </h1>
        <p className="text-char-500 text-sm leading-relaxed max-w-xs mx-auto font-sans">
          Answer a few quick questions so we can build your personalized,
          evidence-backed nutrition plan.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="w-full mt-12"
      >
        <button
          onClick={onNext}
          className="w-full py-4 rounded-pill text-white font-semibold text-base bg-forest-700 hover:bg-forest-800 transition-colors duration-fast min-h-[48px] font-sans"
        >
          Get started
        </button>
        <p className="text-xs text-char-400 mt-4 font-sans">Takes about 2 minutes</p>
      </motion.div>
    </div>
  );
}
