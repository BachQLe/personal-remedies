import { useState, useCallback } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getMealPlanSuggestions, buildRecipeDetail } from '../../api/api.js';
import { PLAN_SLOT_KEYS } from '../../api/config.js';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { useSnackbar } from '../../context/SnackbarContext.jsx';
import FoodDetailCard from '../../components/FoodDetailCard.jsx';
import PageHeader from '../../components/shared/PageHeader.jsx';
import GlassPanel from '../../components/shared/GlassPanel.jsx';
import PillSwitcher from '../../components/shared/PillSwitcher.jsx';
import BestRecipesRails from '../../components/shared/BestRecipesRails.jsx';
import DataState from '../../components/shared/DataState.jsx';
import CoverageNotice from './CoverageNotice.jsx';
import ProfileSetupAction from './ProfileSetupAction.jsx';
import { resolveProfileWithConditions } from './profileFallback.js';
import TopDosTab from './TopDosTab.jsx';
import GroupsTab from './GroupsTab.jsx';

// ── Constants ────────────────────────────────────────────────────────────────

// All three tabs (Top Dos & Don'ts, Food Groups, Best Recipes) share this
// lavender-200 page background — one shade more saturated than the
// lavender-100 tone used on the Home screen's Dietary Guidance tile.
const LAVENDER_BG_COLOR = '#DCC8F0';

// Screen-level title + description per tab, crossfaded in the shared
// PageHeader (replaces the per-tab <h1> each tab used to render itself).
const TAB_META = {
  top: {
    title: "Top Dos & Don'ts",
  },
  groups: {
    title: 'Food Groups',
  },
  recipes: {
    title: 'Best Recipes',
  },
};

// Resolves the active tab from the URL: ?tab=recipes / ?tab=groups win
// outright; anything else (including the legacy ?tab=bestworst) lands on
// Top Dos & Don'ts, the new default.
function resolveTab(searchParams) {
  const tab = searchParams.get('tab');
  if (tab === 'recipes') return 'recipes';
  if (tab === 'groups') return 'groups';
  return 'top';
}

// ── Skeletons ────────────────────────────────────────────────────────────────

