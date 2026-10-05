import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Bookmark, ChevronLeft, ExternalLink } from 'lucide-react';
import ConditionTag from './shared/ConditionTag.jsx';
import Icon from './shared/Icon.jsx';
import Skeleton from './shared/Skeleton.jsx';
import FoodRating from './shared/FoodRating.jsx';
import StudyReferences from './shared/StudyReferences.jsx';
import EmptyState from './shared/EmptyState.jsx';
import { getLibrary, addToLibrary, removeFromLibrary } from '../state/library.js';
import { getFoodFacts, assessFood, getFoodIdByName, getGroupLabel } from '../api/api.js';
import { storage } from '../api/storage.js';
import { getSaveBlockReason, SAVE_BLOCK_MESSAGES } from '../utils/saveGate.js';
import {
  resolveIsRecipe,
  resolveRecipeLinkTarget,
  resolveGroupLinkTarget,
  groupConditionsByVerdict,
  orderVerdictGroups,
  deriveAssessStatus,
} from '../utils/foodDetailCard.js';
import { getNonFoodIcon } from '../api/ingredientImages.js';
import { resolveCardIngredients } from '../api/ingredientDerivation.js';
import IngredientSwaps from './shared/IngredientSwaps.jsx';
import NonFoodGuidance from './shared/NonFoodGuidance.jsx';
import NutrientFactsPanel from './NutrientFactsPanel.jsx';
import Snackbar from './shared/Snackbar.jsx';
import { openUrl } from '../api/browser.js';

const DISMISS_THRESHOLD = 100;

// Recipe back face: ingredients block is hidden for now (not deleted) — flip
// back to true to restore it.
const SHOW_RECIPE_INGREDIENTS = false;

// Open/close entrance-exit animation (separate from the drag-dismiss
// transform above, which only ever applies while fully open). Opening lifts
// the card up from a lower, tilted-back resting position straight to rest,
// no overshoot/bounce-back; closing reverses the same transform on a
// quicker ease-in. No scale/size change at any point — only translateY and
// rotateX move. Blur/opacity resolve faster than the transform and on a
// plain ease-out, so the card is already sharp/opaque well before the
// transform finishes settling. EXIT_MS must cover the slowest of the exit
// transitions below so handleClose's unmount timer never cuts the animation
// off mid-flight.
const CLOSED_OFFSET_PX = 28;
const CLOSED_TILT_DEG = 6;
const CLOSED_BLUR_PX = 4;
const ENTER_TRANSITION =
  'transform 0.38s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.16s ease-out, filter 0.14s ease-out';
const EXIT_TRANSITION =
  'transform 0.24s cubic-bezier(0.4, 0, 1, 1), opacity 0.2s ease-in, filter 0.2s ease-in';
const EXIT_MS = 260;

// assessFood() has no built-in timeout — a hung fetch left the back face's
// skeleton spinning forever with no way out. Raced against this in the load
// effect below; a loss here is treated as an 'error' (never silently folded
// into the "genuinely empty" state — see deriveAssessStatus).
const ASSESS_TIMEOUT_MS = 15000;

// The Nutridigm API exposes no nutrition-fact fields anywhere (fooditems/
// goodfor/detailed all probed, July 2026) — no nutrition UI is shown.

// The saved profile's real conditions only — no demo-condition fallback.
function getProfile() {
  const saved = storage.get('profile', null);
  return { ...(saved ?? {}), conditions: saved?.conditions ?? [] };
}

/**
 * Single per-condition row in the back face's "Conditions in your profile"
 * section — verdict rating, study count, and "couldn't load studies"
 * honesty state, backed by the shared StudyReferences component for the
 * expandable citations list. `showReferences` (default true) hides all
 * study-related UI for recipes, which show verdicts but never studies.
 *
 * Renders the verdict via the shared FoodRating (green star/red skull)
 * component rather than a hand-rolled tier pill — this row already has a
 * real per-condition `numericId` (raw.conditions[i].descriptionNumericID),
 * so it uses the app's canonical numericId-driven rating system instead of
 * the text-only tier pill (src/utils/tierConfig.js) that surfaces without a
 * numericId fall back to. `tone="light"` since this row sits on a white
 * card, unlike FoodRating's usual dark photo-overlay context.
 */
