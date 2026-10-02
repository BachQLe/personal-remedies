import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getProfile, getRecipes, buildRecipeDetail } from '../../api/api.js';
import FoodDetailCard from '../../components/FoodDetailCard.jsx';
import DataState from '../../components/shared/DataState.jsx';
import BottomSheet from '../../components/shared/BottomSheet.jsx';
import BestRecipesRails from '../../components/shared/BestRecipesRails.jsx';
import FoodImageCard from '../../components/shared/FoodImageCard.jsx';
import SaveButton from '../../components/shared/SaveButton.jsx';
import { MEAL_TYPE_META, displayTagForItem } from '../../components/shared/mealTypeMeta.jsx';
import { PLAN_SLOT_KEYS } from '../../api/config.js';
import { DEFAULT_DEV_CONDITIONS } from '../../api/config.js';
import { GHOST_RECIPES } from '../../api/ghostData.js';
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

// Meal-type labels this screen understands — used only by
// `mealFilterFromSearchParams` (the `?meal=` deep-link below) and
// `matchesMealFilter`'s bucketing. 'All' is not a bucket; it just means "no
// deep link requested".
const MEAL_TYPES = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snack'];

// Maps a deep-link/bucket label onto the PLAN_SLOT_KEYS value its recipes are
// grouped under (the Plan screen's own slot vocabulary — see
// api/config.js's PLAN_SLOTS). There's no label for 'beverages': recipes are
// never tagged as beverages (see adapter.js's getRecipesRaw doc), so that
// rail always renders BestRecipesRails' own "No options yet" line — same as
// the Meal Planner picker's "Best recipes" tab, which this screen otherwise
// mirrors exactly.
const LABEL_TO_SLOT_KEY = {
  Breakfast: 'breakfast',
  Lunch: 'lunch',
  Dinner: 'dinner',
  Snack: 'snacks',
};

/**
 * Resolve the initial "See more" sheet to auto-open from a `?meal=` URL
 * query param — the deep-link target FoodDetailCard's recipe "other options"
 * link lands on (see FoodDetailCard.jsx's `mealTypeToRecipesHref`: it always
 * emits one of this file's own MEAL_TYPES labels, or no param at all).
 * Validated case-insensitively against MEAL_TYPES' real labels; anything
 * absent, unrecognized, or from some other/future caller that didn't go
 * through `mealTypeToRecipesHref` falls back to 'All' rather than silently
 * opening a sheet the user never asked for.
 *
 * Seeds ONLY the initial `browseSlot` state (call site below uses this as a
 * lazy useState initializer, not an effect) — once the screen is open, the
 * user's own taps are the only thing driving `browseSlot`; the URL is never
 * re-read afterward.
 * @param {URLSearchParams} searchParams
 * @returns {string} a MEAL_TYPES label
 */
// eslint-disable-next-line react-refresh/only-export-components
export function mealFilterFromSearchParams(searchParams) {
  const raw = searchParams.get('meal');
  if (!raw) return 'All';
  const match = MEAL_TYPES.find((m) => m.toLowerCase() === raw.toLowerCase());
  return match ? match : 'All';
}

/**
 * Whether a recipe's `mealType` (or secondary `alsoFits`) satisfies a given
 * meal-type label. Used to bucket recipes into the four meal-type rails
 * below (see `bucketRecipesBySlot`) and to resolve the `?meal=` deep link.
 *
 * Product decision (Task C1, Sept 2026 — verbatim: "Snacks and deserts are
 * going to be shown at once. But theyre going to have different tags. So
 * yeah add as another meal type."): `dessert` is a real, distinct `mealType`
 * value in the data (see recipeIngestion.js's `MEAL_TYPES`), but there is no
 * separate "Dessert" rail here — the `Snack` label matches BOTH `'snack'`
 * and `'dessert'` recipes, shown together in one rail. Every other label
 * matches only its own mealType. `recipe.mealType` is lowercase
 * (adapter.js); labels are capitalized, so the comparison is
 * case-insensitive.
 *
 * `alsoFits` (Task D, Sept 2026): Mory's real overlay data slash-codes a
 * recipe's meal suitability (`L/D`, `B/Bv`, ...) — the import maps the
 * FIRST code to `mealType` and the rest to `alsoFits` (see
 * recipeIngestion.js's `joinRecipeOverlay`). A recipe coded `L/D` is
 * `mealType: 'lunch'`, `alsoFits: ['dinner']` and must show up under BOTH
 * the Lunch and the Dinner rail, not just the one holding its primary
 * category — the same either-`mealType`-or-`alsoFits` rule the Plan
 * screen's slot bucketing uses (see adapter.js's `recipesEligibleForSlot`).
 * The Snack label's snack/dessert union applies to `alsoFits` too (a recipe
 * coded, say, `L/Ds` should surface under Snack via its `alsoFits` exactly
 * like a `Ds`-primary recipe does) — same OR, just widened to two accepted
 * values. `alsoFits` is optional (absent entirely on a recipe with no
 * overlay match), so this defaults it to `[]` rather than assuming an array.
 * @param {string|undefined} recipeMealType
 * @param {string} filterLabel - a MEAL_TYPES label ('All'/'Breakfast'/...)
 * @param {string[]} [alsoFits] - the recipe's secondary meal types, if any.
 * @returns {boolean}
 */
