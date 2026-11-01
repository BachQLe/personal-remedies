/**
 * RankedRow — shared ranked/list row for food items on the Suggestions
 * screen. Originally lived inline in TopDosTab (Top Dos & Don'ts: name +
 * cache-only study count). Extracted here so Food Groups' CategoryDetailPanel
 * can reuse the same white bordered row on a plain glass background.
 *
 * Generalized just enough for that second use:
 *   - `food.numericId` (descriptionNumericID) renders the app-wide FoodRating
 *     stars/skulls, for callers that have it (the Suggest fine-group list;
 *     Top Dos & Don'ts and Food Groups rows carry none, so nothing shows).
 *
 * Props:
 *   food          — { id, name, group?, fineGroup?, groupLabel?, isLifestyle?, numericId?, image? }
 *   studyCount    — number | null/undefined — rendered as "N references" when a real number.
 *                   Tapping it opens the card on Health Details, where the references are.
 *   onSelect      — callback(food); `food.openDetails` is set when the count was the target
 *   saveAction    — optional save-button element (renders at the row's
 *                   trailing edge, before the chevron). Supports a plain node
 *                   or a function (same convention as FoodImageCard's
 *                   `saveAction`), and — like FoodImageCard's — is rendered
 *                   as-is with no extra click wrapper, since the node (e.g.
 *                   SaveButton) is expected to be self-contained and handle
 *                   its own click/keyboard/stopPropagation.
 *                   Both current callers (Top Dos & Don'ts, Food Groups) only
 *                   ever fetch plain foods/lifestyle items (recipes are
 *                   structurally excluded from both endpoints) — neither has
 *                   anything actually saveable, so neither passes this prop.
 *                   It exists for a future caller that DOES have a real
 *                   recipe to offer save on.
 *   imageRight    — opt-in image-card layout (Top Dos & Don'ts only; off by
 *                   default so CategoryDetailPanel's plain text row is
 *                   unchanged). Renders the item's resolved photo absolutely
 *                   positioned over the right half of the row, clipped to
 *                   the row's rounded corners, with 10 decreasing-opacity
 *                   white vertical bars over the photo's left edge so it
 *                   fades into the left half instead of cutting off sharply
 *                   (no CSS gradient — see the user's standing "no
 *                   gradients, use fading bars" rule). The left half itself
 *                   isn't flat white: it's the same photo, mirrored
 *                   horizontally, under a 90% white wash — a
 *                   soft color-matched bleed instead of a hard white gap —
 *                   and the fade bars start at that same 90% so the seam
 *                   between the two halves reads as one continuous fade.
 *                   The photo is resolved via `getIngredientImage` — the
 *                   same resolver FoodImageCard/SuggestionsSheet rows use —
 *                   so EVERY row gets a photo, including lifestyle/water/
 *                   juice items (their coarse group isn't in
 *                   `GROUP_FALLBACKS`, so they land on `getIngredientImage`'s
 *                   generic DEFAULT_FALLBACK photo, same as any other
 *                   unmatched food). Text content and the trailing
 *                   study-count/chevron cluster are raised above the photo
 *                   with `relative z-10` (a plain CSS stacking fact: an
 *                   absolutely-positioned sibling always paints over
 *                   non-positioned flex children, regardless of DOM order),
 *                   and the trailing cluster gets a small squared-off (not
 *                   pill) white backdrop so it stays readable over the
 *                   photo.
 *
 * No leading category-icon avatar and no "Lifestyle" chip: every row
 * (ordinary food, water/juice, lifestyle) renders with the exact same
 * structure, with no visual tell distinguishing lifestyle items from food
 * items — there is no separate notes/description text either.
 */
import { ChevronRight } from 'lucide-react';
import { getIngredientImage } from '../../api/ingredientImages.js';
import { getOverlayImageFile, getServingSize } from '../../api/localTables.js';
import FoodRating from './FoodRating.jsx';

// ── Image-right fade (10 discrete bars, never a CSS gradient) ───────────────

