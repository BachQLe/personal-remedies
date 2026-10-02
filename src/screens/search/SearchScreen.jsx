import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, X } from 'lucide-react';
import { searchEverything, buildRecipeDetail, getGroupLabel } from '../../api/api.js';
import { storage } from '../../api/storage.js';
import { DEFAULT_DEV_CONDITIONS } from '../../api/config.js';
import { getRecentSearches, addRecentSearch } from '../../state/recentSearches.js';
import Icon from '../../components/shared/Icon.jsx';
import FoodDetailCard from '../../components/FoodDetailCard.jsx';
import SaveButton from '../../components/shared/SaveButton.jsx';
import DataState from '../../components/shared/DataState.jsx';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { useSnackbar } from '../../context/SnackbarContext.jsx';
import { recipeToSaveItem } from '../../utils/saveGate.js';

// Single "Food & Nutrient Lookup" search surface — no mode switcher. One
// query fans out to `searchEverything` (foods, recipes, and the nutrients/
// herbal-supplements split of the old "Natural Sources" screen, which has
// been folded in here), and the results render as up to four labelled
// sections (Foods / Recipes / Nutrients / Herbal Supplements), each omitted
// entirely when it has no rows. `BACKDROP_COLOR` is the shared green page
// background every screen uses (tailwind.config.js's `forest-300`);
// `ACCENT_FOCUS_CLASS`/`SPINNER_CLASS` keep the old "Food Lookup" yellow
// accents (`yellow-500`/`yellow-600`) on the white input — kept as module
// constants (not a MODES table) since there's only one mode now.
const HEADING = 'Food & Nutrient Lookup';
const PLACEHOLDER = 'Search foods, recipes, nutrients…';
const BACKDROP_COLOR = '#C8E87A';
const ACCENT_FOCUS_CLASS = 'focus:border-yellow-500';
const SPINNER_CLASS = 'text-yellow-600';

// Section order + labels for `searchEverything`'s sectioned result shape
// (`{ foods, recipes, nutrients, herbals }`). Rendered in this order, each
// section skipped entirely when its array is empty.
const SECTIONS = [
  { key: 'foods', label: 'Foods' },
  { key: 'recipes', label: 'Recipes' },
  { key: 'nutrients', label: 'Nutrients' },
  { key: 'herbals', label: 'Herbal Supplements' },
];

const EMPTY_SECTIONS = { foods: [], recipes: [], nutrients: [], herbals: [] };

/**
 * `useAsyncData`'s default emptiness check (loadState.js#defaultIsEmpty)
 * treats any non-array object with own keys as non-empty — but the sectioned
 * shape here ALWAYS has all four keys, even when every array inside is
 * empty. Without this override, a genuine zero-result search would render
 * as 'success' with nothing to show instead of the 'empty' DataState branch.
 * @param {typeof EMPTY_SECTIONS} data
 * @returns {boolean}
 */
function isSectionsEmpty(data) {
  if (!data) return true;
  return SECTIONS.every(({ key }) => !data[key] || data[key].length === 0);
}

/**
 * Resolve each food-kind result's real food-group label (e.g. "Vegetables",
 * "Herbal Supplements") and stamp it on as `groupLabel`, mutating the
 * sections in place. `normalizeFood` (adapter.js) never sets a `category`
 * field, so without this every food row would render the FoodDetailCard-era
 * placeholder subtitle "Ingredient" regardless of what the food actually is.
 * `getGroupLabel` reads the bundled, already-cached /foodgroups dictionary
 * (localTables.js#getGroupTable via adapter.js) — zero network — so this is
 * cheap; codes are deduped first so a results page with many foods from the
 * same group only resolves that group's label once.
 * @param {typeof EMPTY_SECTIONS} sections
 * @returns {Promise<typeof EMPTY_SECTIONS>}
 */
