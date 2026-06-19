import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { commonAllergies } from '../../api/mockData';

const chipSpring = { type: 'spring', stiffness: 500, damping: 30, mass: 0.8 };

const ALLERGY_ICONS = {
  'Tree Nuts': 'forest',
  'Peanuts': 'spa',
  'Shellfish': 'set_meal',
  'Fish': 'phishing',
  'Dairy': 'water_drop',
  'Eggs': 'egg_alt',
  'Wheat / Gluten': 'grain',
  'Soy': 'grass',
  'Sesame': 'filter_vintage',
  'Corn': 'energy_savings_leaf',
  'Mustard': 'local_florist',
  'Celery': 'park',
  'Lupin': 'yard',
  'Mollusks': 'pool',
  'Sulfites': 'science',
  'Nightshades': 'nightlight',
  'Latex (cross-reactive foods)': 'warning',
  'Coconut': 'beach_access',
  'Fructose': 'nutrition',
};

const ALL_ALLERGIES = [
  ...commonAllergies,
  'Corn',
  'Mustard',
  'Celery',
  'Lupin',
  'Mollusks',
  'Sulfites',
  'Nightshades',
  'Latex (cross-reactive foods)',
  'Coconut',
  'Fructose',
];

export default function StepAllergies({ selected, onChange, onNext }) {
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? ALL_ALLERGIES.filter((a) =>
        a.toLowerCase().includes(query.toLowerCase().trim())
      )
    : [];

  const toggle = (item) => {
    if (selected.includes(item)) {
      onChange(selected.filter((i) => i !== item));
    } else {
      onChange([...selected, item]);
      setQuery('');
    }
  };

  const addCustom = () => {
    const val = query.trim();
    if (val && !selected.includes(val)) {
      onChange([...selected, val]);
    }
    setQuery('');
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length > 0) {
        toggle(filtered[0]);
      } else {
        addCustom();
      }
    }
  };

  return (
    <div className="flex flex-col flex-1 px-5 pt-6 pb-8">
      <h2 className="font-display font-semibold tracking-tightish text-2xl text-char-900 leading-tight">
        Any allergies or intolerances?
      </h2>
      <p className="text-sm text-char-500 mt-1.5 mb-5 font-sans">
        Optional — we'll filter these out of your plan.
      </p>

      <div className="relative mb-3">
        <span className="material-symbols-rounded absolute left-4 top-1/2 -translate-y-1/2 text-char-400 text-[20px]">
          search
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Search allergies..."
          className="w-full bg-white border border-sand-200 rounded-md pl-11 pr-4 py-3.5 text-sm text-char-900 placeholder:text-char-400 outline-none focus:ring-2 focus:ring-forest-700 focus:border-forest-700 transition-colors duration-fast font-sans min-h-[44px]"
        />
      </div>

      {query.trim() && (
        <div className="mb-4 space-y-1.5 max-h-40 overflow-y-auto">
          {filtered.map((a) => {
            const isSelected = selected.includes(a);
            return (
              <motion.button
                key={a}
                whileTap={{ scale: 0.98 }}
                transition={chipSpring}
                onClick={() => toggle(a)}
                className={`w-full text-left px-4 py-3 rounded-md text-sm font-medium transition-all duration-fast border min-h-[44px] font-sans flex items-center gap-2.5 ${
                  isSelected
                    ? 'bg-forest-700 text-white border-forest-700'
                    : 'bg-white text-char-900 border-sand-200 hover:border-forest-700'
                }`}
              >
                {ALLERGY_ICONS[a] && (
                  <span className={`material-symbols-rounded text-[18px] ${isSelected ? 'text-white/80' : 'text-char-400'}`}>
                    {ALLERGY_ICONS[a]}
                  </span>
                )}
                {a}
              </motion.button>
            );
          })}
          {filtered.length === 0 && (
            <button
              onClick={addCustom}
              className="w-full text-left px-4 py-3 rounded-md text-sm font-medium border border-dashed border-forest-300 text-forest-700 hover:bg-forest-50 transition-colors duration-fast min-h-[44px] font-sans"
            >
              Add "{query.trim()}" as custom allergy
            </button>
          )}
        </div>
      )}

      <div className="mb-4">
        <p className="text-[12px] uppercase tracking-eyebrow text-char-500 font-sans mb-3">
          Common
        </p>
        <div className="flex flex-wrap gap-2">
          {commonAllergies.map((a) => {
            const isSelected = selected.includes(a);
            return (
              <motion.button
                key={a}
                whileTap={{ scale: 0.96 }}
                transition={chipSpring}
                onClick={() => toggle(a)}
                className={`px-4 py-2.5 rounded-pill text-sm font-medium border transition-all duration-fast min-h-[44px] font-sans flex items-center gap-2 ${
                  isSelected
                    ? 'text-white bg-forest-700 border-forest-700'
                    : 'bg-white text-char-900 border-sand-200 hover:border-forest-700'
                }`}
              >
                <span className={`material-symbols-rounded text-[18px] ${isSelected ? 'text-white/80' : 'text-char-400'}`}>
                  {ALLERGY_ICONS[a]}
                </span>
                {a}
              </motion.button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selected.filter((i) => !commonAllergies.includes(i)).length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-4 overflow-hidden"
          >
            <p className="text-[12px] uppercase tracking-eyebrow text-char-500 font-sans mb-3">
              Custom
            </p>
            <div className="flex flex-wrap gap-2">
              {selected
                .filter((i) => !commonAllergies.includes(i))
                .map((item) => (
                  <motion.button
                    key={item}
                    layout
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.85, opacity: 0 }}
                    transition={chipSpring}
                    onClick={() => toggle(item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-sm font-medium text-white bg-forest-700 min-h-[36px] font-sans"
                  >
                    {item}
                    <span className="material-symbols-rounded text-[16px] text-white/70">
                      close
                    </span>
                  </motion.button>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-auto flex flex-col gap-3 pt-4">
        <button
          onClick={onNext}
          className="w-full py-4 rounded-pill text-white font-semibold text-base bg-forest-700 hover:bg-forest-800 transition-colors duration-fast min-h-[48px] font-sans"
        >
          Continue
        </button>
        {selected.length === 0 && (
          <button
            onClick={onNext}
            className="w-full py-2 text-sm text-char-500 font-medium hover:text-char-900 transition-colors duration-fast min-h-[44px] font-sans"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
