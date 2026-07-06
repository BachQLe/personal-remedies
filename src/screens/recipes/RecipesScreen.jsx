import { useState, useEffect } from 'react';
import { api } from '../../api/api.js';
import RecipeDetail from '../../components/RecipeDetail.jsx';
import EmptyState from '../../components/shared/EmptyState.jsx';
import Pill from '../../components/shared/Pill.jsx';
import SearchInput from '../../components/shared/SearchInput.jsx';
import Icon from '../../components/shared/Icon.jsx';
import DemoDataChip from '../../components/shared/DemoDataChip.jsx';
import { buildRecipeIngredients } from '../../api/recipeDetail.js';
import { GHOST_PROFILE, GHOST_RECIPES } from '../../api/ghostData.js';

// Demo key conditions (see api/config.js DEFAULT_DEV_CONDITIONS): 203 = Aging, 244 = Pneumonia.
const DEMO_PROFILE = {
  conditions: [203, 244],
  medications: [],
  allergies: [],
  dietary: [],
  tasteLikes: [],
  tasteDislikes: [],
};

const CONDITION_DOT_COLORS = {
  "type 2 diabetes": "bg-lavender-600",
  prediabetes: "bg-lavender-400",
  "hypertension (high blood pressure)": "bg-info-600",
  hypertension: "bg-info-600",
  "high cholesterol": "bg-caution-600",
  "chronic kidney disease (ckd)": "bg-forest-500",
  "heart failure": "bg-lavender-700",
  "heart disease": "bg-lavender-700",
  depression: "bg-info-600",
  osteoarthritis: "bg-caution-600",
  hypothyroidism: "bg-forest-700",
  "irritable bowel syndrome (ibs)": "bg-lavender-400",
  "fatty liver": "bg-caution-600",
  gout: "bg-caution-600",
};

function ConditionDot({ condition }) {
  const cls = CONDITION_DOT_COLORS[condition.toLowerCase().trim()] || "bg-char-400";
  return <span className={`w-[7px] h-[7px] rounded-full flex-none ${cls}`} />;
}

const MEAL_TYPES = [
  { label: 'All', icon: 'restaurant' },
  { label: 'Breakfast', icon: 'egg_alt' },
  { label: 'Lunch', icon: 'lunch_dining' },
  { label: 'Dinner', icon: 'dinner_dining' },
  { label: 'Snack', icon: 'cookie' },
];

// ── Tier config (matches IngredientCard's pill pattern) ─────────────────────

const TIER_CONFIG = {
  Top: {
    label: 'Top',
    bg: 'bg-benefit-100',
    fg: 'text-benefit-600',
    dot: 'bg-benefit-600',
  },
  Strong: {
    label: 'Strong',
    bg: 'bg-forest-50',
    fg: 'text-forest-700',
    dot: 'bg-forest-600',
  },
  Good: {
    label: 'Good',
    bg: 'bg-paper-200',
    fg: 'text-char-700',
    dot: 'bg-char-500',
  },
};

// ── Recipe list row — thumbnail, title, tier pill, source; whole row taps ────

