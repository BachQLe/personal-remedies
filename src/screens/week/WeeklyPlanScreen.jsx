import { useState, useEffect, useRef, Fragment } from 'react';
import { api } from '../../api/api.js';
import ConditionTag from '../../components/shared/ConditionTag.jsx';
import SignalChip from '../../components/shared/SignalChip.jsx';
import StudyReferences from '../../components/shared/StudyReferences.jsx';
import BottomSheet from '../../components/shared/BottomSheet.jsx';
import EmptyState from '../../components/shared/EmptyState.jsx';
import Icon from '../../components/shared/Icon.jsx';
import { GHOST_WEEK } from '../../api/ghostData.js';

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

// Usefulness: how well a recipe fits the user's profile. Higher = more useful.
function recipeUsefulness(recipe, profile) {
  const conditions = profile?.conditions ?? [];
  const matches = recipe.matchedConditions?.filter((c) => conditions.includes(c)).length ?? 0;
  return matches * 25 + (recipe.healthScore ?? 0);
}

// ── Meal slot meta (Material Symbols icons, DS tint backgrounds) ─────────────
const SLOT_META = {
  Breakfast: { icon: 'sun',  bg: 'bg-caution-100',   short: 'B' },
  Lunch:     { icon: 'sun',  bg: 'bg-info-100',      short: 'L' },
  Dinner:    { icon: 'moon', bg: 'bg-lavender-100',  short: 'D' },
  Snack:     { icon: 'leaf', bg: 'bg-benefit-100',    short: 'S' },
};
const SLOT_ORDER = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

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
      <div className="w-full h-48 rounded-xl overflow-hidden bg-sand-100 mb-5">
        <img
          src={recipe.photo}
          alt={recipe.title}
          className="w-full h-full object-cover"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-char-500 font-medium font-sans">{recipe.sourceName}</p>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-signal-beneficial-tint">
          <Icon name="check" size={14} className="text-signal-beneficial" />
          <span className="text-xs text-signal-beneficial font-semibold font-sans">Matched to your profile</span>
        </div>
      </div>

      {displayConditions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {displayConditions.map((c) => (
            <ConditionTag key={c} condition={c} />
          ))}
        </div>
      )}

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

// ── A single slot cell in the week grid — food labels, not photos ────────────
function SlotCell({ meal, dayIndex, slot, swap, onFoodSelect, onRecipeSelect, onPlace }) {
  const recipe = meal?.recipes?.[0] ?? null;
  const foods = meal?.items ?? [];
  const empty = !recipe && foods.length === 0;

  const isRecipeMode = swap?.mode === 'recipe';
  const isTarget =
    swap?.mode === 'target' &&
    swap.target.dayIndex === dayIndex &&
    swap.target.slot === slot;

  if (isRecipeMode) {
    return (
      <button
        onClick={() => onPlace({ dayIndex, slot })}
        className="flex flex-col gap-1 p-1.5 min-h-[56px] text-left rounded-md border-2 border-dashed border-forest-400
          bg-forest-50/40 hover:bg-forest-50 transition-colors duration-fast"
        style={{ animation: 'plan-jitter 0.4s ease-in-out infinite' }}
      >
        {recipe && (
          <span className="text-[10px] font-semibold text-forest-800 leading-tight line-clamp-2">{recipe.title}</span>
        )}
        {foods.map((f) => (
          <span key={f.id} className="text-[10px] text-char-500 leading-tight truncate">{f.name}</span>
        ))}
        <Icon name="refresh-cw" size={16} className="text-forest-600 mt-auto" />
      </button>
    );
  }

  return (
    <div
      className={`flex flex-col gap-1 p-1.5 min-h-[56px] rounded-md transition-shadow duration-fast
        ${isTarget ? 'ring-2 ring-forest-500 ring-offset-1 ring-offset-paper-200 bg-forest-50/50' : ''}`}
    >
      {/* Recipe label — distinct forest chip */}
      {recipe && (
        <button
          onClick={() => onRecipeSelect(recipe)}
          className="flex items-start gap-0.5 text-left rounded bg-forest-100 px-1 py-0.5
            hover:bg-forest-200/70 transition-colors duration-fast"
        >
          <Icon name="utensils" size={11} className="text-forest-700 mt-px flex-shrink-0" />
          <span className="text-[10px] font-semibold text-forest-800 leading-tight line-clamp-2">{recipe.title}</span>
        </button>
      )}

      {/* Food labels — plain text chips */}
      {foods.map((food) => (
        <button
          key={food.id}
          onClick={() => onFoodSelect(food)}
          className="text-left text-[10px] leading-tight text-char-700 truncate rounded px-1 py-0.5
            hover:bg-sand-100 transition-colors duration-fast"
        >
          {food.name}
        </button>
      ))}

      {empty && <span className="text-[10px] text-char-300 px-1">—</span>}
    </div>
  );
}

