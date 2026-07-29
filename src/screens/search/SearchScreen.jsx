import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, X } from 'lucide-react';
import { searchFoodsAndRecipes, searchNaturalSourceItems, buildRecipeDetail } from '../../api/api.js';
import { storage } from '../../api/storage.js';
import { DEFAULT_DEV_CONDITIONS } from '../../api/config.js';
import { getRecentSearches, addRecentSearch } from '../../state/recentSearches.js';
import Icon from '../../components/shared/Icon.jsx';
import PillSwitcher from '../../components/shared/PillSwitcher.jsx';
import FoodDetailCard from '../../components/FoodDetailCard.jsx';

// Mode configs — Food Lookup vs Natural Sources. Backdrop colors are the
// exact hex values behind the `yellow-200`/`blue-200` Tailwind tokens
// (see tailwind.config.js) so framer-motion can animate between them as
// real color values instead of instant class swaps. `accentFocusClass` /
// `spinnerClass` key the input's focus ring and loading spinner to the same
// hue as the backdrop; `examples` feed the ghost-typing placeholder below.
const MODES = {
  food: {
    label: 'Food Lookup',
    heading: 'Look up foods and recipes',
    searchFn: searchFoodsAndRecipes,
    recentsScope: 'default',
    backdropColor: '#FFEC88',
    accentFocusClass: 'focus:border-yellow-500',
    spinnerClass: 'text-yellow-600',
    examples: ['grilled salmon', 'greek yogurt', 'oatmeal', 'is dark chocolate good for me?'],
  },
  natural: {
    label: 'Natural Sources',
    heading: 'Look up natural sources and supplements',
    searchFn: searchNaturalSourceItems,
    recentsScope: 'natural',
    backdropColor: '#BBCEFF',
    accentFocusClass: 'focus:border-blue-500',
    spinnerClass: 'text-blue-600',
    examples: ['vitamin D', 'omega-3', 'magnesium', 'fiber'],
  },
};

const MODE_OPTIONS = [
  { key: 'food', label: MODES.food.label },
  { key: 'natural', label: MODES.natural.label },
];

