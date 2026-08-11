/**
 * resolveProfileWithConditions — shared profile resolution for the
 * Suggestions screens' data fetchers.
 *
 * Reproduces the client-side dev convenience these screens already applied
 * inline (pre-T5B): if the stored profile has no `conditions` (onboarding
 * skipped the health-conditions step), default to DEFAULT_DEV_CONDITIONS so
 * the demo still shows guidance instead of nothing.
 *
 * This is ORTHOGONAL to src/hooks/useAsyncData.js's `requiresProfile` gate,
 * which checks whether a profile object exists in storage AT ALL — the real
 * "no profile" signal, surfaced as the 'empty-no-profile' state. This helper
 * only fills in conditions on an existing-but-conditions-less profile, which
 * `requiresProfile` has no opinion on (and still correctly returns
 * 'empty-no-profile' for the rare/edge case where storage has no profile at
 * all — e.g. cleared mid-session — since it reads storage directly rather
 * than trusting this helper's always-non-empty output).
 * @returns {Promise<import('../../api/types.js').Profile>}
 */
import { getProfile } from '../../api/api.js';
import { DEFAULT_DEV_CONDITIONS } from '../../api/config.js';

export async function resolveProfileWithConditions() {
  const p = await getProfile();
  const conditions = p?.conditions?.length ? p.conditions : DEFAULT_DEV_CONDITIONS;
  return { ...(p ?? {}), conditions };
}
