import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, BookmarkPlus, ArrowRight, RotateCw, RefreshCw, CalendarPlus, Printer, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/shared/PageHeader.jsx';
import GlassPanel from '../../components/shared/GlassPanel.jsx';
import PillSwitcher from '../../components/shared/PillSwitcher.jsx';
import FoodImageCard from '../../components/shared/FoodImageCard.jsx';
import Snackbar from '../../components/shared/Snackbar.jsx';
import SaveButton from '../../components/shared/SaveButton.jsx';
import EmptyState from '../../components/shared/EmptyState.jsx';
import FoodDetailCard from '../../components/FoodDetailCard.jsx';
import MealTypeTag, { mealTypeForItem } from '../../components/shared/mealTypeMeta.jsx';
import SlotSection from './SlotSection.jsx';
import DayStrip from './DayStrip.jsx';
import SchedulerView from './SchedulerView.jsx';
import NutritionFactsSheet from './NutritionFactsSheet.jsx';
import MealPlannerPicker from './MealPlannerPicker.jsx';
import { nextSevenDays, todayKey } from './planDates.js';
import { getIngredientImage } from '../../api/ingredientImages.js';
import {
  getProfile,
  ensurePlanForWeek,
  regenerateDay,
  regenerateWeek,
  shuffleSlot,
  inferSlotKey,
  buildRecipeDetail,
  generatePlanFromPicks,
} from '../../api/api.js';
import { estimatePlanDayCalories } from '../../api/calorieNeeds.js';
import { formatWeekPlanText, buildPrintModel } from '../../api/planExport.js';
import { printPage, share } from '../../api/browser.js';
import { PLAN_SLOTS, DEFAULT_DEV_CONDITIONS } from '../../api/config.js';
import {
  getPlan,
  subscribePlan,
  addToSlot,
  removeFromSlot,
  insertIntoSlot,
  togglePinned,
} from '../../state/dailyPlan.js';
import { getLibrary, subscribeLibrary } from '../../state/library.js';
import { GHOST_PLAN } from '../../api/ghostData.js';
import { getSaveBlockReason } from '../../utils/saveGate.js';

const calmSpring = { type: 'spring', stiffness: 120, damping: 22, mass: 1 };

// Direction-aware day-pager slide. `custom` (the pager direction, ±1) is
// threaded through AnimatePresence to these variant FUNCTIONS — framer-motion
// only resolves function-valued animations via named variants + `custom`,
// not via inline function values on `initial`/`animate`/`exit` directly.
const daySlideVariants = {
  enter: (dir) => ({ x: dir >= 0 ? 36 : -36, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir >= 0 ? -36 : 36, opacity: 0 }),
};

// Stable empty-array reference for `displayPlan?.conditionNames ?? …` — a
// fresh `[]` literal there would change identity every render and needlessly
// invalidate `handleSelect`'s useCallback memoization.
const EMPTY_CONDITION_NAMES = [];

const VIEW_OPTIONS = [
  { key: 'queue', label: 'Day view' },
  { key: 'scheduler', label: 'Week view' },
  { key: 'cookbook', label: 'Saved recipes' },
];

const COOKBOOK_SORT_OPTIONS = [
  { key: 'recent', label: 'Recently saved' },
  { key: 'meal', label: 'By meal type' },
];

function cardImage(item) {
  return item.image || getIngredientImage(item.name, item.group);
}

function cardSubtitle(item) {
  if (!item.tier) return undefined;
  return item.referenceTotal ? `${item.tier} · ${item.referenceTotal} studies` : item.tier;
}

