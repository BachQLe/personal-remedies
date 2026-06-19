import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/api.js';
import RecipeCard from '../../components/RecipeCard.jsx';
import BottomSheet from '../../components/BottomSheet.jsx';
import ConditionTag from '../../components/ConditionTag.jsx';
import SignalChip from '../../components/SignalChip.jsx';
import StudyReferences from '../../components/StudyReferences.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Pill from '../../components/Pill.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import { GHOST_PROFILE, GHOST_RECIPES } from '../../api/ghostData.js';

const DEMO_PROFILE = {
  conditions: ['Type 2 Diabetes', 'Hypertension (high blood pressure)', 'High cholesterol'],
  medications: [],
  allergies: [],
  dietary: [],
  tasteLikes: [],
  tasteDislikes: [],
};

const CONDITION_DOT_COLORS = {
  "type 2 diabetes": "bg-plum-600",
  prediabetes: "bg-plum-400",
  "hypertension (high blood pressure)": "bg-signal-info",
  hypertension: "bg-signal-info",
  "high cholesterol": "bg-honey-700",
  "chronic kidney disease (ckd)": "bg-forest-500",
  "heart failure": "bg-plum-700",
  "heart disease": "bg-plum-700",
  depression: "bg-signal-info",
  osteoarthritis: "bg-honey-600",
  hypothyroidism: "bg-forest-700",
  "irritable bowel syndrome (ibs)": "bg-plum-400",
  "fatty liver": "bg-honey-700",
  gout: "bg-honey-600",
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

// Per-ingredient accordion row inside the detail sheet
function IngredientRow({ ingredient, profile }) {
  const [refs, setRefs] = useState(undefined);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const conditions = profile?.conditions ?? [];
  const relevantConditions = ingredient.matchedConditions.filter((c) => conditions.includes(c));
  const displayConditions = relevantConditions.length ? relevantConditions : ingredient.matchedConditions;

  async function handleExpand() {
    if (!expanded && refs === undefined && displayConditions.length > 0) {
      setLoading(true);
      const r = await api.getIngredientReferences(ingredient.name, displayConditions[0]);
      setRefs(r);
      setLoading(false);
    }
    setExpanded((o) => !o);
  }

  const isBeneficial = ingredient.signal === 'beneficial';

  return (
    <div className={`rounded-xl p-3.5 ${isBeneficial ? 'bg-signal-beneficial-tint' : 'bg-sand-100'}`}>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-char-900 font-sans">{ingredient.name}</span>
            <SignalChip signal={ingredient.signal} compact />
          </div>
          {displayConditions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {displayConditions.slice(0, 2).map((c) => (
                <ConditionTag key={c} condition={c} />
              ))}
            </div>
          )}
        </div>
        {displayConditions.length > 0 && (
          <button
            onClick={handleExpand}
            className="flex-shrink-0 w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-xs
              transition-all duration-fast ease-ds-out hover:shadow-sm"
            aria-label={expanded ? 'Collapse studies' : 'Expand studies'}
          >
            <span
              className={`material-symbols-rounded text-char-500 transition-transform duration-base ${expanded ? 'rotate-180' : ''}`}
              style={{ fontSize: 14 }}
            >
              expand_more
            </span>
          </button>
        )}
      </div>

      {expanded && displayConditions.length > 0 && (
        <div className="mt-3 pl-1">
          <StudyReferences references={refs} loading={loading} />
        </div>
      )}
    </div>
  );
}

