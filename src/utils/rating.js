/**
 * rating.js — Pure mapping from the Nutridigm 7-step verdict ladder
 * (`descriptionNumericID`, 1-7) to a display-agnostic Rating shape.
 *
 * Aug 2026: replaces the old 0.5-stepped 5-star scale (`numericIdToStars` /
 * `STARS_BY_NUMERIC_ID` in src/api/adapter.js, now removed). The old scale
 * tried to linearize a 7-step categorical ladder onto a 5-star continuum
 * (1→5, 2→4.5, 3→4, 4→3, 5→2, 6→1.5, 7→1), which quietly implied a harmful
 * food (numericId 5-7) was still "worth 1-2 stars" — a positive-feeling
 * signal for something the product explicitly gates as unsaveable (see
 * src/utils/saveGate.js). The new ladder is discrete and honest about the
 * sign: 1-3 are genuinely positive (stars), 4 is neutral (nothing shown by
 * default), and 5-7 are genuinely harmful (skulls) — no shared scale, no
 * implied partial credit for a harmful item.
 *
 * Zero dependencies (mirrors src/utils/saveGate.js) so leaf UI components
 * (FoodRating, FoodImageCard, ...) can import this without pulling in the
 * adapter.js module graph.
 */

/** @typedef {{ kind: 'star' | 'skull' | 'neutral', count: 0|1|2|3 }} Rating */

const RATING_BY_NUMERIC_ID = Object.freeze({
  1: Object.freeze({ kind: 'star',    count: 3 }),
  2: Object.freeze({ kind: 'star',    count: 2 }),
  3: Object.freeze({ kind: 'star',    count: 1 }),
  4: Object.freeze({ kind: 'neutral', count: 0 }),
  5: Object.freeze({ kind: 'skull',   count: 1 }),
  6: Object.freeze({ kind: 'skull',   count: 2 }),
  7: Object.freeze({ kind: 'skull',   count: 3 }),
});

/**
 * Map a raw descriptionNumericID (1-7) to a Rating.
 * @param {number} numericId
 * @returns {Rating|null} null outside 1-7 (incl. null/undefined) — callers
 *   render nothing rather than guess.
 */
export function numericIdToRating(numericId) { return RATING_BY_NUMERIC_ID[numericId] ?? null; }

/** Lowest numericId that counts as harmful (skull-rated). */
export const HARMFUL_MIN_NUMERIC_ID = 5;

/**
 * True when a numericId is harmful (skull-rated, 5-7).
 * @param {number} numericId
 * @returns {boolean}
 */
export function isHarmfulNumericId(numericId) {
  return Number.isFinite(numericId) && numericId >= HARMFUL_MIN_NUMERIC_ID;
}