// ── "Build from saved recipes" (1.4) ────────────────────────────────────────
//
// A saved-library item comes from `recipeToSaveItem` (src/utils/saveGate.js)
// — id/name/image/kind:'recipe'/tier/numericId only, with `group`/
// `fineGroup` always null and no `mealType` at all. Without SOME per-item
// slot signal, every saved recipe falls through `mealTypeForItem`'s
// `inferSlotKey` default and lands in Lunch alone. Title-keyword matching
// only (never invents tier/nutrition data) — same spirit as adapter.js's
// private `guessMealType`, duplicated in miniature here since that helper
// isn't exported from core and this track doesn't touch adapter.js.
const SAVED_RECIPE_SLOT_KEYWORDS = [
  ['smoothie', 'breakfast'], ['oatmeal', 'breakfast'], ['pancake', 'breakfast'],
  ['omelet', 'breakfast'], ['granola', 'breakfast'], ['parfait', 'breakfast'], ['waffle', 'breakfast'],
  ['tea', 'beverages'], ['juice', 'beverages'], ['latte', 'beverages'], ['lemonade', 'beverages'],
  ['cookie', 'snacks'], ['cake', 'snacks'], ['snack bar', 'snacks'], ['pie', 'snacks'],
  ['brownie', 'snacks'], ['muffin', 'snacks'], ['pudding', 'snacks'], ['tart', 'snacks'],
  ['cheesecake', 'snacks'], ['ice cream', 'snacks'], ['dip', 'snacks'],
  ['soup', 'dinner'], ['stew', 'dinner'], ['chili', 'dinner'], ['roast', 'dinner'],
  ['salad', 'lunch'], ['sandwich', 'lunch'], ['wrap', 'lunch'],
];

/**
 * Best-effort slot guess for a saved recipe, by title keyword. Falls back to
 * 'dinner' (matching adapter.js's own guessMealType fallback) when nothing
 * matches.
 * @param {string} name
 * @returns {string} one of PLAN_SLOT_KEYS
 */
function guessSlotForSavedRecipe(name) {
  const lower = (name || '').toLowerCase();
  for (const [keyword, slotKey] of SAVED_RECIPE_SLOT_KEYWORDS) {
    if (lower.includes(keyword)) return slotKey;
  }
  return 'dinner';
}

/**
 * Map `getLibrary()` items into `generatePlanFromPicks`-ready picks, tagged
 * with a guessed `fromSlot` (mealTypeForItem prefers `fromSlot` over
 * re-inferring — see mealTypeMeta.jsx). Excludes anything
 * `getSaveBlockReason` would now block (ingredient/harmful/unscored) — the
 * save gate should already keep those out of the library, but this stays
 * defensive against rows saved before the gate existed. The numericId 5-7
 * check is redundant with `getSaveBlockReason`'s 'harmful' case but kept
 * explicit as a second, independent guard against ever planning a
 * skull-rated recipe.
 * @param {import('../../api/types.js').Food[]} library
 * @returns {Array<Object>}
 */
function libraryItemsToPicks(library) {
  return library
    .filter((item) => getSaveBlockReason(item) === null)
    .filter((item) => !(Number.isFinite(item.numericId) && item.numericId >= 5 && item.numericId <= 7))
    .map((item) => ({ ...item, fromSlot: guessSlotForSavedRecipe(item.name) }));
}

/**
 * The plan-day calorie line — the ONE quiet piece of numeric context this
 * screen shows (never a badge, never a bar, never per-food). Omits itself
 * entirely when nothing is countable (`total <= 0`) rather than show "~0".
 */
function CalorieLine({ slots, need }) {
  const { total } = estimatePlanDayCalories(slots);
  if (total <= 0) return null;

  return (
    <p className="text-xs font-sans text-blue-950/60 leading-relaxed">
      {`~${Math.round(total).toLocaleString()} cal planned (estimated)`}
      {` · your estimated need ~${need.toLocaleString()}`}
    </p>
  );
}

// ── Cookbook card grid ───────────────────────────────────────────────────────

