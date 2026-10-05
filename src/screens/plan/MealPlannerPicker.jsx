/**
 * MealPlannerPicker.jsx — full-screen "New meal plan" recipe-picker overlay.
 *
 * Opened by the Plan screen's "New meal plan" FAB (hidden during the
 * first-run empty state, where the empty-state's own "Build my meal plan"
 * button is the only CTA — see MealQueueScreen.jsx's `firstRunEmpty`). Two
 * tabs (`PillSwitcher`):
 * "Best recipes" (ranked candidate pools from `getMealPlanSuggestions`,
 * refreshable via a windowed re-slice — zero extra network) and "Saved
 * recipes" (the user's library, grouped by meal type). Both render through
 * the shared `BestRecipesRails` with `showAdd` so cards carry a selectable
 * "+"/check toggle. Picks are handed to `generatePlanFromPicks`, which builds
 * a fresh 7-day plan seeded from them alone (picks-only default, Aug 2026,
 * decision b — an empty pick list now yields an honestly empty week rather
 * than pool-filling), so the confirm CTA below is disabled at zero picks —
 * see planBuilder.js.
 *
 * The "Week starts" row above the tabs is the ONLY place that choice is made
 * (2026-09): it has to be settled before the plan exists, since
 * `generatePlanFromPicks` reads `nextSevenDays()` to lay out its 7 days. The
 * Plan screen now only displays the resulting window as a read-only chip.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, RefreshCw, CalendarRange } from 'lucide-react';
import PillSwitcher from '../../components/shared/PillSwitcher.jsx';
import BestRecipesRails from '../../components/shared/BestRecipesRails.jsx';
import Snackbar from '../../components/shared/Snackbar.jsx';
import FoodDetailCard from '../../components/FoodDetailCard.jsx';
import { getMealPlanSuggestions, generatePlanFromPicks, buildRecipeDetail } from '../../api/api.js';
import { getIngredientImage } from '../../api/ingredientImages.js';
import { getOverlayImageFile } from '../../api/localTables.js';
import { getLibrary, subscribeLibrary } from '../../state/library.js';
import { mealTypeForItem } from '../../components/shared/mealTypeMeta.jsx';
import { PLAN_SLOT_KEYS } from '../../api/config.js';
import { estimatePlanDayCalories } from '../../api/calorieNeeds.js';
import { todayKey, getWeekStartDay, setWeekStartDay } from './planDates.js';
import CalorieGapSheet from './CalorieGapSheet.jsx';
import SlotBrowseSheet from './SlotBrowseSheet.jsx';
import DataState from '../../components/shared/DataState.jsx';
import { useOnline, planLoadState } from './usePlanLoadState.js';

const calmSpring = { type: 'spring', stiffness: 120, damping: 22, mass: 1 };

// How many cards are shown per rail at once — Refresh bumps the window
// forward by this much (wrapping around each slot's own pool length), so
// "refresh" re-slices the already-cached pools instead of re-fetching.
const WINDOW_SIZE = 12;

const TAB_OPTIONS = [
  { key: 'best', label: 'Best recipes' },
  { key: 'saved', label: 'Saved recipes' },
];

// Fraction of the user's estimated daily need below which the plan is treated
// as too thin to hand over without comment. Deliberately not 100% — these are
// coarse estimates on both sides, so only a clear shortfall is worth a prompt.
const CALORIE_GAP_RATIO = 0.8;

// The week-start choice lives HERE, before the plan is built, rather than on
// the Plan screen after the fact (where it was a 7-pill row that crowded the
// day strip). `null` = "Today" — planDates.js's default rolling window. The
// value is only persisted (`setWeekStartDay`) in `handleCreatePlan`, right
// before `generatePlanFromPicks` reads `nextSevenDays()`, so closing the
// picker without creating anything leaves the live plan's window untouched.
const WEEK_START_OPTIONS = [
  { value: null, label: 'Today' },
  { value: 0, label: 'Su' },
  { value: 1, label: 'Mo' },
  { value: 2, label: 'Tu' },
  { value: 3, label: 'We' },
  { value: 4, label: 'Th' },
  { value: 5, label: 'Fr' },
  { value: 6, label: 'Sa' },
];

function emptySlotMap() {
  return Object.fromEntries(PLAN_SLOT_KEYS.map((key) => [key, []]));
}

/** A `window`-sized, wraparound slice of `pool` starting at `offset`. */
function rotate(pool, offset, window = WINDOW_SIZE) {
  const len = pool.length;
  if (len === 0) return [];
  const size = Math.min(window, len);
  return Array.from({ length: size }, (_, i) => pool[(offset + i) % len]);
}

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

