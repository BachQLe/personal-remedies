/**
 * resolveProfileWithConditions — shared profile resolution for the
 * Suggestions screens' data fetchers.
 *
 * Normalizes the stored profile so `conditions` is always an array. No demo
 * conditions are substituted: a profile without conditions stays empty and
 * the adapter returns honest empty results.
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

export async function resolveProfileWithConditions() {
  const p = await getProfile();
  const conditions = p?.conditions ?? [];
  return { ...(p ?? {}), conditions };
}
