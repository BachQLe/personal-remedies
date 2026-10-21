/**
 * MealQueueScreen - "Your week": the plan's day view. Pick favorites once
 * (My Favorites), then New meal plan builds a week from them in one tap. The
 * week card holds the day strip plus New meal plan, Save week and Load week.
 * Each day lists its meals with + (add a favorite) and X (remove); Save day /
 * Load day sit next to the day's calories at the top of the day. My Meal Plan /
 * My Favorites tabs on top. No calendars, no shuffling, no regenerating.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Printer, Share2, HelpCircle, CalendarPlus, Bookmark, ArrowRight, FolderOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/shared/PageHeader.jsx';
import EmptyState from '../../components/shared/EmptyState.jsx';
import DataState, { SlowLoadingNote } from '../../components/shared/DataState.jsx';
import RequireEntitlement from '../../components/shared/RequireEntitlement.jsx';
import FoodDetailCard from '../../components/FoodDetailCard.jsx';
import { useSnackbar } from '../../context/SnackbarContext.jsx';
import { useSavedLists } from '../favorites/useSavedLists.js';
import { useRecipeDetail } from '../favorites/useRecipeDetail.js';
import { useOnline, planLoadState } from './usePlanLoadState.js';
import SlotSection from './SlotSection.jsx';
import DayStrip from './DayStrip.jsx';
import PlanTabs from './PlanTabs.jsx';
import HowToUseSheet from './HowToUseSheet.jsx';
import SuggestionsSheet from './SuggestionsSheet.jsx';
import CalorieGapSheet from './CalorieGapSheet.jsx';
import NewPlanSheet from './NewPlanSheet.jsx';
import NameSheet from './NameSheet.jsx';
import LoadSavedSheet from './LoadSavedSheet.jsx';
import AddFavoriteSheet from './AddFavoriteSheet.jsx';
import { COPY } from './plannerCopy.js';
import { nextSevenDays, todayKey } from './planDates.js';
import {
  getProfile,
  ensurePlanForWeek,
  generateWeekFromFavorites,
  favoritesBySlot,
  toPlanItem,
  saveCurrentPlan,
  updateSavedPlan,
  loadSavedPlan,
  planFingerprint,
  restoreActiveSavedPlan,
  saveDay,
  loadSavedDay,
  isFavoritesPrunePending,
} from '../../api/api.js';
import { estimatePlanDayCalories, formatCalories } from '../../api/calorieNeeds.js';
import { formatWeekPlanText, buildPrintModel } from '../../api/planExport.js';
import { printPage, share } from '../../api/browser.js';
import { PLAN_SLOTS, MAX_SAVED_PLANS, MAX_SAVED_DAYS } from '../../api/config.js';
import { getPlan, setPlan, subscribePlan, addToSlot, removeFromSlot, insertIntoSlot } from '../../state/dailyPlan.js';
import { getLibrary, subscribeLibrary } from '../../state/library.js';
import { GHOST_PLAN } from '../../api/ghostData.js';

const calmSpring = { type: 'spring', stiffness: 120, damping: 22, mass: 1 };

// Direction-aware day-pager slide. `custom` (the pager direction, +-1) reaches
// these variant FUNCTIONS through AnimatePresence.
const daySlideVariants = {
  enter: (dir) => ({ x: dir >= 0 ? 36 : -36, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir >= 0 ? -36 : 36, opacity: 0 }),
};

// Stable empty array for `displayPlan?.conditionNames ?? ...` (a fresh `[]`
// would change identity every render).
const EMPTY_CONDITION_NAMES = [];

// Fraction of the calorie target below which a freshly built week gets the gap sheet.
const CALORIE_GAP_RATIO = 0.8;

const ICON_BTN =
  'inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/40 hover:bg-white/60 ' +
  'text-blue-950/70 shadow-sm transition duration-fast active:scale-95';

/** The plan-day calorie total (sits in the day action card), hidden when nothing is countable. */
function CalorieLine({ slots }) {
  const { total } = estimatePlanDayCalories(slots);
  if (total <= 0) return null;

  return (
    <p className="whitespace-nowrap pl-4 font-sans text-sm font-semibold text-blue-950/70">
      {`${formatCalories(total)} cal`}
    </p>
  );
}

