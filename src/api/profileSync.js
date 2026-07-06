/**
 * profileSync — best-effort sync of local app state to the signed-in user's
 * `profiles` row in Supabase.
 *
 * Design:
 *   - localStorage (src/api/storage.js) remains the synchronous source of
 *     truth. The app must work fully signed-out (guest mode) — every export
 *     here no-ops cleanly when Supabase isn't configured or no user is
 *     signed in.
 *   - Sync is one denormalized row per user: profiles.conditions/preferences/
 *     library/daily_plan (see supabase/migrations/0002_profile_app_state.sql).
 *   - Merge rule: newer `updated_at` wins. On sign-in we compare the remote
 *     row's `updated_at` against a locally-tracked `lastSyncedAt` timestamp.
 *     If remote is newer, remote hydrates localStorage (e.g. same user on a
 *     new device). Otherwise local is pushed up — this is what migrates a
 *     guest's local profile into their account on first sign-in, since a
 *     fresh row's `updated_at` (set at insert time by the auth trigger) will
 *     be older than any local activity.
 *   - Writes are debounced (~2s trailing) via `schedulePush()` so rapid local
 *     mutations (swipes, queue edits) don't each trigger a network call.
 *   - Never throws into callers and never blocks the UI: Supabase errors are
 *     logged once via console.warn and swallowed.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase.js';
import { storage } from './storage.js';
import { reloadLibrary } from '../state/library.js';

const SYNC_META_KEY = 'syncMeta';
const DEBOUNCE_MS = 2000;

let _currentUser = null;
let _pushTimer = null;
let _warnedPushError = false;
let _warnedPullError = false;
let _storageUnsubscribe = null;
let _reconcileInFlight = null;
let _hydrating = false;

/** @returns {{ lastSyncedAt: string|null }} */
function getSyncMeta() {
  return storage.get(SYNC_META_KEY, { lastSyncedAt: null }) || { lastSyncedAt: null };
}

function setSyncMeta(patch) {
  storage.set(SYNC_META_KEY, { ...getSyncMeta(), ...patch });
}

/**
 * Split the local `profile` object into the `conditions` array column and an
 * opaque `preferences` jsonb blob (everything else on the profile).
 * @param {import('./types.js').Profile|null} profile
 */
function splitProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    return { conditions: [], preferences: {} };
  }
  const { conditions, ...preferences } = profile;
  return {
    conditions: Array.isArray(conditions) ? conditions.filter((c) => typeof c === 'number') : [],
    preferences,
  };
}

/** Re-combine a remote row's conditions + preferences back into a local `profile` object. */
function joinProfile(row) {
  const preferences = row.preferences && typeof row.preferences === 'object' ? row.preferences : {};
  const conditions = Array.isArray(row.conditions) ? row.conditions : [];
  return { ...preferences, conditions };
}

/**
 * Push the current local app state (profile/library/dailyPlan) up to the
 * user's `profiles` row. Fire-and-forget; errors are logged once and
 * swallowed so sync failures never break the app.
 * @param {{ id: string }} user
 */
async function pushNow(user) {
  if (!isSupabaseConfigured || !supabase || !user) return;

  const localProfile = storage.get('profile', null);
  const library = storage.get('library', []);
  const dailyPlan = storage.get('dailyPlan', null);
  const { conditions, preferences } = splitProfile(localProfile);

  const row = {
    id: user.id,
    conditions,
    preferences,
    library: Array.isArray(library) ? library : [],
    daily_plan: dailyPlan ?? null,
    updated_at: new Date().toISOString(),
  };
  if (localProfile) row.onboarding_completed = true;

  try {
    const { error } = await supabase.from('profiles').upsert(row);
    if (error) throw error;
    setSyncMeta({ lastSyncedAt: row.updated_at });
  } catch (err) {
    if (!_warnedPushError) {
      _warnedPushError = true;
      console.warn('[profileSync] push failed, continuing offline:', err);
    }
  }
}

/**
 * Schedule a debounced push (~2s trailing) for the given user. Safe to call
 * repeatedly — resets the timer each time. No-ops when signed out or
 * unconfigured.
 * @param {{ id: string }} [user] - defaults to the last known signed-in user.
 */