function ConditionRow({ conditionAssessment, showReferences = true }) {
  const { conditionName, numericId, referenceCount, citations, referenceStatus, status } = conditionAssessment;
  const refsErrored = referenceStatus === 'error';
  // Honest unscorable state (unauthorized / no data / error for this condition).
  const unscorable = status != null && status !== 'ok';

  const formattedRefs = (citations || []).map((c) => (typeof c === 'string' ? { source: c } : c));

  return (
    <div className="py-3 border-b border-sand-100 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <span className="font-sans text-sm font-medium text-char-900">
          {conditionName}
        </span>
        {unscorable ? (
          <span data-testid="condition-unscorable" className="text-[11px] text-char-400 font-sans italic whitespace-nowrap">
            Can&apos;t be scored yet
          </span>
        ) : (
        <div className="flex items-center gap-2">
          <FoodRating numericId={numericId} size={14} tone="light" />
          {showReferences && !refsErrored && referenceCount > 0 && (
            <span className="text-[11px] text-char-400 font-sans whitespace-nowrap">
              {referenceCount} {referenceCount === 1 ? 'reference' : 'references'}
            </span>
          )}
        </div>
        )}
      </div>

      {/* Reference fetch failed — say so rather than implying zero studies */}
      {showReferences && !unscorable && refsErrored && (
        <p className="mt-1 text-[11px] text-char-400 font-sans italic">
          Couldn&apos;t load references
        </p>
      )}

      {showReferences && !unscorable && !refsErrored && formattedRefs.length > 0 && (
        <StudyReferences references={formattedRefs} />
      )}
    </div>
  );
}

// Exported alongside the component (not split into utils/foodDetailCard.js,
// where resolveIsRecipe/resolveRecipeLinkTarget/etc. already live) — Wave 3
// scope for this file is deliberately narrow and this codebase's precedent
// for a component file that needs a directly-testable pure helper is
// RecipesScreen.jsx's own exported `matchesMealFilter`, not an extraction.
// Both trip eslint's react-refresh/only-export-components warning exactly
// like that precedent already does; harmless (a lint warning, not a build
// break) and consistent with it.

/**
 * @param {Object} props
 * @param {Object} props.item - `{ foodId, name, image?, sourceName?,
 *   conditions?, topFoodsForConditions?, realIngredients?, sourceUrl?,
 *   attribution?, isRecipe?, group?, fineGroup? }` — see recipeDetail.js's
 *   `buildRecipeDetail` for the full recipe-detail payload shape.
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {'helpful'|'harmful'} [props.listType] - Which category list this
 *   card was opened from, when the caller knows it — reorders the front
 *   face's verdict-group chips so "Avoid for" leads when browsing an Avoid
 *   list. Undefined (most callers) keeps the default Helps→Neutral→Avoid
 *   for order — see `orderVerdictGroups` in utils/foodDetailCard.js.
 */
