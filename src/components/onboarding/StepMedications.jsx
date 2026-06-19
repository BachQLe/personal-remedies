import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { medications, medicationSynonyms } from '../../data/medications';

const chipSpring = { type: 'spring', stiffness: 500, damping: 30, mass: 0.8 };

export default function StepMedications({ selected, onChange, onNext }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();

    const synonymKey = Object.keys(medicationSynonyms).find(
      (key) => q === key.toLowerCase() || key.toLowerCase().startsWith(q)
    );
    const resolved = synonymKey ? medicationSynonyms[synonymKey] : null;

    const matches = medications.filter((m) =>
      m.toLowerCase().includes(q)
    );

    if (resolved && !matches.includes(resolved)) {
      matches.unshift(resolved);
    }

    return matches.slice(0, 15);
  }, [query]);

  const toggle = (med) => {
    if (selected.includes(med)) {
      onChange(selected.filter((m) => m !== med));
    } else {
      onChange([...selected, med]);
      setQuery('');
    }
  };

  const remove = (med) => onChange(selected.filter((m) => m !== med));

  return (
    <div className="flex flex-col flex-1 px-5 pt-6 pb-8">
      <h2 className="font-display font-semibold tracking-tightish text-2xl text-char-900 leading-tight">
        What medications do you take?
      </h2>
      <p className="text-sm text-char-500 mt-1.5 mb-5 font-sans">
        Optional — helps us flag potential food interactions.
      </p>

      <div className="relative mb-3">
        <span className="material-symbols-rounded absolute left-4 top-1/2 -translate-y-1/2 text-char-400 text-[20px]">
          search
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search medications (try brand names too)..."
          className="w-full bg-white border border-sand-200 rounded-md pl-11 pr-4 py-3.5 text-sm text-char-900 placeholder:text-char-400 outline-none focus:ring-2 focus:ring-forest-700 focus:border-forest-700 transition-colors duration-fast font-sans min-h-[44px]"
        />
      </div>

      {query.trim() && (
        <div className="mb-4 space-y-1.5 max-h-48 overflow-y-auto">
          {filtered.map((m) => {
            const isSelected = selected.includes(m);
            return (
              <motion.button
                key={m}
                whileTap={{ scale: 0.98 }}
                transition={chipSpring}
                onClick={() => toggle(m)}
                className={`w-full text-left px-4 py-3 rounded-md text-sm font-medium transition-all duration-fast border min-h-[44px] font-sans ${
                  isSelected
                    ? 'bg-forest-700 text-white border-forest-700'
                    : 'bg-white text-char-900 border-sand-200 hover:border-forest-700'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className={`material-symbols-rounded text-[18px] ${
                      isSelected ? 'text-white' : 'text-forest-700'
                    }`}
                  >
                    medication
                  </span>
                  {m}
                </span>
              </motion.button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-char-500 text-center py-4 font-sans">
              No matches — try a different name
            </p>
          )}
        </div>
      )}

      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <p className="text-[12px] uppercase tracking-eyebrow text-char-500 font-sans mb-3">
              Added
            </p>
            <div className="space-y-2 mb-4">
              {selected.map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between bg-white border border-sand-200 rounded-md px-4 py-3"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-rounded text-[20px] text-forest-700">
                      medication
                    </span>
                    <span className="text-sm font-medium text-char-900 font-sans">
                      {item}
                    </span>
                  </div>
                  <button
                    onClick={() => remove(item)}
                    className="text-char-400 hover:text-signal-avoid transition-colors duration-fast min-w-[44px] min-h-[44px] flex items-center justify-center"
                  >
                    <span className="material-symbols-rounded text-[20px]">
                      close
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!query.trim() && selected.length === 0 && (
        <div className="flex-1 flex items-start">
          <p className="text-sm text-char-400 font-sans">
            Start typing to search our medication database.
          </p>
        </div>
      )}

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