function RecipeRow({ recipe, onView }) {
  const tierCfg = recipe.tier ? TIER_CONFIG[recipe.tier] : null;
  return (
    <button
      onClick={() => onView(recipe)}
      className="w-full flex items-center gap-3.5 bg-white rounded-xl border border-sand-200
        p-3 shadow-xs text-left cursor-pointer
        transition-all duration-base ease-ds-out
        hover:border-forest-300 hover:shadow-card hover:-translate-y-[1px]
        active:translate-y-[1px] active:scale-[0.99]"
    >
      {/* Thumbnail */}
      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-forest-50 flex items-center justify-center">
        {recipe.photo ? (
          <img
            src={recipe.photo}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <span className="font-display text-2xl font-semibold text-forest-300">
            {recipe.title?.[0] || ''}
          </span>
        )}
      </div>

      {/* Title + tier + source */}
      <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
        <span className="font-sans font-semibold text-char-900 text-sm leading-snug line-clamp-2">
          {recipe.title}
        </span>
        <div className="flex items-center gap-2 mt-0.5">
          {tierCfg && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-[11px] font-semibold ${tierCfg.bg} ${tierCfg.fg}`}>
              <span className={`w-[6px] h-[6px] rounded-full ${tierCfg.dot}`} />
              {tierCfg.label}
            </span>
          )}
          {recipe.sourceName && (
            <span className="text-[11px] text-char-500 font-sans truncate">
              {recipe.sourceName}
            </span>
          )}
        </div>
      </div>

      {/* Chevron affordance */}
      <span className="flex-shrink-0 text-char-400">
        <Icon name="chevron-right" size={16} />
      </span>
    </button>
  );
}

export default function RecipesScreen() {
  const [profile, setProfile] = useState(null);
  const [allRecipes, setAllRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mealFilter, setMealFilter] = useState('All');
  const [conditionFilter, setConditionFilter] = useState('All');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Display names for the real profile's conditions (healthConditionID[]).
  const [conditionNames, setConditionNames] = useState([]);
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      let p = await api.getProfile();
      if (!p) p = DEMO_PROFILE;
      if (!alive) return;
      setProfile(p);
      try {
        const { recipes, usedFallback: fallback } = await api.getRecipes(p);
        if (!alive) return;
        setAllRecipes(recipes ?? []);
        setUsedFallback(!!fallback);
      } catch (err) {
        console.error('RecipesScreen: getRecipes failed', err);
        if (alive) setAllRecipes([]);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .getConditionNames(profile?.conditions ?? [])
      .then((names) => { if (alive) setConditionNames(names); })
      .catch(() => { if (alive) setConditionNames([]); });
    return () => { alive = false; };
  }, [profile]);

  // Ghost mode: render the real layout with placeholder data while loading.
  const ghost = loading;
  // GHOST_PROFILE already carries display-name strings; the real profile's
  // conditions are healthConditionIDs, so use the resolved names instead.
  const conditions = ghost ? (GHOST_PROFILE.conditions ?? []) : conditionNames;
  const conditionOptions = ['All', ...conditions];

  const recipes = ghost ? GHOST_RECIPES : allRecipes;

  // Real recipes (from adapter getRecipes) don't carry a per-ingredient
  // breakdown yet — enrich with real assessFood/topdoordonts data on open,
  // via recipeDetail.js's buildRecipeIngredients (mirrors RecipePicksTab's
  // buildRecipeDetail pattern). Ghost recipes already have `ingredients`.
  function handleViewRecipe(recipe) {
    if (recipe.ingredients) {
      setSelectedRecipe(recipe);
      return;
    }
    setSelectedRecipe({ ...recipe, ingredients: [] });
    buildRecipeIngredients(recipe, profile)
      .then(setSelectedRecipe)
      .catch(() => {});
  }

  const filtered = recipes.filter((r) => {
    const mealOk = mealFilter === 'All' || r.mealType === mealFilter || r.mealType?.toLowerCase() === mealFilter.toLowerCase();
    const condOk = conditionFilter === 'All' || r.matchedConditions.includes(conditionFilter);
    const searchOk = !searchQuery.trim() || r.title.toLowerCase().includes(searchQuery.toLowerCase());
    return mealOk && condOk && searchOk;
  });

  return (
    <div
      className={`flex flex-col gap-5 px-5 pt-6 pb-8 bg-paper-200 min-h-full${ghost ? ' rm-ghost' : ''}`}
      aria-busy={ghost}
    >
      {/* Header */}
      <div>
        <p className="text-[12px] text-char-500 font-label tracking-[0.14em] uppercase">Personal Remedies</p>
        <h1 className="font-display text-2xl font-semibold text-blue-950 tracking-tightish">Recipes</h1>
        <p className="text-sm text-char-500 mt-0.5 font-sans">Condition-approved for your profile</p>
        {!ghost && usedFallback && (
          <div className="mt-2">
            <DemoDataChip />
          </div>
        )}
      </div>

      {/* Search */}
      <div className="py-1">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search recipes"
        />
      </div>

      {/* Section header */}
      <h2 className="font-display text-lg font-semibold text-blue-950 tracking-tightish -mb-2">Discover your top recipes</h2>

      {/* Filters */}
      <div>
        {/* Meal type filter */}
        <div>
          <p className="text-[12px] font-label tracking-[0.14em] uppercase text-char-500 mb-2">Meal type</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-hide">
            {MEAL_TYPES.map(({ label, icon }) => (
              <Pill
                key={label}
                selected={mealFilter === label}
                onClick={() => setMealFilter(label)}
              >
                <Icon name="utensils" size={16} />
                {label}
              </Pill>
            ))}
          </div>
        </div>

        {/* Condition emphasis filter */}
        {conditions.length > 1 && (
          <div className="mt-3">
            <p className="text-[12px] font-label tracking-[0.14em] uppercase text-char-500 mb-2">Condition</p>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-hide">
              {conditionOptions.map((c) => (
                <Pill
                  key={c}
                  selected={conditionFilter === c}
                  onClick={() => setConditionFilter(c)}
                >
                  {c !== 'All' && <ConditionDot condition={c} />}
                  {c === 'All' ? 'All conditions' : c.split('(')[0].trim()}
                </Pill>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recipe count */}
      {filtered.length > 0 && (
        <p className="text-xs text-char-500 -mb-2 font-sans">
          <span className="font-mono">{filtered.length}</span> {filtered.length === 1 ? 'recipe' : 'recipes'}
          {mealFilter !== 'All' ? ` · ${mealFilter}` : ''}
          {conditionFilter !== 'All' ? ` · ${conditionFilter.split('(')[0].trim()}` : ''}
        </p>
      )}

      {/* Recipe list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="menu_book"
          title={recipes.length === 0 ? 'No recipes yet' : 'No recipes found'}
          body={
            recipes.length === 0
              ? 'Set up your health profile to get condition-matched recipes.'
              : 'Try adjusting the filters above.'
          }
          action={
            recipes.length === 0 ? undefined : (
              <button
                onClick={() => { setMealFilter('All'); setConditionFilter('All'); setSearchQuery(''); }}
                className="px-5 py-2.5 rounded-xs bg-forest-700 text-white text-sm font-semibold font-sans
                  transition-all duration-fast ease-ds-out
                  hover:bg-forest-800 active:scale-[0.98]"
              >
                Clear filters
              </button>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((recipe) => (
            <RecipeRow
              key={recipe.id}
              recipe={recipe}
              onView={handleViewRecipe}
            />
          ))}
        </div>
      )}

      {/* Recipe detail sheet */}
      {selectedRecipe && (
        <RecipeDetail
          recipe={selectedRecipe}
          profile={profile}
          onClose={() => setSelectedRecipe(null)}
        />
      )}
    </div>
  );
}
