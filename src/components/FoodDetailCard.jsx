import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Bookmark, ChevronLeft, ExternalLink } from 'lucide-react';
import ConditionTag from './shared/ConditionTag.jsx';
import Icon from './shared/Icon.jsx';
import Skeleton from './shared/Skeleton.jsx';
import FoodRating from './shared/FoodRating.jsx';
import StudyReferences from './shared/StudyReferences.jsx';
import { getLibrary, addToLibrary, removeFromLibrary } from '../state/library.js';
import { getFoodFacts, assessFood, getFoodIdByName } from '../api/api.js';
import { storage } from '../api/storage.js';
import { DEFAULT_DEV_CONDITIONS } from '../api/config.js';
import { getSaveBlockReason, SAVE_BLOCK_MESSAGES } from '../utils/saveGate.js';
import { resolveIsRecipe, resolveRecipeLinkTarget } from '../utils/foodDetailCard.js';
import { getNonFoodIcon } from '../api/ingredientImages.js';
import { openUrl } from '../api/browser.js';
import Snackbar from './shared/Snackbar.jsx';

const DISMISS_THRESHOLD = 100;

// ── Tier config for per-condition rows. Self-contained (not imported from
// elsewhere) so this card can render its tier chips independently. ──────────

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
    label: 'Poor match',
    bg: 'bg-avoid-100',
    fg: 'text-avoid-600',
    dot: 'bg-avoid-600',
  },
  Neutral: {
    label: 'Neutral',
    bg: 'bg-sand-100',
    fg: 'text-char-500',
    dot: 'bg-char-400',
  },
};

// The Nutridigm API exposes no nutrition-fact fields anywhere (fooditems/
// goodfor/detailed all probed, July 2026) — no nutrition UI is shown.

// Mirrors MealprepCarousel's profile-read pattern: prefer the
// saved profile's real conditions, fall back to the demo-key conditions
// this subscription can actually score.
function getProfile() {
  const saved = storage.get('profile', null);
  if (saved?.conditions?.length) return saved;
  return { conditions: DEFAULT_DEV_CONDITIONS };
}

/**
 * Single per-condition row in the back face's "Conditions in your profile"
 * section — tier pill, study count, and "couldn't load studies" honesty
 * state, backed by the shared StudyReferences component for the expandable
 * citations list. `showReferences` (default true) hides all study-related UI
 * for recipes, which show verdicts but never studies.
 */
