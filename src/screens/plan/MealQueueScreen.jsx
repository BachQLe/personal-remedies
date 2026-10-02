import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, BookmarkPlus, Bookmark, ArrowRight, RotateCw, RefreshCw, CalendarPlus, Printer, Share2, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/shared/PageHeader.jsx';
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
import HowToUseSheet from './HowToUseSheet.jsx';
import MealPlannerPicker from './MealPlannerPicker.jsx';
import SuggestionsSheet from './SuggestionsSheet.jsx';
import SavedPlansSheet from './SavedPlansSheet.jsx';
import {
  nextSevenDays,
  todayKey,
  getDayLabelMode,
  setDayLabelMode,
} from './planDates.js';
import { getIngredientImage } from '../../api/ingredientImages.js';
import { getOverlayImageFile } from '../../api/localTables.js';
import {
  getProfile,
  ensurePlanForWeek,
  regenerateDay,
  regenerateWeek,
  shuffleSlot,
  inferSlotKey,
  buildRecipeDetail,
  generatePlanFromPicks,
  toPlanItem,
  getSavedPlans,
  saveCurrentPlan,
  updateSavedPlan,
  loadSavedPlan,
  deleteSavedPlan,
  restoreSavedPlan,
  planFingerprint,
  getActiveSavedPlan,
  restoreActiveSavedPlan,
  guessMealType,
} from '../../api/api.js';
import { estimatePlanDayCalories } from '../../api/calorieNeeds.js';
import { formatWeekPlanText, buildPrintModel } from '../../api/planExport.js';
import { printPage, share } from '../../api/browser.js';
import { PLAN_SLOTS, DEFAULT_DEV_CONDITIONS, MAX_SAVED_PLANS } from '../../api/config.js';
import {
  getPlan,
  setPlan,
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

/**
 * Whether the "Show calendar days" / "Show Day 1–7" toggle renders above the
 * day strip. Off for now at the user's request — the flag only hides the
 * TRIGGER: `getDayLabelMode()` still drives SchedulerView's week view, and the
 * strip itself now always shows weekday + date regardless (see DayStrip.jsx).
 */
const SHOW_DAY_LABEL_TOGGLE = false;

const VIEW_OPTIONS = [
  { key: 'queue', label: 'Day view' },
  { key: 'scheduler', label: 'List view' },
  { key: 'cookbook', label: 'Saved recipes' },
];

const COOKBOOK_SORT_OPTIONS = [
  { key: 'recent', label: 'Recently saved' },
  { key: 'meal', label: 'By meal type' },
];

function cardImage(item) {
  return item.image || getIngredientImage(item.name, item.group, getOverlayImageFile(item.id));
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
// `inferSlotKey` default and lands in Lunch alone.
//
// (Task 13 fix, #8/#13 follow-up) This used to duplicate a small
// title-keyword table in miniature here, independently of — and drifting
// from — adapter.js's own recipe-meal-type keyword table (which maps 'soup'
// to lunch, not dinner, for instance). adapter.js now exports its own
// `guessMealType` for exactly this reuse, so this just maps ITS mealType
// vocabulary ('breakfast'/'lunch'/'dinner'/'snack'/'beverage') onto Plan
// slot keys ('snack' -> 'snacks', 'beverage' -> 'beverages', the rest
// identity) rather than re-deriving a second, inevitably-diverging guess.
const MEAL_TYPE_TO_SLOT_KEY = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  snack: 'snacks',
  beverage: 'beverages',
};

/**
 * Best-effort slot guess for a saved recipe, by title keyword — reuses
 * adapter.js's `guessMealType` (the same classification every other recipe
 * in the app gets) rather than a second, independent guess.
 * @param {string} name
 * @returns {string} one of PLAN_SLOT_KEYS
 */
function guessSlotForSavedRecipe(name) {
  return MEAL_TYPE_TO_SLOT_KEY[guessMealType(name)] || 'dinner';
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
 *
 * Deliberately just the one number ("~1,850 cal"), kept on a single line:
 * the "planned (estimated)" wording and the daily-need comparison are gone
 * (2026-09) — the leading "~" already says it's an estimate. It sits in an
 * understated container: a sand tint at 70% over paper-100 plus a hairline,
 * so the estimate reads as its own small surface next to the "Regenerate
 * day" pill without competing with it — the pill is an action, this is only
 * context, so it stays a shade lighter.
 */
function CalorieLine({ slots }) {
  const { total } = estimatePlanDayCalories(slots);
  if (total <= 0) return null;

  return (
    <div className="shrink-0 rounded-xl bg-white/70 border border-blue-950/[0.06] px-3 py-1.5">
      <p className="text-xs font-sans text-blue-950/60 leading-relaxed whitespace-nowrap">
        {`~${Math.round(total).toLocaleString()} cal`}
      </p>
    </div>
  );
}

// ── Cookbook card grid ───────────────────────────────────────────────────────

function CardGrid({ items, actionIcon, onAction, onSelect, onBlocked, emptyMessage, emptyAction }) {
  if (items.length === 0) {
    return (
      <div className="flex items-start gap-3 px-4 py-4 rounded-xl border border-dashed border-blue-950/30">
        <BookmarkPlus size={18} className="text-blue-950 shrink-0 mt-0.5" aria-hidden="true" />
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
              <ArrowRight size={14} aria-hidden="true" />
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
                onClick={() => onSelect(item)}
                action={blocked ? undefined : actionIcon}
                actionOnClick={blocked ? undefined : () => onAction(item)}
                actionLabel={blocked ? undefined : `Add ${item.name} to plan`}
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
  const [howToUseOpen, setHowToUseOpen] = useState(false);
  const [suggestionsSlot, setSuggestionsSlot] = useState(null);
  const [buildingFromSaved, setBuildingFromSaved] = useState(false);
  const [savedPlansOpen, setSavedPlansOpen] = useState(false);
  const [savedPlans, setSavedPlans] = useState(getSavedPlans);
  const [activeSavedPlan, setActiveSavedPlanState] = useState(getActiveSavedPlan);
  const [dayLabelMode, setDayLabelModeState] = useState(getDayLabelMode);
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
        // A conditions change can silently discard the plan (and, inside
        // that, clear the active-saved-plan pointer — see
        // `ensurePlanForWeek`'s doc) before this component ever renders it —
        // resync the local mirror so a stale "active" badge/banner can't
        // survive a mount that started with a mismatched plan.
        if (!cancelled) setActiveSavedPlanState(getActiveSavedPlan());
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

  // Suggestions (Task 11, formerly "Substitutions"): swap an acceptable
  // substitute into the currently-open slot in place of the original item.
  // Composed entirely from the same removeFromSlot/insertIntoSlot primitives
  // handleRemove already uses above — never a new mutation path (see
  // SuggestionsSheet.jsx's doc on why this must stay distinct from the
  // deleted SwapSheet). `toPlanItem` (planBuilder.js) is the same
  // PlanCandidate -> PlanItem conversion every other slot-fill path uses.
  // Undo mirrors handleRemove's Undo pattern exactly: swap the original back
  // into the same index.
  const handleSwapSubstitute = useCallback((originalItem, substitute) => {
    const dateKey = activeDay;
    const slotKey = suggestionsSlot;
    if (!slotKey) return;

    const index = removeFromSlot(dateKey, slotKey, originalItem.id);
    const convertedItem = toPlanItem(substitute);
    insertIntoSlot(dateKey, slotKey, convertedItem, index);

    showSnackbar(`Swapped in — ${substitute.name}`, true, () => {
      removeFromSlot(dateKey, slotKey, convertedItem.id);
      insertIntoSlot(dateKey, slotKey, originalItem, index);
    });
  }, [showSnackbar, activeDay, suggestionsSlot]);

  // Suggestions — add a candidate straight into the currently-open slot, no
  // source item to swap for (that's `handleSwapSubstitute`, above — a
  // genuinely different action, not reused here). Originated as Task 13's
  // fallback-mode add; Wave 4 generalizes it to every path that can hand
  // this sheet an `onAdd` candidate — the full fine-group menu's "+" and the
  // always-shown "All {slot} options" list alike. `toPlanItem` is the same
  // PlanCandidate -> PlanItem conversion every other slot-fill path uses
  // (planBuilder.js); SuggestionsSheet is responsible for only ever handing
  // this a Plan-safe, `kind`-stamped candidate (see its `toPlanSafeCandidates`
  // for the full-menu case, or `getCandidatesForSlot` for the "All options"
  // case — both already exclude numericId 5-7). `addToSlot` cross-slot-
  // dedupes by id and no-ops (false) if the item is already in the plan that
  // day — surfaced honestly rather than claiming a second add succeeded.
  // Undo mirrors handleRemove's pattern: remove the exact id just added.
  const handleAddSuggestion = useCallback((candidate) => {
    const dateKey = activeDay;
    const slotKey = suggestionsSlot;
    if (!slotKey) return;

    const item = toPlanItem(candidate);
    const added = addToSlot(dateKey, slotKey, item);
    if (!added) {
      showSnackbar('Already in plan');
      return;
    }
    showSnackbar(`Added — ${candidate.name}`, true, () => {
      removeFromSlot(dateKey, slotKey, item.id);
    });
  }, [showSnackbar, activeDay, suggestionsSlot]);

  // Task 10: display-only Day-label mode toggle (see planDates.js's NOTE) —
  // swaps whether each day chip's PRIMARY label is the weekday name or a
  // relative "Day N"; `nextSevenDays()` (called fresh in this render body,
  // below, and again inside SchedulerView's own render) picks up the new
  // stored mode as soon as this state change triggers a re-render. Never
  // touches which real calendar date backs any `plan.days[key]` entry.
  const handleToggleDayLabelMode = useCallback(() => {
    const next = dayLabelMode === 'dayNumber' ? 'calendar' : 'dayNumber';
    setDayLabelMode(next);
    setDayLabelModeState(next);
  }, [dayLabelMode]);

  // Task 8: save/load/delete named plan snapshots, capped at
  // MAX_SAVED_PLANS (config.js) — separate from saving an individual recipe
  // (SaveButton/library.js). All persistence lives in planBuilder.js's
  // saveCurrentPlan/getSavedPlans/loadSavedPlan/deleteSavedPlan (storage.js's
  // namespaced persistence wrapper); this screen just re-reads the list
  // after each mutation and surfaces a snackbar.
  const refreshSavedPlans = useCallback(() => setSavedPlans(getSavedPlans()), []);

  // Task C (#16): local mirror of planBuilder.js's `activeSavedPlan` storage
  // pointer — re-read after every mutation that can set/clear it (save,
  // update, load, delete-the-active-entry, plus the conditions-change/
  // new-plan purges threaded through the profile-load effect above and
  // `handlePlanGenerated` below).
  const refreshActiveSavedPlan = useCallback(() => setActiveSavedPlanState(getActiveSavedPlan()), []);

  // Task C (#16): whether the live plan has drifted from the saved entry it
  // traces back to. `null`/no active entry never reads as dirty — there's
  // nothing to compare against, and SavedPlansSheet's naming flow already
  // treats that as the save-as-new case. Recomputed only when `plan` or
  // `activeSavedPlan` actually change (`planFingerprint` walks the whole
  // plan, not free to run every render).
  const dirty = useMemo(
    () => !!activeSavedPlan && !!plan && planFingerprint(plan) !== activeSavedPlan.fingerprint,
    [plan, activeSavedPlan]
  );
  const activeSavedPlanName = activeSavedPlan
    ? savedPlans.find((p) => p.id === activeSavedPlan.id)?.name ?? null
    : null;

  const handleSavePlan = useCallback((name) => {
    const result = saveCurrentPlan(name);
    if (result.ok) {
      refreshSavedPlans();
      refreshActiveSavedPlan();
      showSnackbar(`Saved as "${result.entry.name}"`);
    } else if (result.reason === 'at-cap') {
      showSnackbar(`You can save up to ${MAX_SAVED_PLANS} plans — delete one first`);
    } else {
      showSnackbar('Nothing to save yet — build a plan first');
    }
  }, [refreshSavedPlans, refreshActiveSavedPlan, showSnackbar]);

  // Task A (#14)/B (#15): overwrite the ACTIVE saved entry in place — the
  // "Save"/"Update" action (header, the unsaved-changes banner, and
  // SavedPlansSheet's per-entry "Update"). No-op with a friendly snackbar if there's somehow no active
  // entry left (e.g. a race with it being deleted elsewhere).
  const handleUpdateActivePlan = useCallback(() => {
    if (!activeSavedPlan) return;
    const result = updateSavedPlan(activeSavedPlan.id);
    if (result.ok) {
      refreshSavedPlans();
      refreshActiveSavedPlan();
      showSnackbar('Saved');
    } else {
      showSnackbar('Could not save — try again');
    }
  }, [activeSavedPlan, refreshSavedPlans, refreshActiveSavedPlan, showSnackbar]);

  // Task A (#14): loading a saved plan REPLACES the live plan outright (same
  // whole-plan-overwrite contract `loadSavedPlan` always had). When the plan
  // being replaced has unsaved changes (`dirty`, Task C), this offers Undo
  // instead of a plain confirm — `window.confirm` would block and this
  // screen's `showSnackbar` already supports an Undo action everywhere else
  // (handleRemove/handleSwapSubstitute/handleAddSuggestion above). Undo
  // restores both the previous plan (`setPlan`) and the previous
  // active-saved-plan pointer (`restoreActiveSavedPlan`) so the two stay in
  // sync, exactly as they were before the load.
  const handleLoadSavedPlan = useCallback((id) => {
    const previousPlan = plan;
    const previousActive = activeSavedPlan;
    const wasDirty = dirty;

    const ok = loadSavedPlan(id);
    setSavedPlansOpen(false);
    refreshActiveSavedPlan();

    if (ok && profileRef.current) {
      // Refit already landed the snapshot on the current window (see
      // loadSavedPlan's doc) — this just fills any day the snapshot didn't
      // cover and re-runs the same ensure path every other mount/rebuild
      // uses, so the screen renders the loaded week immediately without
      // needing a remount.
      ensurePlanForWeek(profileRef.current).catch((err) => {
        console.error('MealQueueScreen: failed to refresh plan after loading saved plan', err);
      });
    }

    if (ok && wasDirty) {
      showSnackbar('Plan loaded — unsaved changes were replaced', true, () => {
        setPlan(previousPlan);
        restoreActiveSavedPlan(previousActive);
        refreshActiveSavedPlan();
      });
    } else {
      showSnackbar(ok ? 'Plan loaded' : 'Could not load that plan');
    }
  }, [showSnackbar, plan, activeSavedPlan, dirty, refreshActiveSavedPlan]);

  // Task A (#14): delete with Undo — restores the exact entry (id/name/
  // savedAt/plan preserved via `restoreSavedPlan`) and, if it was the active
  // entry, the active-saved-plan pointer too.
  const handleDeleteSavedPlan = useCallback((id) => {
    const entry = savedPlans.find((p) => p.id === id);
    const wasActive = activeSavedPlan?.id === id;
    const previousActive = activeSavedPlan;

    const ok = deleteSavedPlan(id);
    if (!ok) return;
    refreshSavedPlans();
    refreshActiveSavedPlan();

    if (!entry) return;
    showSnackbar(`Deleted "${entry.name}"`, true, () => {
      restoreSavedPlan(entry);
      if (wasActive) restoreActiveSavedPlan(previousActive);
      refreshSavedPlans();
      refreshActiveSavedPlan();
    });
  }, [savedPlans, activeSavedPlan, refreshSavedPlans, refreshActiveSavedPlan, showSnackbar]);

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
  // `generatePlanFromPicks` always clears the active-saved-plan pointer
  // internally (Task C/#16 — a freshly-picked week isn't an edit of
  // whatever was active before), so resync the local mirror here too.
  const handlePlanGenerated = useCallback(() => {
    setView('queue');
    setSelectedDay(todayKey());
    refreshActiveSavedPlan();
    showSnackbar('Meal plan created');
  }, [showSnackbar, refreshActiveSavedPlan]);

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
      // sourceUrl/attribution/nutritionPerServing/ingredients thread through
      // from the plan item/candidate onto the FoodDetailCard seed when
      // present (they flow from PlanCandidate — see api/types.js) —
      // `?? null`/`?? []` keeps this a no-op for sources that don't carry
      // them yet.
      const seed = {
        foodId: item.id,
        name: item.name,
        image: item.image,
        sourceName: item.sourceName ?? null,
        sourceUrl: item.sourceUrl ?? null,
        attribution: item.attribution ?? null,
        nutritionPerServing: item.nutritionPerServing ?? null,
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
  const plusIcon = <Plus size={16} className="text-forest-700" aria-hidden="true" />;

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
        right={
          /* Help + Saved plans (always available) + print/share (T4C,
             plan-gated) — all live in the header's top-right corner so they
             never share a row with the view switcher or day strip below
             (both horizontally scrollable). Print/share stay hidden with no
             plan yet (nothing honest to print/share); Help/Saved plans have
             no such dependency — Saved plans is a way to LOAD a previous
             week even during the first-run empty state, and Help documents
             Cookbook-only controls usable before a plan exists too. */
          <div className="flex items-center gap-2 shrink-0 -mt-3 -mr-1">
            <button
              type="button"
              onClick={() => setHowToUseOpen(true)}
              aria-label="How to use this screen"
              className="inline-flex items-center justify-center w-11 h-11 rounded-full
                bg-white/40 hover:bg-white/60 text-blue-950/70 shadow-sm
                transition-all duration-fast active:scale-95"
            >
              <HelpCircle size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setSavedPlansOpen(true)}
              aria-label={dirty ? 'Saved plans — unsaved changes' : 'Saved plans'}
              className="relative inline-flex items-center justify-center w-11 h-11 rounded-full
                bg-white/40 hover:bg-white/60 text-blue-950/70 shadow-sm
                transition-all duration-fast active:scale-95"
            >
              <Bookmark size={18} aria-hidden="true" />
              {/* Task C (#16): unsaved-changes indicator — small dot, same
                  pattern as ProfileScreen's SubEditRow `dot` badge. */}
              {dirty && (
                <span
                  aria-hidden="true"
                  className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-avoid-700 ring-2 ring-forest-300"
                />
              )}
            </button>
            {plan && (
              <>
                <button
                  type="button"
                  onClick={handlePrint}
                  aria-label="Print meal plan"
                  className="inline-flex items-center justify-center w-11 h-11 rounded-full
                    bg-white/40 hover:bg-white/60 text-blue-950/70 shadow-sm
                    transition-all duration-fast active:scale-95"
                >
                  <Printer size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  aria-label="Share meal plan"
                  className="inline-flex items-center justify-center w-11 h-11 rounded-full
                    bg-white/40 hover:bg-white/60 text-blue-950/70 shadow-sm
                    transition-all duration-fast active:scale-95"
                >
                  <Share2 size={18} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        }
      />

      {/* ── Paper panel ──────────────────────────────────────────────────
          Same solid white container SuggestionsScreen (Best & Worst Choices)
          and Home use under their headers: full-bleed, rounded top corners
          only, own background + inner padding, soft upward shadow lifting it
          off the green page. Its pb-28 both clears the floating TabBar and
          paints paper behind it (appshell-cream-fix). Now also encapsulates
          the view switcher + day strip, so the whole Day/Week/Saved-recipes
          control surface reads as one panel instead of straddling the green
          header and the white body. ─────────────────────────────────────── */}
      <div className="flex-1 bg-paper-100 rounded-t-2xl px-5 pt-5 pb-28 shadow-[0_-2px_16px_rgba(45,36,24,0.05)] flex flex-col gap-8 mt-4 rm-print-hide">
        <div className="flex flex-col gap-4">
          <PillSwitcher options={VIEW_OPTIONS} value={view} onChange={handleToggleView} trackClassName="bg-white" />

          {view === 'queue' && !firstRunEmpty && (
            <>
              {/* The read-only week-range chip that used to label the strip is
                  gone (2026-09) — the strip's own dates already say which
                  window this is, and the extra row cost vertical space above
                  the fold. The week-start CHOICE lives in MealPlannerPicker.
                  All that can render here now is the display-only day-label
                  toggle, itself hidden — see SHOW_DAY_LABEL_TOGGLE. */}
              {SHOW_DAY_LABEL_TOGGLE && (
                <div className="flex items-center justify-end">
                  <button
                    onClick={handleToggleDayLabelMode}
                    className="shrink-0 text-xs font-semibold font-sans
                      text-blue-950/50 hover:text-blue-950/70 transition-colors duration-fast"
                  >
                    {dayLabelMode === 'dayNumber' ? 'Show calendar days' : 'Show Day 1–7'}
                  </button>
                </div>
              )}

              <DayStrip days={days} selected={activeDay} onSelect={handleSelectDay} bgClassName="bg-paper-100" />
            </>
          )}
        </div>

        {view === 'queue' ? (
          firstRunEmpty ? (
            <EmptyState
              icon="calendar"
              title="No meal plan yet"
              size="lg"
              iconBgClassName="bg-blue-50"
              iconClassName="text-blue-950"
              action={
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={() => setPickerOpen(true)}
                    className="inline-flex items-center gap-2 rounded-pill bg-blue-950 text-white
                      text-base font-semibold font-sans px-7 py-3.5
                      hover:bg-blue-900 active:scale-[0.99] transition-all duration-fast"
                  >
                    <CalendarPlus size={19} aria-hidden="true" />
                    Build my meal plan
                  </button>

                  {library.length > 0 && (
                    <button
                      onClick={handleBuildFromSaved}
                      disabled={buildingFromSaved}
                      className="text-sm font-semibold font-sans text-blue-950/70 hover:text-blue-950
                        transition-colors duration-fast disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {buildingFromSaved ? 'Building…' : 'Build from saved recipes'}
                    </button>
                  )}
                </div>
              }
            />
          ) : (
            <div className="flex flex-col gap-4">
              {/* Task C (#16): unsaved-changes banner — a clear, dismissable-
                  by-action alternative to the header dot alone, since a
                  small badge is easy to miss. Only shown once there's an
                  active saved entry to name and drift to report. */}
              {dirty && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3">
                  <p className="text-xs font-sans text-blue-950/80 leading-snug min-w-0">
                    Unsaved changes to &ldquo;{activeSavedPlanName ?? 'your plan'}&rdquo;
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleUpdateActivePlan}
                      className="rounded-pill bg-blue-950 text-white text-xs font-semibold font-sans px-3 py-1.5
                        hover:bg-blue-900 active:scale-[0.99] transition-all duration-fast"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setSavedPlansOpen(true)}
                      className="text-xs font-semibold font-sans text-blue-950/70 hover:text-blue-950
                        transition-colors duration-fast"
                    >
                      Save as new
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-start justify-between gap-3">
                <CalorieLine slots={daySlots} />
                <button
                  onClick={handleRegenerateDay}
                  disabled={showGhost || regeneratingDay}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-pill bg-white hover:bg-sand-100
                    px-3 py-1.5 text-xs font-semibold text-blue-950/70 transition-all duration-fast
                    ${showGhost || regeneratingDay ? 'opacity-40 pointer-events-none' : 'active:scale-95'}`}
                >
                  <RotateCw size={13} className={regeneratingDay ? 'animate-spin' : ''} aria-hidden="true" />
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
                      onOpenSuggestions={setSuggestionsSlot}
                      ghost={showGhost}
                      shuffling={shufflingSlot === slot.key}
                      onSaveBlocked={showSnackbar}
                    />
                  ))}
                </motion.div>
              </AnimatePresence>

              {/* Week-level regenerate — discoverable but not dominant.
                  `pb-16` (on top of the panel's own `pb-28`) lifts this clear
                  of the fixed "New meal plan" FAB, which floats
                  bottom-[88px]..~132px above the viewport bottom — without
                  it, this button's own line lands inside that band and the
                  FAB (rendered later, z-50) visually sits on top of and
                  intercepts taps meant for it. */}
              <div className="flex justify-center pt-2 pb-16">
                <button
                  onClick={handleRegenerateWeek}
                  disabled={showGhost || regeneratingWeek}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold font-sans
                    text-blue-950/50 hover:text-blue-950/70 transition-colors duration-fast
                    ${showGhost || regeneratingWeek ? 'opacity-40 pointer-events-none' : ''}`}
                >
                  <RefreshCw size={12} className={regeneratingWeek ? 'animate-spin' : ''} aria-hidden="true" />
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
                  trackClassName="bg-white"
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
                        onSelect={handleSelect}
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
                  onSelect={handleSelect}
                  onBlocked={(msg) => showSnackbar(msg)}
                  emptyMessage="No saved recipes yet — save recipes as you browse."
                  emptyAction={{ label: 'Browse recipes', onClick: () => navigate('/app/recipes') }}
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
      </div>

      {/* ── New meal plan FAB — opens the recipe-picker overlay. Hidden during
          the first-run empty state (`firstRunEmpty`), where the empty-state's
          own "Build my meal plan" button is the only CTA — a first-time user
          would otherwise see two buttons doing the identical
          `setPickerOpen(true)`. Visible everywhere else a plan already
          exists, where "New meal plan" correctly means "replace the current
          one". Bottom offset mirrors the Snackbar's so it clears the navbar.
          `data-print-hide`: a plain UI control, not content — never belongs
          on a printed page. ─────────────────────────────────────────────── */}
      {!firstRunEmpty && (
        <div className="fixed right-5 bottom-[88px] z-50 flex flex-col items-end gap-2" data-print-hide>
          <button
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-2
              rounded-pill bg-blue-950 text-white px-4 py-3 shadow-lg
              font-sans text-sm font-semibold transition-all duration-fast
              hover:bg-blue-900 active:scale-95"
          >
            <CalendarPlus size={16} aria-hidden="true" />
            New meal plan
          </button>
        </div>
      )}

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

      {/* ── How to Use (help) ──────────────────────────────────────────────── */}
      <div data-print-hide>
        <HowToUseSheet
          open={howToUseOpen}
          onClose={() => setHowToUseOpen(false)}
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

      {/* ── Suggestions (Task 11, formerly "Substitutions" — per-slot, see
          SlotSection's text link) ─────────────────────────────────────── */}
      <div data-print-hide>
        <SuggestionsSheet
          open={!!suggestionsSlot}
          onClose={() => setSuggestionsSlot(null)}
          slot={PLAN_SLOTS.find((s) => s.key === suggestionsSlot) ?? null}
          sourceItems={daySlots[suggestionsSlot] ?? []}
          profile={profile}
          onSelect={handleSelect}
          onSwap={handleSwapSubstitute}
          onAdd={handleAddSuggestion}
        />
      </div>

      {/* ── Saved plans (Task 8) ────────────────────────────────────────── */}
      <div data-print-hide>
        <SavedPlansSheet
          open={savedPlansOpen}
          onClose={() => setSavedPlansOpen(false)}
          hasActivePlan={!!plan}
          savedPlans={savedPlans}
          activeSavedPlanId={activeSavedPlan?.id ?? null}
          onSave={handleSavePlan}
          onUpdate={handleUpdateActivePlan}
          onLoad={handleLoadSavedPlan}
          onDelete={handleDeleteSavedPlan}
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
            <h1 className="plan-print-title">My Remedi Meal Plan</h1>
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
