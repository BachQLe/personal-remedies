/**
 * coverageMessage.js — pure copy-building logic for the partial-data
 * ("demo guidance") notice (REMEDI_MASTER_PLAN.md §4.2).
 *
 * ── What's actually knowable at the UI layer ────────────────────────────────
 * adapter.js's `withConditionFallback` (see src/api/adapter.js ~:142) is an
 * ALL-OR-NOTHING retry: when the profile's requested condition IDs 401 with
 * NOTAUTHORIZEDHEALTHID, it re-issues the SAME request with
 * `DEFAULT_DEV_CONDITIONS` (config.js — currently `[203, 244]`, "Aging" +
 * "Pneumonia") substituted for the ENTIRE condition list, and returns a
 * single `usedFallback: boolean` flag alongside the result. Nutridigm's
 * /topdoordonts, /detailed and /suggest endpoints return one reconciled
 * ranking for a multi-condition request — there is no per-condition
 * attribution in the response (nothing says "food X ranks here because of
 * condition 203, not 244"). So this module can honestly state:
 *   1. EXACTLY which condition IDs the guidance actually reflects, when a
 *      fallback happened — DEFAULT_DEV_CONDITIONS, a fixed, known constant
 *      (not a guess).
 *   2. How many of the user's OWN requested conditions are outside that set
 *      (a true set-difference between what was asked for and what was
 *      substituted) — i.e. "N of your conditions aren't covered."
 * It can NOT honestly claim that a specific displayed item's ranking came
 * from one particular condition in that substituted set rather than another
 * — that finer-grained, item-level attribution isn't in the shape adapter.js
 * returns today. A follow-up wave that wants that needs adapter.js to thread
 * richer per-condition coverage through `withConditionFallback`'s callers.
 *
 * Kept framework-free (no React) so it can be unit-tested directly, mirroring
 * src/api/loadState.js's approach.
 */

/**
 * Join a list of display names into a natural-language string ("A", "A and
 * B", "A, B, and C").
 * @param {string[]} names
 * @returns {string}
 */
export function joinNames(names) {
  if (!names || names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/**
 * Count how many of the requested condition IDs are NOT among the condition
 * IDs the guidance actually reflects — a plain set-difference, never a
 * guess about per-item attribution within the covered set.
 * @param {number[]|null|undefined} requestedConditionIds
 * @param {number[]} coveredConditionIds
 * @returns {number}
 */
export function countUncovered(requestedConditionIds, coveredConditionIds) {
  const requested = requestedConditionIds || [];
  const covered = coveredConditionIds || [];
  return requested.filter((id) => !covered.includes(id)).length;
}

/**
 * Build the factual, data-coverage-only notice copy. Returns `null` when
 * there's nothing to say (no covered names resolved yet).
 *
 * COPY-REVIEW: flagged for C2 health-claim audit — every branch here is
 * about which conditions the DATA covers, never about health outcomes.
 *
 * @param {string[]|null} coveredNames - Display names for the condition IDs
 *   the guidance actually reflects (DEFAULT_DEV_CONDITIONS, resolved via
 *   getConditionNames).
 * @param {number} uncoveredCount - Result of `countUncovered`.
 * @returns {string|null}
 */
export function buildCoverageMessage(coveredNames, uncoveredCount) {
  if (!coveredNames || coveredNames.length === 0) return null;
  const namesText = joinNames(coveredNames);

  if (uncoveredCount > 0) {
    const noun = uncoveredCount === 1 ? 'condition' : 'conditions';
    const verb = uncoveredCount === 1 ? "isn't" : "aren't";
    return `Showing demo guidance for ${namesText} only — ${uncoveredCount} of your ${noun} ${verb} covered by this data yet.`;
  }

  return `Showing demo guidance for ${namesText} — a placeholder condition set, not your own profile.`;
}
