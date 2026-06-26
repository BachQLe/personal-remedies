import { useState, useEffect, useRef } from 'react';
import { api } from '../../api/api.js';
import Card from '../../components/shared/Card.jsx';
import DayStrip from './DayStrip.jsx';
import FoodCard from '../../components/shared/FoodCard.jsx';
import RecipeCard from '../../components/shared/RecipeCard.jsx';
import ConditionTag from '../../components/shared/ConditionTag.jsx';
import SignalChip from '../../components/shared/SignalChip.jsx';
import StudyReferences from '../../components/shared/StudyReferences.jsx';
import BottomSheet from '../../components/shared/BottomSheet.jsx';
import EmptyState from '../../components/shared/EmptyState.jsx';
import Skeleton from '../../components/shared/Skeleton.jsx';
import Icon from '../../components/shared/Icon.jsx';
import { GHOST_PLAN } from '../../api/ghostData.js';

const DEMO_PROFILE = {
  conditions: ['Type 2 Diabetes', 'Hypertension (high blood pressure)', 'High cholesterol'],
  medications: [],
  allergies: [],
  dietary: [],
  tasteLikes: [],
  tasteDislikes: [],
};

function toISO(date) {
  return date.toISOString().split('T')[0];
}

// ── Food detail sheet ─────────────────────────────────────────────────────────
function FoodDetailSheet({ food, profile, onClose }) {
  const [refsByCondition, setRefsByCondition] = useState({});
  const [loadingRefs, setLoadingRefs] = useState({});

  const conditions = profile?.conditions ?? [];
  const relevantConditions = food.matchedConditions.filter((c) => conditions.includes(c));
  const displayConditions = relevantConditions.length ? relevantConditions : food.matchedConditions;

  async function loadRefs(condition) {
    if (refsByCondition[condition] !== undefined || loadingRefs[condition]) return;
    setLoadingRefs((p) => ({ ...p, [condition]: true }));
    const refs = await api.getReferences(food.id, condition);
    setRefsByCondition((p) => ({ ...p, [condition]: refs }));
    setLoadingRefs((p) => ({ ...p, [condition]: false }));
  }

  return (
    <BottomSheet open onClose={onClose} title={food.name}>
      <div className="flex gap-4 mb-5">
        <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-sand-100">
          <img
            src={food.photo}
            alt={food.name}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
        <div className="flex flex-col gap-2 justify-center">
          <SignalChip signal={food.signal} />
          {food.referenceCount > 0 && (
            <p className="text-xs text-char-500">
              <span className="font-mono">{food.referenceCount}</span>{' '}
              {food.referenceCount === 1 ? 'study' : 'studies'} behind this
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {displayConditions.map((condition) => (
          <div key={condition} className="bg-sand-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <ConditionTag condition={condition} />
              <SignalChip signal={food.signal} compact />
            </div>
            <StudyReferences
              references={refsByCondition[condition]}
              loading={loadingRefs[condition]}
            />
            {refsByCondition[condition] === undefined && !loadingRefs[condition] && (
              <button
                onClick={() => loadRefs(condition)}
                className="text-xs text-forest-700 font-semibold mt-1 transition-colors duration-fast hover:text-forest-800"
              >
                See the studies
                <Icon name="arrow-right" size={14} className="inline-block align-middle ml-0.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}

// ── Recipe detail sheet ───────────────────────────────────────────────────────
function RecipeDetailSheet({ recipe, profile, onClose }) {
  const [refsByKey, setRefsByKey] = useState({});
  const [loadingRefs, setLoadingRefs] = useState({});

  const conditions = profile?.conditions ?? [];

  async function loadIngredientRefs(ingredientName, condition) {
    const key = `${ingredientName}:${condition}`;
    if (refsByKey[key] !== undefined || loadingRefs[key]) return;
    setLoadingRefs((p) => ({ ...p, [key]: true }));
    const refs = await api.getReferences(ingredientName.toLowerCase().replace(/\s+/g, '-'), condition);
    setRefsByKey((p) => ({ ...p, [key]: refs }));
    setLoadingRefs((p) => ({ ...p, [key]: false }));
  }

  const matchedConditions = recipe.matchedConditions.filter((c) => conditions.includes(c));
  const displayConditions = matchedConditions.length ? matchedConditions : recipe.matchedConditions;

  return (
    <BottomSheet open onClose={onClose} title={recipe.title}>
      {/* Recipe photo */}
      <div className="w-full h-48 rounded-xl overflow-hidden bg-sand-100 mb-5">
        <img
          src={recipe.photo}
          alt={recipe.title}
          className="w-full h-full object-cover"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      </div>

      {/* Source + match pill */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-char-500 font-medium font-sans">{recipe.sourceName}</p>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-signal-beneficial-tint">
          <Icon name="check" size={14} className="text-signal-beneficial" />
          <span className="text-xs text-signal-beneficial font-semibold font-sans">Matched to your profile</span>
        </div>
      </div>

      {/* Condition tags */}
      {displayConditions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {displayConditions.map((c) => (
            <ConditionTag key={c} condition={c} />
          ))}
        </div>
      )}

      {/* Ingredients */}
      {recipe.ingredients?.length > 0 && (
        <div>
          <p className="text-[12px] font-bold tracking-eyebrow uppercase text-char-500 mb-3 font-label">Ingredients</p>
          <div className="flex flex-col gap-3">
            {recipe.ingredients.map((ing, i) => {
              const relevantConds = ing.matchedConditions?.filter((c) => conditions.includes(c)) ?? [];
              return (
                <div key={i} className="bg-sand-100 rounded-xl p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-sans font-medium text-blue-950 text-sm">{ing.name}</span>
                    {ing.signal && ing.signal !== 'neutral' && <SignalChip signal={ing.signal} compact />}
                  </div>
                  {relevantConds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {relevantConds.map((c) => (
                        <ConditionTag key={c} condition={c} />
                      ))}
                    </div>
                  )}
                  {relevantConds.map((c) => {
                    const key = `${ing.name}:${c}`;
                    return (
                      <div key={c}>
                        <StudyReferences
                          references={refsByKey[key]}
                          loading={loadingRefs[key]}
                        />
                        {refsByKey[key] === undefined && !loadingRefs[key] && (
                          <button
                            onClick={() => loadIngredientRefs(ing.name, c)}
                            className="text-xs text-forest-700 font-semibold mt-1 transition-colors duration-fast hover:text-forest-800"
                          >
                            See the studies
                            <Icon name="arrow-right" size={14} className="inline-block align-middle ml-0.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

// ── Meal slot meta (Material Symbols icons, DS tint backgrounds) ─────────────
const SLOT_META = {
  Breakfast: { icon: 'sun',  bg: 'bg-caution-100' },
  Lunch:     { icon: 'sun',  bg: 'bg-info-100' },
  Dinner:    { icon: 'moon', bg: 'bg-lavender-100' },
  Snack:     { icon: 'leaf', bg: 'bg-benefit-100' },
};

// ── Meal slot column (matches home page WeekCalendar square aesthetic) ───────
function MealSlotColumn({ meal, onFoodSelect, onRecipeSelect, replaceMode, onSlotReplace }) {
  const meta = SLOT_META[meal.slot] ?? { icon: 'restaurant', bg: 'bg-sand-100' };

  if (replaceMode) {
    const existing = [
      ...(meal.items?.map((f) => f.name) ?? []),
      ...(meal.recipes?.map((r) => r.title) ?? []),
    ];
    return (
      <button
        onClick={() => onSlotReplace(meal.slot)}
        className={`relative flex flex-col bg-sand-100 overflow-hidden cursor-pointer
          border-2 border-dashed border-forest-400 rounded-lg
          hover:bg-forest-50/40 transition-colors duration-fast`}
        style={{ animation: 'plan-jitter 0.4s ease-in-out infinite' }}
      >
        <div className={`p-2 ${meta.bg} flex items-center gap-1.5`}>
          <Icon name={meta.icon} size={14} className="text-char-700" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-char-700">{meal.slot}</span>
        </div>
        <div className="flex flex-col gap-1 p-2 flex-1">
          {existing.length > 0 ? existing.map((name, i) => (
            <p key={i} className="text-[10px] text-char-500 truncate font-sans">{name}</p>
          )) : (
            <p className="text-[10px] text-char-300 font-sans">Empty</p>
          )}
        </div>
        <div className="px-2 pb-2">
          <Icon name="refresh-cw" size={20} className="text-forest-600 mx-auto block" />
        </div>
      </button>
    );
  }

  return (
    <div
      className={`relative flex flex-col bg-sand-100 overflow-hidden ${meal.slot === 'Breakfast' ? 'rounded-tl-md' : meal.slot === 'Snack' ? 'rounded-tr-md' : ''
        }`}
    >
      {/* Slot header (Breakfast / Lunch / Dinner / Snack) */}
      <div className={`p-2 ${meta.bg} flex items-center gap-1.5`}>
        <Icon name={meta.icon} size={14} className="text-char-700" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-char-700">{meal.slot}</span>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 p-2 flex-1">
        {/* Food items */}
        {meal.items?.map((food) => (
          <button
            key={food.id}
            onClick={() => onFoodSelect(food)}
            className="w-full text-left rounded-none bg-paper-200 overflow-hidden aspect-[3/4] shadow-card border border-sand-200
              hover:shadow-lg hover:-translate-y-[1px] transition-all duration-fast active:scale-[0.98]"
            style={{ animation: 'plan-blur-in 0.125s ease-out both' }}
          >
            <div className="w-full h-full flex flex-col">
              <div className="flex-1 min-h-0">
                {food.photo ? (
                  <img src={food.photo} alt={food.name} className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-full bg-sand-100" />
                )}
              </div>
              <div className="px-2.5 py-2 rounded-t-sm bg-white -mt-2 relative">
                <p className="text-xs leading-snug text-char-700 font-sans font-medium">{food.name}</p>
              </div>
            </div>
          </button>
        ))}

        {/* Recipes */}
        {meal.recipes?.map((recipe) => (
          <button
            key={recipe.id}
            onClick={() => onRecipeSelect(recipe)}
            className="w-full text-left rounded-none bg-paper-200 overflow-hidden aspect-[3/4] shadow-card border border-sand-200
              hover:shadow-lg hover:-translate-y-[1px] transition-all duration-fast active:scale-[0.98]"
            style={{ animation: 'plan-blur-in 0.125s ease-out both' }}
          >
            <div className="w-full h-full flex flex-col">
              <div className="flex-1 min-h-0">
                {recipe.photo ? (
                  <img src={recipe.photo} alt={recipe.title} className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-full bg-sand-100" />
                )}
              </div>
              <div className="px-2.5 py-2 rounded-t-sm bg-white -mt-2 relative">
                <p className="text-xs leading-snug text-char-700 font-sans font-medium line-clamp-2">{recipe.title}</p>
              </div>
            </div>
          </button>
        ))}

        {!meal.items?.length && !meal.recipes?.length && (
          <p className="text-xs leading-snug text-char-300 px-2 py-2">—</p>
        )}
      </div>
    </div>
  );
}

// ── Meal columns grid (B / L / D / Snack on same Y level) ───────────────────
function MealColumnsGrid({ meals, onFoodSelect, onRecipeSelect, replaceMode, onSlotReplace }) {
  const slotOrder = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
  const mealsBySlot = {};
  for (const meal of meals) {
    mealsBySlot[meal.slot] = meal;
  }
  const activeSlots = slotOrder.filter((s) => mealsBySlot[s]);
  const cols = activeSlots.length || 3;

  return (
    <div
      className="grid gap-2 items-start"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {(activeSlots.length ? activeSlots : ['Breakfast', 'Lunch', 'Dinner']).map((slot) => {
        const meal = mealsBySlot[slot] ?? { slot, items: [], recipes: [] };
        return (
          <MealSlotColumn
            key={slot}
            meal={meal}
            onFoodSelect={onFoodSelect}
            onRecipeSelect={onRecipeSelect}
            replaceMode={replaceMode}
            onSlotReplace={onSlotReplace}
          />
        );
      })}
    </div>
  );
}

// ── Skeleton loaders ─────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="w-full rounded-none overflow-hidden aspect-[3/4] border border-sand-200">
      <div className="w-full h-full flex flex-col">
        <div className="flex-1 min-h-0 bg-sand-200" />
        <div className="px-2.5 py-2 bg-white -mt-2 relative">
          <Skeleton shape="text" className="w-3/5" />
        </div>
      </div>
    </div>
  );
}

function SkeletonMealColumn({ slot }) {
  const meta = SLOT_META[slot] ?? { icon: 'restaurant', bg: 'bg-sand-100' };
  return (
    <div className={`flex flex-col bg-sand-100 overflow-hidden ${slot === 'Breakfast' ? 'rounded-tl-md' : slot === 'Snack' ? 'rounded-tr-md' : ''
      }`}>
      <div className={`p-2 ${meta.bg}`}>
        <span className="text-[10px] font-bold uppercase tracking-wider text-char-600">{slot}</span>
      </div>
      <div className="flex flex-col gap-2 p-2">
        <SkeletonCard />
        {(slot === 'Lunch' || slot === 'Dinner') && <SkeletonCard />}
      </div>
    </div>
  );
}

function PlanSkeleton() {
  const slots = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
  return (
    <div className="px-5">
      <div className="rounded-xl bg-sand-200/60 border border-sand-200 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] px-2 py-8">
        <div
          className="grid gap-2 items-start"
          style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))` }}
        >
          {slots.map((slot) => (
            <SkeletonMealColumn key={slot} slot={slot} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Recommendation card with replace / info actions ─────────────────────────
function RecommendationCard({ recipe, rank, expanded, onToggle, onReplace, onInfo }) {
  return (
    <div className="bg-white rounded-xl border border-sand-200 shadow-xs overflow-hidden transition-all duration-base">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3.5 p-3.5 text-left
          transition-colors duration-fast hover:bg-sand-50"
      >
        <div className="relative w-[52px] h-[52px] rounded-md overflow-hidden flex-shrink-0 bg-paper-200">
          <img
            src={recipe.photo}
            alt={recipe.title}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div className="absolute top-0 left-0 w-5 h-5 bg-forest-700 text-white text-[10px] font-bold flex items-center justify-center rounded-br-md">
            {rank}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-sans font-semibold text-blue-950 text-sm leading-snug">{recipe.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-char-500">{recipe.sourceName}</p>
            <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-signal-beneficial-tint">
              <Icon name="heart" size={12} className="text-signal-beneficial" />
              <span className="text-[10px] font-bold text-signal-beneficial">{recipe.healthScore}</span>
            </div>
          </div>
        </div>
        <Icon
          name="chevron-down"
          size={18}
          className={`flex-shrink-0 text-char-400 transition-transform duration-fast ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="flex border-t border-sand-200">
          <button
            onClick={onReplace}
            className="flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold text-forest-700 font-sans
              transition-colors duration-fast hover:bg-forest-50 active:bg-forest-100 border-r border-sand-200"
          >
            <Icon name="refresh-cw" size={22} />
            Replace a meal
          </button>
          <button
            onClick={onInfo}
            className="flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold text-char-600 font-sans
              transition-colors duration-fast hover:bg-sand-50 active:bg-sand-100"
          >
            <Icon name="info" size={22} />
            View details
          </button>
        </div>
      )}
    </div>
  );
}

// ── PlanScreen ────────────────────────────────────────────────────────────────
export default function PlanScreen() {
  const today = toISO(new Date());
  const [profile, setProfile] = useState(null);
  const [selectedDate, setSelectedDate] = useState(today);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dayLoading, setDayLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [expandedRec, setExpandedRec] = useState(null);
  const [replacingRecipe, setReplacingRecipe] = useState(null);
  const mealGridRef = useRef(null);

  useEffect(() => {
    async function init() {
      let p = await api.getProfile();
      if (!p) p = DEMO_PROFILE;
      setProfile(p);
      const [dayPlan, recs] = await Promise.all([
        api.getMealPlan(p, today),
        api.getTopRecipeRecommendations(p, 10),
      ]);
      setPlan(dayPlan);
      setRecommendations(recs);
      setLoading(false);
    }
    init();
  }, []);

  async function handleSelectDate(date) {
    if (date === selectedDate) return;
    setSelectedDate(date);
    setDayLoading(true);
    const dayPlan = await api.getMealPlan(profile ?? DEMO_PROFILE, date);
    setPlan(dayPlan);
    setDayLoading(false);
  }

  function startReplace(recipe) {
    setReplacingRecipe(recipe);
    setExpandedRec(null);
    setTimeout(() => {
      mealGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function handleSlotReplace(slot) {
    if (!replacingRecipe || !plan) return;
    setPlan((prev) => ({
      ...prev,
      meals: prev.meals.map((meal) => {
        if (meal.slot !== slot) return meal;
        return {
          ...meal,
          recipes: [replacingRecipe],
          items: [],
        };
      }),
    }));
    setReplacingRecipe(null);
  }

  const ghost = loading;
  const meals = ghost ? GHOST_PLAN.meals : (plan?.meals ?? []);

  return (
    <div
      className={`flex flex-col pb-8 bg-paper-200 min-h-full${ghost ? ' rm-ghost' : ''}`}
      aria-busy={ghost}
    >
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <p className="text-[12px] text-char-500 font-bold uppercase tracking-eyebrow mb-1 font-label">Personal Remedies</p>
        <h1 className="font-display text-2xl font-semibold text-blue-950 tracking-tightish">Meal plan</h1>
      </div>

      <div>
        {/* Day strip */}
        <div className="px-5 mb-5">
          <Card className="!p-3">
            <DayStrip
              selected={selectedDate}
              onSelect={handleSelectDate}
            />
          </Card>
        </div>

        {/* Date label + reassurance */}
        <div className="px-5 mb-5" data-ghost-hide>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-semibold text-blue-950 font-sans">
              {selectedDate === today
                ? 'Today'
                : new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              <span className="text-char-400 font-mono text-xs ml-2">{selectedDate}</span>
            </p>
          </div>
        </div>

        {/* Meal sections */}
        {dayLoading ? (
          <PlanSkeleton />
        ) : meals.length === 0 ? (
          <div className="px-5">
            <EmptyState
              icon="calendar_today"
              title="No plan for this day"
              body="Select a different day to see your meal recommendations."
            />
          </div>
        ) : (
          <div className="px-5 flex flex-col gap-5">
            {replacingRecipe && (
              <div className="flex items-center justify-between bg-forest-50 border border-forest-300 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon name="refresh-cw" size={20} className="text-forest-700" />
                  <p className="text-sm font-semibold text-forest-800 font-sans truncate">
                    Tap a meal to replace with <span className="text-forest-900">{replacingRecipe.title}</span>
                  </p>
                </div>
                <button
                  onClick={() => setReplacingRecipe(null)}
                  className="flex-shrink-0 ml-2 text-xs font-semibold text-forest-700 px-3 py-1.5 rounded-lg bg-white border border-forest-300
                    hover:bg-forest-50 transition-colors duration-fast"
                >
                  Cancel
                </button>
              </div>
            )}
            <div ref={mealGridRef} className="rounded-xl bg-sand-200/60 border border-sand-200 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] px-2 py-8">
              <MealColumnsGrid
                meals={meals}
                onFoodSelect={setSelectedFood}
                onRecipeSelect={setSelectedRecipe}
                replaceMode={!!replacingRecipe}
                onSlotReplace={handleSlotReplace}
              />
            </div>
          </div>
        )}

        {/* Top recipe recommendations */}
        {!ghost && !dayLoading && recommendations.length > 0 && (
          <div className="px-5 mt-8">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="award" size={20} className="text-forest-700" />
              <h2 className="font-display text-lg font-semibold text-blue-950 tracking-tightish">Top recipes for you</h2>
            </div>
            <p className="text-xs text-char-500 mb-4 font-sans">Sorted by healthiness score. Tap to replace a meal or view details.</p>
            <div className="flex flex-col gap-2.5">
              {recommendations.map((recipe, i) => (
                <RecommendationCard
                  key={recipe.id}
                  recipe={recipe}
                  rank={i + 1}
                  expanded={expandedRec === recipe.id}
                  onToggle={() => setExpandedRec(expandedRec === recipe.id ? null : recipe.id)}
                  onReplace={() => startReplace(recipe)}
                  onInfo={() => {
                    setExpandedRec(null);
                    setSelectedRecipe(recipe);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Food detail sheet */}
      {selectedFood && (
        <FoodDetailSheet
          food={selectedFood}
          profile={profile}
          onClose={() => setSelectedFood(null)}
        />
      )}

      {/* Recipe detail sheet */}
      {selectedRecipe && (
        <RecipeDetailSheet
          recipe={selectedRecipe}
          profile={profile}
          onClose={() => setSelectedRecipe(null)}
        />
      )}

    </div>
  );
}