async function attachFoodGroupLabels(sections) {
  const foodItems = [...sections.foods, ...sections.nutrients, ...sections.herbals].map(
    (r) => r.food,
  );
  const codes = [...new Set(foodItems.map((f) => f.fineGroup || f.group))];
  const labelEntries = await Promise.all(codes.map(async (code) => [code, await getGroupLabel(code)]));
  const labelByCode = new Map(labelEntries);
  for (const food of foodItems) {
    food.groupLabel = labelByCode.get(food.fineGroup || food.group);
  }
  return sections;
}

function ResultRow({ kind, title, subtitle, onClick, saveItem, onSaveBlocked }) {
  // `saveItem` is opt-in — only recipe rows carry one (they're the only
  // saveable kind here; a plain food/nutrient/herbal result has nothing to
  // save, so passing a SaveButton for it would always render as blocked).
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
        <Icon name={isRecipe ? 'utensils' : 'leaf'} size={18} aria-hidden="true" />
      </span>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-char-900 truncate leading-tight">{title}</p>
        {subtitle && <p className="text-xs text-char-500 mt-0.5 truncate">{subtitle}</p>}
      </div>

      {saveItem && (
        <SaveButton item={saveItem} onBlocked={onSaveBlocked} className="flex-shrink-0" />
      )}
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

export default function SearchScreen({ active, onClose }) {
  const [query, setQuery] = useState('');
  // The query a fetch actually runs against — updated 300ms after the last
  // keystroke (handleChange's debounce), or immediately on Enter/a
  // recent-search chip. Kept separate from `query` (the raw input value) so
  // useAsyncData's deps array only re-fires once the debounce settles, not
  // on every keystroke.
  const [committedQuery, setCommittedQuery] = useState('');
  // True only while a debounce timer is pending. useAsyncData's own
  // `status` only reports 'loading' for the hook's very first fetch — later
  // dep-driven refetches are stale-while-revalidate by design (see
  // useAsyncData.js), so it can't alone reproduce the old per-keystroke
  // input spinner. This flag covers the debounce wait; `status === 'loading'`
  // covers a fetch actually in flight; the input spinner shows for either.
  const [debouncePending, setDebouncePending] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const profile = useRef(getProfile());
  const { show } = useSnackbar();

  const hasQuery = query.trim().length > 0;
  const trimmedCommitted = committedQuery.trim();

  const fetcher = useCallback(async () => {
    if (!trimmedCommitted) return EMPTY_SECTIONS;
    const sections = await searchEverything(trimmedCommitted, profile.current);
    return attachFoodGroupLabels(sections);
  }, [trimmedCommitted]);

  const { status, data, retry } = useAsyncData(fetcher, [trimmedCommitted], {
    isEmpty: isSectionsEmpty,
  });
  const results = data ?? EMPTY_SECTIONS;

  // Derived straight from storage on every render rather than mirrored into
  // state — addRecentSearch() writes synchronously, so by the time any
  // re-render happens (triggered by the same handler's other setState calls)
  // this already reflects the latest list. Avoids a setState-in-effect just
  // to keep a copy in sync.
  const recents = active ? getRecentSearches() : [];

  useEffect(() => {
    if (!active) return undefined;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    // Reset on the way out (cleanup runs when `active` flips back to false,
    // or on unmount) so the surface reopens blank next time, instead of
    // setting state synchronously in the effect body itself.
    return () => {
      clearTimeout(t);
      setQuery('');
      setCommittedQuery('');
      setDebouncePending(false);
      setSelectedItem(null);
    };
  }, [active]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleChange = (val) => {
    setQuery(val);
    setSelectedItem(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = val.trim();
    if (!trimmed) {
      setDebouncePending(false);
      setCommittedQuery('');
      return;
    }
    setDebouncePending(true);
    debounceRef.current = setTimeout(() => {
      setDebouncePending(false);
      setCommittedQuery(val);
    }, 300);
  };

  const runChip = (term) => {
    setQuery(term);
    addRecentSearch(term);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setDebouncePending(false);
    setCommittedQuery(term);
  };

  const commitRecent = useCallback((term) => {
    const t = (term || '').trim();
    if (!t) return;
    addRecentSearch(t);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      commitRecent(query);
      setDebouncePending(false);
      setCommittedQuery(query);
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
    // Forward the real C1 overlay fields (when present upstream on the
    // Recipe — see adapter.js's getRecipesRaw) so buildRecipeDetail can
    // read them through onto the card payload.
    if (recipe.sourceUrl) card.sourceUrl = recipe.sourceUrl;
    if (recipe.attribution) card.attribution = recipe.attribution;
    if (recipe.nutritionPerServing) card.nutritionPerServing = recipe.nutritionPerServing;
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
  const searching = debouncePending || status === 'loading';

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
              initial={{ opacity: 0, backgroundColor: BACKDROP_COLOR }}
              animate={{ opacity: 1, backgroundColor: BACKDROP_COLOR }}
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
                {HEADING}
              </h1>

              <div className="relative mt-4 flex-none pointer-events-auto">
                <Search size={20} aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-char-400 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => handleChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  placeholder={PLACEHOLDER}
                  className={`w-full pl-12 pr-12 py-4 rounded-xl bg-white border-[1.5px] border-sand-200
                    text-base text-char-900 placeholder:text-char-400 font-sans
                    shadow-[0_2px_8px_rgba(45,36,24,0.06)]
                    transition-all duration-fast ease-ds-out
                    focus:outline-none ${ACCENT_FOCUS_CLASS} focus:shadow-[0_4px_12px_rgba(45,36,24,0.10)]`}
                />
                {searching ? (
                  <Loader2 size={18} className={`absolute right-4 top-1/2 -translate-y-1/2 ${SPINNER_CLASS} animate-spin`} aria-hidden="true" />
                ) : query ? (
                  <button
                    onClick={() => handleChange('')}
                    aria-label="Clear search"
                    className="tap-target absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center
                      rounded-full text-char-400 hover:text-char-700 hover:bg-sand-100 transition-colors duration-fast"
                  >
                    <X size={16} aria-hidden="true" />
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
                        className="h-full overflow-y-auto hide-scrollbar pb-1 flex flex-col gap-5"
                      >
                        {/* Idle-vs-no-results distinction (must survive): this
                            DataState only ever mounts once `hasQuery` is true —
                            the idle recents/hint view below is a completely
                            separate branch, never routed through 'empty'. */}
                        <DataState
                          status={status}
                          onRetry={retry}
                          emptyTitle="No matches"
                          emptyBody={`No matches for "${query.trim()}" — try a different term.`}
                          screenName="search results"
                        >
                          {SECTIONS.map(({ key, label }) => {
                            const rows = results[key];
                            if (!rows || !rows.length) return null;
                            return (
                              <div key={key}>
                                <p className="text-[12px] font-label tracking-[0.14em] uppercase text-char-700 mb-2">
                                  {label}
                                </p>
                                <div className="flex flex-col gap-2.5">
                                  {rows.map((item) =>
                                    item.kind === 'food' ? (
                                      <ResultRow
                                        key={item.key}
                                        kind="food"
                                        title={item.food.name}
                                        subtitle={item.food.groupLabel || 'Ingredient'}
                                        onClick={() => openFood(item.food)}
                                      />
                                    ) : (
                                      <ResultRow
                                        key={item.key}
                                        kind="recipe"
                                        title={item.recipe.title}
                                        subtitle={item.recipe.sourceName}
                                        onClick={() => openRecipe(item.recipe)}
                                        saveItem={recipeToSaveItem(item.recipe)}
                                        onSaveBlocked={show}
                                      />
                                    ),
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </DataState>
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
                            rather than leaving it blank. Not a DataState/empty
                            status — this is the idle view, shown whenever there's
                            no query at all, distinct from a completed search that
                            found zero results (the DataState branch above). */}
                        <div className="flex-1 flex flex-col items-center justify-center gap-2">
                          <Search size={32} strokeWidth={1.5} className="text-blue-950/25" aria-hidden="true" />
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
