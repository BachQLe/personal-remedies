// supabase/functions/delete-account/index.ts
//
// In-app account deletion (Apple 5.1.1(v) / Google Play). Verifies the
// caller's JWT, deletes that user's rows, then deletes the auth user with the
// service-role client (the only place that key is allowed to live).
//
// Deleting auth.users cascades to profiles and every user_* table
// (supabase/migrations/20260624000000_init_schema.sql); the explicit row
// deletes below run first so a partial failure never leaves data behind.
//
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are
// injected automatically by Supabase. ALLOWED_ORIGINS is the same optional
// secret nutridigm-proxy uses.
import { createClient } from 'npm:@supabase/supabase-js@2';

const DEFAULT_ALLOWED_ORIGINS = 'http://localhost:5173';

// Same CORS shape as nutridigm-proxy, plus the headers supabase-js sends.
function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') || DEFAULT_ALLOWED_ORIGINS)
    .split(',').map((o) => o.trim()).filter(Boolean);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(status: number, body: Record<string, unknown>, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

// Tables keyed by user_id, then profiles keyed by id.
const USER_TABLES = ['user_conditions', 'user_allergens', 'user_dietary_restrictions', 'taste_swipes', 'daily_picks'];

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json(405, { code: 'METHOD_NOT_ALLOWED' }, origin);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json(500, { code: 'NOT_CONFIGURED' }, origin);

  // Verify the caller: the id comes from the validated JWT, never the body.
  const authHeader = req.headers.get('Authorization') ?? '';
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data, error: authError } = await caller.auth.getUser();
  if (authError || !data?.user) return json(401, { code: 'UNAUTHORIZED' }, origin);
  const userId = data.user.id;

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  try {
    for (const table of USER_TABLES) {
      const { error } = await admin.from(table).delete().eq('user_id', userId);
      if (error) throw error;
    }
    const { error: profileError } = await admin.from('profiles').delete().eq('id', userId);
    if (profileError) throw profileError;
    const { error: userError } = await admin.auth.admin.deleteUser(userId);
    if (userError) throw userError;
  } catch (err) {
    console.error('[delete-account] failed for', userId, err);
    return json(500, { code: 'DELETE_FAILED', message: 'Could not delete the account.' }, origin);
  }
  return json(200, { ok: true }, origin);
});