function RecipeDetailSheet({ recipe, profile, onClose }) {
  const helpful = recipe.ingredients.filter((i) => i.signal === 'beneficial');
  const neutral = recipe.ingredients.filter((i) => i.signal !== 'beneficial');

  const conditions = profile?.conditions ?? [];
  const matchedToUser = recipe.matchedConditions.filter((c) => conditions.includes(c));
  const displayConditions = matchedToUser.length ? matchedToUser : recipe.matchedConditions;

  return (
    <BottomSheet open onClose={onClose}>
      {/* Hero image */}
      <div className="-mx-5 -mt-4 mb-5">
        <div className="w-full h-52 bg-sand-100 overflow-hidden">
          <img
            src={recipe.photo}
            alt={recipe.title}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
      </div>

      {/* Title + source */}
      <div className="mb-5">
        <h2 className="font-display text-xl font-semibold text-char-900 tracking-tightish leading-snug">{recipe.title}</h2>
        <p className="text-sm text-char-500 mt-1 font-sans">
          from <span className="font-semibold text-char-900">{recipe.sourceName}</span>
        </p>
        {/* Prep/cook times in mono if available */}
        {(recipe.prepTime || recipe.cookTime || recipe.servings) && (
          <div className="flex items-center gap-4 mt-2.5 font-mono text-xs text-char-500">
            {recipe.prepTime && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-rounded" style={{ fontSize: 14 }}>timer</span>
                Prep {recipe.prepTime}
              </span>
            )}
            {recipe.cookTime && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-rounded" style={{ fontSize: 14 }}>local_fire_department</span>
                Cook {recipe.cookTime}
              </span>
            )}
            {recipe.servings && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-rounded" style={{ fontSize: 14 }}>group</span>
                {recipe.servings}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Profile match banner */}
      <div className="bg-signal-beneficial-tint rounded-xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="material-symbols-rounded text-signal-beneficial" style={{ fontSize: 16 }}>check_circle</span>
          <span className="text-sm font-bold text-signal-beneficial font-sans">Matched to your profile</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {displayConditions.map((c) => (
            <ConditionTag key={c} condition={c} />
          ))}
        </div>
        <p className="text-xs text-signal-beneficial font-medium font-sans">
          <span className="font-mono">{helpful.length}</span> beneficial {helpful.length === 1 ? 'ingredient' : 'ingredients'} · <span className="font-mono">{recipe.ingredients.length}</span> total
        </p>
      </div>

      {/* Ingredients */}
      <div className="mb-6">
        <p className="text-[12px] font-bold tracking-eyebrow uppercase text-char-500 mb-3 font-sans">Ingredients</p>
        <div className="flex flex-col gap-2">
          {helpful.map((ing) => (
            <IngredientRow key={ing.name} ingredient={ing} profile={profile} />
          ))}
          {neutral.map((ing) => (
            <IngredientRow key={ing.name} ingredient={ing} profile={profile} />
          ))}
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={onClose}
        className="w-full py-3 rounded-pill border border-sand-200 text-sm font-semibold text-char-500 font-sans
          transition-all duration-fast ease-ds-out
          hover:bg-sand-100 active:bg-sand-200"
      >
        Dismiss
      </button>
    </BottomSheet>
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

  useEffect(() => {
    async function load() {
      let p = await api.getProfile();
      if (!p) p = DEMO_PROFILE;
      setProfile(p);
      const r = await api.getRecipes(p);
      setAllRecipes(r);
      setLoading(false);
    }
    load();
  }, []);

  // Ghost mode: render the real layout with placeholder data while loading.
  const ghost = loading;
  const profileData = ghost ? GHOST_PROFILE : profile;
  const recipes = ghost ? GHOST_RECIPES : allRecipes;

  const conditions = profileData?.conditions ?? [];
  const conditionOptions = ['All', ...conditions];

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
        <p className="text-[12px] text-char-500 font-bold uppercase tracking-eyebrow font-sans">Personal Remedies</p>
        <h1 className="font-display text-2xl font-semibold text-char-900 tracking-tightish">Recipes</h1>
        <p className="text-sm text-char-500 mt-0.5 font-sans">Condition-approved for your profile</p>
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
      <h2 className="font-display text-lg font-semibold text-char-900 tracking-tightish -mb-2">Discover your top recipes</h2>

      {/* Filters */}
      <div>
        {/* Meal type filter */}
        <div>
          <p className="text-[12px] font-bold tracking-eyebrow uppercase text-char-500 mb-2 font-sans">Meal type</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-hide">
            {MEAL_TYPES.map(({ label, icon }) => (
              <Pill
                key={label}
                selected={mealFilter === label}
                onClick={() => setMealFilter(label)}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 16 }}>{icon}</span>
                {label}
              </Pill>
            ))}
          </div>
        </div>

        {/* Condition emphasis filter */}
        {conditions.length > 1 && (
          <div className="mt-3">
            <p className="text-[12px] font-bold tracking-eyebrow uppercase text-char-500 mb-2 font-sans">Condition</p>
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

      {/* Recipe grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="menu_book"
          title="No recipes found"
          body="Try adjusting the filters above."
          action={
            <button
              onClick={() => { setMealFilter('All'); setConditionFilter('All'); setSearchQuery(''); }}
              className="px-5 py-2.5 rounded-pill bg-forest-700 text-white text-sm font-semibold font-sans
                transition-all duration-fast ease-ds-out
                hover:bg-forest-800 active:scale-[0.98]"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              layout="grid"
              onClick={() => setSelectedRecipe(recipe)}
            />
          ))}
        </div>
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