// One skeleton "rail" per meal-type slot, mirroring BestRecipesRails' own
// section layout (header line + a row of card placeholders) so the loading
// state doesn't jump when the real rails mount.
function SkeletonRails() {
  return (
    <div className="flex flex-col gap-6">
      {PLAN_SLOT_KEYS.map((key) => (
        <div key={key} className="flex flex-col gap-3">
          <div className="h-4 w-24 rounded bg-sand-200 animate-pulse" />
          <div className="flex gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-[150px] shrink-0 rounded-xl bg-sand-200 animate-pulse"
                style={{ aspectRatio: '4/5' }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── BestRecipesTab ────────────────────────────────────────────────────────────
// "Best Recipes" — always shows top, condition-ranked options for all five
// meal types (breakfast/lunch/dinner/snacks/beverages) via the same
// getMealPlanSuggestions pool the Plan screen's picker uses, rendered
// through the shared BestRecipesRails (read-only here — no "+" picker).
// Tapping a card opens FoodDetailCard seeded via the same buildRecipeDetail
// enrichment flow the old picker used.

function emptySlotMap() {
  return Object.fromEntries(PLAN_SLOT_KEYS.map((key) => [key, []]));
}

async function fetchBestRecipes() {
  const profile = await resolveProfileWithConditions();
  const res = await getMealPlanSuggestions(profile);
  return {
    candidates: res?.candidates ?? emptySlotMap(),
    usedFallback: !!res?.usedFallback,
    requestedConditionIds: profile.conditions,
  };
}

function isCandidatesEmpty(data) {
  const candidates = data?.candidates ?? emptySlotMap();
  return PLAN_SLOT_KEYS.every((key) => (candidates[key]?.length ?? 0) === 0);
}

function BestRecipesTab() {
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const { show } = useSnackbar();

  const { status, data, retry } = useAsyncData(fetchBestRecipes, [], {
    isEmpty: isCandidatesEmpty,
    requiresProfile: true,
  });

  const candidates = data?.candidates ?? emptySlotMap();

  // PlanCandidates use name/image/sourceName/id instead of the FoodDetailCard
  // item shape's name/image — seed the card immediately with the mapped
  // shape, then enrich in place via the same buildRecipeDetail flow the old
  // picker used (real per-condition tiers + complementary ingredients;
  // assessFood keys on foodId).
  const openRecipe = useCallback((item) => {
    const card = {
      foodId: item.foodId ?? item.id ?? null,
      name: item.name,
      image: item.image,
      sourceName: item.sourceName ?? null,
      matchedConditions: item.matchedConditions ?? [],
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
    buildRecipeDetail(card)
      .then((detail) => setSelectedRecipe({ ...detail, isRecipe: true }))
      .catch(() => { });
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {status === 'loading' ? (
        <SkeletonRails />
      ) : (
        <DataState
          status={status}
          onRetry={retry}
          screenName="Best Recipes"
          emptyTitle="No recipes yet"
          emptyBody="We don't have recipes ranked for your conditions right now."
          emptyAction={status === 'empty-no-profile' ? <ProfileSetupAction /> : undefined}
        >
          <div className="flex flex-col gap-3">
            <CoverageNotice usedFallback={!!data?.usedFallback} requestedConditionIds={data?.requestedConditionIds} />
            <BestRecipesRails
              candidatesBySlot={candidates}
              onSelectCard={openRecipe}
              edgeFadeClass="bg-lavender-200"
              onSaveBlocked={show}
            />
          </div>
        </DataState>
      )}

      <FoodDetailCard
        item={selectedRecipe}
        open={!!selectedRecipe}
        onClose={() => setSelectedRecipe(null)}
      />
    </div>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SuggestionsScreen() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => resolveTab(searchParams));
  const [selectedFood, setSelectedFood] = useState(null);

  // Re-resolve the active tab whenever the URL's search params change (e.g.
  // another route linking in with a new ?tab=), so an in-page navigation
  // switches tabs without requiring a full remount. Adjusted
  // during render (React's documented escape hatch — see CategoryDetailPanel's
  // resetFor) rather than in an effect, so a manual tab click (which never
  // touches the URL) isn't clobbered by a redundant re-derivation.
  const paramsKey = searchParams.toString();
  const [resolvedFor, setResolvedFor] = useState(paramsKey);
  if (paramsKey !== resolvedFor) {
    setResolvedFor(paramsKey);
    setActiveTab(resolveTab(searchParams));
  }

  const TAB_OPTIONS = [
    { key: 'top', label: "Dos & Don'ts" },
    { key: 'groups', label: 'Food Groups' },
    { key: 'recipes', label: 'Recipes' },
  ];

  // Legacy deep link: ?category=<coarseGroupId> used to open the Food Groups
  // tab with that group's detail panel expanded inline. Food group detail
  // now lives at its own route, so redirect there instead. Checked after all
  // hooks above so the hook call order never changes across renders.
  const category = searchParams.get('category');
  if (category) {
    return <Navigate to={'/app/suggestions/group/' + category} replace />;
  }

  return (
    // -mb-28 cancels the AppShell main's pb-28 navbar reserve so the
    // background reaches behind the floating TabBar (appshell-cream-fix
    // pattern); GlassPanel's own pb-28 keeps the last row clear of the bar.
    <div className="flex flex-col -mb-28" style={{ backgroundColor: LAVENDER_BG_COLOR, minHeight: '100dvh' }}>

      <PageHeader label="Guidance" className="pb-3">
        {/* Title crossfade between tabs — min-height keeps the slider from
            jumping while the title swaps. */}
        <div className="min-h-[44px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } }}
              exit={{ opacity: 0, transition: { duration: 0.15, ease: 'easeOut' } }}
            >
              <h1 className="font-display text-[32px] font-semibold text-blue-950 leading-tight mt-2">
                {TAB_META[activeTab].title}
              </h1>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Tab switcher — shared PillSwitcher slider (same as Search). */}
        <div className="mt-3">
          <PillSwitcher options={TAB_OPTIONS} value={activeTab} onChange={setActiveTab} />
        </div>
      </PageHeader>

      {/* Tab content — glass panel bleeds behind the navbar (appshell-cream-fix) */}
      <GlassPanel>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } }}
            exit={{ opacity: 0, transition: { duration: 0.15, ease: 'easeOut' } }}
          >
            {activeTab === 'top' ? (
              <TopDosTab onSelectFood={setSelectedFood} />
            ) : activeTab === 'groups' ? (
              <GroupsTab />
            ) : (
              <BestRecipesTab />
            )}
          </motion.div>
        </AnimatePresence>
      </GlassPanel>

      {/* Food detail card (self-loads facts + assessment from the id/name) */}
      {selectedFood && (
        <FoodDetailCard
          item={{ foodId: selectedFood.id, name: selectedFood.name }}
          open={!!selectedFood}
          onClose={() => setSelectedFood(null)}
        />
      )}
    </div>
  );
}
