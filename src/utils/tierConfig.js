/**
 * tierConfig.js — canonical text-tier-pill styling, for callers that only
 * have a tier STRING (no numericId) to render.
 *
 * Previously hand-rolled three times with drifting labels/colors
 * (RankedRow.jsx, FoodDetailCard.jsx, and RecipesScreen.jsx's local
 * TIER_CONFIG objects) — this is the single source of truth going forward.
 *
 * Prefer `FoodRating`/`numericIdToRating` (src/utils/rating.js) over this
 * whenever a real `numericId` (descriptionNumericID) is available — the
 * app's deliberate green-star/red-skull system is the canonical verdict
 * language; this text pill exists only for surfaces that genuinely never
 * receive a numericId, just a tier string (e.g. Top Dos & Don'ts and Food
 * Groups list rows via RankedRow — see its docblock).
 *
 * Mirrors adapter.js's `numericIdToTier` ladder (1→Top, 2→Strong, 3→Good,
 * 4→null/Neutral, 5-7→poor) so every tier string that function can produce
 * has a matching pill definition here.
 */
export const TIER_CONFIG = Object.freeze({
  Top: Object.freeze({
    label: 'Top',
    bg: 'bg-benefit-100',
    fg: 'text-benefit-600',
    dot: 'bg-benefit-600',
  }),
  Strong: Object.freeze({
    label: 'Strong',
    bg: 'bg-forest-50',
    fg: 'text-forest-700',
    dot: 'bg-forest-600',
  }),
  Good: Object.freeze({
    label: 'Good',
    bg: 'bg-paper-200',
    fg: 'text-char-700',
    dot: 'bg-char-500',
  }),
  poor: Object.freeze({
    label: 'Poor match',
    bg: 'bg-avoid-100',
    fg: 'text-avoid-600',
    dot: 'bg-avoid-600',
  }),
  Neutral: Object.freeze({
    label: 'Neutral',
    bg: 'bg-sand-100',
    fg: 'text-char-500',
    dot: 'bg-char-400',
  }),
});
