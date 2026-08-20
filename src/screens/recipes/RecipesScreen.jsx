import { useState, useEffect, useCallback } from 'react';
import { getProfile, getRecipes, getConditionNames, buildRecipeDetail } from '../../api/api.js';
import FoodDetailCard from '../../components/FoodDetailCard.jsx';
import EmptyState from '../../components/shared/EmptyState.jsx';
import DataState from '../../components/shared/DataState.jsx';
import Pill from '../../components/shared/Pill.jsx';
import SearchInput from '../../components/shared/SearchInput.jsx';
import Icon from '../../components/shared/Icon.jsx';
import SaveButton from '../../components/shared/SaveButton.jsx';
import { recipeToSaveItem } from '../../utils/saveGate.js';
import { DEFAULT_DEV_CONDITIONS } from '../../api/config.js';
import { GHOST_PROFILE, GHOST_RECIPES } from '../../api/ghostData.js';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { useSnackbar } from '../../context/SnackbarContext.jsx';

// Demo key conditions (see api/config.js DEFAULT_DEV_CONDITIONS): 203 = Aging, 244 = Pneumonia.
const DEMO_PROFILE = {
  conditions: DEFAULT_DEV_CONDITIONS,
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

// ── Tier config (matches the shared tier pill pattern) ──────────────────────

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
  poor: {
    label: 'Use caution',
    bg: 'bg-caution-100',
    fg: 'text-caution-700',
    dot: 'bg-caution-600',
  },
};

// ── Recipe list row — thumbnail, title, tier pill, source; whole row taps ────

function RecipeRow({ recipe, onView, onSaveBlocked }) {
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

      {/* Save + chevron affordance */}
      <span className="flex-shrink-0 flex items-center gap-2">
        <SaveButton
          item={recipeToSaveItem(recipe)}
          onBlocked={onSaveBlocked}
        />
        <span className="text-char-400">
          <Icon name="chevron-right" size={16} aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}

