/**
 * CoverageNotice — persistent, non-dismissable inline notice shown at the
 * top of a Suggestions list when its data came from adapter.js's
 * demo-condition fallback (`withConditionFallback`, ~adapter.js:142) rather
 * than the profile's own conditions (REMEDI_MASTER_PLAN.md §4.2).
 *
 * A toast/Snackbar is deliberately NOT used here — this is a persistent
 * fact about the data on screen, not a transient event, and must stay
 * visible for as long as the (possibly-partial) data does. See
 * DataState.jsx's 'offline-cached' banner for the same non-dismissable
 * inline-notice pattern this borrows its visual language from.
 *
 * Shape limitation (see coverageMessage.js's header for the full read of
 * adapter.js): `usedFallback` is the only per-request signal available —
 * this can name exactly which condition IDs the returned data reflects
 * (DEFAULT_DEV_CONDITIONS, a fixed constant) and how many of the user's own
 * requested conditions fall outside that set, but NOT which specific
 * displayed item came from which condition within that set — Nutridigm's
 * multi-condition endpoints return one reconciled ranking, not a
 * per-condition breakdown.
 *
 * @param {Object} props
 * @param {boolean} props.usedFallback - From the adapter result
 *   (`{ usedFallback }` — see types.js's "usedFallback propagation" note).
 * @param {number[]} [props.requestedConditionIds] - The condition IDs
 *   actually asked for (profile.conditions BEFORE any fallback substitution)
 *   — used only to count how many fall outside the covered set.
 */
import { useEffect, useState } from 'react';
import { getConditionNames } from '../../api/api.js';
import { DEFAULT_DEV_CONDITIONS } from '../../api/config.js';
import Icon from '../../components/shared/Icon.jsx';
import { buildCoverageMessage, countUncovered } from './coverageMessage.js';

export default function CoverageNotice({ usedFallback, requestedConditionIds }) {
  const [coveredNames, setCoveredNames] = useState(null);

  useEffect(() => {
    // Nothing to resolve while there's no fallback to report — and no
    // setState here to reset any stale `coveredNames` either: the render
    // below gates on the `usedFallback` PROP directly (never on
    // `coveredNames`), so a stale value from a previous true→false→true
    // flip is simply never read while `usedFallback` is false, and once it
    // flips true again DEFAULT_DEV_CONDITIONS (a constant) resolves to the
    // exact same names anyway — nothing to correct.
    if (!usedFallback) return;
    let cancelled = false;
    getConditionNames(DEFAULT_DEV_CONDITIONS)
      .then((names) => {
        if (!cancelled) setCoveredNames(names);
      })
      .catch(() => {
        if (!cancelled) {
          setCoveredNames(DEFAULT_DEV_CONDITIONS.map((id) => `Condition ${id}`));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [usedFallback]);

  if (!usedFallback) return null;

  const uncoveredCount = countUncovered(requestedConditionIds, DEFAULT_DEV_CONDITIONS);
  const message = buildCoverageMessage(coveredNames, uncoveredCount);
  if (!message) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-2 px-4 py-2.5 rounded-lg bg-sand-100 border border-sand-200 text-char-600 text-xs font-sans font-medium"
    >
      <Icon name="info" size={14} className="text-char-400 shrink-0 mt-0.5" aria-hidden="true" />
      {/* COPY-REVIEW: flagged for C2 health-claim audit */}
      <span>{message}</span>
    </div>
  );
}
