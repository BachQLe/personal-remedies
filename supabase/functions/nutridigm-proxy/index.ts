// supabase/functions/nutridigm-proxy/index.ts
//
// Edge Function proxy for the Nutridigm API. Moves NUTRIDIGM_SUBSCRIPTION_ID
// off the client bundle (REMEDI_MASTER_PLAN.md Phase 3.1) — the key is
// injected here, server-side, from a Supabase secret, instead of shipping
// in `import.meta.env.VITE_NUTRIDIGM_SUBSCRIPTION_ID` for anyone to unpack
// out of the JS bundle. Key rotation afterwards is a `supabase secrets set`
// call, no client release (Phase 3.2).
//
// ── URL CONTRACT (must match the client's VITE_NUTRIDIGM_PROXY_URL usage) ──
//
//   Client calls:   <proxy-url>/<endpoint>?<query-params>
//   e.g.            https://<project-ref>.supabase.co/functions/v1/nutridigm-proxy/topdoordonts?healthConditionID=203,244&consumeOrAvoid=consume&limit=30
//
// Supabase routes every request under a function's name to that function's
// handler with the full original path intact (e.g.
// "/functions/v1/nutridigm-proxy/topdoordonts" in production, or
// "/nutridigm-proxy/topdoordonts" behind a custom functions domain). This
// handler locates the "nutridigm-proxy/" path segment and treats everything
// after it as the upstream endpoint path — so it works under either shape,
// and under `supabase functions serve` locally too.
//
// The client must NOT send its own subscriptionID — this function strips
// any client-supplied value first (so a spoofed one is never forwarded)
// and always injects the real one from the NUTRIDIGM_SUBSCRIPTION_ID secret.
//
// Endpoints are allowlisted below — this is intentionally not an open proxy.
//
// ── *** THE 220 RULE — READ THIS BEFORE TOUCHING THE RESPONSE PATH *** ─────
//
// Nutridigm returns HTTP 220 for "valid request, correctly-formed, empty
// result." It is a SUCCESS status, not an error or a redirect variant.
// src/api/nutridigm.js on the client special-cases `res.status === 220` and
// treats it as an empty result rather than throwing. This proxy MUST pass
// the upstream status code through completely unmodified — 200, 220, 400,
// 401, whatever upstream sent — and MUST NOT normalize 220 to 200 or 204,
// collapse it, or otherwise "fix" it. Response bodies must also pass through
// byte-for-byte: error bodies carry a `code` field (e.g.
// NOTAUTHORIZEDHEALTHID, APIDAILYLIMITREACHED, NOFOODITEMSFORGROUP) that the
// client switches on directly.

/** The 8 known Nutridigm read endpoints. Anything else is rejected with 404. */
const ALLOWED_ENDPOINTS = new Set([
  'healthconditions',
  'fooditems',
  'foodgroups',
  'goodfor',
  'topdoordonts',
  'suggest',
  'detailed',
  'references',
]);

/** Must match this function's directory name (used to locate the sub-path). */
const FUNCTION_NAME = 'nutridigm-proxy';

/** Same default as src/api/config.js NUTRIDIGM_BASE_URL — kept in sync manually. */
const DEFAULT_BASE_URL =
  'https://5jocnrfkfb.execute-api.us-east-1.amazonaws.com/PersonalRemedies/nutridigm/api/v2';

/** Same default as the client's local dev origin. */
const DEFAULT_ALLOWED_ORIGINS = 'http://localhost:5173';

/**
 * Build CORS response headers for a given request Origin.
 * Access-Control-Allow-Origin is only set when the request's Origin matches
 * an entry in the comma-separated ALLOWED_ORIGINS secret (or the localhost
 * default when that secret is unset) — otherwise it's simply omitted, which
 * is how browsers naturally block cross-origin reads.
 */
function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || DEFAULT_ALLOWED_ORIGINS)
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    Vary: 'Origin',
  };

  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

function jsonError(status: number, code: string, message: string, origin: string | null): Response {
  return new Response(JSON.stringify({ code, message }), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

/**
 * Extract the endpoint sub-path after the function name, e.g.
 * "/functions/v1/nutridigm-proxy/topdoordonts" -> "topdoordonts".
 * Returns null if the function name segment isn't found or nothing follows it.
 */
function extractEndpoint(pathname: string): string | null {
  const marker = `${FUNCTION_NAME}/`;
  const idx = pathname.indexOf(marker);
  if (idx === -1) return null;
  const rest = pathname.slice(idx + marker.length).replace(/^\/+|\/+$/g, '');
  return rest || null;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');

  // Preflight — respond before any auth/allowlist logic runs.
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== 'GET') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'Only GET is supported.', origin);
  }

  const url = new URL(req.url);
  const endpoint = extractEndpoint(url.pathname);

  // Allowlist — reject anything else. Do not become an open proxy.
  if (!endpoint || !ALLOWED_ENDPOINTS.has(endpoint)) {
    return jsonError(
      404,
      'UNKNOWN_ENDPOINT',
      `Unknown or disallowed Nutridigm endpoint: ${endpoint ?? '(none)'}`,
      origin
    );
  }

  const subscriptionId = Deno.env.get('NUTRIDIGM_SUBSCRIPTION_ID');
  if (!subscriptionId) {
    // Function deployed but secret not set yet — fail loudly rather than
    // forwarding a doomed, key-less request upstream.
    console.error('[nutridigm-proxy] NUTRIDIGM_SUBSCRIPTION_ID secret is not set.');
    return jsonError(500, 'PROXY_NOT_CONFIGURED', 'Nutridigm subscription secret is not set.', origin);
  }

  const baseUrl = Deno.env.get('NUTRIDIGM_BASE_URL') || DEFAULT_BASE_URL;
  const upstreamUrl = new URL(`${baseUrl.replace(/\/+$/, '')}/${endpoint}`);

  // Forward every client query param except subscriptionID (strip any
  // client-supplied value first), then inject the real one from the secret.
  for (const [key, value] of url.searchParams.entries()) {
    if (key.toLowerCase() === 'subscriptionid') continue;
    upstreamUrl.searchParams.set(key, value);
  }
  upstreamUrl.searchParams.set('subscriptionID', subscriptionId);

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl.toString(), { method: 'GET' });
  } catch (err) {
    console.error(`[nutridigm-proxy] upstream fetch failed for /${endpoint}:`, err);
    return jsonError(502, 'PROXY_UPSTREAM_ERROR', 'Failed to reach the Nutridigm API.', origin);
  }

  // ── Pass-through: status, body, and content-type travel verbatim. ────────
  // NO status normalization here. 220 stays 220. 400/401 stay 400/401 with
  // their original bodies (NOFOODITEMSFORGROUP, NOTAUTHORIZEDHEALTHID,
  // APIDAILYLIMITREACHED, etc. all depend on this).
  const body = await upstreamRes.arrayBuffer();
  const headers = corsHeaders(origin);
  const contentType = upstreamRes.headers.get('content-type');
  if (contentType) headers['Content-Type'] = contentType;

  return new Response(body, {
    status: upstreamRes.status,
    headers,
  });
});