export default function RecipesScreen() {
  const [mealFilter, setMealFilter] = useState('All');
  const [conditionFilter, setConditionFilter] = useState('All');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Display names for the real profile's conditions (healthConditionID[]).
  const [conditionNames, setConditionNames] = useState([]);
  const { show } = useSnackbar();

  // Primary data fetch (T5A): profile + condition-ranked recipes, via
  // useAsyncData so a real failure gets an honest error panel + working
  // Retry instead of silently collapsing to "no recipes" (the previous
  // `catch(...) { setAllRecipes([]) }`). Bundled into one object because
  // both are needed together and `getProfile()` itself never rejects (it
  // always resolves to a profile or null — see api.js) — only `getRecipes`
  // can genuinely fail (network/API), and that failure now propagates.
  const fetcher = useCallback(async () => {
    let p = await getProfile();
    if (!p) p = DEMO_PROFILE;
    const { recipes } = await getRecipes(p);
    return { profile: p, recipes: recipes ?? [] };
  }, []);

  const { status, data, retry } = useAsyncData(fetcher, [], {
    isEmpty: (d) => !d?.recipes?.length,
  });

  const profile = data?.profile ?? null;
  const fetchedRecipes = data?.recipes ?? [];

  useEffect(() => {
    let alive = true;
    getConditionNames(profile?.conditions ?? [])
      .then((names) => { if (alive) setConditionNames(names); })
      .catch(() => { if (alive) setConditionNames([]); });
    return () => { alive = false; };
  }, [profile]);

  // Ghost mode: render the real layout with placeholder data while loading.
  // Kept as its own bespoke treatment (not DataState's generic skeleton) —
  // every OTHER status (success/empty/error-network/error-api/
  // offline-cached/offline-no-cache) routes through DataState below instead.
  const ghost = status === 'loading';
  // GHOST_PROFILE already carries display-name strings; the real profile's
  // conditions are healthConditionIDs, so use the resolved names instead.
  const conditions = ghost ? (GHOST_PROFILE.conditions ?? []) : conditionNames;
  const conditionOptions = ['All', ...conditions];

  const recipes = ghost ? GHOST_RECIPES : fetchedRecipes;

  // Real recipes (from adapter getRecipes) use title/photo instead of
  // FoodDetailCard's item shape's name/image, and don't carry a per-ingredient
  // breakdown yet — seed the card immediately with the mapped shape, then
  // enrich via recipeDetail.js's buildRecipeDetail (same seed-then-enrich
  // idiom as MealprepCarousel/SuggestionsScreen). Ghost recipes already carry
  // `ingredients`, so they're passed through as-is.
  function handleViewRecipe(recipe) {
    if (recipe.ingredients) {
      setSelectedRecipe({
        foodId: recipe.foodId ?? recipe.id ?? null,
        name: recipe.title,
        image: recipe.photo,
        sourceName: recipe.sourceName ?? null,
        conditions: recipe.matchedConditions ?? [],
        ingredients: recipe.ingredients,
        isRecipe: true,
      });
      return;
    }
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
      isRecipe: true,
    });
    buildRecipeDetail(card, profile)
      .then((detail) => setSelectedRecipe({ ...detail, isRecipe: true }))
      .catch(() => {});
  }

  const filtered = recipes.filter((r) => {
    const mealOk = mealFilter === 'All' || r.mealType === mealFilter || r.mealType?.toLowerCase() === mealFilter.toLowerCase();
    const condOk = conditionFilter === 'All' || r.matchedConditions.includes(conditionFilter);
    const searchOk = !searchQuery.trim() || r.title.toLowerCase().includes(searchQuery.toLowerCase());
    return mealOk && condOk && searchOk;
  });

  const clearFilters = () => { setMealFilter('All'); setConditionFilter('All'); setSearchQuery(''); };

  return (
    // Green page + white paper shell — the same two-layer background every
    // other screen uses (see HomeScreen/SuggestionsScreen). `-mb-28` cancels
    // the AppShell main's pb-28 navbar reserve so the shell's own pb-28
    // becomes the navbar clearance and paints paper behind the floating
    // TabBar (appshell-cream-fix pattern).
    <div
      className={`bg-forest-300 flex flex-col min-h-screen -mb-28${ghost ? ' rm-ghost' : ''}`}
      aria-busy={ghost}
    >
      {/* Header zone — on the green page background, above the shell */}
      <div className="px-5 pt-6 pb-6">
        <p className="text-[12px] text-blue-950/60 font-label tracking-[0.14em] uppercase">Personal Remedies</p>
        <h1 className="font-display text-2xl font-semibold text-blue-950 tracking-tightish">Recipes</h1>
        <p className="text-sm text-blue-950/60 mt-0.5 font-sans">Condition-approved for your profile</p>
      </div>

      {/* Content shell — full-bleed white container with rounded top corners */}
      <div className="flex-1 bg-paper-100 rounded-t-2xl px-5 pt-5 pb-28 shadow-[0_-2px_16px_rgba(45,36,24,0.05)] flex flex-col gap-5">

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
            {MEAL_TYPES.map(({ label }) => (
              <Pill
                key={label}
                selected={mealFilter === label}
                onClick={() => setMealFilter(label)}
              >
                <Icon name="utensils" size={16} aria-hidden="true" />
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

      {/* Recipe list — ghost keeps its own placeholder-data treatment (see
          `ghost` above); every other status goes through DataState, whose
          'empty' branch covers a genuinely empty FETCH (no recipes at all —
          e.g. no profile conditions) and whose error/offline-no-cache
          branches cover a real failure with a working Retry. A successful
          fetch that the user's own meal-type/condition/search filters have
          narrowed to zero matches is a separate, purely local case (NOT part
          of the state matrix) — handled inside DataState's children, same
          "Clear filters" action as before. */}
      {ghost ? (
        filtered.length === 0 ? (
          <EmptyState
            icon="menu_book"
            title="No recipes found"
            body="Try adjusting the filters above."
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((recipe) => (
              <RecipeRow key={recipe.id} recipe={recipe} onView={handleViewRecipe} onSaveBlocked={show} />
            ))}
          </div>
        )
      ) : (
        <DataState
          status={status}
          onRetry={retry}
          emptyTitle="No recipes yet"
          emptyBody="Set up your health profile to get condition-matched recipes."
          screenName="recipes"
        >
          {filtered.length === 0 ? (
            <EmptyState
              icon="menu_book"
              title="No recipes found"
              body="Try adjusting the filters above."
              action={
                <button
                  onClick={clearFilters}
                  className="px-5 py-2.5 rounded-xs bg-forest-700 text-white text-sm font-semibold font-sans
                    transition-all duration-fast ease-ds-out
                    hover:bg-forest-800 active:scale-[0.98]"
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {filtered.map((recipe) => (
                <RecipeRow key={recipe.id} recipe={recipe} onView={handleViewRecipe} onSaveBlocked={show} />
              ))}
            </div>
          )}
        </DataState>
      )}

      </div>

      {/* Recipe detail card */}
      <FoodDetailCard
        item={selectedRecipe}
        open={!!selectedRecipe}
        onClose={() => setSelectedRecipe(null)}
      />
    </div>
  );
}
