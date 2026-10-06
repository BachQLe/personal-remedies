import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { conditionSynonyms } from '../../data/conditionSynonyms';
import { getConditions } from '../../api/api.js';
import { getConditionMeta } from '../../utils/conditionMeta.js';
import fruitIllustration from '../../assets/fruit-lemon-graphic.png';
import FruitScene from './FruitScene.jsx';
import BackButton from '../shared/BackButton.jsx';

const chipSpring = { type: 'spring', stiffness: 500, damping: 30, mass: 0.8 };
// Snappy spring for the card height "opening up".
const snappySpring = { type: 'spring', stiffness: 600, damping: 38, mass: 0.7 };
// Conditions re-entry: settles in place almost instantly (no overshoot).
const settleFast = { type: 'spring', stiffness: 1100, damping: 60, mass: 0.5 };


function resolveQuery(query) {
  const q = query.toLowerCase().trim();
  if (!q) return null;
  // Fallback layer only: the Nutridigm dictionary's own AKA field (matched
  // directly in conditionResults below) covers most abbreviations/aliases
  // now. conditionSynonyms.js remains as a hand-rolled backstop for terms
  // the dictionary doesn't carry (e.g. "t2d", "hbp").
  const synonym = Object.keys(conditionSynonyms).find(
    (key) => q === key || q.startsWith(key) || key.startsWith(q),
  );
  return synonym ? conditionSynonyms[synonym] : null;
}

/**
 * Split a Nutridigm `AKA` string into individual alias terms.
 * Observed format is semicolon-separated (e.g. "Alcohol abuse; AUD"); a
 * bare comma can appear WITHIN a single alias (e.g. "Anemia, Megaloblastic"),
 * so only ';' is treated as a separator.
 * @param {string} [aka]
 * @returns {string[]}
 */
function splitAka(aka) {
  if (!aka) return [];
  return aka.split(';').map((s) => s.trim()).filter(Boolean);
}

/** Truncate a sub-text string to ~70 chars with an ellipsis. */
function truncate(text, max = 70) {
  if (!text) return '';
  const trimmed = text.trim();
  return trimmed.length > max ? trimmed.slice(0, max - 1).trimEnd() + '…' : trimmed;
}

