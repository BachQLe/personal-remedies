/**
 * FoodDetail — per-food detail view (bottom sheet / expandable panel).
 *
 * Props:
 *   food           — Food object (has id, name, group, tier, referenceTotal)
 *   profile        — Profile (to call assessFood)
 *   onClose        — callback to dismiss
 *   onAddToLibrary — callback(food) — library-add action
 *
 * On mount, calls assessFood(food.id, profile) and getFoodFacts(food.id)
 * (dictionary-backed, no extra API call) in parallel from the API layer.
 * Displays: Food Facts (photo banner, group eyebrow, long description when
 *   substantive), food name, reconciled tier, per-condition breakdown
 *   (each condition's name + tier + reference count),
 *   expandable citations list per condition.
 * Nutrition facts are intentionally absent: getNutritionFacts always
 * returns null today (the Nutridigm API exposes none) and null renders
 * nothing — no placeholder tables.
 * Library-add button present here too.
 */
import { useState, useEffect } from 'react';
import { BookmarkPlus } from 'lucide-react';
import { assessFood, getFoodFacts, getNutritionFacts } from '../api/api.js';
import BottomSheet from './shared/BottomSheet.jsx';
import StudyReferences from './shared/StudyReferences.jsx';
import Skeleton from './shared/Skeleton.jsx';
import DemoDataChip from './shared/DemoDataChip.jsx';

// ── Tier config (matches IngredientCard) ─────────────────────────────────────

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
};

/**
 * Single condition row in the per-condition breakdown.
 */
function ConditionRow({ conditionAssessment }) {
  const { conditionName, tier, referenceCount, citations, referenceStatus } = conditionAssessment;
  const cfg = tier ? TIER_CONFIG[tier] : null;
  const refsErrored = referenceStatus === 'error';

  // Format citations for StudyReferences (it expects {source, year?, url?} or strings)
  const formattedRefs = (citations || []).map((c) => {
    if (typeof c === 'string') return { source: c };
    return c;
  });

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
          {!refsErrored && referenceCount > 0 && (
            <span className="text-[11px] text-char-400 font-sans whitespace-nowrap">
              {referenceCount} {referenceCount === 1 ? 'study' : 'studies'}
            </span>
          )}
        </div>
      </div>

      {/* Reference fetch failed — say so rather than implying zero studies */}
      {refsErrored && (
        <p className="mt-1 text-[11px] text-char-400 font-sans italic">
          Couldn&apos;t load studies
        </p>
      )}

      {/* Expandable citations */}
      {!refsErrored && formattedRefs.length > 0 && (
        <StudyReferences references={formattedRefs} />
      )}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {import('../api/types.js').Food} props.food
 * @param {import('../api/types.js').Profile} props.profile
 * @param {() => void} props.onClose
 * @param {(food: import('../api/types.js').Food) => void} [props.onAddToLibrary]
 */
export default function FoodDetail({ food, profile, onClose, onAddToLibrary }) {
  const [assessment, setAssessment] = useState(null);
  const [facts, setFacts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        // Facts come from the cached food dictionary (no extra API call) and
        // load in parallel with the assessment; each failure is independent
        // so a facts miss never blanks the assessment (or vice versa).
        const [assessResult, factsResult] = await Promise.all([
          assessFood(food.id, profile).catch((err) => {
            console.error('FoodDetail: assessFood failed', err);
            return null;
          }),
          getFoodFacts(food.id).catch(() => null),
        ]);
        if (!cancelled) {
          setAssessment(assessResult);
          setFacts(factsResult);
        }

        // Nutrition facts: the Nutridigm API exposes no nutrition-fact
        // fields (July-2026 probe — see getNutritionFacts/types.js), so this
        // always resolves null today, and null means render NOTHING
        // nutritional — no placeholder tables, per the never-fabricate rule.
        await getNutritionFacts(food.id).catch(() => null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [food.id, profile]);

  // Suppress junk one-word descriptions like "Cooked" — only render a real
  // paragraph (non-empty and at least 8 characters).
  const description =
    facts?.longDescription && facts.longDescription.length >= 8
      ? facts.longDescription
      : null;

  const reconciledTier = assessment?.tier;
  const tierCfg = reconciledTier ? TIER_CONFIG[reconciledTier] : null;
  const perCondition = assessment?.perCondition || [];

  return (
    <BottomSheet open={true} onClose={onClose} title={food.name}>
      {loading ? (
        <div className="flex flex-col gap-4 py-2">
          <Skeleton shape="text" className="w-1/2 h-6" />
          <Skeleton shape="text" className="w-3/4" />
          <Skeleton shape="text" className="w-2/3" />
          <Skeleton shape="text" className="w-1/2" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Food Facts — dictionary-backed (photo, group, description).
              Self-hides entirely when the food isn't in the dictionary.
              Nutrition facts render nothing: the API exposes none (see
              getNutritionFacts) and we never show placeholder tables. */}
          {facts && (
            <div className="flex flex-col gap-2">
              <div className="w-full h-40 rounded-xl bg-sand-100 overflow-hidden">
                <img
                  src={facts.photo}
                  alt={facts.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
              {facts.groupLabel && (
                <p className="text-xs font-bold tracking-eyebrow uppercase text-char-500">
                  {facts.groupLabel}
                </p>
              )}
              {description && (
                <p className="text-sm text-char-700 font-sans leading-relaxed">
                  {description}
                </p>
              )}
            </div>
          )}

          {assessment?.usedFallback && (
            <div>
              <DemoDataChip />
            </div>
          )}

          {/* Header: Reconciled tier + library-add */}
          <div className="flex items-center justify-between">
            {tierCfg && (
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-pill text-sm font-semibold ${tierCfg.bg} ${tierCfg.fg}`}>
                <span className={`w-2 h-2 rounded-full ${tierCfg.dot}`} />
                {tierCfg.label}
              </span>
            )}

            {onAddToLibrary && (
              <button
                onClick={() => onAddToLibrary(food)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill
                  text-xs font-semibold text-forest-700 bg-forest-50
                  hover:bg-forest-100 transition-colors duration-fast
                  active:scale-[0.97]"
              >
                <BookmarkPlus size={14} />
                Add to library
              </button>
            )}
          </div>

          {/* Total references summary — referenceTotal is null (not 0) when
              any condition's /references fetch failed; skip the line rather
              than claiming zero studies. */}
          {assessment?.food?.referenceTotal > 0 && (
            <p className="text-xs text-char-500 font-sans">
              {assessment.food.referenceTotal} total {assessment.food.referenceTotal === 1 ? 'study' : 'studies'} across your conditions
            </p>
          )}

          {/* Per-condition breakdown */}
          {perCondition.length > 0 && (
            <div>
              <h3 className="text-xs font-bold tracking-eyebrow uppercase text-char-500 mb-2">
                Per-condition breakdown
              </h3>
              <div className="bg-paper-100 rounded-xl p-3">
                {perCondition.map((ca, i) => (
                  <ConditionRow key={ca.conditionId || i} conditionAssessment={ca} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
