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
 *   showGroup     — show the item's food group under its name. Off on a screen titled with
 *                   that group, where every row would repeat the title.
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
 *   thumbnail     — opt-in photo layout (Top Dos & Don'ts only; off by default so
 *                   CategoryDetailPanel's plain text row is unchanged). Shows a left
 *                   64px rounded photo, the same row as GroupsTab, with the group and
 *                   serving-size lines hidden. Every row gets a photo via `getIngredientImage`.
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

export default function RankedRow({ food, studyCount, onSelect, saveAction, thumbnail = false, showGroup = true }) {
  const image = thumbnail
    ? food.image || getIngredientImage(food.name, food.group, getOverlayImageFile(food.id))
    : null;
  const servingSize = getServingSize(food.id);

  return (
    <button
      onClick={(e) => onSelect(e.target.closest('[data-reference-count]') ? { ...food, openDetails: true } : food)}
      className={`relative w-full flex gap-3 px-4 py-3 rounded-sm bg-white border border-sand-200 shadow-xs text-left overflow-hidden
        transition-all duration-fast hover:border-forest-300 hover:shadow-card active:scale-[0.99]
        ${thumbnail ? 'items-center' : 'items-start'}`}
    >
      {thumbnail && image && (
        <img src={image} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" loading="lazy" />
      )}

      {/* Name + rating + group */}
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2 flex-wrap">
          <span className={`font-sans font-semibold text-char-900 break-words min-w-0 ${thumbnail ? 'text-base leading-snug' : 'text-sm'}`}>
            {food.name}
          </span>
          <FoodRating numericId={food.numericId} tone="light" size={13} />
        </span>
        {/* Skip 'x' — Nutridigm's catch-all fine group has no real label, so
            getGroupLabel echoes the raw code back (see adapter.js). */}
        {!thumbnail && showGroup && food.groupLabel && food.groupLabel !== 'x' && (
          <span className="block text-[0.875rem] text-char-400 font-sans mt-0.5">
            {food.groupLabel}
          </span>
        )}
        {!thumbnail && servingSize && (
          <span className="block text-[0.875rem] text-char-500 font-sans mt-0.5">
            Serving size: {servingSize}
          </span>
        )}
      </span>

      {/* Trailing cluster: cache-only study count, optional save action, chevron. */}
      <span className="flex-shrink-0 flex items-center gap-2 self-center">
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