// eslint-disable-next-line react-refresh/only-export-components
export function matchesMealFilter(recipeMealType, filterLabel, alsoFits) {
  if (filterLabel === 'All') return true;
  const lower = recipeMealType?.toLowerCase();
  const alsoLower = (alsoFits ?? []).map((mt) => mt?.toLowerCase());
  if (filterLabel === 'Snack') {
    return (
      lower === 'snack' ||
      lower === 'dessert' ||
      alsoLower.includes('snack') ||
      alsoLower.includes('dessert')
    );
  }
  const target = filterLabel.toLowerCase();
  return lower === target || alsoLower.includes(target);
}

/**
 * Map a Recipe (adapter.js shape: `title`/`photo`) onto the shape
 * `BestRecipesRails`/`FoodImageCard`/`SaveButton` expect (`name`/`image`/
 * `kind: 'recipe'`) — the same rename `recipeToSaveItem` (saveGate.js) does,
 * but keeping every other Recipe field (title/photo included) so
 * `handleViewRecipe` below can still read them. `fromSlot` records which
 * rail the card is rendered under, for its corner meal-type tag
 * (`displayTagForItem`) — same convention the Plan screen's own cards use.
 * @param {import('../../api/types.js').Recipe} recipe
 * @param {string} slotKey
 */
function toCardItem(recipe, slotKey) {
  return {
    ...recipe,
    name: recipe.title,
    image: recipe.photo,
    kind: 'recipe',
    fromSlot: slotKey,
  };
}

/**
 * Group recipes into the Plan screen's own meal-type slots (`PLAN_SLOT_KEYS`)
 * — breakfast/lunch/dinner/snacks/beverages — by reusing `matchesMealFilter`
 * against each real label. A recipe with both a primary `mealType` and an
 * `alsoFits` match (see that function's doc) lands in every slot it
 * qualifies for, not just one. `beverages` never gets a label here (recipes
 * are structurally never tagged as beverages), so it always renders empty —
 * same as the Meal Planner picker's "Best recipes" tab.
 * @param {import('../../api/types.js').Recipe[]} recipes
 * @returns {Record<string, Object[]>}
 */
function bucketRecipesBySlot(recipes) {
  const out = Object.fromEntries(PLAN_SLOT_KEYS.map((key) => [key, []]));
  for (const recipe of recipes) {
    for (const [label, slotKey] of Object.entries(LABEL_TO_SLOT_KEY)) {
      if (matchesMealFilter(recipe.mealType, label, recipe.alsoFits)) {
        out[slotKey].push(toCardItem(recipe, slotKey));
      }
    }
  }
  return out;
}

