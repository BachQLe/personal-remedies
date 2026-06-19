import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/api.js';
import Card from '../../components/Card.jsx';
import ConditionTag from '../../components/ConditionTag.jsx';
import SignalChip from '../../components/SignalChip.jsx';
import StudyReferences from '../../components/StudyReferences.jsx';
import BottomSheet from '../../components/BottomSheet.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { GHOST_PROFILE, GHOST_TOP_FOODS } from '../../api/ghostData.js';

const DEMO_PROFILE = {
  conditions: ['Type 2 Diabetes', 'Hypertension (high blood pressure)', 'High cholesterol'],
  medications: [],
  allergies: [],
  dietary: [],
  tasteLikes: [],
  tasteDislikes: [],
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getTodayEyebrow() {
  const now = new Date();
  const day = DAY_NAMES[now.getDay()];
  const month = now.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const date = now.getDate();
  return `TODAY · ${day.toUpperCase()}, ${month} ${date}`;
}

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const HOME_SLOT_META = {
  Breakfast: { icon: 'wb_twilight', bg: 'bg-signal-limit-tint', bgToday: 'bg-white/10' },
  Lunch:     { icon: 'sunny',      bg: 'bg-signal-info-tint',  bgToday: 'bg-white/10' },
  Dinner:    { icon: 'nights_stay', bg: 'bg-plum-50',           bgToday: 'bg-white/10' },
};

const DEMO_MEALS = {
  Mon: { Breakfast: ['Oatmeal'], Lunch: ['Salad'], Dinner: ['Salmon'] },
  Tue: { Breakfast: ['Eggs'], Lunch: [], Dinner: ['Stir fry'] },
  Wed: { Breakfast: [], Lunch: ['Wrap'], Dinner: [] },
  Thu: { Breakfast: ['Yogurt'], Lunch: ['Soup'], Dinner: ['Chicken'] },
  Fri: { Breakfast: [], Lunch: ['Rice bowl'], Dinner: ['Pasta'] },
  Sat: { Breakfast: ['Pancakes'], Lunch: [], Dinner: [] },
  Sun: { Breakfast: ['Berries'], Lunch: ['Sandwich'], Dinner: ['Stew'] },
};

function DaysAtAGlance() {
  const today = new Date();
  const days = Array.from({ length: 3 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  return (
    <Card className="!p-5">
      <p className="font-mono text-xs font-semibold uppercase tracking-eyebrow text-char-500 mb-4">
        Days at a glance
      </p>
      <div className="grid grid-cols-3 gap-3">
        {days.map((date, i) => {
          const isToday = i === 0;
          const dayKey = WEEK_DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1];
          const dayMeals = DEMO_MEALS[dayKey] ?? {};
          const label = isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' });
          const dateNum = date.getDate();
          return (
            <div
              key={i}
              className={`relative flex flex-col p-3 overflow-hidden ${
                isToday
                  ? 'bg-forest-700 text-white'
                  : 'bg-paper-100 text-char-900'
              }`}
              style={{
                clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)',
              }}
            >
              <div className="flex items-baseline gap-1.5 mb-3">
                <span
                  className={`font-mono text-lg font-bold leading-none ${
                    isToday ? 'text-white' : 'text-char-900'
                  }`}
                >
                  {dateNum}
                </span>
                <span
                  className={`font-mono text-[10px] font-semibold uppercase ${
                    isToday ? 'text-white/60' : 'text-char-500'
                  }`}
                >
                  {label}
                </span>
              </div>
              <div className="flex flex-col gap-2 flex-1">
                {Object.entries(HOME_SLOT_META).map(([slot, meta]) => {
                  const items = dayMeals[slot] ?? [];
                  return (
                    <div
                      key={slot}
                      className={`p-2 flex-1 rounded-sm ${isToday ? meta.bgToday : meta.bg}`}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <span
                          className={`material-symbols-rounded ${isToday ? 'text-white/60' : 'text-char-500'}`}
                          style={{ fontSize: 13 }}
                        >
                          {meta.icon}
                        </span>
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider ${
                            isToday ? 'text-white/60' : 'text-char-500'
                          }`}
                        >
                          {slot.slice(0, 3)}
                        </span>
                      </div>
                      {items.length > 0 ? (
                        items.map((item, j) => (
                          <p
                            key={j}
                            className={`text-[11px] leading-snug truncate ${
                              isToday ? 'text-white/90' : 'text-char-700'
                            }`}
                          >
                            {item}
                          </p>
                        ))
                      ) : (
                        <p
                          className={`text-[11px] leading-snug ${
                            isToday ? 'text-white/30' : 'text-char-300'
                          }`}
                        >
                          —
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

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
        <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-paper-200">
          <img
            src={food.photo}
            alt={food.name}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
        <div className="flex flex-col gap-2 justify-center">
          <SignalChip signal={food.signal} />
          <p className="text-xs text-char-500 font-sans">
            {food.referenceCount} {food.referenceCount === 1 ? 'study' : 'studies'} behind this
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {displayConditions.map((condition) => (
          <div key={condition} className="bg-paper-100 rounded-lg p-4">
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
                className="text-xs text-forest-700 font-semibold font-sans mt-1 hover:text-forest-800 transition-colors duration-fast"
              >
                See the studies
                <span className="material-symbols-rounded align-middle ml-0.5" style={{ fontSize: 14 }}>
                  arrow_forward
                </span>
              </button>
            )}
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}

export default function HomeScreen() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [topFoods, setTopFoods] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFood, setSelectedFood] = useState(null);
  const [avoidOpen, setAvoidOpen] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    async function load() {
      let p = await api.getProfile();
      if (!p) p = DEMO_PROFILE;
      setProfile(p);
      const foods = await api.getTopFoods(p);
      setTopFoods(foods);
      setLoading(false);
    }
    load();
  }, []);

  // Ghost mode: render the real layout with placeholder data while loading.
  const ghost = loading;
  const ghostProfile = ghost ? GHOST_PROFILE : profile;
  const ghostFoods = ghost ? GHOST_TOP_FOODS : topFoods;

  const helpful = ghostFoods?.helpful ?? [];
  const avoid = ghostFoods?.avoid ?? [];
  const byCategory = ghostFoods?.byCategory ?? {};
  const categories = Object.keys(byCategory);

  const displayHelpful = selectedCategory
    ? (byCategory[selectedCategory] ?? [])
    : helpful;

  return (
    <div
      className={`flex flex-col gap-5 px-5 pt-6 pb-8 bg-paper-200 min-h-screen${ghost ? ' rm-ghost' : ''}`}
      aria-busy={ghost}
    >
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-eyebrow text-char-500">
              {getTodayEyebrow()}
            </p>
            <h1 className="font-display text-[40px] font-semibold text-char-900 mt-1 leading-tight">
              {getGreeting()}, Mory.
            </h1>
          </div>
          <button
            onClick={() => navigate('/app/profile')}
            className="w-10 h-10 rounded-full hover:bg-char-900/5 flex items-center justify-center transition-colors duration-fast"
            aria-label="Notifications"
          >
            <span className="material-symbols-rounded text-char-400" style={{ fontSize: 22 }}>
              notifications
            </span>
          </button>
        </div>
        {ghostProfile?.conditions?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {ghostProfile.conditions.map((c) => (
              <ConditionTag key={c} condition={c} compact />
            ))}
          </div>
        )}
      </div>

      {/* Days at a glance */}
      <DaysAtAGlance />

      {/* Your food profile — categories + top foods */}
      <Card className="!p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-mono text-xs font-semibold uppercase tracking-eyebrow text-char-500">
            Your food profile
          </p>
          <p className="text-[11px] text-char-400 font-sans">
            Matched to {ghostProfile?.conditions?.length ?? 0} condition{ghostProfile?.conditions?.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Category slider */}
        {categories.length > 0 && (
          <div className="relative mb-4 -mx-5">
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-30" style={{ background: 'linear-gradient(to right, white 0%, transparent 100%)' }} />
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-30" style={{ background: 'linear-gradient(to left, white 0%, transparent 100%)' }} />
            <div className="relative z-10 flex gap-2 overflow-x-auto pb-1 px-5 scrollbar-hide">
              {categories.map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(isActive ? null : cat)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold font-sans whitespace-nowrap border shadow-sm transition-all duration-fast
                      ${isActive
                        ? 'bg-forest-700 text-white border-forest-700 shadow-md'
                        : 'bg-white text-char-700 border-sand-200 hover:border-forest-300 hover:shadow-md'
                      }`}
                  >
                    {cat}
                    <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white/80' : 'bg-paper-200 text-char-400'}`}>
                      {byCategory[cat].length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Most helpful grid */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-char-900 font-sans">
            {selectedCategory ? selectedCategory : 'Most helpful for you'}
          </p>
          {selectedCategory && (
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-xs text-forest-700 font-semibold font-sans hover:text-forest-800 transition-colors duration-fast"
            >
              Show all
            </button>
          )}
        </div>
        {displayHelpful.length === 0 ? (
          <EmptyState
            title="No foods yet"
            body="Complete onboarding to see recommendations."
            action={
              <button
                onClick={() => navigate('/onboarding')}
                className="px-5 py-2.5 rounded-pill bg-forest-700 hover:bg-forest-800 text-white text-sm font-semibold font-sans transition-colors duration-fast"
              >
                Set up profile
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {displayHelpful.slice(0, 9).map((food, i) => (
              <button
                key={food.id}
                onClick={() => setSelectedFood(food)}
                className="relative flex flex-col bg-paper-200 rounded-none border border-sand-200 overflow-hidden shadow-card text-left
                  transition-all duration-base ease-ds-out
                  hover:-translate-y-[2px] hover:shadow-lg
                  active:translate-y-[1px] active:scale-[0.99]"
              >
                {i < 3 && (
                  <span className="absolute top-0.5 right-0.5 z-10 flex items-center gap-px px-1 py-px rounded bg-honey-600 text-white text-[7px] font-bold font-mono shadow-sm">
                    <span className="material-symbols-rounded" style={{ fontSize: 8 }}>kid_star</span>
                    #{i + 1}
                  </span>
                )}
                <div className="w-full aspect-[3/4] bg-sand-100">
                  {food.photo ? (
                    <img
                      src={food.photo}
                      alt={food.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-forest-600">
                      <span className="font-display text-lg font-semibold text-paper-100">
                        {food.name?.[0] || ''}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-1.5 bg-white rounded-t-sm -mt-3 relative">
                  <p className="text-[10px] font-semibold text-char-900 font-sans truncate">{food.name}</p>
                  {food.referenceCount > 0 && (
                    <p className="text-[9px] text-char-400 font-mono mt-0.5">
                      {food.referenceCount} {food.referenceCount === 1 ? 'study' : 'studies'}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Foods to avoid */}
        {avoid.length > 0 && (
          <>
            <button
              onClick={() => setAvoidOpen((o) => !o)}
              className="w-full flex items-center justify-between mt-5 mb-3"
            >
              <div className="flex items-center gap-2">
                <p className="font-mono text-xs font-semibold uppercase tracking-eyebrow text-signal-avoid">Foods to avoid</p>
                <span className="px-1.5 py-0.5 bg-signal-avoid-tint text-signal-avoid text-[10px] font-semibold rounded-pill font-mono">
                  {avoid.length}
                </span>
              </div>
              <span
                className={`material-symbols-rounded text-signal-avoid transition-transform duration-base ${avoidOpen ? 'rotate-180' : ''}`}
                style={{ fontSize: 16 }}
              >
                expand_more
              </span>
            </button>

            <div className={`grid grid-cols-3 gap-2 ${avoidOpen ? 'grid' : 'hidden'}`}>
              {avoid.map((food) => (
                <button
                  key={food.id}
                  onClick={() => setSelectedFood(food)}
                  className="relative flex flex-col bg-paper-200 rounded-none border border-sand-200 overflow-hidden shadow-card text-left
                    transition-all duration-base ease-ds-out
                    hover:-translate-y-[2px] hover:shadow-lg
                    active:translate-y-[1px] active:scale-[0.99]"
                >
                  <div className="w-full aspect-[3/4] bg-sand-100">
                    {food.photo ? (
                      <img
                        src={food.photo}
                        alt={food.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-signal-avoid">
                        <span className="font-display text-lg font-semibold text-paper-100">
                          {food.name?.[0] || ''}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-1.5 bg-white rounded-t-sm -mt-3 relative">
                    <p className="text-[10px] font-semibold text-char-900 font-sans truncate">{food.name}</p>
                    {food.referenceCount > 0 && (
                      <p className="text-[9px] text-char-400 font-mono mt-0.5">
                        {food.referenceCount} {food.referenceCount === 1 ? 'study' : 'studies'}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Food detail sheet */}
      {selectedFood && (
        <FoodDetailSheet
          food={selectedFood}
          profile={profile}
          onClose={() => setSelectedFood(null)}
        />
      )}
    </div>
  );
}
