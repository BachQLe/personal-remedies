/**
 * LibraryStrip — horizontal scrollable strip showing the user's saved ingredients.
 *
 * Lives on the Home screen directly below the primary CTA as the plan's
 * staging ground. Each item is a compact mini-card using IngredientCard (compact).
 * Items saved here are 2 clicks from being in the plan.
 *
 * Empty state: "Save ingredients from Lookup or Suggestions to build your plan."
 */

import { useState, useEffect } from 'react';
import { BookmarkPlus, X } from 'lucide-react';
import { getLibrary, removeFromLibrary, subscribeLibrary } from '../state/library.js';

/**
 * @param {Object} props
 * @param {(food: import('../api/types.js').Food) => void} [props.onSelectFood]
 */
export default function LibraryStrip({ onSelectFood }) {
  const [items, setItems] = useState(getLibrary);

  useEffect(() => {
    const unsub = subscribeLibrary(setItems);
    return unsub;
  }, []);

  // ── Empty state ────────────────────────────────────────────────────────────

  if (!items || items.length === 0) {
    return (
      <div className="flex items-center gap-3 px-4 py-4 bg-paper-100 rounded-xl border border-dashed border-sand-300">
        <BookmarkPlus size={20} className="text-char-400 flex-shrink-0" />
        <p className="text-sm text-char-500 font-sans leading-snug">
          Save ingredients from Lookup or Suggestions to build your plan.
        </p>
      </div>
    );
  }

  // ── Populated strip ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="font-label text-xs font-semibold uppercase tracking-eyebrow text-char-500">
          My Library
        </p>
        <span className="text-[11px] text-char-400 font-sans">
          {items.length} ingredient{items.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="relative -mx-1">
        <div className="flex gap-2 overflow-x-auto px-1 pb-2 scrollbar-hide">
          {items.map((food) => (
            <div
              key={food.id}
              className="relative flex flex-col items-center flex-shrink-0 w-[72px] group"
            >
              {/* Remove button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFromLibrary(food.id);
                }}
                className="absolute -top-1 -right-1 z-10 w-5 h-5 flex items-center justify-center
                  rounded-full bg-char-900/70 text-white opacity-0 group-hover:opacity-100
                  transition-opacity duration-fast"
                aria-label={`Remove ${food.name} from library`}
              >
                <X size={12} />
              </button>

              {/* Mini card body */}
              <button
                onClick={() => onSelectFood && onSelectFood(food)}
                className="w-[60px] h-[60px] rounded-lg overflow-hidden flex items-center justify-center
                  bg-forest-600 shadow-xs border border-sand-200
                  transition-all duration-base ease-ds-out
                  hover:shadow-card hover:-translate-y-[1px]
                  active:scale-[0.96]"
              >
                <span className="font-display text-lg font-semibold text-paper-100">
                  {food.name?.[0] || ''}
                </span>
              </button>

              {/* Label */}
              <span className="mt-1 text-[10px] font-sans text-char-700 text-center leading-tight line-clamp-2 w-full px-0.5">
                {food.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