function CardGrid({ items, actionIcon, onAction, onBlocked, emptyMessage, emptyAction }) {
  if (items.length === 0) {
    return (
      <div className="flex items-start gap-3 px-4 py-4 rounded-xl border border-dashed border-blue-950/30">
        <BookmarkPlus size={18} className="text-blue-950 shrink-0 mt-0.5" />
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-blue-950 font-sans leading-snug">{emptyMessage}</p>
          {emptyAction && (
            <button
              onClick={emptyAction.onClick}
              className="mt-1 inline-flex items-center gap-1.5 self-start rounded-pill bg-blue-950
                text-white text-sm font-semibold font-sans px-4 py-2
                hover:bg-blue-900 active:scale-[0.99] transition-all duration-fast"
            >
              {emptyAction.label}
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <AnimatePresence mode="popLayout">
        {items.map((item) => {
          // A blocked item is a legacy harmful-recipe or ingredient sitting
          // in the library from before the save gate existed (see
          // src/utils/saveGate.js) — its normal add-to-plan action is
          // suppressed (an ingredient/harmful recipe shouldn't be plannable
          // either), and SaveButton becomes the only way to remove it.
          const blocked = getSaveBlockReason(item);
          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.88 }}
              transition={calmSpring}
            >
              <FoodImageCard
                id={item.id}
                image={cardImage(item)}
                numericId={item.numericId}
                title={item.name}
                subtitle={cardSubtitle(item)}
                mealTag={mealTypeForItem(item)}
                aspectRatio="4/5"
                action={blocked ? undefined : actionIcon}
                actionOnClick={blocked ? undefined : () => onAction(item)}
                saveAction={<SaveButton item={item} onBlocked={onBlocked} />}
                className="w-full"
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 4;

export default function MealQueueScreen() {
  const navigate = useNavigate();
  const [plan, setPlanState] = useState(getPlan);
  const [library, setLibrary] = useState(getLibrary);
  const [view, setView] = useState('queue');
  const [cookbookExpanded, setCookbookExpanded] = useState(false);
  const [cookbookSort, setCookbookSort] = useState('recent');
  const [building, setBuilding] = useState(() => getPlan() == null);
  const [profile, setProfile] = useState(null);
  const [selectedDay, setSelectedDay] = useState(todayKey());
  const [pagerDirection, setPagerDirection] = useState(1);
  const [shufflingSlot, setShufflingSlot] = useState(null);
  const [regeneratingDay, setRegeneratingDay] = useState(false);
  const [regeneratingWeek, setRegeneratingWeek] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [factsTarget, setFactsTarget] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [buildingFromSaved, setBuildingFromSaved] = useState(false);
  const [snackbar, setSnackbar] = useState(null);
  const snackbarRef = useRef(null);
  const snackbarIdRef = useRef(0);
  const profileRef = useRef(null);

  const days = nextSevenDays();
  const dayKeys = days.map((d) => d.key);

  useEffect(() => {
    const unsubP = subscribePlan(setPlanState);
    const unsubL = subscribeLibrary(setLibrary);
    return () => { unsubP(); unsubL(); };
  }, []);

  // Load the profile (dev-condition fallback, same pattern as
  // SuggestionsScreen) and ensure this week's plan exists. Failures leave
  // the plan as-is (null on a first-ever failed build) — slots fall back to
  // their honest empty state rather than fabricating anything.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getProfile();
        const conditions = p?.conditions?.length ? p.conditions : DEFAULT_DEV_CONDITIONS;
        const fullProfile = { ...(p ?? {}), conditions };
        if (cancelled) return;
        profileRef.current = fullProfile;
        setProfile(fullProfile);
        await ensurePlanForWeek(fullProfile);
      } catch (err) {
        console.error('MealQueueScreen: failed to build plan', err);
      } finally {
        if (!cancelled) setBuilding(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // The window rolls forward at local midnight; if the stored selection
  // falls out of it (screen left open overnight, or a stale selection from a
  // prior condition-change rebuild), every read below falls back to today
  // rather than showing a day that no longer has a chip. Derived at render
  // time (not corrected via a setState-in-effect) so there's never a frame
  // where the UI points at a day the strip doesn't offer.
  const activeDay = dayKeys.includes(selectedDay) ? selectedDay : todayKey();

  const showSnackbar = useCallback((message, canUndo = false, undoFn = null) => {
    snackbarIdRef.current += 1;
    const id = snackbarIdRef.current;
    snackbarRef.current = undoFn;
    setSnackbar({ id, message, canUndo });
  }, []);

  const dismissSnackbar = useCallback(() => setSnackbar(null), []);

  const handleUndo = useCallback(() => {
    if (snackbarRef.current) snackbarRef.current();
    snackbarRef.current = null;
    setSnackbar(null);
  }, []);

  const handleToggleView = useCallback((newView) => {
    setView(newView);
    setCookbookExpanded(false);
  }, []);

  const handleSelectDay = useCallback((key) => {
    setPagerDirection(dayKeys.indexOf(key) >= dayKeys.indexOf(activeDay) ? 1 : -1);
    setSelectedDay(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDay]);

  const handleSwipeDay = useCallback((offsetX) => {
    const threshold = 60;
    const currentIndex = dayKeys.indexOf(activeDay);
    if (offsetX < -threshold && currentIndex < dayKeys.length - 1) {
      handleSelectDay(dayKeys[currentIndex + 1]);
    } else if (offsetX > threshold && currentIndex > 0) {
      handleSelectDay(dayKeys[currentIndex - 1]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDay]);

  // Ghost mode: only while there is genuinely no plan to show yet (an
  // existing plan is never masked, even if a background rebuild is in
  // flight).
  const showGhost = building && !plan;
  const displayPlan = showGhost ? GHOST_PLAN : plan;
  const conditionNames = displayPlan?.conditionNames ?? EMPTY_CONDITION_NAMES;
  const dayState = displayPlan?.days?.[activeDay] ?? null;
  const daySlots = dayState?.slots ?? {};
  const dayPinned = dayState?.pinned ?? [];
  const dailyNeed = profile?.calorieTarget ?? 2000;

  // First-run empty state (1.3): `ensurePlanForWeek` returns `{ plan: null }`
  // immediately on a first-ever run — no network, no auto-fill (see
  // planBuilder.js's no-plan contract). Once the profile-load effect settles
  // (`building` false) with still no plan, the user has genuinely never run
  // the picker or built from saved recipes — render the Day-view empty state
  // below instead of 5 honest-empty slots.
  const firstRunEmpty = !building && !plan;

  // Print view model (T4C) — built from the REAL plan only, never ghost data
  // (`plan`, not `displayPlan`/GHOST_PLAN): `conditionNames` above is safe to
  // reuse here too, since it equals `plan.conditionNames` exactly whenever
  // `plan` is non-null (`displayPlan` only diverges from `plan` in ghost
  // mode, which requires `!plan`). `null` when there's nothing to print yet.
  const printModel = plan ? buildPrintModel(plan, { conditionNames }) : null;

  // Plan: shuffle one slot on the selected day
  const handleShuffle = useCallback(async (slotKey) => {
    if (shufflingSlot) return;
    setShufflingSlot(slotKey);
    try {
      await shuffleSlot(profileRef.current, activeDay, slotKey);
    } catch (err) {
      console.error('MealQueueScreen: shuffle failed', err);
      showSnackbar('Could not shuffle — try again');
    } finally {
      setShufflingSlot(null);
    }
  }, [shufflingSlot, showSnackbar, activeDay]);

  // Plan: regenerate the whole selected day (pinned items stay put)
  const handleRegenerateDay = useCallback(async () => {
    if (regeneratingDay) return;
    setRegeneratingDay(true);
    try {
      await regenerateDay(profileRef.current, activeDay);
      showSnackbar(dayPinned.length ? 'Day regenerated — pinned items kept' : 'Day regenerated');
    } catch (err) {
      console.error('MealQueueScreen: regenerate day failed', err);
      showSnackbar('Could not regenerate — try again');
    } finally {
      setRegeneratingDay(false);
    }
  }, [regeneratingDay, showSnackbar, activeDay, dayPinned.length]);

  // Plan: regenerate the entire week (every day's pinned items stay put)
  const handleRegenerateWeek = useCallback(async () => {
    if (regeneratingWeek) return;
    setRegeneratingWeek(true);
    try {
      const result = await regenerateWeek(profileRef.current);
      // `regenerateWeek` returns null when there's no plan yet to regenerate
      // (guarded defensively — the button is disabled during ghost mode, so
      // this shouldn't be reachable, but never claim success it didn't have).
      showSnackbar(result ? 'Week regenerated — pinned items kept' : 'Nothing to regenerate yet');
    } catch (err) {
      console.error('MealQueueScreen: regenerate week failed', err);
      showSnackbar('Could not regenerate — try again');
    } finally {
      setRegeneratingWeek(false);
    }
  }, [regeneratingWeek, showSnackbar]);

  // Plan: pin/unpin a card on the selected day
  const handleTogglePin = useCallback((id) => {
    togglePinned(activeDay, id);
  }, [activeDay]);

  // Plan: remove a card from its slot on the selected day, with Undo
  // restoring it at the same index.
  const handleRemove = useCallback((slotKey, item) => {
    const dateKey = activeDay;
    const idx = removeFromSlot(dateKey, slotKey, item.id);
    showSnackbar('Removed from plan', true, () => insertIntoSlot(dateKey, slotKey, item, idx));
  }, [showSnackbar, activeDay]);

  // Print & share the whole week (T4C, REMEDI_MASTER_PLAN.md §1.9) — plain,
  // ink-friendly output; FOODS only, never a calorie tally (see
  // planExport.js's header). `printPage()`/`share()` are the only
  // window/navigator touchpoints allowed anywhere in the app (browser.js).
  const handlePrint = useCallback(() => {
    printPage();
  }, []);

  const handleShare = useCallback(async () => {
    if (!plan) return;
    const text = formatWeekPlanText(plan, { conditionNames });
    const result = await share({ title: 'My Remedi meal plan', text });
    if (!result.ok) {
      showSnackbar('Could not share — try again');
    } else if (result.method === 'clipboard') {
      showSnackbar('Copied to clipboard');
    }
    // method === 'share' success: the native share sheet is its own
    // confirmation — no snackbar needed.
  }, [plan, conditionNames, showSnackbar]);

  // New meal plan picker: called right after `generatePlanFromPicks`
  // succeeds — lands the user on Day view, today, with a confirmation toast.
  const handlePlanGenerated = useCallback(() => {
    setView('queue');
    setSelectedDay(todayKey());
    showSnackbar('Meal plan created');
  }, [showSnackbar]);

  // First-run empty state (1.3/1.4): build straight from the saved-recipes
  // library, skipping the picker entirely. Shares `handlePlanGenerated`'s
  // landing behavior with the picker's own confirm flow.
  const handleBuildFromSaved = useCallback(async () => {
    if (buildingFromSaved) return;
    setBuildingFromSaved(true);
    try {
      await generatePlanFromPicks(profileRef.current, libraryItemsToPicks(library));
      handlePlanGenerated();
    } catch (err) {
      console.error('MealQueueScreen: build from saved recipes failed', err);
      showSnackbar('Could not build a plan — try again');
    } finally {
      setBuildingFromSaved(false);
    }
  }, [buildingFromSaved, library, handlePlanGenerated, showSnackbar]);

  // Cookbook: add to the selected day's plan (bucketed by inferSlotKey).
  // No-ops honestly (rather than lying "Already in plan") when there's no
  // plan yet at all — `addToSlot` itself no-ops with no day to add into,
  // reachable here since the Cookbook tab stays browsable during the
  // first-run empty state (see `firstRunEmpty`, below).
  const handleAddToPlan = useCallback((item) => {
    if (!plan) {
      showSnackbar('Build a meal plan first');
      return;
    }
    const slotKey = inferSlotKey(item);
    const added = addToSlot(activeDay, slotKey, {
      id: item.id,
      name: item.name,
      image: item.image,
      group: item.group,
      fineGroup: item.fineGroup || '',
      tier: item.tier ?? null,
      numericId: item.numericId ?? null,
      kind: item.kind ?? 'food',
    });
    const slotLabel = PLAN_SLOTS.find((s) => s.key === slotKey)?.label ?? slotKey;
    showSnackbar(added ? `Added to ${slotLabel}` : 'Already in plan');
  }, [showSnackbar, activeDay, plan]);

  // Select: open FoodDetailCard, seeding recipes via buildRecipeDetail
  // exactly like SuggestionsScreen's BestRecipesTab.
  const handleSelect = useCallback((item) => {
    if (item.kind === 'recipe') {
      // sourceUrl/attribution/ingredients thread through from the plan
      // item/candidate onto the FoodDetailCard seed when present (they flow
      // from PlanCandidate — see api/types.js) — `?? null`/`?? []` keeps this
      // a no-op today, before those fields exist on a persisted PlanItem.
      const seed = {
        foodId: item.id,
        name: item.name,
        image: item.image,
        sourceName: item.sourceName ?? null,
        sourceUrl: item.sourceUrl ?? null,
        attribution: item.attribution ?? null,
        conditions: conditionNames,
        ingredients: item.ingredients ?? [],
        isRecipe: true,
      };
      setSelectedDetail(seed);
      buildRecipeDetail(seed)
        .then((detail) => setSelectedDetail({ ...detail, isRecipe: true }))
        .catch(() => { });
    } else {
      setSelectedDetail({ foodId: item.id, name: item.name, image: item.image });
    }
  }, [conditionNames]);

  const visibleCookbook = cookbookExpanded ? library : library.slice(0, PAGE_SIZE);
  const plusIcon = <Plus size={16} className="text-forest-700" />;

  return (
    <div className="bg-forest-300 flex flex-col min-h-screen -mb-28 rm-plan-print-root">

      {/* ── Header zone ─────────────────────────────────────────────────────
          `rm-print-hide` (index.css) hides this whole zone — chrome, tabs,
          day strip, and the print/share controls below — under
          `@media print`; only `.plan-print-view` (bottom of this file)
          renders on a printed page. ─────────────────────────────────────── */}
      <PageHeader
        label="Plan"
        title="My Meal Plan"
        className="bg-forest-300 rm-print-hide"
      >
        <div className="mt-4 flex items-start gap-3">
          <div className="flex-1">
            <PillSwitcher options={VIEW_OPTIONS} value={view} onChange={handleToggleView} />
          </div>

          {/* Print & share (T4C) — plain, ink-friendly week summary; hidden
              entirely with no plan yet (nothing honest to print/share). */}
          {plan && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePrint}
                aria-label="Print meal plan"
                className="inline-flex items-center justify-center w-11 h-11 rounded-full
                  bg-white/40 hover:bg-white/60 text-blue-950/70 shadow-sm
                  transition-all duration-fast active:scale-95"
              >
                <Printer size={18} />
              </button>
              <button
                type="button"
                onClick={handleShare}
                aria-label="Share meal plan"
                className="inline-flex items-center justify-center w-11 h-11 rounded-full
                  bg-white/40 hover:bg-white/60 text-blue-950/70 shadow-sm
                  transition-all duration-fast active:scale-95"
              >
                <Share2 size={18} />
              </button>
            </div>
          )}
        </div>

        {view === 'queue' && !firstRunEmpty && (
          <div className="mt-4 -mb-2">
            <DayStrip days={days} selected={activeDay} onSelect={handleSelectDay} />
          </div>
        )}
      </PageHeader>

      {/* ── Glass panel ──────────────────────────────────────────────────── */}
      <GlassPanel className="mt-4 rm-print-hide">
        {view === 'queue' ? (
          firstRunEmpty ? (
            <EmptyState
              icon="calendar"
              title="No meal plan yet"
              body="Pick recipes you like and we'll build your week around them — nothing gets added automatically."
              action={
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={() => setPickerOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-pill bg-blue-950 text-white
                      text-sm font-semibold font-sans px-5 py-2.5
                      hover:bg-blue-900 active:scale-[0.99] transition-all duration-fast"
                  >
                    <CalendarPlus size={16} />
                    Build your meal plan
                  </button>

                  {library.length > 0 ? (
                    <button
                      onClick={handleBuildFromSaved}
                      disabled={buildingFromSaved}
                      className="text-sm font-semibold font-sans text-blue-950/70 hover:text-blue-950
                        transition-colors duration-fast disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {buildingFromSaved ? 'Building…' : 'Build from saved recipes'}
                    </button>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5">
                      <p className="text-xs text-char-500 font-sans max-w-[260px] text-center leading-snug">
                        Save recipes you like, then build a plan from them.
                      </p>
                      <button
                        onClick={() => navigate('/app/recipes')}
                        className="text-sm font-semibold font-sans text-blue-950/70 hover:text-blue-950
                          transition-colors duration-fast"
                      >
                        Browse recipes
                      </button>
                    </div>
                  )}
                </div>
              }
            />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <CalorieLine
                  slots={daySlots}
                  need={dailyNeed}
                />
                <button
                  onClick={handleRegenerateDay}
                  disabled={showGhost || regeneratingDay}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-pill bg-white/40 hover:bg-white/60
                    px-3 py-1.5 text-xs font-semibold text-blue-950/70 transition-all duration-fast
                    ${showGhost || regeneratingDay ? 'opacity-40 pointer-events-none' : 'active:scale-95'}`}
                >
                  <RotateCw size={13} className={regeneratingDay ? 'animate-spin' : ''} />
                  Regenerate day
                </button>
              </div>

              <AnimatePresence mode="popLayout" custom={pagerDirection} initial={false}>
                <motion.div
                  key={activeDay}
                  custom={pagerDirection}
                  variants={daySlideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={calmSpring}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.12}
                  onDragEnd={(_e, info) => handleSwipeDay(info.offset.x)}
                  className="flex flex-col gap-8"
                >
                  {PLAN_SLOTS.map((slot) => (
                    <SlotSection
                      key={slot.key}
                      slot={slot}
                      items={daySlots[slot.key] ?? []}
                      pinnedIds={dayPinned}
                      conditionNames={conditionNames}
                      onShuffle={handleShuffle}
                      onSelect={handleSelect}
                      onRemove={handleRemove}
                      onTogglePin={handleTogglePin}
                      ghost={showGhost}
                      shuffling={shufflingSlot === slot.key}
                      onSaveBlocked={showSnackbar}
                    />
                  ))}
                </motion.div>
              </AnimatePresence>

              {/* Week-level regenerate — discoverable but not dominant */}
              <div className="flex justify-center pt-2">
                <button
                  onClick={handleRegenerateWeek}
                  disabled={showGhost || regeneratingWeek}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold font-sans
                    text-blue-950/50 hover:text-blue-950/70 transition-colors duration-fast
                    ${showGhost || regeneratingWeek ? 'opacity-40 pointer-events-none' : ''}`}
                >
                  <RefreshCw size={12} className={regeneratingWeek ? 'animate-spin' : ''} />
                  Regenerate whole week
                </button>
              </div>
            </div>
          )
        ) : view === 'scheduler' ? (
          <SchedulerView
            planDays={displayPlan?.days ?? {}}
            onSelectItem={handleSelect}
            onOpenFacts={({ day, items }) => setFactsTarget({ day, items })}
          />
        ) : (
          <section>
            <div className="flex items-baseline justify-between mb-4">
              <p className="font-label text-xs tracking-widest uppercase text-blue-950/70">
                Saved recipes
              </p>
            </div>

            {library.length > 0 && (
              <div className="mb-4">
                <PillSwitcher
                  options={COOKBOOK_SORT_OPTIONS}
                  value={cookbookSort}
                  onChange={setCookbookSort}
                  size="sm"
                />
              </div>
            )}

            {cookbookSort === 'meal' && library.length > 0 ? (
              <div className="flex flex-col gap-6">
                {PLAN_SLOTS.map((slot) => {
                  const slotItems = library.filter((item) => mealTypeForItem(item) === slot.key);
                  if (slotItems.length === 0) return null;
                  return (
                    <div key={slot.key}>
                      <div className="flex items-center gap-2 mb-3">
                        <MealTypeTag mealKey={slot.key} />
                        <p className="font-label text-xs tracking-widest uppercase text-blue-950/70">
                          {slot.label}
                        </p>
                      </div>
                      <CardGrid
                        items={slotItems}
                        actionIcon={plusIcon}
                        onAction={handleAddToPlan}
                        onBlocked={(msg) => showSnackbar(msg)}
                        emptyMessage=""
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                <CardGrid
                  items={visibleCookbook}
                  actionIcon={plusIcon}
                  onAction={handleAddToPlan}
                  onBlocked={(msg) => showSnackbar(msg)}
                  emptyMessage="Your saved recipes list is empty — save foods and recipes from Food Lookup."
                  emptyAction={{ label: 'Food Lookup', onClick: () => navigate('/app/search') }}
                />

                {/* See more / see less */}
                {library.length > PAGE_SIZE && (
                  <div className="mt-3 flex justify-center">
                    {!cookbookExpanded ? (
                      <button
                        onClick={() => setCookbookExpanded(true)}
                        className="text-sm font-semibold font-sans text-blue-950/70
                          hover:text-blue-950 transition-colors duration-fast"
                      >
                        See all {library.length}
                      </button>
                    ) : (
                      <button
                        onClick={() => setCookbookExpanded(false)}
                        className="text-sm font-semibold font-sans text-blue-950/50
                          hover:text-blue-950/70 transition-colors duration-fast"
                      >
                        See less
                      </button>
                    )}
                  </div>
                )}

                {!cookbookExpanded && library.length > PAGE_SIZE && (
                  <p className="mt-2 text-center text-[11px] text-blue-950/40 font-sans">
                    Scroll to see more
                  </p>
                )}
              </>
            )}
          </section>
        )}
      </GlassPanel>

      {/* ── New meal plan FAB — always visible on this screen, opens the
          recipe-picker overlay. Bottom offset mirrors the Snackbar's so it
          clears the navbar. `data-print-hide`: a plain UI control, not
          content — never belongs on a printed page. ────────────────────── */}
      <button
        onClick={() => setPickerOpen(true)}
        data-print-hide
        className="fixed right-5 bottom-[88px] z-50 inline-flex items-center gap-2
          rounded-pill bg-blue-950 text-white px-4 py-3 shadow-lg
          font-sans text-sm font-semibold transition-all duration-fast
          hover:bg-blue-900 active:scale-95"
      >
        <CalendarPlus size={16} />
        New meal plan
      </button>

      {/* ── Snackbar ─────────────────────────────────────────────────────── */}
      <div data-print-hide>
        <Snackbar snackbar={snackbar} onUndo={handleUndo} onDismiss={dismissSnackbar} />
      </div>

      {/* ── Food/recipe detail ──────────────────────────────────────────── */}
      <div data-print-hide>
        <FoodDetailCard
          item={selectedDetail}
          open={!!selectedDetail}
          onClose={() => setSelectedDetail(null)}
        />
      </div>

      {/* ── Nutrition facts (from a Week view day) ────────────────────────── */}
      <div data-print-hide>
        <NutritionFactsSheet
          open={!!factsTarget}
          dayLabel={factsTarget?.day?.label}
          items={factsTarget?.items ?? []}
          onClose={() => setFactsTarget(null)}
        />
      </div>

      {/* ── New meal plan picker overlay ──────────────────────────────────── */}
      <div data-print-hide>
        <MealPlannerPicker
          open={pickerOpen}
          profile={profile}
          onClose={() => setPickerOpen(false)}
          onGenerated={handlePlanGenerated}
        />
      </div>

      {/* ── Print view (T4C, REMEDI_MASTER_PLAN.md §1.9) ───────────────────
          Always in the DOM (so printed content can never lag a stale
          render), invisible on screen (`.plan-print-view` in index.css),
          shown ONLY under `@media print`. `aria-hidden` keeps it out of the
          accessibility tree on screen, where it's genuinely inert — a
          screen reader user gets the same live content via the on-screen
          Day/Week views instead. Built straight from `buildPrintModel`
          (planExport.js): foods only, no calories, no fabricated "—"
          placeholders, no images/icons — plain black-on-white text. */}
      <section className="plan-print-view" aria-hidden="true">
        {printModel && (
          <>
            <h1 className="plan-print-title">Remedi Meal Plan</h1>
            {printModel.rangeLabel && (
              <p className="plan-print-range">{printModel.rangeLabel}</p>
            )}
            {printModel.conditionLine && (
              <p className="plan-print-conditions">{printModel.conditionLine}</p>
            )}

            {printModel.days.map((day) => (
              <div className="plan-print-day" key={`${day.label}-${day.dateLabel}`}>
                <h2 className="plan-print-day-heading">{day.label} · {day.dateLabel}</h2>
                {day.slots.length === 0 ? (
                  <p className="plan-print-empty">Nothing planned</p>
                ) : (
                  day.slots.map((slot) => (
                    <p className="plan-print-slot" key={slot.label}>
                      <span className="plan-print-slot-label">{slot.label}:</span>{' '}
                      {slot.items.join(', ')}
                    </p>
                  ))
                )}
              </div>
            ))}

            <p className="plan-print-footer">Generated by Remedi — not medical advice</p>
          </>
        )}
      </section>
    </div>
  );
}