// ── Full-week calendar — days as rows, slots as columns ──────────────────────
function WeekCalendar({ days, swap, todayISO, onFoodSelect, onRecipeSelect, onPlace }) {
  const mealsBySlot = (day) => {
    const map = {};
    for (const m of day.meals) map[m.slot] = m;
    return map;
  };

  return (
    <div className="rounded-xl bg-sand-200/60 border border-sand-200 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] p-2">
      <div className="grid items-stretch gap-1" style={{ gridTemplateColumns: '34px repeat(4, minmax(0, 1fr))' }}>
        {/* Header row */}
        <div />
        {SLOT_ORDER.map((slot) => {
          const meta = SLOT_META[slot];
          return (
            <div key={slot} className={`flex items-center justify-center gap-1 rounded-md py-1.5 ${meta.bg}`}>
              <Icon name={meta.icon} size={13} className="text-char-700" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-char-700 hidden min-[380px]:inline">{slot}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-char-700 min-[380px]:hidden">{meta.short}</span>
            </div>
          );
        })}

        {/* Day rows — cells flow directly into the grid */}
        {days.map((day, dayIndex) => {
          const slotMap = mealsBySlot(day);
          const isToday = day.date === todayISO;
          const rowAnim = { animation: 'plan-blur-in 0.18s ease-out both', animationDelay: `${dayIndex * 0.03}s` };
          return (
            <Fragment key={day.date}>
              <div
                style={rowAnim}
                className={`flex flex-col items-center justify-center rounded-md py-1 ${
                  isToday ? 'bg-forest-700 text-white' : 'bg-paper-100 text-char-900'
                }`}
              >
                <span className={`text-[9px] font-bold uppercase tracking-eyebrow ${isToday ? 'text-white/70' : 'text-char-400'}`}>
                  {day.weekday.slice(0, 2)}
                </span>
                <span className="text-xs font-bold font-mono tabular-nums leading-none mt-0.5">{day.dayNum}</span>
              </div>
              {SLOT_ORDER.map((slot) => (
                <div key={slot} style={rowAnim} className="bg-white rounded-md border border-sand-200/80">
                  <SlotCell
                    meal={slotMap[slot]}
                    dayIndex={dayIndex}
                    slot={slot}
                    swap={swap}
                    onFoodSelect={onFoodSelect}
                    onRecipeSelect={onRecipeSelect}
                    onPlace={onPlace}
                  />
                </div>
              ))}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ── "Recipes this week" row — ranked least → most useful, swappable ──────────
function WeekRecipeRow({ entry, expanded, onToggle, onSwap, onInfo }) {
  const { recipe, weekday, slot } = entry;
  const meta = SLOT_META[slot];
  return (
    <div className="bg-white rounded-xl border border-sand-200 shadow-xs overflow-hidden transition-all duration-base">
      <button onClick={onToggle} className="w-full flex items-center gap-3.5 p-3.5 text-left transition-colors duration-fast hover:bg-sand-50">
        <div className="relative w-[52px] h-[52px] rounded-md overflow-hidden flex-shrink-0 bg-paper-200">
          <img
            src={recipe.photo}
            alt={recipe.title}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-sans font-semibold text-char-900 text-sm leading-snug line-clamp-1">{recipe.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sand-100">
              <Icon name={meta.icon} size={11} className="text-char-500" />
              <span className="text-[10px] font-semibold text-char-600">{weekday} · {slot}</span>
            </span>
            <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-signal-beneficial-tint">
              <Icon name="heart" size={12} className="text-signal-beneficial" />
              <span className="text-[10px] font-bold text-signal-beneficial">{recipe.healthScore}</span>
            </div>
          </div>
        </div>
        <span className={`flex-shrink-0 text-char-400 material-symbols-rounded transition-transform duration-fast ${expanded ? 'rotate-180' : ''}`} style={{ fontSize: 18 }}>
          expand_more
        </span>
      </button>

      {expanded && (
        <div className="flex border-t border-sand-200">
          <button
            onClick={onSwap}
            className="flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold text-forest-700 font-sans
              transition-colors duration-fast hover:bg-forest-50 active:bg-forest-100 border-r border-sand-200"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 22 }}>swap_horiz</span>
            Swap out
          </button>
          <button
            onClick={onInfo}
            className="flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold text-char-600 font-sans
              transition-colors duration-fast hover:bg-sand-50 active:bg-sand-100"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 22 }}>info</span>
            View details
          </button>
        </div>
      )}
    </div>
  );
}

// ── Top recommendation row (unchanged behavior from the day plan) ────────────
function RecommendationCard({ recipe, rank, expanded, targetMode, onToggle, onReplace, onPlace, onInfo }) {
  if (targetMode) {
    return (
      <button
        onClick={onPlace}
        className="w-full flex items-center gap-3.5 p-3.5 text-left bg-white rounded-xl border-2 border-forest-300 shadow-xs
          hover:bg-forest-50/50 transition-colors duration-fast"
      >
        <div className="relative w-[52px] h-[52px] rounded-md overflow-hidden flex-shrink-0 bg-paper-200">
          <img src={recipe.photo} alt={recipe.title} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <div className="absolute top-0 left-0 w-5 h-5 bg-forest-700 text-white text-[10px] font-bold flex items-center justify-center rounded-br-md">{rank}</div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-sans font-semibold text-char-900 text-sm leading-snug line-clamp-1">{recipe.title}</p>
          <p className="text-xs text-char-500 mt-0.5">{recipe.sourceName}</p>
        </div>
        <span className="flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg bg-forest-700 text-white text-xs font-semibold">
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>add</span>
          Place
        </span>
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-sand-200 shadow-xs overflow-hidden transition-all duration-base">
      <button onClick={onToggle} className="w-full flex items-center gap-3.5 p-3.5 text-left transition-colors duration-fast hover:bg-sand-50">
        <div className="relative w-[52px] h-[52px] rounded-md overflow-hidden flex-shrink-0 bg-paper-200">
          <img src={recipe.photo} alt={recipe.title} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <div className="absolute top-0 left-0 w-5 h-5 bg-forest-700 text-white text-[10px] font-bold flex items-center justify-center rounded-br-md">{rank}</div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-sans font-semibold text-char-900 text-sm leading-snug">{recipe.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-char-500">{recipe.sourceName}</p>
            <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-signal-beneficial-tint">
              <span className="material-symbols-rounded text-signal-beneficial" style={{ fontSize: 12 }}>favorite</span>
              <span className="text-[10px] font-bold text-signal-beneficial">{recipe.healthScore}</span>
            </div>
          </div>
        </div>
        <span className={`flex-shrink-0 text-char-400 material-symbols-rounded transition-transform duration-fast ${expanded ? 'rotate-180' : ''}`} style={{ fontSize: 18 }}>
          expand_more
        </span>
      </button>

      {expanded && (
        <div className="flex border-t border-sand-200">
          <button
            onClick={onReplace}
            className="flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold text-forest-700 font-sans
              transition-colors duration-fast hover:bg-forest-50 active:bg-forest-100 border-r border-sand-200"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 22 }}>swap_horiz</span>
            Replace a meal
          </button>
          <button
            onClick={onInfo}
            className="flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold text-char-600 font-sans
              transition-colors duration-fast hover:bg-sand-50 active:bg-sand-100"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 22 }}>info</span>
            View details
          </button>
        </div>
      )}
    </div>
  );
}

// ── WeeklyPlanScreen ──────────────────────────────────────────────────────────
export default function WeeklyPlanScreen() {
  const todayISO = toISO(new Date());
  const [profile, setProfile] = useState(null);
  const [week, setWeek] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedFood, setSelectedFood] = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [expandedWeekRow, setExpandedWeekRow] = useState(null);
  const [expandedRec, setExpandedRec] = useState(null);

  // swap = null | { mode:'recipe', recipe } | { mode:'target', target:{dayIndex,slot,label} }
  const [swap, setSwap] = useState(null);

  const calendarRef = useRef(null);
  const recsRef = useRef(null);

  useEffect(() => {
    async function init() {
      let p = await api.getProfile();
      if (!p) p = DEMO_PROFILE;
      setProfile(p);
      const [weekPlan, recs] = await Promise.all([
        api.getWeeklyPlan(p, todayISO),
        api.getTopRecipeRecommendations(p, 10),
      ]);
      setWeek(weekPlan);
      setRecommendations(recs);
      setLoading(false);
    }
    init();
  }, []);

  function placeRecipe(target, recipe) {
    setWeek((prev) => ({
      ...prev,
      days: prev.days.map((day, di) =>
        di !== target.dayIndex
          ? day
          : { ...day, meals: day.meals.map((m) => (m.slot !== target.slot ? m : { ...m, recipes: [recipe] })) },
      ),
    }));
    setSwap(null);
    setExpandedWeekRow(null);
    setExpandedRec(null);
  }

  // From a "this week" row: pick this slot, then choose a replacement below.
  function startSwapFromSlot(entry) {
    setSwap({ mode: 'target', target: { dayIndex: entry.dayIndex, slot: entry.slot, label: `${entry.weekday} · ${entry.slot}` } });
    setExpandedWeekRow(null);
    setTimeout(() => recsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  // From a top recipe: pick this recipe, then tap a slot on the calendar.
  function startReplaceFromRecipe(recipe) {
    setSwap({ mode: 'recipe', recipe });
    setExpandedRec(null);
    setTimeout(() => calendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  function handleCalendarPlace(slotLoc) {
    if (swap?.mode !== 'recipe') return;
    placeRecipe(slotLoc, swap.recipe);
  }

  const ghost = loading;
  const days = ghost ? GHOST_WEEK.days : (week?.days ?? []);
  const weekStart = ghost ? GHOST_WEEK.weekStart : week?.weekStart;

  // Recipes actually scheduled this week, ranked least → most useful.
  const usedRecipes = days
    .flatMap((day, dayIndex) =>
      day.meals
        .filter((m) => m.recipes?.length)
        .map((m) => ({
          recipe: m.recipes[0],
          dayIndex,
          weekday: day.weekday,
          dayNum: day.dayNum,
          slot: m.slot,
          usefulness: recipeUsefulness(m.recipes[0], profile),
        })),
    )
    .sort((a, b) => a.usefulness - b.usefulness);

  const weekRangeLabel = (() => {
    if (!weekStart || ghost) return 'This week';
    const start = new Date(weekStart + 'T00:00:00');
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(start)} – ${fmt(end)}`;
  })();

  return (
    <div className={`flex flex-col pb-8 bg-paper-200 min-h-full${ghost ? ' rm-ghost' : ''}`} aria-busy={ghost}>
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <p className="text-[12px] text-char-500 font-bold uppercase tracking-eyebrow mb-1 font-sans">Personal Remedies</p>
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="font-display text-2xl font-semibold text-char-900 tracking-tightish">Weekly plan</h1>
          <span className="text-xs text-char-500 font-mono" data-ghost-hide>{weekRangeLabel}</span>
        </div>
      </div>

      {/* Active-swap banner */}
      {swap && (
        <div className="px-5 mb-4" data-ghost-hide>
          <div className="flex items-center justify-between bg-forest-50 border border-forest-300 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-rounded text-forest-700" style={{ fontSize: 20 }}>swap_horiz</span>
              <p className="text-sm font-semibold text-forest-800 font-sans truncate">
                {swap.mode === 'recipe'
                  ? <>Tap a meal in the calendar to place <span className="text-forest-900">{swap.recipe.title}</span></>
                  : <>Pick a replacement below for <span className="text-forest-900">{swap.target.label}</span></>}
              </p>
            </div>
            <button
              onClick={() => setSwap(null)}
              className="flex-shrink-0 ml-2 text-xs font-semibold text-forest-700 px-3 py-1.5 rounded-lg bg-white border border-forest-300 hover:bg-forest-50 transition-colors duration-fast"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Full-week calendar */}
      {days.length === 0 ? (
        <div className="px-5">
          <EmptyState icon="calendar_today" title="No plan yet" body="Complete onboarding to generate your week." />
        </div>
      ) : (
        <div ref={calendarRef} className="px-5">
          <WeekCalendar
            days={days}
            swap={swap}
            todayISO={todayISO}
            onFoodSelect={setSelectedFood}
            onRecipeSelect={setSelectedRecipe}
            onPlace={handleCalendarPlace}
          />
        </div>
      )}

      {/* Recipes used this week — least → most useful */}
      {!ghost && usedRecipes.length > 0 && (
        <div className="px-5 mt-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-rounded text-forest-700" style={{ fontSize: 20 }}>list_alt</span>
            <h2 className="font-display text-lg font-semibold text-char-900 tracking-tightish">Recipes this week</h2>
          </div>
          <p className="text-xs text-char-500 mb-4 font-sans">
            Ranked least to most useful for your profile — swap out the ones up top.
          </p>
          <div className="flex flex-col gap-2.5">
            {usedRecipes.map((entry) => {
              const key = `${entry.dayIndex}-${entry.slot}`;
              return (
                <WeekRecipeRow
                  key={key}
                  entry={entry}
                  expanded={expandedWeekRow === key}
                  onToggle={() => setExpandedWeekRow(expandedWeekRow === key ? null : key)}
                  onSwap={() => startSwapFromSlot(entry)}
                  onInfo={() => { setExpandedWeekRow(null); setSelectedRecipe(entry.recipe); }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Top recipes for you — unchanged */}
      {!ghost && recommendations.length > 0 && (
        <div ref={recsRef} className="px-5 mt-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-rounded text-forest-700" style={{ fontSize: 20 }}>recommend</span>
            <h2 className="font-display text-lg font-semibold text-char-900 tracking-tightish">Top recipes for you</h2>
          </div>
          <p className="text-xs text-char-500 mb-4 font-sans">
            {swap?.mode === 'target'
              ? `Tap one to drop into ${swap.target.label}.`
              : 'Sorted by healthiness score. Tap to replace a meal or view details.'}
          </p>
          <div className="flex flex-col gap-2.5">
            {recommendations.map((recipe, i) => (
              <RecommendationCard
                key={recipe.id}
                recipe={recipe}
                rank={i + 1}
                expanded={expandedRec === recipe.id}
                targetMode={swap?.mode === 'target'}
                onToggle={() => setExpandedRec(expandedRec === recipe.id ? null : recipe.id)}
                onReplace={() => startReplaceFromRecipe(recipe)}
                onPlace={() => placeRecipe(swap.target, recipe)}
                onInfo={() => { setExpandedRec(null); setSelectedRecipe(recipe); }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Detail sheets */}
      {selectedFood && (
        <FoodDetailSheet food={selectedFood} profile={profile} onClose={() => setSelectedFood(null)} />
      )}
      {selectedRecipe && (
        <RecipeDetailSheet recipe={selectedRecipe} profile={profile} onClose={() => setSelectedRecipe(null)} />
      )}
    </div>
  );
}
