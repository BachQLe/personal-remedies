import { motion } from 'framer-motion';

const DIET_OPTIONS = [
  { value: 'omnivore', label: 'Omnivore', icon: 'restaurant' },
  { value: 'pescatarian', label: 'Pescatarian', icon: 'set_meal' },
  { value: 'vegetarian', label: 'Vegetarian', icon: 'nutrition' },
  { value: 'vegan', label: 'Vegan', icon: 'eco' },
];

const RELIGIOUS_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
];

const chipSpring = { type: 'spring', stiffness: 500, damping: 30, mass: 0.8 };

export default function StepDietary({
  dietaryPattern,
  religiousRestriction,
  onChangeDiet,
  onChangeReligious,
  onNext,
}) {
  return (
    <div className="flex flex-col flex-1 px-5 pt-6 pb-8">
      <h2 className="font-display font-semibold tracking-tightish text-2xl text-char-900 leading-tight">
        How do you eat?
      </h2>
      <p className="text-sm text-char-500 mt-1.5 mb-6 font-sans">
        Pick the pattern that best describes your diet.
      </p>

      <div className="space-y-3 mb-8">
        {DIET_OPTIONS.map(({ value, label, icon }) => {
          const isSelected = dietaryPattern === value;
          return (
            <motion.button
              key={value}
              whileTap={{ scale: 0.97 }}
              transition={chipSpring}
              onClick={() => onChangeDiet(value)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border text-left transition-all duration-fast min-h-[56px] ${
                isSelected
                  ? 'border-forest-700 bg-forest-700 text-white'
                  : 'border-sand-200 bg-white text-char-900 hover:border-forest-700'
              }`}
            >
              <span
                className={`material-symbols-rounded text-[24px] ${
                  isSelected ? 'text-white' : 'text-forest-700'
                }`}
              >
                {icon}
              </span>
              <span
                className={`text-base font-semibold font-sans ${
                  isSelected ? 'text-white' : 'text-char-900'
                }`}
              >
                {label}
              </span>
            </motion.button>
          );
        })}
      </div>

      <div className="mb-6">
        <p className="text-[12px] uppercase tracking-eyebrow text-char-500 font-sans mb-3">
          Religious restriction (optional)
        </p>
        <div className="flex gap-3">
          {RELIGIOUS_OPTIONS.map(({ value, label }) => {
            const isSelected = religiousRestriction === value;
            return (
              <motion.button
                key={value}
                whileTap={{ scale: 0.96 }}
                transition={chipSpring}
                onClick={() => onChangeReligious(value)}
                className={`flex-1 py-3 rounded-pill text-sm font-medium border transition-all duration-fast min-h-[44px] font-sans ${
                  isSelected
                    ? 'border-forest-700 bg-forest-700 text-white'
                    : 'border-sand-200 bg-white text-char-900 hover:border-forest-700'
                }`}
              >
                {label}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="mt-auto pt-4">
        <button
          onClick={onNext}
          disabled={!dietaryPattern}
          className="w-full py-4 rounded-pill text-white font-semibold text-base bg-forest-700 hover:bg-forest-800 transition-colors duration-fast disabled:opacity-40 disabled:cursor-not-allowed min-h-[48px] font-sans"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