export function schedulePush(user = _currentUser) {
  if (!isSupabaseConfigured || !user) return;
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => {
    _pushTimer = null;
    pushNow(user);
  }, DEBOUNCE_MS);
}

/** Flush any pending debounced push immediately (best-effort, not awaited by callers). */
export function flushPush() {
  if (!_pushTimer) return;
  clearTimeout(_pushTimer);
  _pushTimer = null;
  if (_currentUser) pushNow(_currentUser);
}

/**
 * Fetch the user's remote `profiles` row and reconcile with local state:
 * newer `updated_at` wins. If remote is newer, hydrate localStorage from
 * remote and notify the src/state/ stores to re-read. Otherwise, push local
 * state up (this is what migrates a guest profile into the account on first
 * sign-in).
 * @param {{ id: string }} user
 */
export async function pullProfile(user) {
  if (!isSupabaseConfigured || !supabase || !user) return;

  let row;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('conditions, preferences, library, daily_plan, updated_at')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw error;
    row = data;
  } catch (err) {
    if (!_warnedPullError) {
      _warnedPullError = true;
      console.warn('[profileSync] pull failed, continuing offline:', err);
    }
    return;
  }

  if (!row || !row.updated_at) {
    // No remote state yet (fresh auth-trigger row) — push local up.
    await pushNow(user);
    return;
  }

  const { lastSyncedAt } = getSyncMeta();
  const remoteIsNewer = !lastSyncedAt || new Date(row.updated_at) > new Date(lastSyncedAt);

  if (remoteIsNewer) {
    // Suppress the onWrite → schedulePush echo while writing remote data
    // back into localStorage; there's nothing new to push right after a pull.
    _hydrating = true;
    try {
      if (row.preferences || row.conditions) {
        storage.set('profile', joinProfile(row));
      }
      if (row.library) storage.set('library', row.library);
      if (row.daily_plan !== undefined) storage.set('dailyPlan', row.daily_plan);
    } finally {
      _hydrating = false;
    }
    setSyncMeta({ lastSyncedAt: row.updated_at });
    notifyStoresReloaded();
  } else {
    await pushNow(user);
  }
}

/**
 * Ask the src/state/ pub/sub stores to re-read from localStorage after a
 * remote hydration.
 */
function notifyStoresReloaded() {
  try {
    reloadLibrary();
  } catch {
    /* state store failed to reload — non-fatal */
  }
}

/**
 * Run the sign-in reconciliation flow (pull-then-merge) for a user. Safe to
 * call multiple times; each call re-reconciles.
 * @param {{ id: string }} user
 */
function reconcile(user) {
  _reconcileInFlight = pullProfile(user).finally(() => {
    _reconcileInFlight = null;
  });
  return _reconcileInFlight;
}

/**
 * Call once at app level (see src/context/AuthContext.jsx). Subscribes to
 * Supabase auth state: on SIGNED_IN, pulls + reconciles the remote profile;
 * while signed in, local storage writes (profile/library/dailyPlan) schedule
 * a debounced push. No-ops entirely when Supabase isn't configured.
 * @returns {() => void} teardown function
 */
export function initProfileSync() {
  if (!isSupabaseConfigured || !supabase) return () => {};

  // Hook local writes → debounced push while signed in. storage.onWrite fires
  // for every key (profile, library, dailyPlan, recentSearches, ...); only
  // the three synced keys should trigger a push.
  const SYNCED_KEYS = new Set(['profile', 'library', 'dailyPlan']);
  _storageUnsubscribe = storage.onWrite((key) => {
    if (_hydrating || !_currentUser || !SYNCED_KEYS.has(key)) return;
    schedulePush();
  });

  supabase.auth.getSession().then(({ data }) => {
    const user = data?.session?.user ?? null;
    if (user) {
      _currentUser = user;
      reconcile(user);
    }
  });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    const user = session?.user ?? null;
    if (event === 'SIGNED_IN' && user) {
      _currentUser = user;
      reconcile(user);
    } else if (event === 'SIGNED_OUT') {
      flushPush();
      _currentUser = null;
    } else if (user) {
      _currentUser = user;
    }
  });

  return () => {
    subscription.unsubscribe();
    _storageUnsubscribe?.();
    _storageUnsubscribe = null;
    if (_pushTimer) {
      clearTimeout(_pushTimer);
      _pushTimer = null;
    }
  };
}