export default function FoodDetailCard({ item: itemProp, open, onClose, listType }) {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [dragY, setDragY] = useState(0);

  // Open/close animation lifecycle. Every caller nulls its `item` state in
  // the same tick it flips `open` to false (see call sites), so `itemProp`
  // itself disappears right as the close animation should be starting —
  // `renderItem` holds the last real item so the card still has content to
  // show while it animates down, and `mounted` keeps the component rendered
  // (rather than the old `if (!open) return null`) for that same window.
  const [mounted, setMounted] = useState(open);
  const [animateIn, setAnimateIn] = useState(false);
  const [renderItem, setRenderItem] = useState(itemProp);

  // Render-time derived-state adjustments (same escape hatch the resetKey/
  // savedSyncKey blocks further down use) rather than effects, so opening
  // mounts and starting the close transition both happen in the SAME render
  // the prop changed in — no one-frame lag, and no synchronous setState
  // inside an effect body.
  if (itemProp && itemProp !== renderItem) {
    setRenderItem(itemProp);
  }
  if (open && !mounted) {
    setMounted(true);
  }
  if (!open && animateIn) {
    setAnimateIn(false);
  }

  // Deferred side effects only: kicking off the entrance transition (has to
  // wait a couple of frames past the mount above so the browser actually
  // paints the "closed" transform first) and the exit unmount (has to wait
  // out the close transition). Both setState calls here are async callbacks
  // (rAF / setTimeout), not synchronous effect-body calls.
  useEffect(() => {
    if (!open) return undefined;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimateIn(true));
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (open || !mounted) return undefined;
    const t = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [open, mounted]);

  const item = itemProp ?? renderItem;
  const isExiting = mounted && !open;

  const [facts, setFacts] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // 'loading' | 'success' | 'empty' | 'error' — see deriveAssessStatus.
  // Distinct from `detailLoading` (which also covers the `facts` fetch):
  // this one is specifically the assessFood() outcome, so the back face can
  // tell a genuine "nothing for this pairing" apart from a network error or
  // a timed-out request instead of collapsing all three into one state.
  const [assessStatus, setAssessStatus] = useState('loading');
  const [resolvedFoodId, setResolvedFoodId] = useState(null);
  // Bumped by the back face's Retry button to re-run the load effect below.
  const [retryToken, setRetryToken] = useState(0);

  const isDragging = useRef(false);
  const [dragging, setDragging] = useState(false);
  const dragOriginY = useRef(0);

  const [snackbar, setSnackbar] = useState(null);
  const snackbarIdRef = useRef(0);
  const undoFnRef = useRef(null);
  const showSnackbar = useCallback((message, canUndo = false, undoFn = null) => {
    snackbarIdRef.current += 1;
    undoFnRef.current = undoFn;
    setSnackbar({ id: snackbarIdRef.current, message, canUndo });
  }, []);
  const handleSnackbarUndo = useCallback(() => {
    undoFnRef.current?.();
    setSnackbar(null);
  }, []);

  const isRecipe = resolveIsRecipe(item);
  // Hoisted so both the save gate below AND handleSave's addToLibrary
  // payload use the exact same value — addToLibrary previously omitted
  // `kind` entirely, so items saved from this card recomputed as
  // 'ingredient' later (getSaveBlockReason short-circuits on a missing kind).
  const kind = isRecipe ? 'recipe' : 'food';
  const combinedFoodId = item?.foodId ?? resolvedFoodId ?? null;

  // Save-gate: translate this card's item shape (isRecipe + async assessment)
  // into the { kind, tier, numericId } shape getSaveBlockReason expects.
  // Non-recipes don't depend on assessment.tier/numericId at all
  // (getSaveBlockReason short-circuits to 'ingredient' for any non-recipe
  // kind), so only recipes need to wait on the assessment settling. While
  // detailLoading is true, we don't yet know assessment.tier/numericId for a
  // recipe, so withhold the blocked state rather than show it then flip it
  // off once the assessment resolves. Passing numericId (not just tier)
  // makes this exact rather than relying on saveGate's tier-only fallback.
  const gateItem = { kind, tier: assessment?.tier, numericId: assessment?.numericId };
  const blockReason = (isRecipe && detailLoading) ? null : getSaveBlockReason(gateItem);

  // Lock body scroll while the card is open or animating closed — tied to
  // `mounted` rather than `open` so the background doesn't jump/scroll out
  // from under the card while it's still visibly sliding down.
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mounted]);

  // Reset flip state whenever the card closes or the root item changes.
  // Computed during render (not an effect) per React's "adjusting state
  // when a prop changes" pattern, tracking the last-seen key so the reset
  // only fires once per actual change.
  const resetKey = open ? `${item?.foodId ?? ''}|${item?.name ?? ''}` : 'closed';
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setFlipped(false);
    setDragY(0);
  }

  // Sync saved state with library whenever the effective (front-facing) food
  // changes. Same render-time pattern as the reset above, keyed on the
  // open/combinedFoodId pair the old effect depended on.
  const savedSyncKey = open && combinedFoodId != null ? combinedFoodId : null;
  const [lastSavedSyncKey, setLastSavedSyncKey] = useState(savedSyncKey);
  if (savedSyncKey !== lastSavedSyncKey) {
    setLastSavedSyncKey(savedSyncKey);
    if (savedSyncKey != null) {
      setSaved(getLibrary().some((f) => f.id === savedSyncKey));
    }
  }

  // Self-load facts + assessment for the current item.
  useEffect(() => {
    if (!open || !item) return;
    let cancelled = false;

    async function load() {
      setDetailLoading(true);
      setAssessStatus('loading');
      try {
        let foodId = item.foodId ?? null;
        if (foodId == null && item.name) {
          foodId = await getFoodIdByName(item.name).catch(() => null);
        }

        const profile = getProfile();

        // assessFood() is raced against a 15s timeout so a hung fetch can't
        // spin the back face's skeleton forever — a timeout rejects the
        // race exactly like a real network error, and both are settled
        // (never re-thrown) so a rejection here is a classification signal,
        // not an unhandled promise. `facts` keeps its own independent
        // catch-to-null — this task only requires distinguishing
        // loading/success/empty/error for the ASSESSMENT.
        const assessPromise = foodId != null
          ? Promise.race([
            assessFood(foodId, profile),
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error('timeout')), ASSESS_TIMEOUT_MS);
            }),
          ])
          : Promise.resolve(null);

        const [factsResult, assessSettled] = await Promise.all([
          foodId != null ? getFoodFacts(foodId).catch(() => null) : Promise.resolve(null),
          assessPromise.then(
            (value) => ({ ok: true, value }),
            () => ({ ok: false })
          ),
        ]);

        if (!cancelled) {
          setFacts(factsResult);
          setAssessment(assessSettled.ok ? assessSettled.value : null);
          setAssessStatus(deriveAssessStatus(assessSettled));
          setResolvedFoodId(foodId);
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [open, item?.foodId, item?.name, retryToken]);

  // Re-runs the load effect above via its retryToken dependency — used by
  // the back face's error-state Retry button (assessStatus === 'error').
  const handleRetry = useCallback(() => {
    setRetryToken((t) => t + 1);
  }, []);

  // "Other options" link target for a plain FOOD item — see
  // resolveGroupLinkTarget's own doc above for the fine→coarse→nothing
  // fallback. Recipes get no group link at all here (their own link, below,
  // goes to the recipe browser instead — recipes' fine group is always the
  // blanket 'l', which EXCLUDED_FINE_GROUPS would reject anyway, but
  // short-circuiting on `isRecipe` keeps this item-group computation from
  // even running for the item shape it isn't meant for).
  const groupLinkTarget = isRecipe ? null : resolveGroupLinkTarget(item, facts, assessment);
  const groupLinkCode = groupLinkTarget?.code ?? null;

  // Real display label for that target code (getGroupLabel resolves both
  // fine and coarse codes — adapter.js). Reset at render time (not inside
  // the effect below) whenever the resolved code itself changes — new item
  // opened, this item's code resolving differently as assessment/facts load
  // in, or the code disappearing — same render-time "derived state changed"
  // pattern the flip/saved resets above use, so the render site never has
  // to synchronously setState from inside an effect for what's really a
  // derived reset rather than an async result arriving.
  const [lastGroupLinkCode, setLastGroupLinkCode] = useState(groupLinkCode);
  const [groupLinkLabel, setGroupLinkLabel] = useState(null);
  if (groupLinkCode !== lastGroupLinkCode) {
    setLastGroupLinkCode(groupLinkCode);
    setGroupLinkLabel(null);
  }

  // The actual label fetch — only runs when there's a real code to resolve,
  // and only ever writes `groupLinkLabel` from its own async result (never
  // synchronously), so the render site below can safely treat a null label
  // as "still loading" and withhold the link rather than flashing a
  // half-built one (e.g. a bare, un-prettified code).
  useEffect(() => {
    if (!groupLinkCode) return;
    let cancelled = false;
    getGroupLabel(groupLinkCode).then((label) => {
      if (!cancelled) setGroupLinkLabel(label);
    }).catch(() => { });
    return () => { cancelled = true; };
  }, [groupLinkCode]);

  // Ingredient rows for the back face (recipes only — see the render site).
  // Pure/local: real overlay ingredients when the recipe has them, else read
  // off the recipe name against the bundled food dictionary. Memoized on the
  // identity of the item this card is showing, since the derivation walks the
  // dictionary index. Must stay above the `if (!open || !item)` early return
  // below — it's a hook.
  const cardIngredients = useMemo(
    () => resolveCardIngredients(item),
    [item]
  );

  const handleClose = useCallback(() => {
    setFlipped(false);
    setDragY(0);
    onClose?.();
  }, [onClose]);

  const handleSave = useCallback(() => {
    if (combinedFoodId == null) return;
    if (saved) {
      removeFromLibrary(combinedFoodId);
    } else {
      addToLibrary({
        id: combinedFoodId,
        name: item?.name,
        image: item?.image ?? facts?.photo,
        // Enrichment from the loaded assessment — null (never fabricated)
        // when the assessment hasn't loaded or the field is absent.
        group: assessment?.food?.group ?? null,
        fineGroup: assessment?.food?.fineGroup ?? null,
        tier: assessment?.tier ?? null,
        numericId: assessment?.numericId ?? null,
        kind,
      });
    }
    setSaved((s) => !s);
  }, [saved, combinedFoodId, item, facts, assessment, kind]);

  const onHandleDown = (e) => {
    isDragging.current = true;
    setDragging(true);
    dragOriginY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onHandleMove = (e) => {
    if (!isDragging.current) return;
    setDragY(Math.max(0, e.clientY - dragOriginY.current));
  };

  const onHandleUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    setDragging(false);
    if (dragY >= DISMISS_THRESHOLD) {
      // Drag-dismiss always closes fully, regardless of navigation depth.
      handleClose();
    } else {
      setDragY(0);
    }
  };

  if (!mounted || !item) return null;

  const dismissProgress = Math.min(1, dragY / DISMISS_THRESHOLD);
  const cardOpacity = 1 - dismissProgress * 0.4;
  const backdropOpacity = 1 - dismissProgress * 0.6;

  const perCondition = assessment?.perCondition || [];

  // Description: foods use the dictionary long description (junk-filtered
  // with a minimum-length check), recipes use sourceName.
  const description = isRecipe
    ? (item?.sourceName || null)
    : (facts?.longDescription && facts.longDescription.length >= 8 ? facts.longDescription : null);

  // Non-food rendering rule (master plan 1.10, decision j): coarse group
  // 'k' (Key Nutrients & Herbal) or fine group 'x'/'j1' (lifestyle) items
  // never get a stock food photo — a category icon renders instead. Group/
  // fineGroup for the item currently open primarily come from the
  // self-loaded assessment (assessFood's Food carries them, straight off
  // the /fooditems dictionary entry). When assessFood fails/times out
  // (assessStatus === 'error') or the /goodfor lookup itself came back
  // genuinely empty, `assessment` is null and that source is gone — falls
  // back to `facts` (getFoodFacts) next and then to whatever the caller
  // already seeded on `item` (e.g. GroupDetailScreen passes through the
  // coarse group it's already browsing). NOTE: getFoodFacts
  // (src/api/adapter.js ~1767, verified while building this fallback)
  // does NOT currently return group/fineGroup fields — this fallback layer
  // is inert until/unless that adapter export is extended, but is wired
  // defensively (and item.group/fineGroup DOES help today, e.g. the coarse
  // group is real whenever the caller browsed here by category).
  const nonFoodIcon = getNonFoodIcon(
    assessment?.food?.group ?? facts?.group ?? item?.group,
    assessment?.food?.fineGroup ?? facts?.fineGroup ?? item?.fineGroup
  );
  const displayImage = nonFoodIcon ? null : (item?.image || facts?.photo || null);

  // Condition chips: use the item's own conditions when given (recipes —
  // shown as a single "Best for:" group, as before), else group EVERY
  // entry in the assessment's perCondition by verdict (Helps/Neutral/Avoid
  // for) via the shared numericId-based bucketing — see
  // groupConditionsByVerdict in utils/foodDetailCard.js for why this
  // replaced the old tier-filtered, single-clipped-line chip row (it
  // silently dropped every condition outside tier Top/Strong/Good).
  const conditionGroups = item?.conditions?.length
    ? [{ key: 'best', label: 'Best for:', names: item.conditions }]
    : orderVerdictGroups(groupConditionsByVerdict(perCondition), listType);

  // Link-out target: a real C1 overlay `sourceUrl` always wins (public-
  // domain attribution required, embedded in the label — see
  // resolveRecipeLinkTarget); absent that, falls back to a new-tab web
  // search exactly as before. This CTA hands off to the OS browser in one
  // tap via `openUrl`.
  const linkTarget = resolveRecipeLinkTarget(item);
  const handleGetRecipe = () => openUrl(linkTarget.url);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center px-4" style={{ perspective: '3000px' }}>
      {/* Scrim — fades with the card's own open/close animation below. */}
      <div
        className="absolute inset-0 bg-char-900/50 backdrop-blur-[3px]"
        style={{
          opacity: backdropOpacity * (animateIn ? 1 : 0),
          transition: dragging ? 'none' : (isExiting ? 'opacity 0.2s ease-in' : 'opacity 0.3s ease-out'),
        }}
        onClick={handleClose}
      />

      {/* Card wrapper — 2:3 ratio. Open: lifts up from a lower, tilted-back,
          blurred resting position straight to rest, no scale/size change.
          Close: reverses the same transform on a quicker ease-in. `dragY`
          (drag-dismiss) layers on top of whichever resting position
          `animateIn` currently targets. */}
      <div
        className="relative w-full max-w-[400px] z-10"
        style={{
          aspectRatio: '2/3',
          maxHeight: 'calc(100dvh - 180px)',
          transformOrigin: 'center bottom',
          opacity: cardOpacity * (animateIn ? 1 : 0),
          filter: animateIn ? 'blur(0px)' : `blur(${CLOSED_BLUR_PX}px)`,
          transform: animateIn
            ? `translateY(${dragY}px) rotateX(0deg)`
            : `translateY(${dragY + CLOSED_OFFSET_PX}px) rotateX(${CLOSED_TILT_DEG}deg)`,
          transition: dragging ? 'none' : (isExiting ? EXIT_TRANSITION : ENTER_TRANSITION),
        }}
      >
        {/* Flip container */}
        <div
          className="w-full h-full"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: 'transform 0.55s cubic-bezier(0.22, 0.61, 0.36, 1)',
          }}
        >

          {/* ── FRONT FACE ──────────────────────────────────────── */}
          <div
            className="absolute inset-0 rounded-2xl shadow-lg overflow-hidden touch-none select-none"
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}
          >
            {/* Background image — fills entire card */}
            {displayImage ? (
              <img
                src={displayImage}
                alt={item?.name}
                className="absolute inset-0 w-full h-full object-cover object-center"
                loading="eager"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-sand-100">
                <Icon name={nonFoodIcon || 'leaf'} size={48} className="text-char-300" aria-hidden="true" />
              </div>
            )}

            {/* Drag pill — centered at top */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
              <div className="w-14 h-1.5 rounded-full bg-white/60" />
            </div>

            {/* Save — top-left. Blocked (not-yet-saved, gated) items render a
                slashed bookmark and toast the reason instead of saving —
                see saveGate.js. Removal is always allowed regardless of
                blockReason. */}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                if (!saved && blockReason) {
                  showSnackbar(SAVE_BLOCK_MESSAGES[blockReason]);
                  return;
                }
                handleSave();
              }}
              className={`absolute top-4 left-4 z-20 w-11 h-11 rounded-full flex items-center justify-center
                shadow-md transition-all duration-fast backdrop-blur-sm
                ${saved ? 'bg-white text-forest-700' : 'bg-white/90 text-char-500 hover:text-char-900'}`}
              aria-label={saved ? 'Remove from saved recipes' : (blockReason ? SAVE_BLOCK_MESSAGES[blockReason] : 'Save recipe')}
            >
              {!saved && blockReason ? (
                <span className="relative inline-flex items-center justify-center" style={{ width: 20, height: 20 }}>
                  <Bookmark size={20} aria-hidden="true" />
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 h-[1.5px] w-[141%] bg-current"
                    style={{ transform: 'translateY(-50%) rotate(-45deg)', transformOrigin: 'center' }}
                  />
                </span>
              ) : (
                <Bookmark size={20} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
              )}
            </button>

            {/* X close — top-right */}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleClose}
              className="absolute top-4 right-4 z-20 w-11 h-11 rounded-full bg-white/90 backdrop-blur-sm
                flex items-center justify-center text-char-500 hover:text-char-900
                shadow-md transition-all duration-fast"
              aria-label="Close"
            >
              <X size={20} aria-hidden="true" />
            </button>

            {/* Info panel — pinned to bottom, independent of image.
                min-height is a FLOOR (never a cap) so the card doesn't jump
                for a short description, but is free to grow taller than
                that when the verdict-group chips below wrap onto several
                lines — see conditionGroups/groupConditionsByVerdict. */}
            <div
              className="absolute bottom-0 left-0 right-0 z-20 bg-neutral-900/70 backdrop-blur-sm rounded-t-2xl px-5 pt-4 pb-5 flex flex-col gap-2 min-h-[250px]"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {/* Verdict rating — pinned to top-right of the info panel.
                  Renders nothing once loading settles into 'error' (rather
                  than a stale spinner or a fabricated rating) — `assessment`
                  is null in that state, so `numericId != null` is already
                  false and this naturally falls through to "render nothing". */}
              {(detailLoading || assessment?.numericId != null) && (
                <div className="absolute top-3 right-4">
                  <FoodRating numericId={assessment?.numericId} size={18} loading={detailLoading} />
                </div>
              )}

              {/* Food name */}
              <h2 className="font-display text-2xl font-semibold text-white leading-snug tracking-tightish pr-24">
                {item?.name}
              </h2>
              <p className="text-[11px] text-white/60 font-sans">
                Ask your doctor before changing your diet, especially if you take medication.
              </p>

              {/* Eyebrow + verdict-group condition chips — every entry in
                  perCondition is represented (grouped Helps/Neutral/Avoid
                  for), and each group's chip row wraps (flex-wrap) rather
                  than clipping to one line. */}
              {conditionGroups.length > 0 && (
                <div className="flex flex-col gap-1 overflow-y-auto max-h-28 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {conditionGroups.map((g) => (
                    <div key={g.key} className="flex items-start gap-2 flex-wrap">
                      <p className="text-[10px] font-label tracking-[0.14em] uppercase text-white/50 flex-none whitespace-nowrap pt-0.5">
                        {g.label}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {g.names.map((c, i) => (
                          <ConditionTag key={i} condition={c} compact className="flex-none" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Description — facts.longDescription for foods, sourceName for
                  recipes. Always rendered (even when null) as a flex-1 area
                  so the CTA stays pinned to the bottom regardless of
                  description length. Clamped to 2 lines (shorter than
                  before) to leave room for the (now potentially
                  multi-group, wrapping) condition chips above. */}
              {description ? (
                <p className="flex-1 text-sm text-white/70 font-sans leading-snug line-clamp-2">
                  {description}
                </p>
              ) : (
                <div className="flex-1" />
              )}

              {/* Flip CTA */}
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setFlipped(true)}
                className="mt-2 w-full py-3.5 rounded-xl bg-white text-blue-950
                  font-display font-semibold text-base shadow-fab
                  transition-all duration-base ease-ds-out
                  hover:bg-sand-50 hover:-translate-y-[1px] hover:shadow-lg
                  active:translate-y-[1px] active:scale-[0.99]"
              >
                See health details
              </button>
            </div>
          </div>

          {/* ── BACK FACE ────────────────────────────────────────── */}
          <div
            className="absolute inset-0 z-30 bg-paper-100 rounded-2xl shadow-lg flex flex-col overflow-hidden"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            {/* Back header */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 pt-5 pb-3">
              <div className="min-w-0">
                <h3 className="font-display text-xl font-semibold text-blue-950 leading-snug tracking-tightish truncate">
                  {item?.name}
                </h3>
                {isRecipe ? (
                  item?.sourceName && (
                    <p className="text-xs text-char-500 font-sans mt-0.5 truncate">
                      {item.sourceName}
                    </p>
                  )
                ) : (
                  facts?.groupLabel && facts.groupLabel !== 'x' && (
                    <p className="text-xs text-char-500 font-sans mt-0.5 truncate">
                      {facts.groupLabel}
                    </p>
                  )
                )}
              </div>
              <button
                onClick={() => setFlipped(false)}
                className="tap-target flex-shrink-0 ml-3 h-9 px-3.5 rounded-full bg-white border border-neutral-200
                  flex items-center gap-1 text-char-600 text-sm font-sans
                  hover:bg-sand-100 transition-all duration-fast shadow-xs"
                aria-label="Back to overview"
              >
                <ChevronLeft size={15} aria-hidden="true" />
                <span>Overview</span>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex flex-col gap-3">

                {!isRecipe && nonFoodIcon && (
                  <NonFoodGuidance
                    foodId={combinedFoodId}
                    group={assessment?.food?.group ?? facts?.group ?? item?.group}
                    fineGroup={assessment?.food?.fineGroup ?? facts?.fineGroup ?? item?.fineGroup}
                    longDescription={description}
                  />
                )}

                {/* Conditions in your profile — per-condition breakdown (tier
                    pills, and for foods only: study counts, expandable
                    citations, "couldn't load studies" state). Recipes show
                    verdicts but never studies. */}
                <div className="rounded-xl border border-neutral-300/50 shadow-xs bg-white p-4">
                  <p className="text-[11px] font-label tracking-[0.14em] uppercase text-char-400 mb-3">
                    Conditions in your profile
                  </p>

                  {/* Total references — referenceTotal is null (not 0) when
                      any condition's /references fetch failed; skip the
                      line rather than claiming zero studies. Recipes never
                      show studies, so skip this line entirely for them. */}
                  {!isRecipe && assessment?.food?.referenceTotal > 0 && (
                    <p className="text-xs text-char-500 font-sans mb-2">
                      {assessment.food.referenceTotal} total {assessment.food.referenceTotal === 1 ? 'reference' : 'references'} across your conditions
                    </p>
                  )}

                  {detailLoading ? (
                    <div className="flex flex-col gap-3 py-1">
                      <Skeleton shape="text" className="w-3/4" />
                      <Skeleton shape="text" className="w-2/3" />
                      <Skeleton shape="text" className="w-1/2" />
                    </div>
                  ) : assessStatus === 'error' ? (
                    // A real failure (network error, or the 15s timeout race
                    // in the load effect) — distinct from the genuine-empty
                    // state below, and recoverable via Retry rather than a
                    // dead end. See deriveAssessStatus in
                    // utils/foodDetailCard.js.
                    <EmptyState
                      icon="alert-triangle"
                      title="Couldn't load health details"
                      body="Something went wrong loading condition data for this item."
                      action={(
                        <button
                          type="button"
                          onClick={handleRetry}
                          className="px-5 py-2.5 rounded-xs bg-forest-700 text-white text-sm font-semibold font-sans
                            transition-all duration-fast ease-ds-out hover:bg-forest-800 active:scale-[0.98]"
                        >
                          Retry
                        </button>
                      )}
                    />
                  ) : perCondition.length > 0 ? (
                    <div>
                      {perCondition.map((ca, i) => (
                        <ConditionRow key={ca.conditionId ?? i} conditionAssessment={ca} showReferences={!isRecipe} />
                      ))}
                    </div>
                  ) : (
                    // Honest "nothing to show" state — fires when /goodfor
                    // genuinely returned nothing for this item/condition
                    // pairing (e.g. some lifestyle items like Smoking have no
                    // per-condition scoring data), not a blank/broken card.
                    <EmptyState
                      icon="info"
                      title="No data for this item"
                      body="We don't have condition or reference data for this pairing yet."
                    />
                  )}
                </div>

                {/* Real USDA nutrient panel — plain foods only (recipes carry
                    their own source panel; non-food items have no nutrients). */}
                {!isRecipe && !nonFoodIcon && combinedFoodId != null && (
                  <NutrientFactsPanel key={combinedFoodId} foodId={combinedFoodId} />
                )}

                {/* Ingredients (+ per-ingredient healthy swaps) — recipes
                    only. Real C1-overlay ingredient facts win whenever the
                    recipe has an overlay match (facts as given by the
                    source, no invented quantities); otherwise the list is
                    read off the recipe's own name against the bundled food
                    dictionary, and captioned as such — see
                    api/ingredientDerivation.js for why that beats both an
                    invented list and the empty block this used to render
                    for every recipe in the app (no overlay row currently
                    carries ingredient data at all). Directions are still
                    never republished — this list plus the link-out CTA
                    below is the whole of what this app shows for a recipe's
                    preparation. */}
                {SHOW_RECIPE_INGREDIENTS && isRecipe && (
                  <IngredientSwaps
                    key={`${item?.foodId ?? ''}|${item?.name ?? ''}`}
                    ingredients={cardIngredients.ingredients}
                    derived={cardIngredients.derived}
                    profile={getProfile()}
                  />
                )}

                {/* Top-ranked foods for your conditions — a "see also" rail of
                    OTHER foods that help the same conditions (from
                    /topdoordonts), deliberately NOT presented as this
                    item's ingredients (that was the old, misleading
                    `ingredients` field name — see recipeDetail.js header).
                    Only shown when there are real companions beyond the
                    hero food itself. Thumbnails come pre-resolved from
                    recipeDetail.js (outside this file's ownership this
                    wave) and may not yet honor the non-food icon rule for
                    a companion that happens to be a 'k'/lifestyle item —
                    a known, documented gap, not attempted here.
                    Recipe-gated: buildRecipeDetail is shared by both recipe
                    screens and MealprepCarousel's plain "Top Dos & Don'ts"
                    foods (isRecipe: false), and for the latter this rail is
                    genuinely the item's own "similar items" content. For a
                    recipe, though, these are unrelated individual foods that
                    merely target the same conditions — showing them under a
                    recipe's health details reads as if they were part of the
                    recipe, which they're not. A recipe's own content is
                    `realIngredients` (above) when a C1 overlay match exists,
                    or nothing. */}
                {!isRecipe && item?.topFoodsForConditions?.length > 1 && (
                  <div className="rounded-xl border border-neutral-300/50 shadow-xs bg-white p-4">
                    {/* COPY-REVIEW: flagged for C2 health-claim audit */}
                    <p className="text-[11px] font-label tracking-[0.14em] uppercase text-char-400 mb-3">
                      Top-ranked foods for your conditions
                    </p>
                    <div className="flex gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-1 px-1">
                      {item.topFoodsForConditions.map((food, i) => (
                        <div key={food.foodId ?? i} className="flex-shrink-0 w-16 flex flex-col items-center gap-1.5">
                          {food.image ? (
                            <img
                              src={food.image}
                              alt={food.name}
                              className="w-16 h-16 rounded-full object-cover object-center"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-sand-100 flex items-center justify-center">
                              <Icon name="leaf" size={22} className="text-char-300" aria-hidden="true" />
                            </div>
                          )}
                          <span className="text-[11px] font-sans text-char-600 text-center leading-tight line-clamp-2">
                            {food.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* "Other options" link — Mory's Wave 3 Suggest tie-in
                    ("the link that says better/other options... from the
                    same food group as the card"). Deliberately its OWN
                    block, not nested inside the rail above: that rail gates
                    on `topFoodsForConditions` (the /topdoordonts companions
                    list), a completely different signal from whether this
                    item's own food group resolves — this link must show up
                    on its own whenever a group resolves, rail or no rail.
                    Plain foods link to their own fine (preferred) or coarse
                    food group's Suggest page — see resolveGroupLinkTarget
                    above for the fine→coarse→nothing fallback and why
                    EXCLUDED_FINE_GROUPS routes some items to the coarse
                    page instead. The target route
                    (/app/suggestions/fine/:fineGroupId) is being built by a
                    sibling task in parallel and does not exist yet as of
                    this writing — linking to it now is intentional; it 404s
                    until that lands. Withheld until `groupLinkLabel`
                    resolves (see the effect above) so no bare, un-prettified
                    group code ever flashes before the real name loads in.
                    Copy avoids a health claim ("other options", not
                    "better") per this file's existing C2 audit convention
                    — see the recipe variant below for the same treatment. */}
                {!isRecipe && groupLinkTarget && groupLinkLabel && (
                  <button
                    type="button"
                    onClick={() => { onClose?.(); navigate(groupLinkTarget.path); }}
                    className="w-full flex items-center justify-between gap-3 rounded-xl border border-neutral-300/50
                      shadow-xs bg-white p-4 text-left transition-all duration-base ease-ds-out
                      hover:border-forest-300 hover:shadow-card active:scale-[0.99]"
                  >
                    {/* COPY-REVIEW: flagged for C2 health-claim audit */}
                    <span className="text-sm font-sans font-semibold text-char-900">
                      Other options in {groupLinkLabel}
                    </span>
                    <Icon name="chevron-right" size={16} className="text-char-400 flex-shrink-0" aria-hidden="true" />
                  </button>
                )}

                {/* Recipe counterpart of the link above — replaces the old
                    "See other good recipes" link into the recipe browser
                    (RecipesScreen, via mealTypeToRecipesHref) with a link
                    into the food-groups browser instead, so a recipe's back
                    face offers ingredient alternatives rather than more
                    recipes. */}
                {isRecipe && (
                  <button
                    type="button"
                    onClick={() => { onClose?.(); navigate('/app/suggestions?tab=groups&mode=fine'); }}
                    className="w-full flex items-center justify-between gap-3 rounded-xl border border-neutral-300/50
                      shadow-xs bg-white p-4 text-left transition-all duration-base ease-ds-out
                      hover:border-forest-300 hover:shadow-card active:scale-[0.99]"
                  >
                    <span className="text-sm font-sans font-semibold text-char-900">
                      Search ingredient alternatives
                    </span>
                    <Icon name="chevron-right" size={16} className="text-char-400 flex-shrink-0" aria-hidden="true" />
                  </button>
                )}

              </div>
            </div>

            {/* Get the recipe — recipes only, pinned to the bottom.
                `linkTarget.label` already embeds the attribution text when
                sourceUrl wins (see resolveRecipeLinkTarget) — never shown
                as a separate/equal element alongside the search fallback. */}
            {isRecipe && (
              <div className="flex-shrink-0 px-4 pb-4">
                <button
                  onClick={handleGetRecipe}
                  className="w-full py-3.5 px-4 rounded-xl bg-blue-950 text-white
                    font-display font-semibold text-base shadow-fab
                    flex items-center justify-center gap-2
                    transition-all duration-base ease-ds-out
                    hover:-translate-y-[1px] hover:shadow-lg
                    active:translate-y-[1px] active:scale-[0.99]"
                >
                  <ExternalLink size={17} className="flex-shrink-0" aria-hidden="true" />
                  <span className="truncate">{linkTarget.label}</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Mounted outside the (transformed) card wrapper — a `transform` on an
          ancestor creates a new containing block for `fixed` descendants,
          which would break Snackbar's viewport-anchored positioning. */}
      <Snackbar snackbar={snackbar} onUndo={handleSnackbarUndo} onDismiss={() => setSnackbar(null)} />
    </div>
  );
}
