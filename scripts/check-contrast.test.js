/**
 * check-contrast.test.js — regression guard for scripts/check-contrast.mjs
 * (T6A, REMEDI_MASTER_PLAN.md Phase 5 "Accessibility").
 *
 * This does NOT assert every pairing passes WCAG AA — as of this writing 15
 * of the app's 34 real color pairings fail (see KNOWN_FAILURES below), most
 * notably the primary CTA button (PrimaryButton.jsx, 3.46:1 vs the 4.5:1
 * required) and the entire SignalChip "beneficial/limit/avoid" tinted-text
 * system (2.42–3.83:1). Those are BRAND PALETTE decisions (which shade of
 * forest-700/benefit-600/etc. to use), not something this task is
 * authorized to silently change — REMEDI_MASTER_PLAN.md T6A brief: "if
 * existing pairings fail AA, do NOT silently change the brand palette —
 * report the failures clearly... Bach decides palette changes, not you."
 *
 * So instead this test locks in the CURRENT set of failing pairing ids as a
 * documented baseline:
 *   - A NEW failure (a pairing not in KNOWN_FAILURES that now fails) means
 *     someone introduced a regression — e.g. picked a lower-contrast token
 *     for existing UI — and the test fails loudly.
 *   - A pairing in KNOWN_FAILURES that starts PASSING (e.g. Bach approves a
 *     palette tweak) is reported as a friendly note, not a failure, so
 *     fixing one doesn't require touching this test file first — but it DOES
 *     mean KNOWN_FAILURES has gone stale and should be trimmed by whoever
 *     made that change.
 *   - Adding a brand-new PAIRINGS entry that fails AA requires a conscious
 *     choice: either fix the token pairing, or add its id to
 *     KNOWN_FAILURES with a reason — silently leaving it out isn't possible
 *     because the "no unexpected failures" assertion below will catch it.
 */
import { describe, expect, it } from 'vitest';
import { evaluatePairings } from './check-contrast.mjs';

/**
 * Pre-existing AA failures as of T6A (Aug 2026), each with the reason it's
 * allowlisted rather than fixed here. TODO(bach): review whether to bump
 * these tokens a shade or two for AA compliance; see check-contrast.mjs's
 * PAIRINGS list (and re-run `node scripts/check-contrast.mjs`) for exact
 * ratios and the offending hex pairs.
 * @type {Record<string, string>}
 */
const KNOWN_FAILURES = {
  'muted-text-on-white': 'char-400 (#8A8377) on white is 3.75:1, used for de-emphasized icon/label text app-wide — bumping to char-500 everywhere is a broader sweep than this task scope.',
  'primary-btn-text': "the app's primary CTA (PrimaryButton.jsx): text-on-dark (#F3EFE6) on forest-700 (#628C22) is 3.46:1 — the single highest-impact finding in this audit.",
  'pill-forest-text': 'same token pair as primary-btn-text, via .pill-forest in src/index.css.',
  'pill-honey-text': 'white on honey-600 (#C2902F) is 2.87:1 — legacy token, .pill-honey in src/index.css.',
  'retry-btn-text': 'DataState.jsx retry button reuses forest-700 background; white text is 3.97:1, just under 4.5:1.',
  'signalchip-beneficial-text': 'SignalChip.jsx "beneficial" tinted text (benefit-600 on benefit-100) is 3.44:1 — part of the brand-defining food-guidance signal system.',
  'signalchip-limit-text': 'SignalChip.jsx "limit" tinted text (caution-600 on caution-100) is 2.42:1 — the worst ratio in the audit.',
  'signalchip-limit-dot': 'SignalChip.jsx "limit" dot-icon fill (white on caution-600) is 2.93:1, just under the 3:1 UI-component threshold.',
  'signalchip-avoid-text': 'SignalChip.jsx "avoid" tinted text (avoid-600 on avoid-100) is 3.83:1.',
  'studyreferences-link': 'StudyReferences.jsx citation link (forest-700 on white) is 3.97:1 — also reused by pill-selected/primary-btn-text\'s forest-700.',
  'pillswitcher-selected-positive': 'PillSwitcher.jsx tone="positive" selected thumb (white on forest-600) is 2.80:1.',
  'pillswitcher-selected-negative': 'PillSwitcher.jsx tone="negative" selected thumb (white on red-500) is 4.05:1.',
  'pill-selected': 'Pill.jsx selected state reuses forest-700; white text is 3.97:1.',
  'searchinput-placeholder': 'SearchInput.jsx placeholder text (char-300 on white) is 2.18:1 — placeholder text is exempt from some interpretations of AA but fails outright here regardless.',
  'emptystate-icon': 'EmptyState.jsx icon-in-circle (forest-600 on forest-50) is 2.62:1, under the 3:1 UI-component threshold.',
};

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
