import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, UtensilsCrossed, Fish, Egg, Apple, Carrot, Wheat, Milk, Cookie, Soup, Pill,
} from 'lucide-react';
import {
  getSuggestions, getWorstFoods, getRecipes, getCachedRefCount, warmReferenceCount, getConditionNames,
} from '../../api/api.js';
import { DEFAULT_DEV_CONDITIONS, COARSE_GROUP_LABELS } from '../../api/config.js';
import { getRecommendations, getUsedFallback } from '../../api/recommendations.js';
import { api } from '../../api/api.js';
import { addToLibrary } from '../../state/library.js';
import IngredientCard from '../../components/IngredientCard.jsx';
import FoodDetail from '../../components/FoodDetail.jsx';
import RecipeDetailCard from '../../components/RecipeDetailCard.jsx';
import { buildRecipeDetail } from '../../api/recipeDetail.js';
import DemoDataChip from '../../components/shared/DemoDataChip.jsx';
import CategoryDetailSheet from './CategoryDetailSheet.jsx';

// ── Constants ────────────────────────────────────────────────────────────────

const BG_COLOR = '#111E58';
const CARDS_PER_PAGE = 3;
const RECS_PER_SLOT = 12;
const SWIPE_THRESHOLD = 60;

const RECIPE_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack', 'beverages'];
const MEAL_LABELS = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  snack: 'snack',
  beverages: 'beverages',
};

// ── Word-by-word reveal (from DailyPicksScreen) ──────────────────────────────


// ── Animation constants ───────────────────────────────────────────────────────

const softSpring   = { type: 'spring', stiffness: 200,  damping: 26, mass: 0.8 };
const snappySlide  = { type: 'spring', stiffness: 1400, damping: 60, mass: 0.3 };
const snappyVert   = { type: 'spring', stiffness: 1800, damping: 65, mass: 0.2 };
const chipSpring   = { type: 'spring', stiffness: 500,  damping: 30, mass: 0.8 };

const slideVariants = {
  enter:  (d) => ({ opacity: 0, x: d * 48 }),
  center: { opacity: 1, x: 0 },
  exit:   (d) => ({ opacity: 0, x: d * -48 }),
};
const vertVariants = {
  enter:  (d) => ({ opacity: 0, y: d * 60 }),
  center: { opacity: 1, y: 0 },
  exit:   (d) => ({ opacity: 0, y: d * -60 }),
};

const cardVariants = {
  initial: { opacity: 0, y: 24, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit:    { opacity: 0, y: -12, scale: 0.97 },
};

// ── StepBar ──────────────────────────────────────────────────────────────────

function StepBar({ current, total, gold }) {
  const fillBg = gold
    ? 'linear-gradient(-45deg,#facc15 0%,#facc15 15%,#fde047 15%,#fde047 25%,#facc15 25%,#facc15 50%,#fde047 50%,#fde047 75%,#facc15 75%,#facc15 100%)'
    : 'white';
  return (
    <div className="flex items-center gap-2 w-full max-w-[280px]">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="flex-1 h-[18px] rounded-full overflow-hidden"
          style={{
            border: gold ? '4px solid rgba(250,204,21,0.4)' : '4px solid rgba(255,255,255,0.2)',
            background: 'transparent',
          }}
        >
          <motion.div
            className="h-full rounded-full origin-left"
            style={{ background: fillBg, backgroundSize: '20px 20px' }}
            initial={false}
            animate={{ scaleX: i <= current ? 1 : 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
      ))}
    </div>
  );
}

// ── AnimatedMealWord ──────────────────────────────────────────────────────────

