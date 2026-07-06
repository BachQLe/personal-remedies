/**
 * PlanScreen — Single-day-focused meal plan view with week strip navigation.
 *
 * Features:
 * - Week strip with 7 day-pills (Mon-Sun), current day selected by default
 * - Forward/back week navigation that regenerates the plan via buildMealPlan
 * - Five meal sections: Breakfast / Lunch / Dinner / Snack / Beverages
 * - RecipeCards in planner variant (context='planner': add to menu + heart)
 * - Per-day calorie total + per-meal calories
 * - Celebratory confetti on plan generation
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, UtensilsCrossed, Coffee, Cookie, GlassWater, Sparkles } from 'lucide-react';
import { buildMealPlan } from '../../api/api.js';
import { storage } from '../../api/storage.js';
import { DEFAULT_DEV_CONDITIONS } from '../../api/config.js';
import RecipeCard from '../../components/RecipeCard.jsx';
import WeekStrip, { getDateForDay, getTodayIndex } from './WeekStrip.jsx';
import Confetti from './Confetti.jsx';
import DemoDataChip from '../../components/shared/DemoDataChip.jsx';

// ── Helpers ─────────────────────────────────────────────────────────────────

function getProfile() {
  const stored = storage.get('profile', null);
  if (stored && stored.conditions && stored.conditions.length > 0) {
    return stored;
  }
  // Fallback dev profile
  return { conditions: DEFAULT_DEV_CONDITIONS };
}

// ── Meal section metadata ───────────────────────────────────────────────────

const MEAL_SECTIONS = [
  { slot: 'Breakfast', icon: UtensilsCrossed, label: 'Breakfast', color: 'text-amber-600', bg: 'bg-amber-50' },
  { slot: 'Lunch', icon: UtensilsCrossed, label: 'Lunch', color: 'text-blue-600', bg: 'bg-blue-50' },
  { slot: 'Dinner', icon: UtensilsCrossed, label: 'Dinner', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { slot: 'Snack', icon: Cookie, label: 'Snack', color: 'text-green-600', bg: 'bg-green-50' },
  { slot: 'Beverages', icon: GlassWater, label: 'Beverages', color: 'text-cyan-600', bg: 'bg-cyan-50' },
];

// ── Meal Section Component ──────────────────────────────────────────────────

function MealSection({ mealSlot, meta, onFavorite, onAddToMenu }) {
  const IconComp = meta.icon;
  const items = mealSlot?.items || [];
  const calories = mealSlot?.calories || 0;

  // Convert food items to recipe-like cards for display, keeping a
  // reference to the underlying Food (id/fineGroup/group).
  const cards = items.map((food) => ({
    id: food.id || `food-${food.name}`,
    title: food.name,
    photo: null,
    sourceName: food.groupLabel || undefined,
    mealType: meta.slot,
    calories: calories > 0 ? Math.round(calories / Math.max(items.length, 1)) : undefined,
    _food: food,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex flex-col gap-3"
    >
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg ${meta.bg} flex items-center justify-center`}>
            <IconComp size={15} className={meta.color} />
          </div>
          <h3 className="font-sans font-semibold text-char-900 text-sm">
            {meta.label}
          </h3>
        </div>
        {calories > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-sand-100">
            <Flame size={12} className="text-char-500" />
            <span className="text-[11px] font-mono font-medium text-char-600">
              {calories} cal
            </span>
          </div>
        )}
      </div>

      {/* Cards */}
      {cards.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5">
          {cards.map((recipe, idx) => (
            <motion.div
              key={recipe.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: idx * 0.05 }}
              className="relative"
            >
              <RecipeCard
                recipe={recipe}
                context="planner"
                onFavorite={() => onFavorite && onFavorite(recipe)}
                onAddToPlanner={() => onAddToMenu && onAddToMenu(recipe)}
                onViewRecipe={() => {}}
              />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="py-4 px-3 rounded-xl bg-sand-50 border border-dashed border-sand-200 text-center">
          <p className="text-xs text-char-400 font-sans">No items for this meal</p>
        </div>
      )}
    </motion.div>
  );
}

// ── Loading skeleton ────────────────────────────────────────────────────────

