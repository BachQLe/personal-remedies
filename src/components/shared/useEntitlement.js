import { hasEntitlement } from '../../api/entitlements.js';

export function useEntitlement(featureKey) {
  return hasEntitlement(featureKey);
}

export function upgradePath(featureKey) {
  return `/app/upgrade?feature=${encodeURIComponent(featureKey)}`;
}