function ConditionRow({ conditionAssessment, showReferences = true }) {
  const { conditionName, tier, numericId, referenceCount, citations, referenceStatus } = conditionAssessment;
  // Prefer a real tier match; numericId 4 ("Neutral / OK") maps to a null
  // tier upstream (indistinguishable from "no data" otherwise), so fall back
  // to the Neutral pill specifically for that case rather than any null tier.
  const cfg = tier ? TIER_CONFIG[tier] : (numericId === 4 ? TIER_CONFIG.Neutral : null);
  const refsErrored = referenceStatus === 'error';

  const formattedRefs = (citations || []).map((c) => (typeof c === 'string' ? { source: c } : c));

  return (
    <div className="py-3 border-b border-sand-100 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <span className="font-sans text-sm font-medium text-char-900">
          {conditionName}
        </span>
        <div className="flex items-center gap-2">
          {cfg && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-[11px] font-semibold ${cfg.bg} ${cfg.fg}`}>
              <span className={`w-[6px] h-[6px] rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          )}
          {showReferences && !refsErrored && referenceCount > 0 && (
            <span className="text-[11px] text-char-400 font-sans whitespace-nowrap">
              {referenceCount} {referenceCount === 1 ? 'study' : 'studies'}
            </span>
          )}
        </div>
      </div>

      {/* Reference fetch failed — say so rather than implying zero studies */}
      {showReferences && refsErrored && (
        <p className="mt-1 text-[11px] text-char-400 font-sans italic">
          Couldn&apos;t load studies
        </p>
      )}

      {showReferences && !refsErrored && formattedRefs.length > 0 && (
        <StudyReferences references={formattedRefs} />
      )}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {Object} props.item - `{ foodId, name, image?, sourceName?,
 *   conditions?, topFoodsForConditions?, realIngredients?, sourceUrl?,
 *   attribution?, isRecipe? }` — see recipeDetail.js's `buildRecipeDetail`
 *   for the full recipe-detail payload shape.
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 */
export default function FoodDetailCard({ item, open, onClose }) {
  const [saved, setSaved] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [dragY, setDragY] = useState(0);

  const [facts, setFacts] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resolvedFoodId, setResolvedFoodId] = useState(null);

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

  // Lock body scroll while the card is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

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
      try {
        let foodId = item.foodId ?? null;
        if (foodId == null && item.name) {
          foodId = await getFoodIdByName(item.name).catch(() => null);
        }

        const profile = getProfile();
        const [factsResult, assessResult] = await Promise.all([
          foodId != null ? getFoodFacts(foodId).catch(() => null) : Promise.resolve(null),
          foodId != null ? assessFood(foodId, profile).catch(() => null) : Promise.resolve(null),
        ]);

        if (!cancelled) {
          setFacts(factsResult);
          setAssessment(assessResult);
          setResolvedFoodId(foodId);
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [open, item?.foodId, item?.name]);

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

  if (!open || !item) return null;

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
  // fineGroup for the item currently open only become known once the
  // self-loaded assessment resolves (assessFood's Food carries them; the
  // seed `item` prop itself never does), so this only takes effect after
  // load — before that, `nonFoodIcon` is null and the existing "no image"
  // fallback (leaf icon) covers the loading window for any item that
  // didn't arrive with a seeded photo.
  const nonFoodIcon = getNonFoodIcon(assessment?.food?.group, assessment?.food?.fineGroup);
  const displayImage = nonFoodIcon ? null : (item?.image || facts?.photo || null);

  // Condition chips: use the item's own conditions when given, else derive
  // from the assessment's helpful conditions (same logic as buildRecipeDetail).
  const derivedConditions = item?.conditions?.length
    ? item.conditions
    : perCondition
      .filter((c) => c.tier === 'Top' || c.tier === 'Strong' || c.tier === 'Good')
      .sort((a, b) => (b.referenceCount ?? 0) - (a.referenceCount ?? 0))
      .map((c) => c.conditionName);

  // Chip row is a single clipped line (no wrap/scroll) — sort shortest-first
  // so the longest name lands last, where it gets clipped at the panel edge.
  const sortedConditions = [...derivedConditions].sort((a, b) => a.length - b.length);

  // Link-out target: a real C1 overlay `sourceUrl` always wins (public-
  // domain attribution required, embedded in the label — see
  // resolveRecipeLinkTarget); absent that, falls back to a new-tab web
  // search exactly as before. Routed through browser.js's `openUrl` (the
  // only file allowed to touch `window.open`) rather than calling it directly.
  const linkTarget = resolveRecipeLinkTarget(item);
  const handleGetRecipe = () => openUrl(linkTarget.url);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center px-4">
      {/* Scrim */}
      <div
        className="absolute inset-0 bg-char-900/50 backdrop-blur-[3px]"
        style={{ opacity: backdropOpacity }}
        onClick={handleClose}
      />

      {/* Card wrapper — 2:3 ratio */}
      <div
        className="relative w-full max-w-[400px] z-10"
        style={{
          aspectRatio: '2/3',
          maxHeight: 'calc(100dvh - 180px)',
          opacity: cardOpacity,
          transform: `translateY(${dragY}px)`,
          transition: dragging
            ? 'none'
            : 'transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1)',
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

            {/* Info panel — pinned to bottom, independent of image. Fixed
                min-height so the card never jumps between short/long
                descriptions (worst case: 2-line name + chip row + 4-line
                description + CTA + padding). */}
            <div
              className="absolute bottom-0 left-0 right-0 z-20 bg-neutral-900/70 backdrop-blur-sm rounded-t-2xl px-5 pt-4 pb-5 flex flex-col gap-2 min-h-[250px]"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {/* Verdict rating — pinned to top-right of the info panel */}
              {(detailLoading || assessment?.numericId != null) && (
                <div className="absolute top-3 right-4">
                  <FoodRating numericId={assessment?.numericId} size={18} loading={detailLoading} showNeutralLabel />
                </div>
              )}

              {/* Food name */}
              <h2 className="font-display text-2xl font-semibold text-white leading-snug tracking-tightish pr-24">
                {item?.name}
              </h2>

              {/* Eyebrow + condition chips — single clipped line, no wrap/scroll */}
              {sortedConditions.length > 0 && (
                <div className="flex items-center gap-2 overflow-hidden">
                  <p className="text-[10px] font-label tracking-[0.14em] uppercase text-white/50 flex-none whitespace-nowrap">
                    Best for:
                  </p>
                  <div className="flex gap-1.5 overflow-hidden">
                    {sortedConditions.map((c, i) => (
                      <ConditionTag key={i} condition={c} compact className="flex-none" />
                    ))}
                  </div>
                </div>
              )}

              {/* Description — facts.longDescription for foods, sourceName for
                  recipes. Always rendered (even when null) as a flex-1 area
                  so the panel height stays constant and the CTA stays pinned
                  to the bottom regardless of description length. */}
              {description ? (
                <p className="flex-1 text-sm text-white/70 font-sans leading-snug line-clamp-4">
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
                  facts?.groupLabel && (
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
                <span>To front</span>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex flex-col gap-3">

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
                      {assessment.food.referenceTotal} total {assessment.food.referenceTotal === 1 ? 'study' : 'studies'} across your conditions
                    </p>
                  )}

                  {detailLoading ? (
                    <div className="flex flex-col gap-3 py-1">
                      <Skeleton shape="text" className="w-3/4" />
                      <Skeleton shape="text" className="w-2/3" />
                      <Skeleton shape="text" className="w-1/2" />
                    </div>
                  ) : perCondition.length > 0 ? (
                    <div>
                      {perCondition.map((ca, i) => (
                        <ConditionRow key={ca.conditionId ?? i} conditionAssessment={ca} showReferences={!isRecipe} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-char-400 font-sans italic">
                      No condition data available.
                    </p>
                  )}
                </div>

                {/* Ingredients — real C1-overlay ingredient facts only
                    (facts as given by the source, no invented quantities).
                    Absent entirely (no placeholder row) when the recipe has
                    no overlay match, per recipeDetail.js's never-fabricate
                    rule. Directions are never republished — this list plus
                    the link-out CTA below is the whole of what this app
                    shows for a recipe's preparation. */}
                {item?.realIngredients?.length > 0 && (
                  <div className="rounded-xl border border-neutral-300/50 shadow-xs bg-white p-4">
                    <p className="text-[11px] font-label tracking-[0.14em] uppercase text-char-400 mb-3">
                      Ingredients
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {item.realIngredients.map((ing, i) => (
                        <li key={ing.foodItemID ?? i} className="text-sm font-sans text-char-700 leading-snug">
                          {ing.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Top foods for your conditions — a "see also" rail of
                    OTHER foods that help the same conditions (from
                    /topdoordonts), deliberately NOT presented as this
                    item's ingredients (that was the old, misleading
                    `ingredients` field name — see recipeDetail.js header).
                    Only shown when there are real companions beyond the
                    hero food itself. Thumbnails come pre-resolved from
                    recipeDetail.js (outside this file's ownership this
                    wave) and may not yet honor the non-food icon rule for
                    a companion that happens to be a 'k'/lifestyle item —
                    a known, documented gap, not attempted here. */}
                {item?.topFoodsForConditions?.length > 1 && (
                  <div className="rounded-xl border border-neutral-300/50 shadow-xs bg-white p-4">
                    {/* COPY-REVIEW: flagged for C2 health-claim audit */}
                    <p className="text-[11px] font-label tracking-[0.14em] uppercase text-char-400 mb-3">
                      Top foods for your conditions
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
