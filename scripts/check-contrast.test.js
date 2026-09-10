/**
 * check-contrast.test.js — regression guard for scripts/check-contrast.mjs
 * (T6A, REMEDI_MASTER_PLAN.md Phase 5 "Accessibility").
 *
 * As of the W2 palette pass (Sep 2026) all 34 of the app's real color
 * pairings pass WCAG AA — see docs/a11y-checklist.md §3 for the summary of
 * which tokens changed and why. KNOWN_FAILURES below is the documented
 * baseline of pairings allowlisted as pre-existing brand-palette failures;
 * it is intentionally empty now that the baseline is clean.
 *
 * This test still does its job with an empty baseline:
 *   - A NEW failure (any pairing that now fails, since KNOWN_FAILURES is
 *     empty) means someone introduced a regression — e.g. picked a
 *     lower-contrast token for existing UI — and the test fails loudly.
 *   - Adding a brand-new PAIRINGS entry that fails AA requires a conscious
 *     choice: either fix the token pairing, or add its id to
 *     KNOWN_FAILURES with a reason — silently leaving it out isn't possible
 *     because the "no unexpected failures" assertion below will catch it.
 */
import { describe, expect, it } from 'vitest';
import { evaluatePairings } from './check-contrast.mjs';

/**
 * Documented AA-failure baseline. Empty as of the W2 palette pass (Sep
 * 2026) — the full 34-pairing set passes AA. Add an entry here only for a
 * newly-introduced pairing that's a deliberate, reported brand-palette
 * decision to leave failing (with the reason), not as a way to silence a
 * regression.
 * @type {Record<string, string>}
 */
const KNOWN_FAILURES = {};

describe('contrast check (T6A): AA regressions vs. documented baseline', () => {
  it('no pairing fails AA unless it is in the documented KNOWN_FAILURES baseline', async () => {
    const results = await evaluatePairings();
    const unexpectedFailures = results.filter((r) => !r.pass && !(r.id in KNOWN_FAILURES));

    expect(
      unexpectedFailures,
      unexpectedFailures.length > 0
        ? `New AA contrast failure(s) not in KNOWN_FAILURES:\n${unexpectedFailures
            .map((r) => `  - ${r.id}: ${r.ratio}:1 (need ${r.threshold}:1) — ${r.fg} on ${r.bg} [${r.fgHex} / ${r.bgHex}], source: ${r.source}`)
            .join('\n')}\nEither fix the token pairing or add it to KNOWN_FAILURES with a documented reason.`
        : undefined
    ).toEqual([]);
  });

  it('every PAIRINGS id referenced in KNOWN_FAILURES still exists (catches typos/renames)', async () => {
    const results = await evaluatePairings();
    const knownIds = new Set(results.map((r) => r.id));
    const staleRefs = Object.keys(KNOWN_FAILURES).filter((id) => !knownIds.has(id));
    expect(staleRefs, `KNOWN_FAILURES references pairing id(s) no longer in PAIRINGS: ${staleRefs.join(', ')}`).toEqual([]);
  });

  it('reports (without failing) any baseline entry that now passes, so it can be trimmed', async () => {
    const results = await evaluatePairings();
    const nowPassing = results.filter((r) => r.pass && r.id in KNOWN_FAILURES);
    if (nowPassing.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[check-contrast] Note: ${nowPassing.length} KNOWN_FAILURES entr${nowPassing.length === 1 ? 'y' : 'ies'} now PASS AA and can be removed from the baseline: ${nowPassing
          .map((r) => r.id)
          .join(', ')}`
      );
    }
    // Informational only — never fails the suite.
    expect(true).toBe(true);
  });
});
