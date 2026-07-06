/**
 * SwapSheet — bottom sheet of healthier swaps for a given food.
 *
 * On open, fetches alternatives in the same fine food group via
 * getAlternatives(food.id, profile) — a real, tier-filtered /suggest call.
 * Fetching happens ONLY on open (never per-card fan-out); repeat opens for
 * the same food are cheap since the underlying call may be cached upstream.
 *
 * Props:
 *   open      — boolean, sheet visibility
 *   onClose   — callback to dismiss
 *   food      — the item being swapped (needs id/foodId, name, fineGroup/group)
 *   profile   — Profile (passed to getAlternatives)
 *   onSwap    — callback(alternative) — selecting a swap
 */
import { useState, useEffect } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { getAlternatives, getGroupLabel } from '../api/api.js';
import { getIngredientImage } from '../api/ingredientImages.js';
import BottomSheet from './shared/BottomSheet.jsx';
import Skeleton from './shared/Skeleton.jsx';
import DemoDataChip from './shared/DemoDataChip.jsx';

// ── Tier config (matches IngredientCard / FoodDetail) ───────────────────────

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
};

/**
 * Single alternative row — thumbnail, name, tier pill.
 */
function SwapRow({ alt, onSelect }) {
  const tierCfg = alt.tier ? TIER_CONFIG[alt.tier] : null;
  const thumb = getIngredientImage(alt.name, alt.fineGroup || alt.group);

  return (
    <button
      onClick={() => onSelect(alt)}
      className="w-full flex items-center gap-3 bg-white rounded-xl border border-sand-200
        p-3 shadow-xs text-left
        transition-all duration-base ease-ds-out
        hover:border-forest-300 hover:shadow-card hover:-translate-y-[1px]
        active:translate-y-[1px] active:scale-[0.99]"
    >
      {/* Thumbnail */}
      <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-sand-100">
        <img
          src={thumb}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      </div>

      {/* Name */}
      <span className="flex-1 min-w-0 font-sans text-sm font-medium text-char-900 truncate">
        {alt.name}
      </span>

      {/* Tier pill */}
      {tierCfg && (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill text-xs font-semibold flex-shrink-0 ${tierCfg.bg} ${tierCfg.fg}`}>
          <span className={`w-[7px] h-[7px] rounded-full ${tierCfg.dot}`} />
          {tierCfg.label}
        </span>
      )}
    </button>
  );
}

function SwapSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-sand-200">
          <Skeleton shape="block" className="w-11 h-11 flex-shrink-0" />
          <Skeleton shape="text" className="flex-1 h-4" />
          <Skeleton shape="pill" className="w-16 flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {import('../api/types.js').Food} props.food
 * @param {import('../api/types.js').Profile} props.profile
 * @param {(alternative: import('../api/types.js').Food) => void} props.onSwap
 */
export default function SwapSheet({ open, onClose, food, profile, onSwap }) {
  const [alternatives, setAlternatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usedFallback, setUsedFallback] = useState(false);
  const [groupLabel, setGroupLabel] = useState('');

  const foodId = food?.foodId ?? food?.id;
  const fineGroup = food?.fineGroup || food?.group;

  useEffect(() => {
    if (!open || !foodId || !profile) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [alts, label] = await Promise.all([
          getAlternatives(foodId, profile),
          getGroupLabel(fineGroup),
        ]);
        if (cancelled) return;
        const filtered = (alts || []).filter((a) => a.id !== foodId);
        setAlternatives(filtered);
        setUsedFallback(!!alts?.usedFallback);
        setGroupLabel(label || food?.groupLabel || '');
      } catch (err) {
        console.error('SwapSheet: getAlternatives failed', err);
        if (!cancelled) {
          setAlternatives([]);
          setGroupLabel(food?.groupLabel || '');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fetch only when the sheet is (re)opened for a food/profile
  }, [open, foodId, profile]);

  const handleSelect = (alt) => {
    if (onSwap) onSwap(alt);
    onClose?.();
  };

  const title = groupLabel ? `Better picks in ${groupLabel}` : 'Better picks';

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3">
        {usedFallback && (
          <div>
            <DemoDataChip />
          </div>
        )}

        {loading ? (
          <SwapSkeleton />
        ) : alternatives.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {alternatives.map((alt) => (
              <SwapRow key={alt.id} alt={alt} onSelect={handleSelect} />
            ))}
          </div>
        ) : (
          <div className="py-8 px-4 flex flex-col items-center text-center gap-2">
            <div className="w-10 h-10 rounded-full bg-sand-100 flex items-center justify-center">
              <ArrowLeftRight size={18} className="text-char-400" />
            </div>
            <p className="text-sm text-char-500 font-sans">
              No better options in this group
            </p>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
