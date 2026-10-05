/**
 * RequireEntitlement — entitlement gate (REMEDI_MASTER_PLAN.md §6.1/6.7).
 * Unlocked (the default): renders `children` untouched. Locked: renders an
 * upsell linking to /app/upgrade?feature=<key>, never a redirect.
 * `variant="inline"` renders in place (tab body); `variant="sheet"` renders the upsell in a BottomSheet (for sheet surfaces).
 */
import { Link } from 'react-router-dom';
import { ENTITLEMENT_CONFIG, hasEntitlement } from '../../api/entitlements.js';
import BottomSheet from './BottomSheet.jsx';
import { upgradePath } from './useEntitlement.js';


function Upsell({ featureKey }) {
  const feature = ENTITLEMENT_CONFIG.features[featureKey];
  return (
    <div
      data-testid="entitlement-upsell"
      className="flex flex-col items-center text-center gap-3 px-6 py-10"
    >
      <p className="font-label text-xs uppercase tracking-eyebrow text-char-400">Personal Remedies Plus</p>
      <h2 className="font-display text-xl font-semibold text-blue-950">
        {feature?.label ?? 'This feature'} is part of Personal Remedies Plus
      </h2>
      {feature?.description && (
        <p className="text-sm text-char-400 font-sans max-w-xs">{feature.description}</p>
      )}
      <Link
        to={upgradePath(featureKey)}
        className="mt-2 px-6 py-3 rounded-xs bg-forest-700 hover:bg-forest-800 text-white font-semibold font-sans text-base transition-colors duration-fast"
      >
        See Personal Remedies Plus
      </Link>
    </div>
  );
}

export default function RequireEntitlement({ feature, variant = 'page', open = true, onClose, children }) {
  if (hasEntitlement(feature)) return children;
  if (variant === 'sheet') {
    return (
      <BottomSheet open={open} onClose={onClose} title={ENTITLEMENT_CONFIG.features[feature]?.label}>
        <Upsell featureKey={feature} />
      </BottomSheet>
    );
  }
  return (
    <div className={variant === 'page' ? 'min-h-screen bg-paper-100' : undefined}>
      <Upsell featureKey={feature} />
    </div>
  );
}
