/**
 * goodForMe.js — pure verdict logic for the Search "Good for me?" sheet.
 *
 * Input: the `rows` from adapter.js's `getGoodForMe` (one per profile
 * condition, each with a `status` and the raw Nutridigm `numericId`).
 * Output: one plain-language overall verdict. Nothing is fabricated: a
 * verdict is only derived from rows with a real numericId; unscored rows
 * (no data / unauthorized / error) are counted and surfaced, never guessed.
 *
 * numericId ladder (matches adapter.js numericIdToTier): 1-3 helpful,
 * 4 neutral (no chip), 5-7 harmful.
 */

const names = (rows) => rows.map((r) => r.conditionName).join(', ');

/**
 * @param {Array<{conditionName: string, status: string, numericId: number|null}>} rows
 * @returns {{
 *   kind: 'good'|'mixed'|'avoid'|'neutral'|'unavailable'|'error'|'unknown'|'no-profile',
 *   headline: string, detail: string, unscored: number
 * }}
 */
export function summarizeGoodForMe(rows) {
  if (!rows || rows.length === 0) {
    return {
      kind: 'no-profile',
      headline: 'Add a condition to see this',
      detail: 'Check against my profile compares a food against the conditions in your profile.',
      unscored: 0,
    };
  }

  const scored = rows.filter((r) => r.status === 'ok' && Number.isFinite(r.numericId));
  const helpful = scored.filter((r) => r.numericId >= 1 && r.numericId <= 3);
  const harmful = scored.filter((r) => r.numericId >= 5 && r.numericId <= 7);
  const neutral = scored.filter((r) => r.numericId === 4);
  const unscored = rows.length - scored.length;
  const suffix = unscored
    ? ` ${unscored} of your ${rows.length} conditions couldn't be scored.`
    : '';

  if (scored.length === 0) {
    if (rows.every((r) => r.status === 'unauthorized')) {
      return {
        kind: 'unavailable',
        headline: "We can't score this for your conditions yet",
        detail: 'Scoring for your conditions is not available right now.',
        unscored,
      };
    }
    if (rows.some((r) => r.status === 'error')) {
      return {
        kind: 'error',
        headline: "Couldn't check this right now",
        detail: 'Something went wrong loading the answer. Try again in a moment.',
        unscored,
      };
    }
    return {
      kind: 'unknown',
      headline: 'No data for this food',
      detail: "We don't have scoring for this food against your conditions.",
      unscored,
    };
  }

  if (harmful.length && helpful.length) {
    return {
      kind: 'mixed',
      headline: 'Mixed for you',
      detail: `Ranked favorably for ${names(helpful)}; ranked lower for ${names(harmful)}.${suffix}`,
      unscored,
    };
  }
  if (harmful.length) {
    return {
      kind: 'avoid',
      headline: 'Ranked lower for you',
      detail: `Ranked lower for ${names(harmful)}.${suffix}`,
      unscored,
    };
  }
  if (helpful.length) {
    return {
      kind: 'good',
      headline: 'Ranked higher for you',
      detail: `Ranked favorably for ${names(helpful)}.${suffix}`,
      unscored,
    };
  }
  return {
    kind: 'neutral',
    headline: 'Neutral for you',
    detail: `Neither ranked especially higher nor lower for ${names(neutral)}.${suffix}`,
    unscored,
  };
}

/**
 * One-line status text for a row that has no real score.
 * @param {{status: string}} row
 * @returns {string|null} null when the row is scored.
 */
export function unscoredRowText(row) {
  switch (row.status) {
    case 'unauthorized': return "Can't be scored yet";
    case 'error': return "Couldn't load";
    case 'nodata': return 'No data';
    default: return null;
  }
}