export default function ProfileBuilder({ profile, onChange, onSubmit, saving, onBack }) {
  const [conditionQuery, setConditionQuery] = useState('');
  // Full {healthConditionID, description} objects from the Nutridigm dictionary.
  const [allConditions, setAllConditions] = useState([]);

  const { conditions } = profile;

  // Source the unified list from the Nutridigm dictionary (getConditions),
  // alpha-sorted by description. Falls back to mock conditions via the
  // adapter when offline. `profile.conditions` stores healthConditionID
  // numbers; the objects here are used to resolve id <-> description.
  useEffect(() => {
    let alive = true;
    getConditions()
      .then((list) => {
        if (!alive) return;
        const sorted = (list || [])
          .filter((c) => c && c.description)
          .slice()
          .sort((a, b) => a.description.localeCompare(b.description));
        setAllConditions(sorted);
      })
      .catch(() => { });
    return () => {
      alive = false;
    };
  }, []);

  const conditionById = useMemo(
    () => new Map(allConditions.map((c) => [c.healthConditionID, c.description])),
    [allConditions]
  );
  const describeCondition = (id) => conditionById.get(id) || `Condition ${id}`;

  const update = (key, val) => onChange({ ...profile, [key]: val });

  const toggleInList = (key, value) => {
    const list = profile[key];
    if (list.includes(value)) {
      update(key, list.filter((v) => v !== value));
    } else {
      update(key, [...list, value]);
    }
  };

  const { conditionResults, synonymMatch } = useMemo(() => {
    // No query → the full alpha-sorted list is browseable (brief §3).
    if (!conditionQuery.trim()) return { conditionResults: allConditions, synonymMatch: null };

    const q = conditionQuery.toLowerCase().trim();
    const resolvedName = resolveQuery(conditionQuery);
    // Match on description OR any Nutridigm-provided AKA alias (e.g. "AUD",
    // "T2D" style abbreviations the dictionary itself carries) — defensive
    // `c.AKA || ''` in case a condition record omits it.
    const direct = allConditions.filter((c) => {
      if (c.description.toLowerCase().includes(q)) return true;
      return splitAka(c.AKA).some((alias) => alias.toLowerCase().includes(q));
    });
    if (resolvedName && !direct.some((m) => m.description === resolvedName)) {
      const resolvedCondition = allConditions.find(
        (c) => c.description.toLowerCase().trim() === resolvedName.toLowerCase().trim()
      );
      if (resolvedCondition) direct.unshift(resolvedCondition);
    }

    return { conditionResults: direct, synonymMatch: resolvedName };
  }, [conditionQuery, allConditions]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      <div className="flex-none px-7 pt-6 relative z-10 bg-[#BBCEFF]">
        <div className="flex items-center justify-between h-9">
          {onBack && <BackButton onClick={onBack} />}
          <span className="font-label text-xs tracking-widest uppercase text-blue-950/60">4 of 4</span>
        </div>
      </div>

      {/* ── Form area (blue): single integrated-search page ───────────────── */}
      <div
        className="flex-1 relative overflow-hidden hide-scrollbar"
        style={{ backgroundColor: '#BBCEFF' }}
      >
        <div className="absolute inset-0 overflow-hidden px-7 pb-2">
          <ConditionsPanel
            conditions={conditions}
            conditionQuery={conditionQuery}
            setConditionQuery={setConditionQuery}
            conditionResults={conditionResults}
            synonymMatch={synonymMatch}
            toggleInList={toggleInList}
            describeCondition={describeCondition}
          />
        </div>
      </div>

      <div className="flex-none px-7 pt-3 bg-[#BBCEFF]" style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}>
        <button
          type="button"
          onClick={onSubmit}
          disabled={conditions.length === 0 || saving}
          className="w-full py-4 rounded-pill text-white font-semibold text-base bg-blue-950 hover:bg-blue-900 disabled:opacity-40 disabled:cursor-not-allowed min-h-[56px] font-sans focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-950"
        >
          {saving ? 'Saving your profile…' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

function ConditionsPanel({
  conditions,
  conditionQuery,
  setConditionQuery,
  conditionResults,
  synonymMatch,
  toggleInList,
  describeCondition,
}) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const availableResults = conditionResults.filter(
    (c) => !conditions.includes(c.healthConditionID)
  );
  const open = focused || !!conditionQuery.trim();

  const openSearch = () => inputRef.current?.focus();

  return (
    <section className="flex flex-col items-center h-full min-h-0">
      <div className="w-full max-w-[420px] flex flex-col flex-1 min-h-0 overflow-y-auto">
        {!open && (
          <div className="flex justify-center py-2 min-h-[150px]" style={{ flex: '0 1 calc(46dvh - 60px)' }}>
            <FruitScene scene="garden" src={fruitIllustration} alt="A sunny yellow lemon laughing with delight" />
          </div>
        )}
        {/* Question — slides down from the top (snap) as the page opens */}
        <motion.h1
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...snappySpring, delay: 0.1 }}
          className="flex-none -mx-3 text-[32px] text-balance leading-[1.16] font-semibold tracking-tight text-center mt-3 mb-6"
          style={{ fontFamily: 'Chillax, sans-serif' }}
        >
          Select the health topics that matter most to you
        </motion.h1>

        {/* Standalone search field */}
        <div className="relative group flex-none mb-3">
          <span className="material-symbols-rounded absolute left-[15px] top-1/2 -translate-y-1/2 text-[18px] pointer-events-none transition-colors duration-fast text-blue-950/55 group-focus-within:text-blue-950">
            search
          </span>
          <input
            ref={inputRef}
            type="search"
            value={conditionQuery}
            onChange={(e) => setConditionQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-label="Search conditions, diets, allergies"
            placeholder="Search conditions, diets, allergies…"
            className="w-full pl-11 pr-4 py-[15px] rounded-full border-[1.5px] border-blue-950/10 bg-[#E0E7F5] text-[16px] text-blue-950 placeholder:text-blue-950/55 font-sans shadow-sm transition-all duration-fast ease-ds-out focus:outline-none focus:border-blue-950/40 focus:shadow-sm"
          />
        </div>

        {/* Results card — only rendered when search is open */}
        {open && (
          <motion.div
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'tween', duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex flex-col rounded-t-[24px] p-3 flex-1 min-h-0 mt-3"
            style={{
              backgroundColor: '#CAD7F0',
              borderTop: '1px solid rgba(255,255,255,0.45)',
              borderLeft: '1px solid rgba(255,255,255,0.45)',
              borderRight: '1px solid rgba(255,255,255,0.45)',
            }}
          >
            {/* "In profile" chips */}
            {conditions.length > 0 && (
              <div className="flex-none flex flex-col gap-1.5 mb-2" onMouseDown={(e) => e.preventDefault()}>
                <span className="text-[11px] font-semibold text-blue-950 uppercase tracking-wider">in profile</span>
                <div className="flex flex-wrap gap-1.5">
                  {conditions.map((c) => {
                    const label = describeCondition(c);
                    const meta = getConditionMeta(label);
                    return (
                      <button
                        key={c}
                        onClick={() => toggleInList('conditions', c)}
                        className="flex items-center gap-1 px-2 py-[3px] rounded-full text-[11px] font-semibold text-white font-sans"
                        style={{ backgroundColor: `${meta.color}88` }}
                      >
                        {label}
                        <span className="material-symbols-rounded text-[12px] text-white/60">close</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Synonym hint */}
            {synonymMatch && conditionQuery.trim() && (
              <p className="flex-none text-[13px] mt-3 font-sans font-semibold tracking-wide" style={{ color: '#4c599aff' }}>
                Showing results for "{synonymMatch}"
              </p>
            )}

            {/* Results — scrolls inside the card */}
            <div
              className="flex flex-col gap-2 mt-3 flex-1 min-h-0 overflow-y-auto pr-1"
              onMouseDown={(e) => e.preventDefault()}
            >
              {availableResults.map((c) => (
                <motion.button
                  key={c.healthConditionID}
                  whileTap={{ scale: 0.98 }}
                  transition={chipSpring}
                  onClick={() => {
                    toggleInList('conditions', c.healthConditionID);
                    setConditionQuery('');
                  }}
                  className="flex-none w-full text-left px-4 py-4 rounded-sm text-sm font-medium bg-[#E0E7F5] text-blue-950 border border-blue-950/10 hover:border-blue-950/40 shadow-sm hover:shadow-md transition-all duration-fast min-h-[52px] font-sans flex items-center gap-2.5"
                >
                  {(() => {
                    const meta = getConditionMeta(c.description);
                    return (
                      <span
                        className="material-symbols-rounded text-[18px] flex-shrink-0"
                        style={{ color: meta.color }}
                      >
                        {meta.icon}
                      </span>
                    );
                  })()}
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="truncate">{c.description}</span>
                    {c.longDescription && (
                      <span className="block text-[11px] font-normal text-char-400 truncate">
                        {truncate(c.longDescription)}
                      </span>
                    )}
                  </span>
                </motion.button>
              ))}
              {conditionQuery.trim() && conditionResults.length === 0 && (
                <p className="text-[15px] text-center py-8 font-sans font-medium tracking-wide" style={{ color: '#6B645A' }}>
                  No conditions found for "{conditionQuery}"
                </p>
              )}
              {!conditionQuery.trim() && availableResults.length === 0 &&
                Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={`skeleton-${i}`}
                    className="flex-none w-full px-4 py-4 rounded-sm bg-white/70 border border-white/40 min-h-[52px] flex items-center gap-2.5 animate-pulse"
                    style={{ animationDelay: `${i * 0.09}s` }}
                  >
                    <span className="w-[18px] h-[18px] rounded-full bg-char-900/10 flex-shrink-0" />
                    <span
                      className="h-3 rounded-full bg-char-900/10"
                      style={{ width: `${50 + ((i * 17) % 38)}%` }}
                    />
                  </div>
                ))}
            </div>
          </motion.div>
        )}

        {/* Picked-condition boxes — visible when search is closed */}
        <AnimatePresence>
          {!open && (
            <motion.div
              initial={{ y: 12 }}
              animate={{ y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0 } }}
              transition={settleFast}
              className="flex-none rounded-[18px] p-2 flex flex-col gap-1.5 mt-3"
              style={{
                backgroundColor: '#CAD7F0',
                borderTop: '1px solid rgba(255,255,255,0.45)',
                borderLeft: '1px solid rgba(255,255,255,0.45)',
                borderRight: '1px solid rgba(255,255,255,0.45)',
              }}
            >
              <div className="grid grid-cols-3 gap-2 w-full">
                {[0, 1, 2].map((i) => {
                  const c = conditions[i];
                  const label = c != null ? describeCondition(c) : null;
                  const meta = c != null ? getConditionMeta(label) : null;
                  return (
                    <motion.button
                      key={i}
                      initial={{ y: -16 }}
                      animate={{ y: 0 }}
                      transition={{ ...settleFast, delay: i * 0.03 }}
                      onClick={() => (c ? toggleInList('conditions', c) : openSearch())}
                      aria-label={c ? `Remove ${label}` : 'Add a condition'}
                      className="min-h-[100px] rounded-xl flex flex-col transition-all duration-fast font-sans relative overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-950"
                      style={
                        c
                          ? { backgroundColor: '#E0E7F5' }
                          : {
                            backgroundColor: '#ADC3EC',
                            border: '1.5px solid #8BA8DA',
                          }
                      }
                    >
                      {c ? (
                        <>
                          {/* Category label — top left */}
                          <div className="absolute top-2.5 left-2.5">
                            <span
                              className="text-[9px] font-semibold uppercase tracking-widest text-black/35"
                              style={{ fontFamily: 'Quantico, sans-serif' }}
                            >
                              {meta.label}
                            </span>
                          </div>
                          {/* Close — top right */}
                          <div className="absolute top-2 right-2">
                            <span className="material-symbols-rounded text-[14px] text-black/20">close</span>
                          </div>
                          {/* Condition name — centered */}
                          <div className="flex-1 flex items-center justify-center px-2">
                            <span className="text-[16px] font-semibold text-char-900 leading-tight text-center" style={{ fontFamily: 'Switzer, sans-serif' }}>
                              {label}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-1.5">
                          <svg width="28" height="28" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <line x1="18" y1="6" x2="18" y2="30" stroke="#314F87" strokeWidth="4.5" strokeLinecap="round" />
                            <line x1="6" y1="18" x2="30" y2="18" stroke="#314F87" strokeWidth="4.5" strokeLinecap="round" />
                          </svg>
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