export default function MealQueueScreen() {
  const { show } = useSnackbar();
  const [plan, setPlanState] = useState(getPlan);
  const [library, setLibrary] = useState(getLibrary);
  const { days: savedDays, weeks: savedWeeks, active: activeSavedPlan } = useSavedLists();
  const [building, setBuilding] = useState(() => getPlan() == null);
  const [loadError, setLoadError] = useState(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const online = useOnline();
  const [profile, setProfile] = useState(null);
  const [selectedDay, setSelectedDay] = useState(todayKey());
  const [pagerDirection, setPagerDirection] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [gap, setGap] = useState(null);
  const [howToUseOpen, setHowToUseOpen] = useState(false);
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [saveWeekOpen, setSaveWeekOpen] = useState(false);
  const [saveDayOpen, setSaveDayOpen] = useState(false);
  const [loadDayOpen, setLoadDayOpen] = useState(false);
  const [loadWeekOpen, setLoadWeekOpen] = useState(false);
  const [addSlotKey, setAddSlotKey] = useState(null);
  const [suggestionsSlot, setSuggestionsSlot] = useState(null);

  const days = nextSevenDays();
  const dayKeys = days.map((d) => d.key);

  // The toast lives in the app shell; this keeps the (message, canUndo, undoFn) call shape.
  const showSnackbar = useCallback(
    (message, canUndo = false, undoFn = null) =>
      show(message, canUndo ? { actionLabel: 'Undo', onAction: undoFn } : {}),
    [show]
  );

  useEffect(() => {
    const unsubP = subscribePlan(setPlanState);
    const unsubL = subscribeLibrary(setLibrary);
    return () => { unsubP(); unsubL(); };
  }, []);

  // Load the profile (real conditions only) and keep this week's window full.
  // A failure leaves the plan as-is rather than fabricating anything.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getProfile();
        const fullProfile = { ...(p ?? {}), conditions: p?.conditions ?? [] };
        if (cancelled) return;
        setProfile(fullProfile);
        await ensurePlanForWeek(fullProfile);
      } catch (err) {
        console.error('MealQueueScreen: failed to load plan', err);
        if (!cancelled) setLoadError(err || new Error('failed to load plan'));
      } finally {
        if (!cancelled) setBuilding(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadAttempt]);

  const handleRetryLoad = useCallback(() => {
    setLoadError(null);
    setBuilding(true);
    setLoadAttempt((n) => n + 1);
  }, []);

  // The window rolls forward at local midnight; a stale selection falls back to today.
  const activeDay = dayKeys.includes(selectedDay) ? selectedDay : todayKey();

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

  // Ghost mode: only while there is genuinely no plan to show yet.
  const showGhost = building && !plan;
  const displayPlan = showGhost ? GHOST_PLAN : plan;
  const conditionNames = displayPlan?.conditionNames ?? EMPTY_CONDITION_NAMES;
  const daySlots = displayPlan?.days?.[activeDay]?.slots ?? {};

  // No plan once the profile has loaded: first-run empty state.
  const firstRunEmpty = !building && !plan;
  const noFavorites = library.length === 0;

  // Print view model from the REAL plan only, never ghost data.
  const printModel = plan ? buildPrintModel(plan, { conditionNames }) : null;

  const { detail, open: openRecipe, close: closeRecipe } = useRecipeDetail(conditionNames);

  // Remove a card from its meal, with Undo restoring it at the same index.
  const handleRemove = useCallback((slotKey, item) => {
    const dateKey = activeDay;
    const idx = removeFromSlot(dateKey, slotKey, item.id);
    showSnackbar(COPY.removed, true, () => insertIntoSlot(dateKey, slotKey, item, idx));
  }, [showSnackbar, activeDay]);

  // The + tile: add one of the user's favorites to the open meal.
  const handleAddFavorite = useCallback((item) => {
    const dateKey = activeDay;
    const slotKey = addSlotKey;
    const planItem = toPlanItem(item);
    setAddSlotKey(null);
    if (!addToSlot(dateKey, slotKey, planItem)) {
      showSnackbar(COPY.alreadyInDay);
      return;
    }
    showSnackbar(COPY.added(item.name), true, () => removeFromSlot(dateKey, slotKey, planItem.id));
  }, [showSnackbar, activeDay, addSlotKey]);

  // Suggestions (parked behind SHOW_SUGGESTIONS in SlotSection): swap a
  // substitute in for an item, or add a candidate to the open meal.
  const handleSwapSubstitute = useCallback((originalItem, substitute) => {
    const dateKey = activeDay;
    const slotKey = suggestionsSlot;
    if (!slotKey) return;

    const index = removeFromSlot(dateKey, slotKey, originalItem.id);
    const convertedItem = toPlanItem(substitute);
    insertIntoSlot(dateKey, slotKey, convertedItem, index);

    showSnackbar(`Swapped in - ${substitute.name}`, true, () => {
      removeFromSlot(dateKey, slotKey, convertedItem.id);
      insertIntoSlot(dateKey, slotKey, originalItem, index);
    });
  }, [showSnackbar, activeDay, suggestionsSlot]);

  const handleAddSuggestion = useCallback((candidate) => {
    const dateKey = activeDay;
    const slotKey = suggestionsSlot;
    if (!slotKey) return;

    const item = toPlanItem(candidate);
    if (!addToSlot(dateKey, slotKey, item)) {
      showSnackbar(COPY.alreadyInDay);
      return;
    }
    showSnackbar(COPY.added(candidate.name), true, () => removeFromSlot(dateKey, slotKey, item.id));
  }, [showSnackbar, activeDay, suggestionsSlot]);

  // ── Saved week ─────────────────────────────────────────────────────────────

  // Whether the live plan has drifted from the saved week it traces back to.
  const dirty = useMemo(
    () => !!activeSavedPlan && !!plan && planFingerprint(plan) !== activeSavedPlan.fingerprint,
    [plan, activeSavedPlan]
  );
  const activeSavedPlanName = activeSavedPlan
    ? savedWeeks.find((p) => p.id === activeSavedPlan.id)?.name ?? null
    : null;

  const handleSaveWeek = useCallback((name) => {
    const result = saveCurrentPlan(name);
    setSaveWeekOpen(false);
    if (result.ok) showSnackbar(COPY.weekSaved(result.entry.name));
    else showSnackbar(result.reason === 'at-cap' ? COPY.weekCap(MAX_SAVED_PLANS) : COPY.nothingToSave);
  }, [showSnackbar]);

  // Overwrite the saved week the live plan came from (sheet and unsaved-changes banner).
  const handleUpdateWeek = useCallback(() => {
    if (!activeSavedPlan) return;
    const result = updateSavedPlan(activeSavedPlan.id);
    setSaveWeekOpen(false);
    showSnackbar(result.ok ? COPY.weekUpdated : COPY.couldNotSave);
  }, [activeSavedPlan, showSnackbar]);

  // Loading a saved week REPLACES the live plan; Undo puts the old one back.
  const handleLoadWeek = useCallback((id) => {
    const previousPlan = plan;
    const previousActive = activeSavedPlan;
    const wasDirty = dirty;

    const ok = loadSavedPlan(id);
    setNewPlanOpen(false);
    setLoadWeekOpen(false);
    if (!ok) {
      // loadSavedPlan also returns false while a profile-change prune is pending.
      showSnackbar(isFavoritesPrunePending() ? COPY.prunePending : COPY.couldNotLoad);
      return;
    }
    setSelectedDay(todayKey());
    // Fill any day the saved week did not cover.
    if (profile) {
      ensurePlanForWeek(profile).catch((err) => {
        console.error('MealQueueScreen: failed to refresh plan after loading a week', err);
      });
    }
    showSnackbar(
      wasDirty ? COPY.weekLoadedReplaced : COPY.weekLoaded,
      !!previousPlan,
      () => {
        setPlan(previousPlan);
        restoreActiveSavedPlan(previousActive);
      }
    );
  }, [plan, activeSavedPlan, dirty, profile, showSnackbar]);

  // ── New meal plan: randomize from favorites ────────────────────────────────

  // Builds a week, lands on today, and runs the calorie-gap check exactly once.
  const handleRandomize = useCallback(async () => {
    if (generating) return;
    const previousPlan = plan;
    const previousActive = activeSavedPlan;
    setGenerating(true);
    try {
      const result = await generateWeekFromFavorites(profile, library);
      setNewPlanOpen(false); // sheets sit above the toast, so close first
      if (!result.ok) {
        showSnackbar(result.reason === 'prune-pending' ? COPY.prunePending : COPY.noFavorites);
        return;
      }
      setSelectedDay(todayKey());
      const announce = () => showSnackbar(COPY.planCreated, !!previousPlan, () => {
        setPlan(previousPlan);
        restoreActiveSavedPlan(previousActive);
      });

      // The gap sheet fires only here, once per creation. Its toast waits for
      // the sheet to close so the two never overlap.
      const need = profile.calorieTarget ?? 2000;
      const { total } = estimatePlanDayCalories(result.plan.days[todayKey()]?.slots);
      if (total < need * CALORIE_GAP_RATIO) setGap({ need, total, announce });
      else announce();
    } catch (err) {
      console.error('MealQueueScreen: randomize from favorites failed', err);
      setNewPlanOpen(false);
      showSnackbar(COPY.couldNotBuild);
    } finally {
      setGenerating(false);
    }
  }, [generating, plan, activeSavedPlan, profile, library, showSnackbar]);

  // ── Saved day ──────────────────────────────────────────────────────────────

  const handleSaveDay = useCallback((name) => {
    const result = saveDay(activeDay, name);
    setSaveDayOpen(false);
    if (result.ok) showSnackbar(COPY.daySaved(result.entry.name));
    else showSnackbar(result.reason === 'at-cap' ? COPY.dayCap(MAX_SAVED_DAYS) : COPY.nothingToSave);
  }, [activeDay, showSnackbar]);

  // Loading a saved day REPLACES the day being viewed; Undo puts it back.
  const handleLoadDay = useCallback((entry) => {
    const dateKey = activeDay;
    const previousDay = plan?.days?.[dateKey];
    const result = loadSavedDay(entry.id, dateKey);
    setLoadDayOpen(false);
    if (!result.ok) {
      showSnackbar(result.reason === 'prune-pending' ? COPY.prunePending : COPY.couldNotLoad);
      return;
    }
    showSnackbar(COPY.dayLoaded(entry.name), true, () => {
      const current = getPlan();
      if (current && previousDay) setPlan({ ...current, days: { ...current.days, [dateKey]: previousDay } });
    });
  }, [activeDay, plan, showSnackbar]);

  // ── Print & share the whole week (foods only, never a calorie tally) ──────

  const handleShare = useCallback(async () => {
    if (!plan) return;
    const text = formatWeekPlanText(plan, { conditionNames });
    const result = await share({ title: 'My Personal Remedies meal plan', text });
    if (!result.ok) showSnackbar(COPY.couldNotShare);
    else if (result.method === 'clipboard') showSnackbar(COPY.copied);
    // method === 'share': the native sheet is its own confirmation.
  }, [plan, conditionNames, showSnackbar]);

  // The + tile's sheet: this meal's favorites minus what the day already has.
  const addSlot = PLAN_SLOTS.find((s) => s.key === addSlotKey) ?? null;
  const addPool = addSlot ? favoritesBySlot(library)[addSlot.key] : [];
  const idsInDay = new Set(Object.values(daySlots).flat().map((i) => i.id));

  return (
    <div className="bg-forest-300 flex flex-col min-h-screen -mb-28 rm-plan-print-root">

      {/* Header zone. `rm-print-hide` hides it under @media print; only
          `.plan-print-view` (bottom of this file) renders on paper. */}
      <PageHeader
        label={COPY.planLabel}
        title="My Meal Plan"
        className="bg-forest-300 rm-print-hide"
        right={
          <div className="flex items-center gap-2 shrink-0 -mt-3 -mr-1">
            <button
              type="button"
              onClick={() => setHowToUseOpen(true)}
              aria-label="How to use this screen"
              className={ICON_BTN}
            >
              <HelpCircle size={18} aria-hidden="true" />
            </button>
            {plan && (
              <>
                <button type="button" onClick={() => printPage()} aria-label="Print meal plan" className={ICON_BTN}>
                  <Printer size={18} aria-hidden="true" />
                </button>
                <button type="button" onClick={handleShare} aria-label="Share meal plan" className={ICON_BTN}>
                  <Share2 size={18} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        }
      />

      {/* White paper panel: full-bleed, rounded top corners; its pb-28 clears
          the floating TabBar and paints paper behind it. */}
      <div className="flex-1 bg-paper-100 rounded-t-2xl px-5 pt-5 pb-28 shadow-[0_-2px_16px_rgba(45,36,24,0.05)] flex flex-col gap-8 mt-4 rm-print-hide">
        <PlanTabs value="/app/plan" />

        {!firstRunEmpty && (
          <div className="flex flex-col gap-2 rounded-2xl bg-white p-2">
            <DayStrip days={days} selected={activeDay} onSelect={handleSelectDay} bgClassName="bg-white" />
            <div className="flex flex-col gap-2 border-t border-blue-950/[0.06] pt-2">
              <button
                type="button"
                onClick={() => setNewPlanOpen(true)}
                className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-pill bg-blue-950 px-4
                  font-sans text-sm font-semibold text-white transition duration-fast hover:bg-blue-900 active:scale-[0.99]"
              >
                <CalendarPlus size={16} aria-hidden="true" />
                {COPY.newPlan}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSaveWeekOpen(true)}
                  disabled={showGhost}
                  className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-pill bg-paper-100 px-4 font-sans text-sm
                    font-semibold text-blue-950 transition duration-fast active:scale-95
                    ${showGhost ? 'pointer-events-none opacity-40' : 'hover:bg-sand-100'}`}
                >
                  <Bookmark size={16} aria-hidden="true" />
                  {COPY.saveWeek}
                </button>
                <button
                  type="button"
                  onClick={() => setLoadWeekOpen(true)}
                  disabled={showGhost}
                  className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-pill bg-paper-100 px-4 font-sans text-sm
                    font-semibold text-blue-950 transition duration-fast active:scale-95
                    ${showGhost ? 'pointer-events-none opacity-40' : 'hover:bg-sand-100'}`}
                >
                  <FolderOpen size={16} aria-hidden="true" />
                  {COPY.loadWeekButton}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Offline with a plan on screen: the plan is local data and stays usable. */}
        {!online && plan && <DataState status="offline-cached" />}

        {firstRunEmpty && loadError ? (
          <DataState
            status={planLoadState({ loading: false, hasData: false, error: loadError, online })}
            onRetry={handleRetryLoad}
            screenName="meal plan"
          />
        ) : firstRunEmpty ? (
          <EmptyState
            icon="calendar"
            title={COPY.firstRunTitle}
            body={COPY.firstRunBody}
            size="lg"
            iconBgClassName="bg-blue-50"
            iconClassName="text-blue-950"
            action={
              <div className="flex flex-col items-center gap-1">
                {noFavorites ? (
                  <>
                    <Link
                      to="/app/favorites"
                      className="inline-flex min-h-[48px] items-center gap-2 rounded-pill bg-blue-950 px-7 py-3.5 font-sans text-base
                    font-semibold text-white transition duration-fast hover:bg-blue-900 active:scale-[0.99]"
                    >
                      <Bookmark size={19} aria-hidden="true" />
                      {COPY.pickFavoritesCta}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setNewPlanOpen(true)}
                      className="inline-flex min-h-[44px] items-center gap-1.5 font-sans text-sm font-semibold text-blue-950/70
                    transition-colors duration-fast hover:text-blue-950"
                    >
                      {COPY.firstRunCta}
                      <ArrowRight size={14} aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setNewPlanOpen(true)}
                      className="inline-flex min-h-[48px] items-center gap-2 rounded-pill bg-blue-950 px-7 py-3.5 font-sans text-base
                    font-semibold text-white transition duration-fast hover:bg-blue-900 active:scale-[0.99]"
                    >
                      <CalendarPlus size={19} aria-hidden="true" />
                      {COPY.firstRunCta}
                    </button>
                    <Link
                      to="/app/favorites"
                      className="inline-flex min-h-[44px] items-center gap-1.5 font-sans text-sm font-semibold text-blue-950/70
                    transition-colors duration-fast hover:text-blue-950"
                    >
                      {COPY.stepPick}
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </>
                )}
              </div>
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            {/* Unsaved-changes banner: shown once the live week has drifted from the saved week it came from. */}
            {dirty && (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3">
                <p className="min-w-0 font-sans text-xs leading-snug text-blue-950/80">
                  {COPY.unsavedChanges(activeSavedPlanName ?? 'your plan')}
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={handleUpdateWeek}
                    className="min-h-[44px] rounded-pill bg-blue-950 px-4 font-sans text-xs font-semibold text-white
                      transition duration-fast hover:bg-blue-900 active:scale-[0.99]"
                  >
                    {COPY.save}
                  </button>
                  <button
                    onClick={() => setSaveWeekOpen(true)}
                    className="min-h-[44px] px-2 font-sans text-xs font-semibold text-blue-950/70
                      transition-colors duration-fast hover:text-blue-950"
                  >
                    {COPY.saveAsNew}
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white p-2">
              <CalorieLine slots={daySlots} />
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSaveDayOpen(true)}
                  disabled={showGhost}
                  className={`tap-target inline-flex min-h-[36px] items-center gap-1.5 rounded-pill bg-paper-100 px-3 font-sans text-xs
                    font-semibold text-blue-950 transition duration-fast active:scale-95
                    ${showGhost ? 'pointer-events-none opacity-40' : 'hover:bg-sand-100'}`}
                >
                  <Bookmark size={14} aria-hidden="true" />
                  {COPY.saveDay}
                </button>
                <button
                  type="button"
                  onClick={() => setLoadDayOpen(true)}
                  disabled={showGhost}
                  className={`tap-target inline-flex min-h-[36px] items-center gap-1.5 rounded-pill bg-paper-100 px-3 font-sans text-xs
                    font-semibold text-blue-950 transition duration-fast active:scale-95
                    ${showGhost ? 'pointer-events-none opacity-40' : 'hover:bg-sand-100'}`}
                >
                  <FolderOpen size={14} aria-hidden="true" />
                  {COPY.loadDay}
                </button>
              </div>
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
                    onSelect={openRecipe}
                    onRemove={handleRemove}
                    onAdd={setAddSlotKey}
                    onOpenSuggestions={setSuggestionsSlot}
                    ghost={showGhost}
                    onSaveBlocked={showSnackbar}
                  />
                ))}
              </motion.div>
            </AnimatePresence>

            {showGhost && <SlowLoadingNote />}
          </div>
        )}
      </div>

      <div data-print-hide>
        <FoodDetailCard item={detail} open={!!detail} onClose={closeRecipe} />

        <HowToUseSheet open={howToUseOpen} onClose={() => setHowToUseOpen(false)} />

        {newPlanOpen && (
          <NewPlanSheet
            favorites={library}
            weeks={savedWeeks}
            ready={!!profile}
            generating={generating}
            onRandomize={handleRandomize}
            onLoadWeek={handleLoadWeek}
            onClose={() => setNewPlanOpen(false)}
          />
        )}

        {gap && (
          <CalorieGapSheet
            need={gap.need}
            total={gap.total}
            onClose={() => { gap.announce(); setGap(null); }}
            onAddMore={() => setGap(null)}
          />
        )}

        {addSlot && (
          <AddFavoriteSheet
            slot={addSlot}
            options={addPool.filter((item) => !idsInDay.has(item.id))}
            hasAny={addPool.length > 0}
            onAdd={handleAddFavorite}
            onClose={() => setAddSlotKey(null)}
          />
        )}

        {saveDayOpen && (
          <NameSheet
            title={COPY.nameDayTitle}
            placeholder={`Day ${savedDays.length + 1}`}
            onSubmit={handleSaveDay}
            onClose={() => setSaveDayOpen(false)}
          />
        )}

        {loadDayOpen && (
          <LoadSavedSheet kind="day" entries={savedDays} onPick={handleLoadDay} onClose={() => setLoadDayOpen(false)} />
        )}

        {loadWeekOpen && (
          <LoadSavedSheet
            kind="week"
            entries={savedWeeks}
            onPick={(entry) => handleLoadWeek(entry.id)}
            onClose={() => setLoadWeekOpen(false)}
          />
        )}

        {saveWeekOpen && (
          <RequireEntitlement feature="saved_plans" variant="sheet" open onClose={() => setSaveWeekOpen(false)}>
            <NameSheet
              title={COPY.nameWeekTitle}
              placeholder={`Plan ${savedWeeks.length + 1}`}
              onSubmit={handleSaveWeek}
              onClose={() => setSaveWeekOpen(false)}
              updateName={activeSavedPlanName ?? undefined}
              onUpdate={handleUpdateWeek}
            />
          </RequireEntitlement>
        )}

        {/* Suggestions: parked behind SHOW_SUGGESTIONS in SlotSection. */}
        <SuggestionsSheet
          open={!!suggestionsSlot}
          onClose={() => setSuggestionsSlot(null)}
          slot={PLAN_SLOTS.find((s) => s.key === suggestionsSlot) ?? null}
          sourceItems={daySlots[suggestionsSlot] ?? []}
          profile={profile}
          onSelect={openRecipe}
          onSwap={handleSwapSubstitute}
          onAdd={handleAddSuggestion}
        />
      </div>

      {/* Print view: always in the DOM so printed content never lags a stale
          render, invisible on screen (`.plan-print-view` in index.css), shown
          ONLY under @media print. Foods only, no calories, no images. */}
      <section className="plan-print-view" aria-hidden="true">
        {printModel && (
          <>
            <h1 className="plan-print-title">My Personal Remedies Meal Plan</h1>
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

            <p className="plan-print-footer">Generated by Personal Remedies — not medical advice</p>
          </>
        )}
      </section>
    </div>
  );
}