function PlanSkeleton() {
  return (
    <div className="flex flex-col gap-6 px-5">
      {MEAL_SECTIONS.map((meta) => (
        <div key={meta.slot} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sand-200 animate-pulse" />
            <div className="w-20 h-4 rounded bg-sand-200 animate-pulse" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {[1, 2].map((i) => (
              <div key={i} className="w-full h-44 rounded-xl bg-sand-100 animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── PlanScreen ──────────────────────────────────────────────────────────────

export default function PlanScreen() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(getTodayIndex());
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [favorites, setFavorites] = useState(() => storage.get('planFavorites', []));
  const isFirstLoad = useRef(true);

  // Cache plans by week to avoid refetching when switching days within same week
  const planCache = useRef({});

  /**
   * Generate (or retrieve cached) plan for a given week.
   */
  const getPlanForWeek = useCallback(async (offset) => {
    const cacheKey = `week_${offset}`;
    if (planCache.current[cacheKey]) {
      return planCache.current[cacheKey];
    }

    const profile = getProfile();
    const dayPlan = await buildMealPlan(profile);
    planCache.current[cacheKey] = dayPlan;
    return dayPlan;
  }, []);

  /**
   * Load plan for current week.
   */
  const loadPlan = useCallback(async (offset, showCelebration = false) => {
    setLoading(true);
    try {
      const dayPlan = await getPlanForWeek(offset);
      setPlan(dayPlan);

      if (showCelebration) {
        setShowConfetti(true);
      }
    } catch (err) {
      console.error('Failed to build meal plan:', err);
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [getPlanForWeek]);

  // Initial load
  useEffect(() => {
    loadPlan(0, true);
  }, []);

  // Handle week navigation
  const handlePrevWeek = useCallback(() => {
    const newOffset = weekOffset - 1;
    setWeekOffset(newOffset);
    setSelectedDay(0); // reset to Monday
    loadPlan(newOffset, true);
  }, [weekOffset, loadPlan]);

  const handleNextWeek = useCallback(() => {
    const newOffset = weekOffset + 1;
    setWeekOffset(newOffset);
    setSelectedDay(0); // reset to Monday
    // Forward weeks regenerate the plan
    delete planCache.current[`week_${newOffset}`];
    loadPlan(newOffset, true);
  }, [weekOffset, loadPlan]);

  // Handle day selection (within same week, same plan just different "view")
  const handleSelectDay = useCallback((dayIndex) => {
    setSelectedDay(dayIndex);
  }, []);

  // Handle favorite
  const handleFavorite = useCallback((recipe) => {
    setFavorites((prev) => {
      const exists = prev.find((f) => f.id === recipe.id);
      const next = exists
        ? prev.filter((f) => f.id !== recipe.id)
        : [...prev, recipe];
      storage.set('planFavorites', next);
      return next;
    });
  }, []);

  // Derive selected date label
  const selectedDate = getDateForDay(weekOffset, selectedDay);
  const today = new Date().toISOString().split('T')[0];
  const isToday = selectedDate === today;

  const dateLabel = isToday
    ? 'Today'
    : new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });

  // Get meal data, keyed by slot
  const mealsBySlot = {};
  if (plan && plan.meals) {
    for (const meal of plan.meals) {
      mealsBySlot[meal.slot] = meal;
    }
  }

  const totalCalories = plan?.totalCalories || 2000;

  return (
    <div className="flex flex-col pb-8 bg-paper-200 min-h-full">
      {/* Confetti celebration */}
      <Confetti
        show={showConfetti}
        onComplete={() => setShowConfetti(false)}
      />

      {/* Header */}
      <div className="px-5 pt-6 pb-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-[12px] text-char-500 font-bold uppercase tracking-eyebrow font-label">
            Your Meal Plan
          </p>
          <DemoDataChip show={!!plan?.usedFallback} />
        </div>
        <h1 className="font-display text-2xl font-semibold text-blue-950 tracking-tightish">
          Plan
        </h1>
      </div>

      {/* Week Strip */}
      <div className="px-5 mb-4">
        <div className="bg-white rounded-2xl border border-sand-200 shadow-xs p-3">
          <WeekStrip
            weekOffset={weekOffset}
            selectedDay={selectedDay}
            onSelectDay={handleSelectDay}
            onPrevWeek={handlePrevWeek}
            onNextWeek={handleNextWeek}
          />
        </div>
      </div>

      {/* Day header with calorie badge */}
      <div className="px-5 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-sans font-semibold text-blue-950 text-base">
              {dateLabel}
            </h2>
            <p className="text-xs text-char-500 font-mono mt-0.5">
              {selectedDate}
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-forest-50 border border-forest-200">
            <Flame size={14} className="text-forest-700" />
            <span className="text-xs font-semibold text-forest-800 font-mono">
              {totalCalories} cal
            </span>
          </div>
        </div>
      </div>

      {/* Meal sections */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <PlanSkeleton />
          </motion.div>
        ) : (
          <motion.div
            key={`plan-${weekOffset}-${selectedDay}`}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-6 px-5"
          >
            {MEAL_SECTIONS.map((meta) => (
              <MealSection
                key={meta.slot}
                mealSlot={mealsBySlot[meta.slot]}
                meta={meta}
                onFavorite={handleFavorite}
                onAddToMenu={() => {}}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Plan generation note */}
      {!loading && plan && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="px-5 mt-8 mb-4"
        >
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-forest-50/60 border border-forest-100">
            <Sparkles size={16} className="text-forest-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-forest-800 font-sans leading-relaxed">
              Plan generated from your clinical profile. Navigate to a new week to get fresh recommendations.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
