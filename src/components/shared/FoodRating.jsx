import { Star } from 'lucide-react';
import Skeleton from './Skeleton.jsx';
import { SkullGlyph } from './Icon.jsx';
import { numericIdToRating } from '../../utils/rating.js';

/**
 * FoodRating — the app-wide rating row for a food/recipe's Nutridigm
 * verdict, replacing the old StarRating.jsx (Aug 2026, see
 * src/utils/rating.js for the full rationale).
 *
 * Takes a raw `numericId` (descriptionNumericID, 1-7) and maps it internally
 * via `numericIdToRating` — no caller needs to know the ladder or ever
 * compute stars/skulls itself. Always renders (or reserves) exactly 3 icon
 * slots so the row's width is stable across every possible verdict, never
 * shifting surrounding layout as data loads in.
 *
 * Two honestly-distinct "nothing to show" cases, each rendering
 * differently on purpose:
 *   - No data (`numericId` null/undefined/out of 1-7 range) → renders
 *     nothing at all. We never fake a rating for an unassessed item.
 *   - Neutral (numericId 4) → renders a single unfilled/outline star, in
 *     every context (compact cards and detail views alike). This is a
 *     temporary placeholder pending a real "neutral" glyph.
 *
 * Surfaces: defaults to `tone="dark"` — colors (`text-white`,
 * `text-white/25`, `text-red-400`, `bg-white/15`, ...) tuned for the dark
 * photo-gradient overlays this component was built for (FoodImageCard,
 * FoodDetailCard's front face). Pass `tone="light"` for a white/paper card
 * surface (e.g. FoodDetailCard's back-face "Conditions in your profile"
 * rows) — uses the app's benefit/avoid signal tokens instead.
 *
 * Two deliberate removals versus the old StarRating:
 *   - No `showValue`/`X/5` text — there's no natural denominator on a
 *     3-scale, and that text was the last surviving "/5" reference in the
 *     UI. The `role="img"` `aria-label` now carries that information
 *     instead, and gives Playwright/a11y tooling a stable text hook
 *     (e.g. "2 of 3 skulls — harmful for your conditions").
 *   - No clip-overlay partial-fill trick — that only ever existed to fake
 *     half-star fills, and half-ratings don't exist on this discrete
 *     7-step ladder.
 *
 * @param {Object} props
 * @param {number|null|undefined} props.numericId - Raw descriptionNumericID
 *   (1-7). Anything else (null/undefined/out of range) renders nothing.
 * @param {number} [props.size] - Icon glyph size in px, default 15.
 * @param {boolean} [props.loading] - Renders a skeleton placeholder instead.
 * @param {'dark'|'light'} [props.tone] - Surface the row sits on. Default
 *   'dark' (photo overlays). Use 'light' on a white/paper card.
 * @param {string} [props.className] - Appended to the root element.
 */
export default function FoodRating({
  numericId, size = 15, loading = false, tone = 'dark', className = '',
}) {
  const isLight = tone === 'light';

  if (loading) {
    // shape="block" (not "pill") on purpose — Skeleton's pill variant hardcodes
    // h-7, and className order in the attribute does not beat it (Tailwind
    // stylesheet source order decides).
    return <Skeleton shape="block" className={`h-4 w-16 rounded-pill ${className}`} tint={isLight ? 'bg-sand-200' : 'bg-white/15'} />;
  }

  const rating = numericIdToRating(numericId);
  if (!rating) return null;

  if (rating.kind === 'neutral') {
    // Temporary placeholder: a single unfilled/outline star, in every
    // context (compact cards and detail views alike), until there's a
    // real "neutral" glyph.
    return (
      <div className={`flex items-center gap-[2px] ${className}`} role="img" aria-label="Neutral — neither helps nor hurts">
        <Star size={size} fill="none" aria-hidden="true" className={`flex-shrink-0 ${isLight ? 'text-char-400' : 'text-white/70'}`} />
      </div>
    );
  }

  const isSkull = rating.kind === 'skull';
  const on  = isLight ? (isSkull ? 'text-avoid-600' : 'text-benefit-600') : (isSkull ? 'text-red-400'    : 'text-white');
  const off = isLight ? 'text-char-300' : (isSkull ? 'text-red-400/25' : 'text-white/25');
  const label = isSkull
    ? `${rating.count} of 3 skulls — ranked lower for your conditions`
    : `${rating.count} of 3 stars — ranked higher for your conditions`;

  return (
    <div className={`flex items-center gap-[2px] ${className}`} role="img" aria-label={label}>
      {[0, 1, 2].map((i) => {
        const cls = `flex-shrink-0 ${i < rating.count ? on : off}`;
        return isSkull
          ? <SkullGlyph key={i} size={size} className={cls} />
          : <Star key={i} size={size} fill="currentColor" className={cls} aria-hidden="true" />;
      })}
    </div>
  );
}
