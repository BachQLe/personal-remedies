import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, X } from 'lucide-react';
import { searchFoodsAndRecipes } from '../../api/api.js';
import { storage } from '../../api/storage.js';
import { DEFAULT_DEV_CONDITIONS } from '../../api/config.js';
import { getRecentSearches, addRecentSearch } from '../../state/recentSearches.js';
import { addToLibrary } from '../../state/library.js';
import Icon from '../../components/shared/Icon.jsx';
import FoodDetail from '../../components/FoodDetail.jsx';
import RecipeDetail from '../../components/RecipeDetail.jsx';

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
        className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
          isRecipe ? 'bg-lavender-100 text-lavender-600' : 'bg-forest-100 text-forest-700'
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
const PAD_CENTER = '26vh';
const PAD_RESULTS = '9vh';

function getProfile() {
  const saved = storage.get('profile', null);
  if (saved?.conditions?.length) return saved;
  return { conditions: DEFAULT_DEV_CONDITIONS };
}

// Resolve a display name for the greeting: prefer the prop (Home already reads
// storage itself and passes the trimmed firstName), fall back to storage
// directly so the standalone `/app/search` route (which renders this screen
// with no `name` prop) still greets correctly. Never surfaces a literal
// placeholder like "[name]" — no resolvable name → generic "Good morning".
function resolveName(nameProp) {
  const propTrimmed = typeof nameProp === 'string' ? nameProp.trim() : '';
  if (propTrimmed && propTrimmed !== '[name]') return propTrimmed;
  const stored = storage.get('profile', null)?.firstName;
  const storedTrimmed = typeof stored === 'string' ? stored.trim() : '';
  return storedTrimmed || null;
}

export default function SearchScreen({ active, onClose, name }) {
  const displayName = resolveName(name);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [recents, setRecents] = useState([]);
  const [selectedFood, setSelectedFood] = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const profile = useRef(getProfile());

  const hasQuery = query.trim().length > 0;

  useEffect(() => {
    if (active) {
      setRecents(getRecentSearches());
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    setQuery('');
    setResults([]);
    setSearching(false);
    setSelectedFood(null);
    setSelectedRecipe(null);
  }, [active]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const runSearch = useCallback(async (q) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const r = await searchFoodsAndRecipes(trimmed, profile.current);
      setResults(r);
    } catch (err) {
      console.error('SearchScreen: search failed', err);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleChange = (val) => {
    setQuery(val);
    setSelectedFood(null);
    setSelectedRecipe(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 300);
  };

  const runChip = (term) => {
    setQuery(term);
    addRecentSearch(term);
    setRecents(getRecentSearches());
    if (debounceRef.current) clearTimeout(debounceRef.current);
    runSearch(term);
  };

  const commitRecent = useCallback((term) => {
    const t = (term || '').trim();
    if (!t) return;
    addRecentSearch(t);
    setRecents(getRecentSearches());
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      commitRecent(query);
      runSearch(query);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const openFood = (food) => { commitRecent(query); setSelectedFood(food); };
  const openRecipe = (recipe) => { commitRecent(query); setSelectedRecipe(recipe); };

  const padTarget = hasQuery ? PAD_RESULTS : PAD_CENTER;
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
              className="absolute inset-0 bg-yellow-200"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
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
              <h1 className="font-display text-[32px] font-semibold text-blue-950 leading-tight flex-none">
                {displayName ? `Hi there, ${displayName}` : 'Good morning'}
              </h1>

              <div className="relative mt-4 flex-none pointer-events-auto">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-char-400 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => handleChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  placeholder="Search foods, recipes…"
                  className="w-full pl-12 pr-12 py-4 rounded-xl bg-white border-[1.5px] border-sand-200
                    text-base text-char-900 placeholder:text-char-400 font-sans
                    shadow-[0_2px_8px_rgba(45,36,24,0.06)]
                    transition-all duration-fast ease-ds-out
                    focus:outline-none focus:border-forest-400 focus:shadow-[0_4px_12px_rgba(45,36,24,0.10)]"
                />
                {searching ? (
                  <Loader2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-forest-600 animate-spin" />
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>,
          ]}
        </AnimatePresence>
      </div>

      {selectedFood && (
        <FoodDetail
          food={selectedFood}
          profile={profile.current}
          onClose={() => setSelectedFood(null)}
          onAddToLibrary={addToLibrary}
        />
      )}
      {selectedRecipe && (
        <RecipeDetail
          recipe={selectedRecipe}
          profile={profile.current}
          onClose={() => setSelectedRecipe(null)}
        />
      )}
    </>
  );
}