/**
 * @param {Object} props
 * @param {boolean} props.open
 * @param {import('../../api/types.js').Profile} props.profile
 * @param {() => void} props.onClose
 * @param {() => void} [props.onGenerated] - called right after a plan is
 *   successfully generated, before `onClose`.
 */
export default function MealPlannerPicker({ open, profile, onClose, onGenerated }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('best');
  const [pools, setPools] = useState(emptySlotMap);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [unscorableReason, setUnscorableReason] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const online = useOnline();
  const [offset, setOffset] = useState(0);
  const [library, setLibrary] = useState(getLibrary);
  const [selected, setSelected] = useState(() => new Map());
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [generating, setGenerating] = useState(false);
  /** @type {[{need: number, total: number}|null, Function]} */
  const [gap, setGap] = useState(null);
  const [browseSlot, setBrowseSlot] = useState(null);
  /** Pending week-start weekday (0=Su..6=Sa) or `null` for "Today". */
  const [weekStartDay, setWeekStartDayState] = useState(getWeekStartDay);
  const [snackbar, setSnackbar] = useState(null);
  const snackbarRef = useRef(null);
  const snackbarIdRef = useRef(0);

  useEffect(() => subscribeLibrary(setLibrary), []);

  const showSnackbar = useCallback((message, canUndo = false, undoFn = null) => {
    snackbarIdRef.current += 1;
    const id = snackbarIdRef.current;
    snackbarRef.current = undoFn;
    setSnackbar({ id, message, canUndo });
  }, []);

  const handleSnackbarUndo = useCallback(() => {
    if (snackbarRef.current) snackbarRef.current();
    snackbarRef.current = null;
    setSnackbar(null);
  }, []);

  // Reset transient session state each time the overlay OPENS (guarded
  // render-time state adjustment — same escape hatch SuggestionsScreen uses
  // for its paramsKey/resolvedFor tab resync — rather than an effect, since
  // synchronous setState in an effect body trips react-hooks/set-state-in-effect).
  const [sessionOpen, setSessionOpen] = useState(false);
  if (open && !sessionOpen) {
    setSessionOpen(true);
    setOffset(0);
    setSelected(new Map());
    setActiveTab('best');
    setSelectedRecipe(null);
    setLoading(true);
    setLoadError(null);
    setGap(null);
    setBrowseSlot(null);
    // Re-read the stored week start each open so the row reflects whatever
    // the last created plan used (it's only written on create, below).
    setWeekStartDayState(getWeekStartDay());
  } else if (!open && sessionOpen) {
    setSessionOpen(false);
  }

  // Fetch the ranked candidate pools whenever the picker opens with a
  // resolved profile (getMealPlanSuggestions is cached 8h — cheap to call).
  // `loading` is flipped true by the render-time reset above on open; this
  // effect only ever turns it off / fills pools, so it never sets state
  // synchronously in the effect body itself (matches SuggestionsScreen's
  // BestRecipesTab fetch effect).
  useEffect(() => {
    if (!open || !profile) return;
    let cancelled = false;
    getMealPlanSuggestions(profile)
      .then((res) => {
        if (cancelled) return;
        setPools(res?.candidates || emptySlotMap());
        setUnscorableReason(res?.unscorableReason ?? null);
        setLoadError(null);
      })
      .catch((err) => {
        console.error('MealPlannerPicker: getMealPlanSuggestions failed', err);
        if (cancelled) return;
        setPools(emptySlotMap());
        setLoadError(err || new Error('getMealPlanSuggestions failed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, profile, retryKey]);

  const handleRetryLoad = useCallback(() => {
    setLoadError(null);
    setLoading(true);
    setRetryKey((k) => k + 1);
  }, []);

  // Each item is tagged with the rail (`fromSlot`) it's shown under, so a
  // pick round-trips back to the exact slot it was picked from in
  // `generatePlanFromPicks` (`mealTypeForItem` prefers `fromSlot` over
  // re-inferring from food group, which can be ambiguous across slots).
  const visibleCandidates = useMemo(() => {
    const out = emptySlotMap();
    for (const key of PLAN_SLOT_KEYS) {
      out[key] = rotate(pools[key] || [], offset).map((item) => ({ ...item, fromSlot: key }));
    }
    return out;
  }, [pools, offset]);

  const savedBySlot = useMemo(() => {
    const out = emptySlotMap();
    for (const item of library) {
      const slotKey = mealTypeForItem(item);
      const image = item.image || getIngredientImage(item.name, item.group, getOverlayImageFile(item.id));
      out[slotKey] = [...(out[slotKey] || []), { ...item, image, fromSlot: slotKey }];
    }
    return out;
  }, [library]);

  // Full (un-windowed) pool for whichever slot the "See more" sheet is open
  // for. 'best' pulls straight from `pools` (not `visibleCandidates`, which
  // is capped to WINDOW_SIZE) and tags each item with `fromSlot` manually,
  // same as `visibleCandidates` does; 'saved' reuses `savedBySlot` as-is,
  // since it's already the full, already-tagged pool.
  const browsePool = useMemo(() => {
    if (!browseSlot) return [];
    if (activeTab === 'saved') return savedBySlot[browseSlot] || [];
    return (pools[browseSlot] || []).map((item) => ({ ...item, fromSlot: browseSlot }));
  }, [browseSlot, activeTab, pools, savedBySlot]);

  const hasPoolData = useMemo(
    () => PLAN_SLOT_KEYS.some((key) => (pools[key] || []).length > 0),
    [pools],
  );
  const bestStatus = planLoadState({ loading, hasData: hasPoolData, error: loadError, online });

  const handleRefresh = useCallback(() => {
    setOffset((o) => o + WINDOW_SIZE);
  }, []);

  const handleToggleSelect = useCallback((item) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });
  }, []);

  const selectedIds = useMemo(() => new Set(selected.keys()), [selected]);

  // Seed + enrich the detail card exactly like SuggestionsScreen's
  // BestRecipesTab.openRecipe: immediate seed from the card's own fields,
  // then buildRecipeDetail fills in real per-condition tiers/ingredients.
  const handleSelectCard = useCallback((item) => {
    const seed = {
      foodId: item.id ?? null,
      name: item.name,
      image: item.image,
      sourceName: item.sourceName ?? null,
      matchedConditions: [],
    };
    // PlanCandidates carry these when their source Recipe had a C1 overlay
    // match (see adapter.js's recipeToPlanCandidate) — forward when present
    // so buildRecipeDetail can read them through onto the card payload.
    if (item.sourceUrl) seed.sourceUrl = item.sourceUrl;
    if (item.attribution) seed.attribution = item.attribution;
    if (item.nutritionPerServing) seed.nutritionPerServing = item.nutritionPerServing;
    setSelectedRecipe({
      foodId: seed.foodId,
      name: seed.name,
      image: seed.image,
      sourceName: seed.sourceName,
      conditions: seed.matchedConditions,
      ingredients: [],
      isRecipe: true,
    });
    buildRecipeDetail(seed)
      .then((detail) => setSelectedRecipe({ ...detail, isRecipe: true }))
      .catch(() => {});
  }, []);

  const finish = useCallback(() => {
    setGap(null);
    onGenerated?.();
    onClose?.();
  }, [onGenerated, onClose]);

  const handleCreatePlan = useCallback(async () => {
    setGenerating(true);
    try {
      // Commit the week start FIRST — `generatePlanFromPicks` derives its 7
      // day keys from `nextSevenDays()`, which reads this stored value.
      setWeekStartDay(weekStartDay);
      const { plan } = await generatePlanFromPicks(profile, [...selected.values()]);

      const need = profile.calorieTarget ?? 2000;
      const { total } = estimatePlanDayCalories(plan.days[todayKey()]?.slots);
      if (total < need * CALORIE_GAP_RATIO) {
        setGap({ need, total });
        return;
      }
      finish();
    } catch (err) {
      console.error('MealPlannerPicker: generatePlanFromPicks failed', err);
    } finally {
      setGenerating(false);
    }
  }, [profile, selected, weekStartDay, finish]);

  // Task 9: the gap sheet's "Choose more recipes" action closes both the gap
  // sheet and this whole picker overlay, then routes to the full Recipes
  // catalog (/app/recipes, RecipesScreen) — replaces the old inline quick-add
  // grid built from `gapSuggestions` (removed; see CalorieGapSheet.jsx's doc).
  const handleChooseMore = useCallback(() => {
    setGap(null);
    onClose?.();
    navigate('/app/recipes');
  }, [onClose, navigate]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={calmSpring}
          className="fixed inset-0 z-[60] bg-paper-100 flex flex-col"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 shrink-0 bg-paper-100 border-b border-sand-200
            flex items-center justify-between px-4 py-3">
            <button
              onClick={onClose}
              aria-label="Close"
              className="tap-target w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm
                transition-all duration-fast hover:shadow-md active:scale-95"
            >
              <X size={18} className="text-char-700" aria-hidden="true" />
            </button>
            <h2 className="font-display text-base font-semibold text-blue-950">New meal plan</h2>
            <button
              onClick={() => console.log('MealPlannerPicker: search is not wired up yet')}
              aria-label="Search"
              className="tap-target w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm
                transition-all duration-fast hover:shadow-md active:scale-95"
            >
              <Search size={18} className="text-char-700" aria-hidden="true" />
            </button>
          </div>

          {/* Week start — chosen up front, applied at create time (see
              WEEK_START_OPTIONS). Same pill language as the Plan screen's
              day strip, so it reads as a date control rather than a form. */}
          <div className="shrink-0 px-4 pt-3 flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
            <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold font-sans
              uppercase tracking-eyebrow text-blue-950/40 mr-0.5">
              <CalendarRange size={12} aria-hidden="true" />
              Week starts
            </span>
            {WEEK_START_OPTIONS.map(({ value, label }) => {
              const isSelected = weekStartDay === value;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setWeekStartDayState(value)}
                  aria-pressed={isSelected}
                  className={`shrink-0 px-2.5 py-1 rounded-pill text-[11px] font-semibold font-sans
                    transition-all duration-fast active:scale-95
                    ${isSelected ? 'bg-blue-950 text-white' : 'bg-white text-blue-950/60 hover:bg-sand-100'}`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Tabs + refresh */}
          <div className="shrink-0 px-4 pt-4 pb-2 flex items-center gap-2">
            <div className="flex-1">
              <PillSwitcher options={TAB_OPTIONS} value={activeTab} onChange={setActiveTab} size="sm" trackClassName="bg-white" />
            </div>
            {activeTab === 'best' && (
              <button
                onClick={handleRefresh}
                aria-label="Refresh options"
                className="tap-target w-9 h-9 shrink-0 rounded-full bg-white flex items-center justify-center shadow-sm
                  transition-all duration-fast hover:shadow-md active:scale-95"
              >
                <RefreshCw size={16} className="text-char-700" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Rails */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-32">
            {activeTab === 'best' ? (
              bestStatus === 'loading' ? (
                <SkeletonRails />
              ) : (
                <DataState
                  status={bestStatus}
                  onRetry={handleRetryLoad}
                  screenName="recipes"
                  emptyTitle="No recipes to suggest yet"
                  emptyBody={unscorableReason || "We couldn't find recipe suggestions for your profile right now. Try again in a moment."}
                >
                  <BestRecipesRails
                    candidatesBySlot={visibleCandidates}
                    onSelectCard={handleSelectCard}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                    showAdd
                    showScrollbar
                    onSeeMore={setBrowseSlot}
                    onSaveBlocked={showSnackbar}
                  />
                </DataState>
              )
            ) : (
              <DataState
                status={library.length === 0 ? 'empty' : 'success'}
                screenName="saved recipes"
                emptyTitle="No saved recipes yet"
                emptyBody="Save recipes you like and they'll show up here to pick from."
              >
                <BestRecipesRails
                  candidatesBySlot={savedBySlot}
                  onSelectCard={handleSelectCard}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  showAdd
                  showScrollbar
                  onSeeMore={setBrowseSlot}
                  onSaveBlocked={showSnackbar}
                />
              </DataState>
            )}
          </div>

          {/* Floating summary CTA — absolute within this full-viewport
              overlay (not `fixed`, so it isn't affected by the ancestor's
              framer-motion transform) but reads the same as a bottom-docked
              bar since the overlay itself already spans the full viewport. */}
          <div className="absolute inset-x-4 bottom-6 z-20 max-w-[400px] mx-auto safe-area-bottom
            flex items-center justify-between gap-3 px-4 py-3 rounded-pill
            bg-blue-950 text-white shadow-lg">
            <span className="font-sans text-sm font-medium">
              {/* generatePlanFromPicks no longer pool-fills on zero picks (Aug
                  2026, decision b) — an empty pick list now yields an
                  honestly empty week, so the CTA is disabled instead of
                  quietly handing back nothing. This line doubles as that
                  explanation. */}
              {selected.size === 0 ? 'Pick at least 1 to continue' : `${selected.size} selected`}
            </span>
            <button
              onClick={handleCreatePlan}
              disabled={generating || selected.size === 0}
              className="inline-flex items-center gap-1.5 rounded-pill bg-white text-blue-950
                text-sm font-semibold font-sans px-4 py-2
                hover:bg-sand-50 active:scale-[0.99] transition-all duration-fast
                disabled:opacity-60 disabled:pointer-events-none"
            >
              {generating ? 'Creating…' : 'Create meal plan'}
            </button>
          </div>

          <FoodDetailCard
            item={selectedRecipe}
            open={!!selectedRecipe}
            onClose={() => setSelectedRecipe(null)}
          />

          {gap && (
            <CalorieGapSheet
              open
              need={gap.need}
              total={gap.total}
              onClose={() => setGap(null)}
              onContinue={finish}
              onChooseMore={handleChooseMore}
            />
          )}

          <SlotBrowseSheet
            open={!!browseSlot}
            slotKey={browseSlot}
            pool={browsePool}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectCard={handleSelectCard}
            onClose={() => setBrowseSlot(null)}
            onSaveBlocked={showSnackbar}
          />

          <Snackbar snackbar={snackbar} onUndo={handleSnackbarUndo} onDismiss={() => setSnackbar(null)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
