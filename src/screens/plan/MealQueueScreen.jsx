import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, BookmarkPlus, ArrowRight, RotateCw, RefreshCw, CalendarPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/shared/Icon.jsx';
import PageHeader from '../../components/shared/PageHeader.jsx';
import GlassPanel from '../../components/shared/GlassPanel.jsx';
import PillSwitcher from '../../components/shared/PillSwitcher.jsx';
import FoodImageCard from '../../components/shared/FoodImageCard.jsx';
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
} from '../../api/api.js';
import { numericIdToStars } from '../../api/adapter.js';
import { estimateDailyNeed, estimatePlanDayCalories } from '../../api/calorieNeeds.js';
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

/**
 * The plan-day calorie line — the ONE quiet piece of numeric context this
 * screen shows (never a badge, never a bar, never per-food). Omits itself
 * entirely when nothing is countable (`total <= 0`) rather than show "~0".
 */
function CalorieLine({ slots, need, onAddDetails }) {
  const { total, uncounted } = estimatePlanDayCalories(slots);
  if (total <= 0) return null;

  const partial = uncounted > 0 ? ' (partial — recipes not counted)' : '';

  return (
    <p className="text-xs font-sans text-blue-950/60 leading-relaxed">
      {`~${Math.round(total).toLocaleString()} cal planned`}
      {need != null && ` · your estimated need ~${need.toLocaleString()}`}
      {partial}
      {need == null && (
        <>
          {' · '}
          <button
            onClick={onAddDetails}
            className="underline underline-offset-2 decoration-blue-950/30 hover:decoration-blue-950/60
              text-blue-950/60 hover:text-blue-950/80 transition-colors duration-fast"
          >
            Add your details for a personal target
          </button>
        </>
      )}
    </p>
  );
}

// ── Snackbar ──────────────────────────────────────────────────────────────────

function Snackbar({ snackbar, onUndo, onDismiss }) {
  useEffect(() => {
    if (!snackbar) return;
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [snackbar, onDismiss]);

  return (
    <AnimatePresence>
      {snackbar && (
        <motion.div
          key={snackbar.id}
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={calmSpring}
          className="fixed bottom-[88px] left-1/2 -translate-x-1/2 z-50
            max-w-[360px] w-[calc(100%-40px)]
            flex items-center justify-between gap-3
            px-4 py-3 rounded-xl
            bg-char-900 text-white shadow-lg"
        >
          <span className="font-sans text-sm font-medium">{snackbar.message}</span>
          {snackbar.canUndo && (
            <button
              onClick={onUndo}
              className="font-sans text-sm font-semibold text-forest-300 hover:text-forest-200
                transition-colors duration-fast shrink-0"
            >
              Undo
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Cookbook card grid ───────────────────────────────────────────────────────

function CardGrid({ items, actionIcon, onAction, emptyMessage, emptyAction }) {
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
        {items.map((item) => (
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
              stars={numericIdToStars(item.numericId)}
              title={item.name}
              subtitle={cardSubtitle(item)}
              mealTag={mealTypeForItem(item)}
              aspectRatio="4/5"
              action={actionIcon}
              actionOnClick={() => onAction(item)}
              className="w-full"
            />
          </motion.div>
        ))}
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
  const dailyNeed = estimateDailyNeed(profile);

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

  // New meal plan picker: called right after `generatePlanFromPicks`
  // succeeds — lands the user on Day view, today, with a confirmation toast.
  const handlePlanGenerated = useCallback(() => {
    setView('queue');
    setSelectedDay(todayKey());
    showSnackbar('Meal plan created');
  }, [showSnackbar]);

  // Cookbook: add to the selected day's plan (bucketed by inferSlotKey)
  const handleAddToPlan = useCallback((item) => {
    const slotKey = inferSlotKey(item);
    const added = addToSlot(activeDay, slotKey, {
      id: item.id,
      name: item.name,
      image: item.image,
      group: item.group,
      fineGroup: item.fineGroup || '',
      tier: item.tier ?? null,
      numericId: item.numericId ?? null,
      kind: 'food',
    });
    const slotLabel = PLAN_SLOTS.find((s) => s.key === slotKey)?.label ?? slotKey;
    showSnackbar(added ? `Added to ${slotLabel}` : 'Already in plan');
  }, [showSnackbar, activeDay]);

  // Select: open FoodDetailCard, seeding recipes via buildRecipeDetail
  // exactly like SuggestionsScreen's BestRecipesTab.
  const handleSelect = useCallback((item) => {
    if (item.kind === 'recipe') {
      const seed = {
        foodId: item.id,
        name: item.name,
        image: item.image,
        sourceName: item.sourceName ?? null,
        conditions: conditionNames,
        ingredients: [],
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
    <div className="bg-forest-300 flex flex-col min-h-screen -mb-28">

      {/* ── Header zone ──────────────────────────────────────────────────── */}
      <PageHeader
        label="Plan"
        title="My Meal Plan"
        className="bg-forest-300"
        right={
          <button
            onClick={() => navigate('/app/profile')}
            aria-label="Profile"
            className="w-12 h-12 mt-2 ml-2 flex items-center justify-center rounded-full
              bg-white border border-sand-200 shadow-xs text-char-500
              transition-all duration-fast hover:border-forest-400 hover:text-forest-600 hover:shadow-sm
              active:scale-95"
          >
            <Icon name="user" size={18} />
          </button>
        }
      >
        <div className="mt-4">
          <PillSwitcher options={VIEW_OPTIONS} value={view} onChange={handleToggleView} />
        </div>

        {view === 'queue' && (
          <div className="mt-4 -mb-2">
            <DayStrip days={days} selected={activeDay} onSelect={handleSelectDay} />
          </div>
        )}
      </PageHeader>

      {/* ── Glass panel ──────────────────────────────────────────────────── */}
      <GlassPanel className="mt-4">
        {view === 'queue' ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <CalorieLine
                slots={daySlots}
                need={dailyNeed}
                onAddDetails={() => navigate('/app/profile')}
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
          clears the navbar. ─────────────────────────────────────────────── */}
      <button
        onClick={() => setPickerOpen(true)}
        className="fixed right-5 bottom-[88px] z-50 inline-flex items-center gap-2
          rounded-pill bg-blue-950 text-white px-4 py-3 shadow-lg
          font-sans text-sm font-semibold transition-all duration-fast
          hover:bg-blue-900 active:scale-95"
      >
        <CalendarPlus size={16} />
        New meal plan
      </button>

      {/* ── Snackbar ─────────────────────────────────────────────────────── */}
      <Snackbar snackbar={snackbar} onUndo={handleUndo} onDismiss={dismissSnackbar} />

      {/* ── Food/recipe detail ──────────────────────────────────────────── */}
      <FoodDetailCard
        item={selectedDetail}
        open={!!selectedDetail}
        onClose={() => setSelectedDetail(null)}
      />

      {/* ── Nutrition facts (from a Week view day) ────────────────────────── */}
      <NutritionFactsSheet
        open={!!factsTarget}
        dayLabel={factsTarget?.day?.label}
        items={factsTarget?.items ?? []}
        onClose={() => setFactsTarget(null)}
      />

      {/* ── New meal plan picker overlay ──────────────────────────────────── */}
      <MealPlannerPicker
        open={pickerOpen}
        profile={profile}
        onClose={() => setPickerOpen(false)}
        onGenerated={handlePlanGenerated}
      />
    </div>
  );
}
