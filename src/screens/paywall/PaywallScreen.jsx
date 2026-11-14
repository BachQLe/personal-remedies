/* PLACEHOLDER COPY — final pricing/positioning comes from Track C (C10) and must pass the C2 health-claim audit before shipping. */
/**
 * PaywallScreen — route target for /app/upgrade (REMEDI_MASTER_PLAN.md §6.2:
 * "Paywall screen — Mory's 'page that sells in-app purchase.'"), Task T5C
 * Part B.
 *
 * Reachable ONLY from the "Remedi Plus" row on ProfileScreen — never
 * auto-triggered, never shown as an interstitial. Every feature in the app
 * is unlocked today (src/api/entitlements.js, `defaultUnlocked: true`), so
 * this screen is scaffolding: it renders what a future paid tier could
 * include, straight from `listFeatures()`, and its CTA does not charge
 * anything — tapping it shows a snackbar explaining purchasing arrives with
 * the native app (RevenueCat wiring, §6.3, lands at native conversion).
 *
 * ALL COPY BELOW IS PLACEHOLDER. Feature names/descriptions are pulled from
 * entitlements.js's neutral, non-persuasive strings; the price is a visibly
 * fake placeholder. No benefit statements, no health-outcome claims — Fable
 * does not write user-facing health copy. Final copy/positioning is a
 * Track C (C10) deliverable that must clear the C2 health-claim audit
 * before this screen can ship for real; the yellow banner below is the
 * visible-in-UI draft indicator required alongside this file-header note.
 */
import { useSearchParams } from 'react-router-dom';
import { ENTITLEMENT_CONFIG, listFeatures } from '../../api/entitlements.js';
import { useSnackbar } from '../../context/SnackbarContext.jsx';
import Icon from '../../components/shared/Icon.jsx';
import PageHeader from '../../components/shared/PageHeader.jsx';
import BackButton from '../../components/shared/BackButton.jsx';

export default function PaywallScreen() {
  const { show } = useSnackbar();
  const features = listFeatures();
  const [searchParams] = useSearchParams();
  const requested = ENTITLEMENT_CONFIG.features[searchParams.get('feature')];

  const handleUpgrade = () => {
    show("Purchasing isn't available yet — it arrives with the native app.");
  };

  return (
    // Mirrors ProfileScreen's header-zone + paper shell scaffolding (same
    // -mb-28 / pb-28 navbar-clearance pattern — see the appshell-cream-fix
    // note) so this reads as a natural sub-page of Profile rather than a
    // different surface.
    <div className="min-h-screen -mb-28 bg-forest-300 flex flex-col">
      <PageHeader label="Personal Remedies Plus" className="pb-4">
        <div className="flex items-start gap-3 mt-3">
          <BackButton fallback="/app/profile" />
          <h1 className="font-display text-title font-semibold text-blue-950 leading-tight">
            Personal Remedies Plus
          </h1>
        </div>
      </PageHeader>

      <div className="paper-panel flex flex-col gap-5">
        {/* Draft indicator — required visible marker that nothing on this
            screen is final copy, positioning, or pricing (see file-header
            comment). Yellow, not the health-warning red ("avoid"/"signal")
            palette, so it never reads as a health caution. */}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-yellow-100 border border-yellow-300">
          <Icon name="alert-triangle" size={16} className="text-yellow-700 flex-shrink-0" aria-hidden="true" />
          <p className="text-xs font-semibold font-sans text-yellow-800">
            Draft — placeholder copy, not final pricing or feature claims
          </p>
        </div>

        {requested && (
          <p data-testid="paywall-requested" className="text-sm font-sans text-char-900 px-1">
            You opened <span className="font-semibold">{requested.label}</span>, which is part of Personal Remedies Plus.
          </p>
        )}

        {/* Price placeholder — deliberately fake, never a real number */}
        <div className="rounded-xl border border-sand-200 bg-white shadow-xs px-4 py-5 flex flex-col items-center text-center gap-1">
          <p className="eyebrow">
            Personal Remedies Plus
          </p>
          <p className="font-display text-title font-semibold text-blue-950 leading-tight mt-1">
            $X.XX
            <span className="text-base font-sans font-normal text-char-400"> / month (placeholder)</span>
          </p>
          <p className="text-xs text-char-400 font-sans">Price not yet set.</p>
        </div>

        {/* Feature list — rendered from entitlements.js's config, not
            hardcoded JSX, so it always matches what ENTITLEMENT_CONFIG
            registers. */}
        <div>
          <p className="eyebrow mb-3">
            What's included
          </p>
          <div className="flex flex-col gap-2">
            {features.map((feature) => (
              <div
                key={feature.key}
                className="flex items-start gap-3 px-4 py-3 rounded-sm bg-white border border-sand-200"
              >
                <span className="text-forest-700 mt-0.5 flex-shrink-0">
                  <Icon name="check" size={16} aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold font-sans text-char-900">
                    {feature.label}
                  </span>
                  {feature.description && (
                    <span className="block text-xs text-char-400 font-sans mt-0.5">
                      {feature.description}
                    </span>
                  )}
                </span>
              </div>
            ))}
            {features.length === 0 && (
              <p className="text-sm text-char-400 font-sans italic text-center py-6">
                Nothing to show yet.
              </p>
            )}
          </div>
        </div>

        {/* CTA — placeholder only. Everything is unlocked today
            (defaultUnlocked: true), so this never charges anything; it
            just explains that purchasing isn't wired up yet. */}
        <button
          onClick={handleUpgrade}
          className="btn btn-primary w-full mt-2"
        >
          Upgrade (placeholder)
        </button>
        <p className="text-[0.875rem] text-char-400 font-sans text-center -mt-3">
          Not a real purchase — everything in Personal Remedies is currently unlocked.
        </p>
      </div>
    </div>
  );
}