function AnimatedMealWord({ word }) {
  const [measuredWidths, setMeasuredWidths] = useState(null);
  const prevWidthRef = useRef(null);

  useEffect(() => {
    const el = document.createElement('span');
    el.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-size:28px;font-weight:600;letter-spacing:-0.01em;';
    el.className = 'font-display';
    document.body.appendChild(el);
    const w = {};
    for (const label of Object.values(MEAL_LABELS)) {
      el.textContent = label;
      w[label] = Math.ceil(el.getBoundingClientRect().width) + 2;
    }
    document.body.removeChild(el);
    setMeasuredWidths(w);
  }, []);

  const currentWidth = measuredWidths?.[word];
  const isWider    = prevWidthRef.current != null && currentWidth != null && currentWidth > prevWidthRef.current;
  const isNarrower = prevWidthRef.current != null && currentWidth != null && currentWidth < prevWidthRef.current;

  useEffect(() => {
    if (currentWidth != null) prevWidthRef.current = currentWidth;
  }, [currentWidth]);

  const fastSpring  = { type: 'spring', stiffness: 800, damping: 38, mass: 0.25 };
  const widthDelay  = isNarrower ? 0.18 : 0;
  const textDelay   = isWider    ? 0.12 : 0;

  return (
    <motion.span
      style={{ display: 'inline-flex', overflow: 'hidden', verticalAlign: 'baseline', justifyContent: 'center', height: '1.15em' }}
      animate={{ width: currentWidth || 'auto' }}
      transition={{ ...fastSpring, delay: widthDelay }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={word}
          initial={{ y: '-110%', opacity: 0 }}
          animate={{ y: 0, opacity: 1, transition: { ...fastSpring, delay: textDelay } }}
          exit={{ y: '110%', opacity: 0, transition: fastSpring }}
          style={{ display: 'inline-block', whiteSpace: 'nowrap' }}
        >
          {word}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}

// ── GuidanceList ───────────────────────────────────────────────────────────────
// Primary in-page view for the Dietary Guidance tab (formerly the "See list
// view" bottom sheet — promoted to the main page body). "Backed by N
// studies" trust signal, rate-limit safe: only the top 3 rows of "Best for
// you" get an eager /references fetch (first profile condition only — 3
// calls max, deduped/cached 7d via adapter.js cachedReferences). Every other
// row shows a count ONLY if it's already sitting in the persistent cache
// from some earlier fetch (FoodDetail opens, previous warm-ups, etc.) —
// never triggers network.
const EAGER_STUDY_ROW_COUNT = 3;

function GuidanceList({ bestCategories, worstCategories, onSelectFood, profile }) {
  const [studyCounts, setStudyCounts] = useState({}); // foodId -> count|null

  const allBest  = useMemo(() => bestCategories.flatMap((c) => c.foods), [bestCategories]);
  const allWorst = useMemo(() => worstCategories.flatMap((c) => c.foods), [worstCategories]);
  const firstConditionId = profile?.conditions?.[0] ?? null;

  // Eagerly warm the top 3 "Best for you" rows (first condition only), then
  // read whatever's cached (top 3 + anything already warmed elsewhere) for
  // every row currently on screen. Runs whenever data + first condition are
  // available — idempotent and cache-backed, so re-renders are free.
  useEffect(() => {
    if (!firstConditionId) return;
    let cancelled = false;

    const topFoods = allBest.slice(0, EAGER_STUDY_ROW_COUNT);

    async function warmAndRead() {
      await Promise.all(
        topFoods.map((f) => warmReferenceCount(f.id, firstConditionId))
      );
      if (cancelled) return;

      setStudyCounts((prev) => {
        const next = { ...prev };
        for (const f of [...allBest, ...allWorst]) {
          const count = getCachedRefCount(f.id, [firstConditionId]);
          if (count !== null) next[f.id] = count;
        }
        return next;
      });
    }

    warmAndRead();
    return () => { cancelled = true; };
  }, [firstConditionId, allBest, allWorst]);

  const withStudyCount = (food) => {
    const count = studyCounts[food.id];
    return count == null ? food : { ...food, referenceTotal: count };
  };

  return (
    <div className="bg-paper-100 rounded-2xl p-4">
      {allBest.length > 0 && (
        <section className="mb-6">
          <h3 className="font-sans text-xs font-bold tracking-eyebrow uppercase text-forest-700 mb-3">Best for you</h3>
          <div className="flex flex-col gap-2">
            {allBest.map((food) => (
              <IngredientCard key={food.id} food={withStudyCount(food)} onAddToLibrary={addToLibrary} onSelect={onSelectFood} compact />
            ))}
          </div>
        </section>
      )}
      {allWorst.length > 0 && (
        <section>
          <h3 className="font-sans text-xs font-bold tracking-eyebrow uppercase text-red-500 mb-3">Avoid these</h3>
          <div className="flex flex-col gap-2">
            {allWorst.map((food) => (
              <IngredientCard key={food.id} food={withStudyCount(food)} onAddToLibrary={addToLibrary} onSelect={onSelectFood} compact />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── CategoryGrid ─────────────────────────────────────────────────────────────
// All 9 coarse food groups as a 2-column grid. Labels/counts come from
// whatever's already loaded on this tab (no new fetches, no fabricated
// counts) — tapping a card opens the existing CategoryDetailSheet, which
// does its own on-demand fetch for that group.

const CATEGORY_GRID_GROUPS = ['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'k'];

const CATEGORY_GRID_ICONS = {
  b: Fish, c: Egg, d: Apple, e: Carrot, f: Wheat, g: Milk, h: Cookie, i: Soup, k: Pill,
};

function CategoryGrid({ bestCategories, worstCategories, onOpen }) {
  return (
    <div className="bg-paper-100 rounded-2xl p-4">
      <h3 className="font-sans text-xs font-bold tracking-eyebrow uppercase text-char-500 mb-3">Browse by category</h3>
      <div className="grid grid-cols-2 gap-2.5">
        {CATEGORY_GRID_GROUPS.map((group) => {
          const Icon = CATEGORY_GRID_ICONS[group];
          const bestCat  = bestCategories.find((c) => c.group === group);
          const worstCat = worstCategories.find((c) => c.group === group);
          const label = bestCat?.label ?? worstCat?.label ?? COARSE_GROUP_LABELS[group] ?? group;
          const hasData = !!bestCat || !!worstCat;
          const count = hasData ? (bestCat?.foods?.length ?? 0) + (worstCat?.foods?.length ?? 0) : null;
          return (
            <button
              key={group}
              onClick={() => onOpen({ group, label })}
              className="flex items-center gap-2.5 px-3 py-3 rounded-xl bg-white border border-sand-200 text-left
                transition-colors duration-fast hover:border-forest-300 active:scale-[0.99]"
            >
              <div className="w-9 h-9 rounded-lg bg-forest-50 flex items-center justify-center flex-shrink-0">
                <Icon size={17} className="text-forest-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-sans text-sm font-semibold text-char-900 truncate">{label}</p>
                {count != null && (
                  <p className="text-[11px] text-char-400 font-sans">{count} {count === 1 ? 'food' : 'foods'}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Skeletons (dark) ──────────────────────────────────────────────────────────

function SkeletonListRows() {
  return (
    <div className="bg-paper-100 rounded-2xl p-4 flex flex-col gap-2">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-2.5 py-2 px-3">
          <div className="h-3.5 flex-1 rounded animate-pulse bg-sand-200" />
          <div className="h-3 w-14 rounded animate-pulse bg-sand-200" />
        </div>
      ))}
    </div>
  );
}

// ── RecipeImageCards ──────────────────────────────────────────────────────────

function RecipeImageCards({ recipes, onSelect }) {
  return (
    <div className="flex flex-col gap-3 mt-4 px-4 items-center">
      <AnimatePresence mode="popLayout">
        {recipes.map((rec, i) => (
          <motion.div
            key={rec.id}
            layout
            variants={cardVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ ...chipSpring, delay: i * 0.06 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelect(rec)}
            className="relative rounded-2xl overflow-hidden cursor-pointer w-full max-w-[300px]"
            style={{ aspectRatio: '5/4', WebkitTapHighlightColor: 'transparent' }}
          >
            {rec.image ? (
              <img
                src={rec.image}
                alt={rec.name}
                className="absolute inset-0 w-full h-full object-cover brightness-[0.75]"
                draggable={false}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <span className="material-symbols-rounded text-[40px] text-white/25">restaurant</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 px-4 py-3">
              <h3 className="font-display text-[16px] font-semibold text-white leading-tight">{rec.name}</h3>
              {rec.blurb && (
                <p className="mt-0.5 text-[12px] text-white/55 font-sans line-clamp-1">{rec.blurb}</p>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── Back arrow SVG ────────────────────────────────────────────────────────────

function BackArrow() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
      <path d="M11 8.5 Q10 12 7 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" fill="none" />
      <path d="M11 15.5 Q10 12 7 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" fill="none" />
    </svg>
  );
}

// ── BestWorstTab ──────────────────────────────────────────────────────────────

function BestWorstTab({ profile, onSelectFood }) {
  const [bestCats,      setBestCats]      = useState([]);
  const [worstCats,     setWorstCats]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [usedFallback,  setUsedFallback]  = useState(false);
  const [conditionNames, setConditionNames] = useState([]);
  const [detailCategory, setDetailCategory] = useState(null); // { group, label } | null

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    Promise.all([getSuggestions(profile), getWorstFoods(profile)])
      .then(([best, worst]) => {
        setBestCats(best.categories  ?? []);
        setWorstCats(worst.categories ?? []);
        // Centralized fallback lives in adapter.js (withConditionFallback) —
        // both calls fall back together since they share conditions, so
        // either flag reflects the outcome.
        setUsedFallback(!!best.usedFallback || !!worst.usedFallback);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [profile]);

  // Single-line "For: {condition names}" context under the title.
  useEffect(() => {
    if (!profile?.conditions?.length) { setConditionNames([]); return; }
    let cancelled = false;
    getConditionNames(profile.conditions)
      .then((names) => { if (!cancelled) setConditionNames(names ?? []); })
      .catch(() => { if (!cancelled) setConditionNames([]); });
    return () => { cancelled = true; };
  }, [profile]);

  const hasData = bestCats.length > 0 || worstCats.length > 0;

  return (
    <>
      <div className="px-4 pt-4 pb-2">
        <h1 className="font-display text-xl font-semibold text-white">Dietary Guidance</h1>
        {conditionNames.length > 0 && (
          <p className="mt-1 text-xs font-sans truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
            For: {conditionNames.slice(0, 2).join(', ')}
            {conditionNames.length > 2 ? ` +${conditionNames.length - 2}` : ''}
          </p>
        )}
      </div>

      {!loading && usedFallback && (
        <div className="px-4 pb-2">
          <DemoDataChip dark />
        </div>
      )}

      <div className="flex flex-col gap-4 px-4 pb-6">
        {loading ? (
          <SkeletonListRows />
        ) : !hasData ? (
          <p className="text-sm font-sans text-center py-12" style={{ color: 'rgba(255,255,255,0.4)' }}>
            No suggestions yet. Set up your health profile first.
          </p>
        ) : (
          <>
            <GuidanceList
              bestCategories={bestCats}
              worstCategories={worstCats}
              onSelectFood={onSelectFood}
              profile={profile}
            />
            <CategoryGrid
              bestCategories={bestCats}
              worstCategories={worstCats}
              onOpen={setDetailCategory}
            />
          </>
        )}
      </div>

      <CategoryDetailSheet
        open={!!detailCategory}
        onClose={() => setDetailCategory(null)}
        profile={profile}
        group={detailCategory?.group}
        groupLabel={detailCategory?.label}
        onSelectFood={onSelectFood}
      />
    </>
  );
}

// ── RealRecipeStrip ────────────────────────────────────────────────────────────
// "Real recipes for you" — condition-ranked Food Network recipes from
// adapter.getRecipes (fine food group 'l'), distinct from the per-meal-slot
// food recommendations the rest of this tab shows. Horizontal scroll strip,
// tapping opens the same RecipeDetailCard used below.

function RealRecipeCard({ recipe, onSelect }) {
  return (
    <button
      onClick={() => onSelect(recipe)}
      className="relative shrink-0 w-[42%] max-w-[180px] aspect-[3/4] rounded-xl overflow-hidden text-left snap-start"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {recipe.photo ? (
        <img
          src={recipe.photo}
          alt={recipe.title}
          className="absolute inset-0 w-full h-full object-cover brightness-[0.75]"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
          <UtensilsCrossed size={28} className="text-white/25" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 px-2.5 py-2.5">
        {recipe.tier && (
          <span className="inline-block mb-1 text-[9px] font-semibold font-sans bg-white/20 text-white rounded-full px-1.5 py-0.5">
            {recipe.tier}
          </span>
        )}
        <p className="font-display text-[12px] font-semibold text-white leading-snug line-clamp-2">{recipe.title}</p>
        {recipe.sourceName && (
          <p className="mt-0.5 text-[10px] text-white/55 font-sans line-clamp-1">{recipe.sourceName}</p>
        )}
      </div>
    </button>
  );
}

function RealRecipeStrip({ recipes, onSelect }) {
  if (!recipes.length) return null;
  return (
    <div className="flex-none pt-2 pb-4">
      <h3
        className="font-sans text-xs font-bold tracking-eyebrow uppercase px-6 mb-2.5"
        style={{ color: 'rgba(255,255,255,0.5)' }}
      >
        Real recipes for you
      </h3>
      <div className="flex gap-3 overflow-x-auto px-6 pb-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {recipes.map((recipe) => (
          <RealRecipeCard key={recipe.id} recipe={recipe} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

// ── RecipePicksTab (DailyPicksScreen ported in) ───────────────────────────────

function RecipePicksTab({ onSelectFood }) {
  const [phase] = useState('picking');
  const [mealIndex,   setMealIndex]   = useState(0);
  const [cardPage,    setCardPage]    = useState(0);
  const [direction,   setDirection]   = useState(1);
  const [swipeAxis,   setSwipeAxis]   = useState('x');

  const [allRecsBySlot, setAllRecsBySlot] = useState(() =>
    Object.fromEntries(RECIPE_SLOTS.map((s) => [s, []]))
  );
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [usedFallback,   setUsedFallback]   = useState(false);
  const [realRecipes,    setRealRecipes]    = useState([]);

  // Fetch all slots on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const results   = await Promise.all(
        RECIPE_SLOTS.map((slot) => getRecommendations(slot, 0, RECS_PER_SLOT))
      );
      if (cancelled) return;
      setAllRecsBySlot(Object.fromEntries(RECIPE_SLOTS.map((s, i) => [s, results[i]])));
      // recommendations.js's loadSlots (via buildMealPlan) sets this once
      // all slots have resolved — read it after the Promise.all above.
      setUsedFallback(getUsedFallback());
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // "Real recipes for you" strip — independent fetch of the real,
  // condition-ranked Food Network recipes (fine group 'l'), separate from
  // the per-meal-slot food recommendations above.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const p = await api.getProfile();
      const conditions = p?.conditions?.length ? p.conditions : DEFAULT_DEV_CONDITIONS;
      const { recipes } = await getRecipes({ ...(p ?? {}), conditions }).catch(() => ({ recipes: [] }));
      if (!cancelled) setRealRecipes(recipes ?? []);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const currentSlot = RECIPE_SLOTS[mealIndex];

  const openRecipe = useCallback((rec) => {
    setSelectedRecipe({
      foodId: rec.foodId ?? null,
      name: rec.name,
      image: rec.image,
      sourceName: rec.sourceName ?? null,
      conditions: rec.matchedConditions ?? [],
      ingredients: [],
    });
    buildRecipeDetail(rec).then(setSelectedRecipe).catch(() => {});
  }, []);

  // Real recipes (adapter getRecipes) use title/photo instead of the
  // Recommendation shape's name/image — map once, then reuse the same
  // buildRecipeDetail flow so RecipeDetailCard renders real per-condition
  // tiers/citations for the recipe itself (assessFood keys on foodId).
  const openRealRecipe = useCallback((recipe) => {
    const card = {
      foodId: recipe.foodId ?? null,
      name: recipe.title,
      image: recipe.photo,
      sourceName: recipe.sourceName ?? null,
      matchedConditions: recipe.matchedConditions ?? [],
    };
    setSelectedRecipe({
      foodId: card.foodId,
      name: card.name,
      image: card.image,
      sourceName: card.sourceName,
      conditions: card.matchedConditions,
      ingredients: [],
    });
    buildRecipeDetail(card).then(setSelectedRecipe).catch(() => {});
  }, []);

  const visibleRecipes = useMemo(() => {
    const all   = allRecsBySlot[currentSlot] ?? [];
    const start = cardPage * CARDS_PER_PAGE;
    return all.slice(start, start + CARDS_PER_PAGE);
  }, [allRecsBySlot, currentSlot, cardPage]);

  const totalPages = Math.ceil((allRecsBySlot[currentSlot]?.length ?? 0) / CARDS_PER_PAGE);

  const dragRef = useRef(null);
  const handleDragEnd = useCallback((_, info) => {
    if (info.offset.y < -SWIPE_THRESHOLD) {
      const max = Math.ceil((allRecsBySlot[currentSlot] ?? []).length / CARDS_PER_PAGE) - 1;
      if (cardPage < max) { setSwipeAxis('y'); setDirection(1);  setCardPage((p) => p + 1); }
    } else if (info.offset.y > SWIPE_THRESHOLD) {
      if (cardPage > 0)  { setSwipeAxis('y'); setDirection(-1); setCardPage((p) => p - 1); }
    }
  }, [allRecsBySlot, currentSlot, cardPage]);

  const handleBack = () => {
    setSwipeAxis('x'); setDirection(-1);
    if (mealIndex > 0) { setMealIndex((i) => i - 1); setCardPage(0); }
  };

  const handleNext = () => {
    setSwipeAxis('x'); setDirection(1);
    if (mealIndex < RECIPE_SLOTS.length - 1) { setMealIndex((i) => i + 1); setCardPage(0); }
  };

  return (
    <div className="flex flex-col flex-1" style={{ minHeight: '70dvh' }}>
      {/* StepBar */}
      <div className="flex-none px-6 pt-6 pb-2 flex justify-center">
        <StepBar current={mealIndex} total={RECIPE_SLOTS.length} gold={false} />
      </div>

      {usedFallback && (
        <div className="flex-none flex justify-center pb-1">
          <DemoDataChip dark />
        </div>
      )}

      {/* Real, condition-ranked Food Network recipes — shown once at the top
          of the flow (not repeated per meal-slot step). */}
      {mealIndex === 0 && cardPage === 0 && (
        <RealRecipeStrip recipes={realRecipes} onSelect={openRealRecipe} />
      )}

      <AnimatePresence mode="wait">

        {/* ── Picking ─────────────────────────────────────────────── */}
        {phase === 'picking' && (
          <motion.div
            key="picking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={softSpring}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="flex-none px-6 mt-4">
              <h2 className="font-display text-[28px] font-semibold tracking-tightish text-white leading-tight text-center">
                best{' '}
                <AnimatedMealWord word={MEAL_LABELS[currentSlot]} />
                {' '}foods for<br />your meal plan
              </h2>
            </div>

            <motion.div
              ref={dragRef}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.15}
              onDragEnd={handleDragEnd}
              className="flex-1 px-1 pt-4 pb-2 flex flex-col min-h-0"
            >
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={`page-${mealIndex}-${cardPage}`}
                  custom={direction}
                  variants={swipeAxis === 'y' ? vertVariants : slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={swipeAxis === 'y' ? snappyVert : snappySlide}
                >
                  <RecipeImageCards recipes={visibleRecipes} onSelect={openRecipe} />
                </motion.div>
              </AnimatePresence>

              {/* Page dots + swipe hint */}
              <div className="flex flex-col items-center gap-1.5 pt-4">
                <div className="flex items-center justify-center gap-1.5">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full transition-all duration-200"
                      style={{
                        background: i === cardPage ? 'white' : 'rgba(255,255,255,0.25)',
                        transform: i === cardPage ? 'scale(1.4)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <path d="M8.5 7.5L12 4L15.5 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <path d="M8.5 16.5L12 20L15.5 16.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                  <span className="text-[12px] font-sans font-medium tracking-wide">Swipe to see other foods</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}


      </AnimatePresence>

      {/* ── Bottom nav ───────────────────────────────────────────────── */}
      <div className="flex-none px-6 pt-3 pb-6 z-10" style={{ backgroundColor: BG_COLOR }}>
        <div className="flex items-center gap-3">
          {mealIndex > 0 && (
            <button
              onClick={handleBack}
              className="flex-1 text-sm font-medium font-sans bg-transparent border-none cursor-pointer py-4 min-h-[48px] flex items-center justify-center gap-1 transition-opacity hover:opacity-80"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              <BackArrow />
              Back
            </button>
          )}
          {mealIndex < RECIPE_SLOTS.length - 1 && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              transition={softSpring}
              onClick={handleNext}
              className="relative flex-[2] py-4 rounded-sm text-[16px] font-semibold tracking-wide font-sans shadow-lg min-h-[52px] flex items-center justify-center gap-2 overflow-hidden bg-white"
              style={{ color: BG_COLOR }}
            >
              <span className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2" style={{ borderColor: BG_COLOR }} />
              Next
            </motion.button>
          )}
        </div>
      </div>

      <RecipeDetailCard
        recipe={selectedRecipe}
        open={!!selectedRecipe}
        onClose={() => setSelectedRecipe(null)}
        onSelectIngredient={onSelectFood}
      />
    </div>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SuggestionsScreen() {
  const [activeTab,    setActiveTab]    = useState('bestworst');
  const [profile,      setProfile]      = useState(null);
  const [selectedFood, setSelectedFood] = useState(null);

  useEffect(() => {
    api.getProfile().then((p) => {
      const conditions = p?.conditions?.length ? p.conditions : DEFAULT_DEV_CONDITIONS;
      setProfile({ ...(p ?? {}), conditions });
    });
  }, []);

  const tabs = [
    { key: 'bestworst', icon: Sparkles,         label: 'Guidance' },
    { key: 'recipes',   icon: UtensilsCrossed,  label: 'Best Recipes' },
  ];

  return (
    <div className="flex flex-col" style={{ backgroundColor: BG_COLOR, minHeight: '100dvh' }}>

      {/* Breathing room + tab switcher */}
      <div className="flex-none pt-10">
        <div className="flex">
          {tabs.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="flex-1 flex flex-col items-center gap-1 pt-3 pb-2 relative transition-opacity duration-fast"
            >
              <Icon size={18} style={{ color: activeTab === key ? 'white' : 'rgba(255,255,255,0.4)' }} />
              <span
                className="text-[11px] font-semibold font-sans"
                style={{ color: activeTab === key ? 'white' : 'rgba(255,255,255,0.4)' }}
              >
                {label}
              </span>
              {activeTab === key && (
                <div className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full bg-white" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex flex-col flex-1">
        {activeTab === 'bestworst' ? (
          <BestWorstTab profile={profile} onSelectFood={setSelectedFood} />
        ) : (
          <RecipePicksTab onSelectFood={setSelectedFood} />
        )}
      </div>

      {/* Food detail bottom sheet */}
      {selectedFood && profile && (
        <FoodDetail
          food={selectedFood}
          profile={profile}
          onClose={() => setSelectedFood(null)}
          onAddToLibrary={addToLibrary}
        />
      )}
    </div>
  );
}
