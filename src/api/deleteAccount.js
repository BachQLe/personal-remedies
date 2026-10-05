/**
 * deleteAccount — in-app account / data deletion (Apple 5.1.1(v), Google Play).
 *
 * Cloud first, local last: if the cloud delete fails (offline, server error)
 * NOTHING is wiped and the user stays signed in so they can retry.
 *
 * Result: { ok: true, mode: 'local' | 'full' | 'rows-only' } | { ok: false, reason: 'offline' | 'failed' }
 *  - local:     guest, device wiped only
 *  - full:      edge function deleted rows + auth user
 *  - rows-only: edge function not deployed; rows deleted client-side, the
 *               sign-in record remains until removed on request
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase.js';
import { storage } from './storage.js';
import { clearCache } from './cache.js';
import { isOnline } from './connectivity.js';
import { cancelPendingPush } from './profileSync.js';

function wipeLocal() {
  storage.clear();
  clearCache();
}

/** @param {{ id: string } | null} user - null for guests */
export async function deleteAccount(user) {
  if (!user || !isSupabaseConfigured) {
    wipeLocal();
    return { ok: true, mode: 'local' };
  }
  if (!isOnline()) return { ok: false, reason: 'offline' };

  cancelPendingPush(); // a queued upsert must not re-create the row
  let mode = 'full';
  try {
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (error) {
      if (error.context?.status !== 404) throw error;
      // Function not deployed: RLS lets the user delete their own profile row,
      // which cascades to every user_* table.
      const { error: rowErr } = await supabase.from('profiles').delete().eq('id', user.id);
      if (rowErr) throw rowErr;
      mode = 'rows-only';
    }
  } catch {
    return { ok: false, reason: 'failed' };
  }

  try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* token cleared below anyway */ }
  wipeLocal();
  return { ok: true, mode };
}
