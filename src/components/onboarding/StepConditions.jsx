import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { conditions as allConditions } from '../../data/conditions';
import { conditionSynonyms } from '../../data/conditionSynonyms';
import { popularConditions } from '../../api/mockData';

const chipSpring = { type: 'spring', stiffness: 500, damping: 30, mass: 0.8 };

function resolveQuery(query) {
  const q = query.toLowerCase().trim();
  if (!q) return null;
  const synonym = Object.keys(conditionSynonyms).find(
    (key) => q === key || q.startsWith(key) || key.startsWith(q)
  );
  return synonym ? conditionSynonyms[synonym] : null;
}

export default function StepConditions({ selected, onChange, onNext }) {
  const [query, setQuery] = useState('');

  const { filtered, synonymMatch } = useMemo(() => {
    if (!query.trim()) return { filtered: popularConditions, synonymMatch: null };

    const q = query.toLowerCase().trim();
    const resolved = resolveQuery(query);

    const directMatches = allConditions.filter((c) =>
      c.toLowerCase().includes(q)
    );

    if (resolved && !directMatches.some((m) => m === resolved)) {
      directMatches.unshift(resolved);
    }

    return {
      filtered: directMatches.slice(0, 20),
      synonymMatch: resolved,
    };
  }, [query]);

  const toggle = (condition) => {
    if (selected.includes(condition)) {
      onChange(selected.filter((c) => c !== condition));
    } else {
      onChange([...selected, condition]);
    }
  };

  return (
    <div className="flex flex-col flex-1 px-5 pt-6 pb-8">
      <h2 className="font-display font-semibold tracking-tightish text-2xl text-char-900 leading-tight">
        What conditions do you manage?
      </h2>
      <p className="text-sm text-char-500 mt-1.5 mb-5 font-sans">
        Select at least one. We'll personalize your plan to each.
      </p>

      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-wrap gap-2 mb-4 overflow-hidden"
          >
            {selected.map((c) => (
              <motion.button
                key={c}
                layout
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={chipSpring}
                onClick={() => toggle(c)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-sm font-medium text-white bg-forest-700 min-h-[36px] font-sans"
              >
                {c}
                <span className="material-symbols-rounded text-[16px] text-white/70">
                  close
                </span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative mb-3">
        <span className="material-symbols-rounded absolute left-4 top-1/2 -translate-y-1/2 text-char-400 text-[20px]">
          search
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Search conditions (try "T2D", "IBS"...)'
          className="w-full bg-white border border-sand-200 rounded-md pl-11 pr-4 py-3.5 text-sm text-char-900 placeholder:text-char-400 outline-none focus:ring-2 focus:ring-forest-700 focus:border-forest-700 transition-colors duration-fast font-sans min-h-[44px]"
        />
      </div>

      {synonymMatch && query.trim() && (
        <p className="text-xs text-forest-700 mb-2 font-sans font-medium">
          Showing results for "{synonymMatch}"
        </p>
      )}

      <div className="flex-1 overflow-y-auto -mx-5 px-5 space-y-1.5">
        {!query && (
          <p className="text-[12px] uppercase tracking-eyebrow text-char-500 font-sans mb-2">
            Common conditions
          </p>
        )}
        {filtered.map((c) => {
          const isSelected = selected.includes(c);
          return (
            <motion.button
              key={c}
              whileTap={{ scale: 0.98 }}
              transition={chipSpring}
              onClick={() => toggle(c)}
              className={`w-full text-left px-4 py-3.5 rounded-md text-sm font-medium transition-all duration-fast border min-h-[44px] font-sans ${
                isSelected
                  ? 'bg-forest-700 text-white border-forest-700'
                  : 'bg-white text-char-900 border-sand-200 hover:border-forest-700'
              }`}
            >
              {c}
            </motion.button>
          );
        })}
        {query && filtered.length === 0 && (
          <p className="text-sm text-char-500 text-center py-8 font-sans">
            No conditions found for "{query}"
          </p>
        )}
      </div>

      <button
        onClick={onNext}
        disabled={selected.length === 0}
        className="mt-6 w-full py-4 rounded-pill text-white font-semibold text-base bg-forest-700 hover:bg-forest-800 transition-colors duration-fast disabled:opacity-40 disabled:cursor-not-allowed min-h-[48px] font-sans"
      >
        Continue
      </button>
    </div>
  );
}