export default function RecipesScreen() {
  const [searchParams] = useSearchParams();
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  // Lazy initializer — read the `?meal=` deep link once on mount only (see
  // mealFilterFromSearchParams's doc for why this never re-syncs from the
  // URL afterward): opens straight into that meal type's "See more" sheet
  // instead of an unfiltered page.
  const [browseSlot, setBrowseSlot] = useState(() => {
    const label = mealFilterFromSearchParams(searchParams);
    return LABEL_TO_SLOT_KEY[label] ?? null;
  });
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

  // Ghost mode: render the real layout with placeholder data while loading.
  // Kept as its own bespoke treatment (not DataState's generic skeleton) —
  // every OTHER status (success/empty/error-network/error-api/
  // offline-cached/offline-no-cache) routes through DataState below instead.
  const ghost = status === 'loading';
  const recipes = ghost ? GHOST_RECIPES : fetchedRecipes;
  const candidatesBySlot = bucketRecipesBySlot(recipes);
  const browsePool = browseSlot ? candidatesBySlot[browseSlot] ?? [] : [];

  // Real recipes (from adapter getRecipes) use title/photo instead of
  // FoodDetailCard's item shape's name/image, and don't carry a per-ingredient
  // breakdown yet — seed the card immediately with the mapped shape, then
  // enrich via recipeDetail.js's buildRecipeDetail (same seed-then-enrich
  // idiom as MealprepCarousel/SuggestionsScreen). Ghost recipes already carry
  // `ingredients`, so they're passed through as-is. Receives a rail card
  // (see `toCardItem`), which still carries every original Recipe field.
  function handleViewRecipe(recipe) {
    if (recipe.ingredients) {
      const seeded = {
        foodId: recipe.foodId ?? recipe.id ?? null,
        name: recipe.title,
        image: recipe.photo,
        sourceName: recipe.sourceName ?? null,
        conditions: recipe.matchedConditions ?? [],
        ingredients: recipe.ingredients,
        isRecipe: true,
        // Forwarded so FoodDetailCard's "see other good recipes" link
        // (mealTypeToRecipesHref) can deep-link back to this recipe's own
        // meal type instead of an unfiltered list.
        mealType: recipe.mealType ?? null,
      };
      // This branch never calls buildRecipeDetail, so the C1 overlay fields
      // (when present) must be forwarded here directly too — otherwise a
      // real recipe with an overlay ingredient list would still show no
      // calorie number or source link.
      if (recipe.sourceUrl) seeded.sourceUrl = recipe.sourceUrl;
      if (recipe.attribution) seeded.attribution = recipe.attribution;
      if (recipe.nutritionPerServing) seeded.nutritionPerServing = recipe.nutritionPerServing;
      setSelectedRecipe(seeded);
      return;
    }
    const card = {
      foodId: recipe.foodId ?? null,
      name: recipe.title,
      image: recipe.photo,
      sourceName: recipe.sourceName ?? null,
      matchedConditions: recipe.matchedConditions ?? [],
    };
    // Forward the real C1 overlay fields (when present upstream on the
    // Recipe — see adapter.js's getRecipesRaw) so buildRecipeDetail can
    // read them through onto the FoodDetailCard payload; the Cookbook is
    // the primary recipe surface, so without this the calorie/source-link
    // gap is most visible here.
    if (recipe.sourceUrl) card.sourceUrl = recipe.sourceUrl;
    if (recipe.attribution) card.attribution = recipe.attribution;
    if (recipe.nutritionPerServing) card.nutritionPerServing = recipe.nutritionPerServing;
    setSelectedRecipe({
      foodId: card.foodId,
      name: card.name,
      image: card.image,
      sourceName: card.sourceName,
      conditions: card.matchedConditions,
      ingredients: [],
      isRecipe: true,
      // See the `seeded` branch above — same forwarding, for the same
      // reason. `buildRecipeDetail` doesn't read/copy `mealType` through
      // (it's not part of its documented output shape), so it's merged
      // back in below after that promise resolves too.
      mealType: recipe.mealType ?? null,
    });
    buildRecipeDetail(card, profile)
      .then((detail) => setSelectedRecipe({ ...detail, isRecipe: true, mealType: recipe.mealType ?? null }))
      .catch(() => {});
  }

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
      {/* Header zone — on the green page background, above the shell. No
          search box, filter pills, or recipe count here (2026-10 redesign) —
          this screen is now the Meal Planner's own "Best recipes" rails,
          minus the planner-only controls (Week starts / tabs / Refresh), so
          there's nothing to filter against: each rail IS its own meal-type
          filter. */}
      <div className="px-5 pt-6 pb-6">
        <p className="text-[12px] text-blue-950/60 font-label tracking-[0.14em] uppercase">Personal Remedies</p>
        <h1 className="font-display text-2xl font-semibold text-blue-950 tracking-tightish">Recipes</h1>
        <p className="text-sm text-blue-950/60 mt-0.5 font-sans">Condition-approved for your profile</p>
      </div>

      {/* Content shell — full-bleed white container with rounded top corners */}
      <div className="flex-1 bg-paper-100 rounded-t-2xl px-5 pt-5 pb-28 shadow-[0_-2px_16px_rgba(45,36,24,0.05)] flex flex-col gap-5">
        {ghost ? (
          <BestRecipesRails
            candidatesBySlot={candidatesBySlot}
            onSelectCard={handleViewRecipe}
            onSeeMore={setBrowseSlot}
            onSaveBlocked={show}
            showScrollbar
          />
        ) : (
          <DataState
            status={status}
            onRetry={retry}
            emptyTitle="No recipes yet"
            emptyBody="Set up your health profile to get condition-matched recipes."
            screenName="recipes"
          >
            <BestRecipesRails
              candidatesBySlot={candidatesBySlot}
              onSelectCard={handleViewRecipe}
              onSeeMore={setBrowseSlot}
              onSaveBlocked={show}
              showScrollbar
            />
          </DataState>
        )}
      </div>

      {/* "See more" — full pool for whichever rail's link was tapped (or the
          `?meal=` deep link opened straight into). Mirrors
          MealPlannerPicker's SlotBrowseSheet, minus the +/check pick toggle
          (this screen is browse-only, nothing to add to a plan) — just the
          2-col card grid with each card's save bookmark. */}
      <BottomSheet
        open={!!browseSlot}
        onClose={() => setBrowseSlot(null)}
        title={browseSlot ? `${MEAL_TYPE_META[browseSlot]?.label} recipes` : undefined}
      >
        {browsePool.length === 0 ? (
          <p className="font-sans text-sm text-char-500 py-4">No options yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {browsePool.map((item) => (
              <div key={item.id} style={{ aspectRatio: '4/5' }}>
                <FoodImageCard
                  id={item.id}
                  mealTag={displayTagForItem(item, item.fromSlot ?? browseSlot)}
                  image={item.image}
                  title={item.name}
                  subtitle={item.sourceName || item.tier || undefined}
                  numericId={item.numericId}
                  onClick={() => handleViewRecipe(item)}
                  className="w-full h-full"
                  saveAction={() => <SaveButton item={item} onBlocked={show} />}
                />
              </div>
            ))}
          </div>
        )}
      </BottomSheet>

      {/* Recipe detail card */}
      <FoodDetailCard
        item={selectedRecipe}
        open={!!selectedRecipe}
        onClose={() => setSelectedRecipe(null)}
      />
    </div>
  );
}