// Starts at 90% — matching the left half's mirrored-blur wash opacity, so
// the seam between the two halves reads as one continuous fade — and steps
// down gently over ~80px.
const FADE_OPACITIES = [0.90, 0.81, 0.72, 0.63, 0.54, 0.45, 0.36, 0.27, 0.18, 0.09];

function ImageFadeEdge() {
  return (
    <div className="absolute inset-y-0 left-0 flex" aria-hidden="true">
      {FADE_OPACITIES.map((opacity, i) => (
        <div key={i} className="w-2 h-full bg-white" style={{ opacity }} />
      ))}
    </div>
  );
}

export default function RankedRow({ food, studyCount, onSelect, saveAction, imageRight = false }) {
  const image = imageRight
    ? food.image || getIngredientImage(food.name, food.group, getOverlayImageFile(food.id))
    : null;
  const servingSize = getServingSize(food.id);

  return (
    <button
      onClick={(e) => onSelect(e.target.closest('[data-reference-count]') ? { ...food, openDetails: true } : food)}
      className={`relative w-full flex items-start gap-3 rounded-sm bg-white border border-sand-200 shadow-xs text-left overflow-hidden
        transition-all duration-fast hover:border-forest-300 hover:shadow-card active:scale-[0.99]
        ${imageRight ? 'min-h-[68px] px-4 py-3 items-center' : 'px-4 py-3'}`}
    >
      {/* Photo — right half only, image-right experiment (Top Dos & Don'ts).
          Clipped to the button's rounded corners by the button's own
          overflow-hidden above. The left half isn't flat white: it's a
          mirrored echo of the same photo under a 90% white wash,
          so the "empty" half reads as a soft bleed of the photo's own
          color rather than a hard gap. */}
      {imageRight && image && (
        <>
          <div className="absolute inset-y-0 left-0 w-1/2 overflow-hidden" aria-hidden="true">
            <img
              src={image}
              alt=""
              className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] object-cover scale-x-[-1]"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-white/95" />
          </div>
          <div className="absolute inset-y-0 right-0 w-1/2">
            <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            <ImageFadeEdge />
          </div>
        </>
      )}

      {/* Name + rating + group */}
      <span className={`flex-1 min-w-0 ${imageRight ? 'relative z-10' : ''}`}>
        <span className="flex items-center gap-2 flex-wrap">
          <span className="font-sans text-sm font-semibold text-char-900">
            {food.name}
          </span>
          <FoodRating numericId={food.numericId} tone="light" size={13} />
        </span>
        {/* Skip 'x' — Nutridigm's catch-all fine group has no real label, so
            getGroupLabel echoes the raw code back (see adapter.js). */}
        {food.groupLabel && food.groupLabel !== 'x' && (
          <span className="block text-[0.875rem] text-char-400 font-sans mt-0.5 break-words">
            {food.groupLabel}
          </span>
        )}
        {servingSize && (
          <span className="block text-[0.875rem] text-char-500 font-sans mt-0.5">
            Serving size: {servingSize}
          </span>
        )}
      </span>

      {/* Trailing cluster: cache-only study count, optional save action,
          chevron. Raised above the photo (imageRight) with a small
          squared-off white backdrop so it stays legible. */}
      <span
        className={`flex-shrink-0 flex items-center gap-2 self-center
          ${imageRight ? 'relative z-10 bg-white/90 rounded-md pl-2 pr-1.5 py-1' : ''}`}
      >
        {typeof studyCount === 'number' && studyCount > 0 && (
          <span data-reference-count className="flex-shrink-0 self-center text-[0.875rem] text-char-400 font-sans underline underline-offset-2">
            {studyCount} {studyCount === 1 ? 'reference' : 'references'}
          </span>
        )}

        {/* Save action — opt-in; see prop doc above. Rendered as-is (no extra
            click wrapper), same convention as FoodImageCard's `saveAction`. */}
        {saveAction && (
          <span className="flex-shrink-0 self-center">
            {typeof saveAction === 'function' ? saveAction() : saveAction}
          </span>
        )}

        <ChevronRight size={16} className="text-char-400 shrink-0 self-center" aria-hidden="true" />
      </span>
    </button>
  );
}