function ResultRow({ kind, title, subtitle, onClick }) {
  const isRecipe = kind === 'recipe';
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex-none w-full text-left pl-4 pr-3 py-5 rounded-sm bg-white text-char-900
        border border-sand-200 shadow-sm font-sans flex items-center gap-3
        transition-all duration-fast ease-ds-out hover:border-forest-400 hover:shadow-md"
    >
      <span
        className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${isRecipe ? 'bg-lavender-100 text-lavender-600' : 'bg-forest-100 text-forest-700'
          }`}
      >
        <Icon name={isRecipe ? 'utensils' : 'leaf'} size={18} />
      </span>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-char-900 truncate leading-tight">{title}</p>
        {subtitle && <p className="text-xs text-char-500 mt-0.5 truncate">{subtitle}</p>}
      </div>
    </motion.button>
  );
}

const calmSpring = { type: 'spring', stiffness: 120, damping: 22, mass: 1 };

const PAD_IDLE = '3vh';
// Idle and results states now share the same header offset (pt-10 elsewhere
// in the app), so the label no longer shifts when the user starts typing —
// only the enter/exit animation still moves from PAD_IDLE.
const PAD_CENTER = '40px';

function getProfile() {
  const saved = storage.get('profile', null);
  if (saved?.conditions?.length) return saved;
  return { conditions: DEFAULT_DEV_CONDITIONS };
}

const GHOST_TYPE_MS = 45;
const GHOST_DELETE_MS = 26;
const GHOST_HOLD_MS = 1400;

// True once and cached for the session — reduced-motion preference doesn't
// need live updates for a decorative placeholder cycle.
const prefersReducedMotion =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

// Types out each example query char-by-char, holds, deletes, then moves to
// the next — a lightweight "what can I search here?" hint. Drives the
// input's `placeholder` attr directly (rather than an overlay element) since
// nothing else needs to occupy that space. Disabled (returns the bare first
// example, static) whenever `enabled` is false or the user prefers reduced
// motion.
function useGhostPlaceholder(examples, enabled) {
  const [text, setText] = useState('');
  const animating = enabled && examples?.length > 0 && !prefersReducedMotion;

  useEffect(() => {
    if (!animating) return undefined;

    let cancelled = false;
    let timer = null;
    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;

    const tick = () => {
      if (cancelled) return;
      const phrase = examples[phraseIndex];
      if (!deleting) {
        charIndex += 1;
        setText(phrase.slice(0, charIndex));
        if (charIndex >= phrase.length) {
          timer = setTimeout(() => {
            deleting = true;
            timer = setTimeout(tick, GHOST_DELETE_MS);
          }, GHOST_HOLD_MS);
          return;
        }
        timer = setTimeout(tick, GHOST_TYPE_MS);
      } else {
        charIndex -= 1;
        setText(phrase.slice(0, charIndex));
        if (charIndex <= 0) {
          deleting = false;
          phraseIndex = (phraseIndex + 1) % examples.length;
          timer = setTimeout(tick, GHOST_TYPE_MS);
          return;
        }
        timer = setTimeout(tick, GHOST_DELETE_MS);
      }
    };

    timer = setTimeout(tick, GHOST_TYPE_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [animating, examples]);

  if (!enabled || !examples?.length) return '';
  return animating ? text : examples[0];
}

export default function SearchScreen({ active, onClose }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlMode = searchParams.get('mode') === 'natural' ? 'natural' : 'food';
  const [mode, setMode] = useState(urlMode);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const profile = useRef(getProfile());

  const {
    heading,
    searchFn,
    recentsScope,
    backdropColor,
    accentFocusClass,
    spinnerClass,
    examples,
  } = MODES[mode];

  const hasQuery = query.trim().length > 0;
  const ghostPlaceholder = useGhostPlaceholder(examples, active && !hasQuery);
  // Derived straight from storage on every render rather than mirrored into
  // state — addRecentSearch() writes synchronously, so by the time any
  // re-render happens (triggered by the same handler's other setState calls)
  // this already reflects the latest list. Avoids a setState-in-effect just
  // to keep a copy in sync.
  const recents = active ? getRecentSearches(recentsScope) : [];

  useEffect(() => {
    if (!active) return undefined;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    // Reset on the way out (cleanup runs when `active` flips back to false,
    // or on unmount) so the surface reopens blank next time, instead of
    // setting state synchronously in the effect body itself.
    return () => {
      clearTimeout(t);
      setQuery('');
      setResults([]);
      setSearching(false);
      setSelectedItem(null);
    };
  }, [active]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // Whichever path changed `mode` (pill toggle or the URL-driven sync below),
  // any debounced search still in flight was queued against the previous
  // mode's searchFn — cancel it. A ref mutation, not state, so this belongs
  // in an effect rather than the render-time branch that adjusts state.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, [mode]);

  const runSearch = useCallback(async (q) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const r = await searchFn(trimmed, profile.current);
      setResults(r);
    } catch (err) {
      console.error('SearchScreen: search failed', err);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchFn]);

  const handleChange = (val) => {
    setQuery(val);
    setSelectedItem(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 300);
  };

  // Switching modes changes searchFn/recentsScope, so any in-flight query and
  // its results (scoped to the previous mode) are stale — clear them rather
  // than showing e.g. recipe results under the Natural Sources searchFn.
  // Only used from the event handler below (touches the debounce ref, which
  // render-phase code may not do — see the render-time branch further down).
  const resetForModeChange = (nextMode) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setMode(nextMode);
    setQuery('');
    setResults([]);
    setSearching(false);
    setSelectedItem(null);
  };

  // Pill toggle: local state drives the mode instantly, then the URL is
  // synced as a side effect (replace, not push) — never a navigation, so it
  // never remounts this screen or retriggers the open/close animation.
  const handleModeChange = (nextMode) => {
    resetForModeChange(nextMode);
    setSearchParams(nextMode === 'natural' ? { mode: 'natural' } : {}, { replace: true });
  };

  // Reverse direction: the URL's `mode` param changed out from under us
  // (e.g. browser back/forward) without the pill being clicked — sync local
  // mode state to match. Adjusting state during render (guarded by the
  // equality check, same pattern React recommends for "adjusting state when
  // a prop changes") rather than in an effect — `mode` catches up to
  // `urlMode` within the same render pass instead of committing a stale
  // frame first. Only plain setState here (no ref access, which render-phase
  // code isn't allowed) — the debounce timer is cancelled separately by the
  // `mode`-keyed effect above.
  if (urlMode !== mode) {
    setMode(urlMode);
    setQuery('');
    setResults([]);
    setSearching(false);
    setSelectedItem(null);
  }

  const runChip = (term) => {
    setQuery(term);
    addRecentSearch(term, recentsScope);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    runSearch(term);
  };

  const commitRecent = useCallback((term) => {
    const t = (term || '').trim();
    if (!t) return;
    addRecentSearch(t, recentsScope);
  }, [recentsScope]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      commitRecent(query);
      runSearch(query);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const openFood = (food) => {
    commitRecent(query);
    setSelectedItem({ foodId: food.id, name: food.name });
  };

  const openRecipe = (recipe) => {
    commitRecent(query);
    // Recipe search results use title/photo instead of FoodDetailCard's
    // item shape's name/image — map to the card shape buildRecipeDetail
    // expects (mirrors SuggestionsScreen's BestRecipesTab openRecipe).
    const card = {
      foodId: recipe.foodId ?? recipe.id ?? null,
      name: recipe.title,
      image: recipe.photo,
      sourceName: recipe.sourceName ?? null,
      matchedConditions: recipe.matchedConditions ?? [],
    };
    // Seed immediately with what the search result already carries; enrich
    // async via the same buildRecipeDetail flow MealprepCarousel/SuggestionsScreen use.
    setSelectedItem({
      foodId: card.foodId,
      name: card.name,
      image: card.image,
      sourceName: card.sourceName,
      conditions: card.matchedConditions,
      ingredients: [],
      isRecipe: true,
    });
    buildRecipeDetail(card, profile.current)
      .then((detail) => setSelectedItem({ ...detail, isRecipe: true }))
      .catch(() => { });
  };

  const padTarget = PAD_CENTER;
  const showNoResults = hasQuery && !searching && results.length === 0;

  return (
    <>
      <div
        className="fixed inset-x-0 top-0 z-30"
        style={{ bottom: 0, pointerEvents: active ? 'auto' : 'none' }}
      >
        <AnimatePresence>
          {active && [
            <motion.div
              key="backdrop"
              className="absolute inset-0"
              initial={{ opacity: 0, backgroundColor: backdropColor }}
              animate={{ opacity: 1, backgroundColor: backdropColor }}
              exit={{ opacity: 0 }}
              transition={{ opacity: { duration: 0.25, ease: 'easeOut' }, backgroundColor: { duration: 0.35, ease: 'easeOut' } }}
              onClick={onClose}
            />,
            <motion.div
              key="group"
              className="absolute inset-0 max-w-[430px] mx-auto px-5 flex flex-col pointer-events-none"
              initial={{ paddingTop: PAD_IDLE, opacity: 0 }}
              animate={{ paddingTop: padTarget, opacity: 1 }}
              exit={{ paddingTop: PAD_IDLE, opacity: 0 }}
              transition={{ default: calmSpring, opacity: { duration: 0.25, ease: 'easeOut' } }}
            >
              <p className="font-label text-xs tracking-widest uppercase text-blue-950/60 flex-none">
                Search
              </p>
              <h1 className="font-display text-[32px] font-semibold text-blue-950 leading-tight mt-2 flex-none">
                {heading}
              </h1>

              <div className="mt-4 flex-none pointer-events-auto">
                <PillSwitcher options={MODE_OPTIONS} value={mode} onChange={handleModeChange} />
              </div>

              <div className="relative mt-4 flex-none pointer-events-auto">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-char-400 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => handleChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  placeholder={ghostPlaceholder}
                  className={`w-full pl-12 pr-12 py-4 rounded-xl bg-white border-[1.5px] border-sand-200
                    text-base text-char-900 placeholder:text-char-400 font-sans
                    shadow-[0_2px_8px_rgba(45,36,24,0.06)]
                    transition-all duration-fast ease-ds-out
                    focus:outline-none ${accentFocusClass} focus:shadow-[0_4px_12px_rgba(45,36,24,0.10)]`}
                />
                {searching ? (
                  <Loader2 size={18} className={`absolute right-4 top-1/2 -translate-y-1/2 ${spinnerClass} animate-spin`} />
                ) : query ? (
                  <button
                    onClick={() => handleChange('')}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center
                      rounded-full text-char-400 hover:text-char-700 hover:bg-sand-100 transition-colors duration-fast"
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>

              <div className="flex-1 min-h-0 mt-4 pointer-events-auto">
                <div className="h-full p-3 flex flex-col rounded-t-[24px]" style={{ backgroundColor: 'rgba(255,255,255,0.62)', borderTop: '1px solid rgba(255,255,255,0.75)', borderLeft: '1px solid rgba(255,255,255,0.75)', borderRight: '1px solid rgba(255,255,255,0.75)' }}>
                  <AnimatePresence mode="wait">
                    {hasQuery ? (
                      <motion.div
                        key="results"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="h-full overflow-y-auto hide-scrollbar pb-1 flex flex-col gap-2.5"
                      >
                        {showNoResults ? (
                          <p className="font-sans text-sm text-char-700 text-center py-12">
                            No matches for "{query.trim()}" — try a different term.
                          </p>
                        ) : (
                          results.map((item) =>
                            item.kind === 'food' ? (
                              <ResultRow
                                key={item.key}
                                kind="food"
                                title={item.food.name}
                                subtitle={item.food.category || 'Ingredient'}
                                onClick={() => openFood(item.food)}
                              />
                            ) : (
                              <ResultRow
                                key={item.key}
                                kind="recipe"
                                title={item.recipe.title}
                                subtitle={item.recipe.sourceName}
                                onClick={() => openRecipe(item.recipe)}
                              />
                            ),
                          )
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="chips"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="h-full overflow-y-auto hide-scrollbar pb-1 flex flex-col"
                      >
                        {recents.length > 0 && (
                          <>
                            <p className="text-[12px] font-label tracking-[0.14em] uppercase text-char-700 mb-2">
                              Recent searches
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {recents.map((term) => (
                                <button
                                  key={term}
                                  onClick={() => runChip(term)}
                                  className="px-3.5 py-2 rounded-pill border border-sand-200 bg-white text-sm text-char-900 font-sans
                                    transition-all duration-fast ease-ds-out
                                    hover:border-forest-400 hover:bg-forest-50 active:bg-sand-100"
                                >
                                  {term}
                                </button>
                              ))}
                            </div>
                          </>
                        )}

                        {/* Fills the leftover space below the recents (or the whole
                            area when there are none) with a quiet empty-state hint
                            rather than leaving it blank. */}
                        <div className="flex-1 flex flex-col items-center justify-center gap-2">
                          <Search size={32} strokeWidth={1.5} className="text-blue-950/25" />
                          <p className="text-sm font-sans text-blue-950/30">Searches appear here</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>,
          ]}
        </AnimatePresence>
      </div>

      <FoodDetailCard
        item={selectedItem}
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </>
  );
}
