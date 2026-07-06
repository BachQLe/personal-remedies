/**
 * IngredientCard — universal ingredient card used in Lookup results,
 * Suggestions, alternatives, and recipe ingredient rows.
 *
 * Props:
 *   food          — Food object from api (has id, name, group, tier, referenceTotal)
 *   onAddToLibrary — callback(food) — library-add action
 *   onSelect      — callback(food) — tap body → opens FoodDetail
 *   compact       — boolean — smaller variant for ingredient rows
 *
 * Shows: food name, tier label (Top/Strong/Good using signal colors),
 *        study-reference count ("21 studies"). NEVER a numeric score.
 * Primary action: BookmarkPlus icon for library-add.
 */
import { BookmarkPlus } from 'lucide-react';

// ── Tier config (colors match the existing SignalChip benefit tokens) ──────

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
 * @param {Object} props
 * @param {import('../api/types.js').Food} props.food
 * @param {(food: import('../api/types.js').Food) => void} [props.onAddToLibrary]
 * @param {(food: import('../api/types.js').Food) => void} [props.onSelect]
 * @param {boolean} [props.compact]
 */
export default function IngredientCard({ food, onAddToLibrary, onSelect, compact = false }) {
  const tier = food.tier;
  const tierCfg = tier ? TIER_CONFIG[tier] : null;
  const refCount = food.referenceTotal;

  const handleBodyClick = () => {
    if (onSelect) onSelect(food);
  };

  const handleLibraryAdd = (e) => {
    e.stopPropagation();
    if (onAddToLibrary) onAddToLibrary(food);
  };

  // ── Compact variant (ingredient rows) ──────────────────────────────────────

  if (compact) {
    return (
      <div
        onClick={handleBodyClick}
        className="flex items-center gap-2.5 py-2 px-3 rounded-lg cursor-pointer
          transition-all duration-base ease-ds-out
          hover:bg-paper-200 active:scale-[0.99]"
      >
        {/* Name */}
        <span className="flex-1 min-w-0 font-sans text-sm font-medium text-char-900 truncate">
          {food.name}
        </span>

        {/* Tier pill (compact) */}
        {tierCfg && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-[11px] font-semibold ${tierCfg.bg} ${tierCfg.fg}`}>
            <span className={`w-[6px] h-[6px] rounded-full ${tierCfg.dot}`} />
            {tierCfg.label}
          </span>
        )}

        {/* Reference count */}
        {refCount > 0 && (
          <span className="text-[11px] text-char-400 font-sans whitespace-nowrap">
            {refCount} {refCount === 1 ? 'study' : 'studies'}
          </span>
        )}

        {/* Library-add button */}
        {onAddToLibrary && (
          <button
            onClick={handleLibraryAdd}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full
              text-forest-700 hover:bg-forest-50 transition-colors duration-fast"
            aria-label={`Add ${food.name} to library`}
          >
            <BookmarkPlus size={16} />
          </button>
        )}
      </div>
    );
  }

  // ── Full variant (Lookup results, Suggestions, alternatives) ───────────────

  return (
    <div
      onClick={handleBodyClick}
      className="w-full flex items-center gap-3.5 bg-white rounded-xl border border-sand-200
        p-3.5 shadow-xs text-left cursor-pointer
        transition-all duration-base ease-ds-out
        hover:border-forest-300 hover:shadow-card hover:-translate-y-[1px]
        active:translate-y-[1px] active:scale-[0.99]"
    >
      {/* Thumbnail / initial */}
      <div className="w-[52px] h-[52px] rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center bg-forest-600">
        <span className="font-display text-[22px] font-semibold text-paper-100">
          {food.name?.[0] || ''}
        </span>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
        <span className="font-sans font-semibold text-char-900 text-sm truncate leading-tight">
          {food.name}
        </span>

        {/* Tier label + reference count row */}
        <div className="flex items-center gap-2 mt-0.5">
          {tierCfg && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill text-xs font-semibold ${tierCfg.bg} ${tierCfg.fg}`}>
              <span className={`w-[7px] h-[7px] rounded-full ${tierCfg.dot}`} />
              {tierCfg.label}
            </span>
          )}
          {refCount > 0 && (
            <span className="text-[11px] text-char-400 font-sans">
              {refCount} {refCount === 1 ? 'study' : 'studies'}
            </span>
          )}
        </div>
      </div>

      {/* Library-add button */}
      {onAddToLibrary && (
        <button
          onClick={handleLibraryAdd}
          className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full
            text-forest-700 bg-forest-50 hover:bg-forest-100
            transition-colors duration-fast"
          aria-label={`Add ${food.name} to library`}
        >
          <BookmarkPlus size={18} />
        </button>
      )}
    </div>
  );
}
