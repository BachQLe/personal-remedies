/**
 * RankedRow — shared ranked/list row for food items on the Suggestions
 * screen. Originally lived inline in TopDosTab (Top Dos & Don'ts: name +
 * lifestyle chip + cleaned notes + cache-only study count). Extracted here
 * so Food Groups' CategoryDetailPanel can reuse the same white bordered row
 * on a plain glass background.
 *
 * Generalized just enough for that second use:
 *   - `food.tier` (Top/Strong/Good) renders an optional compact tier pill,
 *     for callers that have tier data (Top Dos & Don'ts explicitly carries
 *     no tier data, so this stays invisible there).
 *
 * Props:
 *   food          — { id, name, group?, fineGroup?, groupLabel?, notes?, isLifestyle?, tier? }
 *   studyCount    — number | null/undefined — rendered as "N studies" when a real number,
 *                   with a small info affordance explaining what the count means.
 *   onSelect      — callback(food)
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
 *
 * Non-food icon rule (master plan 1.10, decision j): `food.group`/
 * `food.fineGroup` are already present on both callers' Food objects
 * (adapter.js's getTopDosAndDonts/getCategoryDetail), so this row resolves
 * its own leading icon via `getNonFoodIcon` — no caller wiring needed. Coarse
 * group 'k' (Key Nutrients & Herbal) or fine group 'x'/'j1' (lifestyle) get
 * a small category-icon avatar; everything else keeps today's plain text
 * row (RankedRow has never rendered a food photo, so ordinary foods are
 * already rule-compliant — the icon is purely additive signal here).
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Info } from 'lucide-react';
import { cleanNotes } from '../../api/recommendations.js';
import { getNonFoodIcon } from '../../api/ingredientImages.js';
import { TIER_CONFIG } from '../../utils/tierConfig.js';
import Icon from './Icon.jsx';

// ── Study count + info tooltip ──────────────────────────────────────────────

/**
 * "N studies" text with a small tap/click-to-open explanation of what the
 * count means (a native `title` attribute doesn't work on touch devices, so
 * this is a minimal self-contained popover instead). Closes on outside
 * click/tap; stops propagation so tapping it never also triggers the row's
 * own onSelect.
 */
function StudyCountBadge({ studyCount }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const toggle = (e) => {
    e.stopPropagation();
    setOpen((v) => !v);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle(e);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <span ref={rootRef} className="relative flex-shrink-0 self-center">
      <span
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        aria-label={`${studyCount} ${studyCount === 1 ? 'study' : 'studies'} — what does this mean?`}
        className="inline-flex items-center gap-0.5 -m-1 p-1 pt-0.5 text-[11px] text-char-400 font-sans
          whitespace-nowrap cursor-pointer hover:text-char-600"
      >
        {studyCount} {studyCount === 1 ? 'study' : 'studies'}
        <Info size={11} aria-hidden="true" />
      </span>
      {open && (
        <span
          role="tooltip"
          className="absolute z-20 right-0 top-full mt-1 w-44 rounded-sm bg-char-900 text-white
            text-[11px] font-sans leading-snug px-2.5 py-2 shadow-lg"
        >
          {studyCount} clinical {studyCount === 1 ? 'study supports' : 'studies support'} this item's ranking for your conditions.
        </span>
      )}
    </span>
  );
}

export default function RankedRow({ food, studyCount, onSelect, saveAction }) {
  const notes = food.isLifestyle ? cleanNotes(food.notes) : '';
  const tierCfg = food.tier ? TIER_CONFIG[food.tier] : null;
  const nonFoodIcon = getNonFoodIcon(food.group, food.fineGroup);

  return (
    <button
      onClick={() => onSelect(food)}
      className="w-full flex items-start gap-3 px-4 py-3 rounded-sm bg-white border border-sand-200 shadow-xs text-left
        transition-all duration-fast hover:border-forest-300 hover:shadow-card active:scale-[0.99]"
    >
      {/* Category icon avatar — non-food items only (never a photo here;
          see the file header note). */}
      {nonFoodIcon && (
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-sand-100 flex items-center justify-center self-center">
          <Icon name={nonFoodIcon} size={16} className="text-char-500" aria-hidden="true" />
        </span>
      )}

      {/* Name + lifestyle/tier chip + group + notes */}
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="font-sans text-sm font-semibold text-char-900">
            {food.name}
          </span>
          {food.isLifestyle && (
            <span className="inline-flex items-center h-[18px] px-2 rounded-pill
              bg-sand-100 border border-sand-200 text-[10px] font-semibold font-sans text-char-500">
              Lifestyle
            </span>
          )}
          {tierCfg && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-[11px] font-semibold ${tierCfg.bg} ${tierCfg.fg}`}>
              <span className={`w-[6px] h-[6px] rounded-full ${tierCfg.dot}`} />
              {tierCfg.label}
            </span>
          )}
        </span>
        {/* Skip 'x' — Nutridigm's catch-all fine group has no real label, so
            getGroupLabel echoes the raw code back (see adapter.js). */}
        {food.groupLabel && food.groupLabel !== 'x' && (
          <span className="block text-[11px] text-char-400 font-sans mt-0.5 truncate">
            {food.groupLabel}
          </span>
        )}
        {notes && (
          <span className="block text-xs text-char-500 font-sans mt-1 leading-snug">
            {notes}
          </span>
        )}
      </span>

      {/* Cache-only study count — render only when a real number is known */}
      {typeof studyCount === 'number' && studyCount > 0 && (
        <StudyCountBadge studyCount={studyCount} />
      )}

      {/* Save action — opt-in; see prop doc above. Rendered as-is (no extra
          click wrapper), same convention as FoodImageCard's `saveAction`. */}
      {saveAction && (
        <span className="flex-shrink-0 self-center">
          {typeof saveAction === 'function' ? saveAction() : saveAction}
        </span>
      )}

      <ChevronRight size={16} className="text-char-400 shrink-0 self-center" aria-hidden="true" />
    </button>
  );
}
