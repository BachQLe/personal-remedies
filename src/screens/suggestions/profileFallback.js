/**
 * resolveProfileWithConditions — shared profile resolution for the
 * Suggestions screens' data fetchers.
 *
 * Reads the profile from storage — the same source useAsyncData's
 * `requiresProfile` gate checks — synchronously, rather than awaiting api.js's
 * getProfile(). (getProfile() now re-reads storage on every call, so it no
 * longer goes stale after profileSync.pullProfile() writes the profile
 * straight to storage on sign-in; it was a load-time snapshot when checklist
 * 4.11 was fixed, which left `conditions: []` until a full reload.)
 * A legacy profile with name-string conditions still goes through getProfile()
 * for its one-time migration to numeric IDs.
 *
 * Normalizes `conditions` to always be an array. No demo conditions are
 * substituted: a profile without conditions stays empty and the adapter
 * returns honest empty results.
 *
 * This is ORTHOGONAL to useAsyncData's `requiresProfile` gate, which checks
 * whether a profile object exists in storage AT ALL — the real "no profile"
 * signal, surfaced as the 'empty-no-profile' state.
 * @returns {Promise<import('../../api/types.js').Profile>}
 */
import { getProfile } from '../../api/api.js';
import { storage } from '../../api/storage.js';

export async function resolveProfileWithConditions() {
  const stored = storage.get('profile', null);
  const p = stored?.conditions?.some((c) => typeof c !== 'number') ? await getProfile() : stored;
  return { ...(p ?? {}), conditions: p?.conditions ?? [] };
}
