/**
 * SaveButton — self-contained bookmark-icon toggle for saving/removing a
 * recipe to/from the user's library (src/state/library.js).
 *
 * Gating (see src/utils/saveGate.js): only recipes (`item.kind === 'recipe'`)
 * can be ADDED to the library, and never a harmful one — skull-rated
 * (`numericId >= 5`, or `tier === 'poor'` for items carrying only tier).
 * This only ever blocks adding — an item already saved (e.g. a legacy
 * ingredient or harmful recipe saved before this gate existed) can always
 * be removed.
 *
 * Three visual/behavioral states:
 *   - Saved              → filled bookmark. Tap removes from library.
 *   - Not saved, allowed → outline bookmark. Tap adds to library.
 *   - Not saved, blocked → bookmark with a diagonal slash. Tap calls
 *                           `onBlocked(message)` and does NOT save.
 *
 * This component does NOT render its own Snackbar/toast — the consuming
 * screen owns toast placement/z-index and passes a callback.
 *
 * Safe to nest inside a `<button>` (several cards, e.g. FoodImageCard,
 * RankedRow, have a `<button>` as their root): the root of this component is
 * a `<span role="button" tabIndex={0}>`, never a nested `<button>`, and every
 * click/keydown stops propagation so tapping this never also triggers a
 * parent card's own onClick.
 *
 * @param {Object} props
 * @param {{ id: number|string, name?: string, image?: string, group?: string,
 *   fineGroup?: string, tier?: string|null, numericId?: number|null,
 *   kind?: string }} props.item - The food/recipe object. Needs at least
 *   `.id` and `.kind`/`.tier` for gating; other fields are passed through to
 *   `addToLibrary` unchanged (same shape FoodDetailCard's handleSave builds,
 *   plus `kind` — see saveGate.js, `kind` must persist so a saved item's
 *   block-reason can be recomputed correctly later, e.g. in a saved-items
 *   grid).
 * @param {number} [props.size] - Bookmark icon size in px. Default 18.
 * @param {(message: string) => void} [props.onBlocked] - Called with the
 *   SAVE_BLOCK_MESSAGES string when a blocked add is attempted. The
 *   consuming screen is expected to route this into its own `showSnackbar`.
 * @param {string} [props.className] - Additional classes on the root span
 *   (e.g. to override the default circular backdrop for a given context).
 */
import { useEffect, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { getLibrary, subscribeLibrary, addToLibrary, removeFromLibrary } from '../../state/library.js';
import { getSaveBlockReason, SAVE_BLOCK_MESSAGES } from '../../utils/saveGate.js';

export default function SaveButton({ item, size = 18, onBlocked, className = '' }) {
  const [saved, setSaved] = useState(() => getLibrary().some((f) => f.id === item?.id));

  useEffect(() => {
    const unsubscribe = subscribeLibrary((items) => {
      setSaved(items.some((f) => f.id === item?.id));
    });
    return unsubscribe;
  }, [item?.id]);

  const blockReason = getSaveBlockReason(item);

  const handleActivate = (e) => {
    e.stopPropagation();
    if (saved) {
      removeFromLibrary(item.id);
      return;
    }
    if (blockReason) {
      onBlocked?.(SAVE_BLOCK_MESSAGES[blockReason]);
      return;
    }
    addToLibrary({
      id: item.id,
      name: item.name,
      image: item.image,
      group: item.group ?? null,
      fineGroup: item.fineGroup ?? null,
      tier: item.tier ?? null,
      numericId: item.numericId ?? null,
      kind: item.kind ?? null,
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleActivate(e);
    }
  };

  const ariaLabel = saved
    ? 'Remove from saved recipes'
    : blockReason
      ? SAVE_BLOCK_MESSAGES[blockReason]
      : 'Save recipe';

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      className={`tap-target inline-flex items-center justify-center w-8 h-8 rounded-full
        bg-white/90 backdrop-blur-sm shadow-sm cursor-pointer
        transition-all duration-fast hover:bg-white hover:shadow-md active:scale-95
        ${saved ? 'text-forest-700' : blockReason ? 'text-char-400' : 'text-char-700'}
        ${className}`}
    >
      {blockReason && !saved ? (
        <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
          <Bookmark size={size} aria-hidden="true" />
          <span
            aria-hidden="true"
            className="absolute left-0 top-1/2 h-[1.5px] w-[141%] bg-current"
            style={{ transform: 'translateY(-50%) rotate(-45deg)', transformOrigin: 'center' }}
          />
        </span>
      ) : (
        <Bookmark size={size} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
      )}
    </span>
  );
}
