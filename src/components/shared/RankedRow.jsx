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
 *   studyCount    — number | null/undefined — rendered as "N studies" when a real number
 *   onSelect      — callback(food)
 *   onSaveBlocked — callback(message) — threaded through to SaveButton's onBlocked.
 *                   Both callers of RankedRow only ever fetch plain foods/lifestyle
 *                   items (recipes are structurally excluded from both endpoints),
 *                   so SaveButton's `item.kind` is hardcoded to 'food' here.
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
import { ChevronRight } from 'lucide-react';
import { cleanNotes } from '../../api/recommendations.js';
import { getNonFoodIcon } from '../../api/ingredientImages.js';
import SaveButton from './SaveButton.jsx';
import Icon from './Icon.jsx';

// ── Tier config (colors match the existing SignalChip benefit tokens) ───────

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

export default function RankedRow({ food, studyCount, onSelect, onSaveBlocked }) {
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
        <span className="flex-shrink-0 pt-0.5 text-[11px] text-char-400 font-sans whitespace-nowrap">
          {studyCount} {studyCount === 1 ? 'study' : 'studies'}
        </span>
      )}

      <SaveButton
        item={{ ...food, kind: 'food' }}
        onBlocked={onSaveBlocked}
        className="flex-shrink-0 self-center"
      />

      <ChevronRight size={16} className="text-char-400 shrink-0 self-center" aria-hidden="true" />
    </button>
  );
}
