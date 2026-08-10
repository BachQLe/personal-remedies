# Deploying the Nutridigm proxy (Supabase Edge Function)

Runbook for deploying `supabase/functions/nutridigm-proxy` — the Edge
Function that moves the Nutridigm subscription key off the client
(REMEDI_MASTER_PLAN.md Phase 3.1/3.2). Follow it top to bottom.

This doc also covers the Auth email template change required for the
6-digit OTP sign-in flow (Phase 4.3) — see the last section.

**Nothing in this doc should ever contain a real key or secret value.**
Every `supabase secrets set` example below uses a placeholder — replace
the placeholder yourself when you run the command, don't paste real
values into any file that gets committed.

---

## 1. Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) installed:
  ```sh
  brew install supabase/tap/supabase
  # or: npm install -g supabase
  supabase --version
  ```
- A Supabase project already created in the dashboard (this repo's
  `supabase/config.toml` and migrations already assume one exists — see
  `supabase/README.md`).
- Your project's **project ref** (Project Settings → General → Reference ID
  in the dashboard, or the last path segment of your project URL).

Log in and link this repo to the project (one-time per machine):

```sh
supabase login
supabase link --project-ref <project-ref>
```

`supabase link` writes to `supabase/.temp/` (already gitignored) — it does
not touch `.env` or any committed file.

---

## 2. Set secrets

The function reads three values from Supabase secrets (Deno `Deno.env.get`),
never from `.env` or the client bundle:

| Secret | Required | Purpose |
|---|---|---|
| `NUTRIDIGM_SUBSCRIPTION_ID` | Yes | The real Nutridigm key. Without it the function returns `500 PROXY_NOT_CONFIGURED`. |
| `NUTRIDIGM_BASE_URL` | No | Overrides the upstream base URL. Falls back to the current AWS endpoint hardcoded in the function if unset. |
| `ALLOWED_ORIGINS` | No | Comma-separated list of origins allowed via CORS. Falls back to `http://localhost:5173` if unset. |

```sh
supabase secrets set \
  NUTRIDIGM_SUBSCRIPTION_ID=<your-nutridigm-subscription-id> \
  NUTRIDIGM_BASE_URL=https://5jocnrfkfb.execute-api.us-east-1.amazonaws.com/PersonalRemedies/nutridigm/api/v2 \
  ALLOWED_ORIGINS=http://localhost:5173,https://<your-prod-domain>
```

You can omit `NUTRIDIGM_BASE_URL` entirely if you're using the default —
it's only there so the upstream URL can change without a code deploy.

Verify what's set (values are never echoed back):

```sh
supabase secrets list
```

---

## 3. Deploy the function

```sh
supabase functions deploy nutridigm-proxy
```

`supabase/config.toml` sets `verify_jwt = false` for this function — it
must be callable without a signed-in user, since Remedi is guest-first
(profile/plan features all work signed-out). Do not add a JWT requirement
in front of this function unless every caller becomes authenticated.

Once deployed, the function is reachable at:

```
https://<project-ref>.supabase.co/functions/v1/nutridigm-proxy
```

### URL contract (for whoever wires up the client)

The client calls `<proxy-url>/<endpoint>?<query-params>` — i.e. the
Nutridigm endpoint name goes directly after the function name in the path,
and query params are forwarded as-is **without** `subscriptionID` (the
function injects that from the secret and strips any client-supplied
value first). Example:

```
https://<project-ref>.supabase.co/functions/v1/nutridigm-proxy/topdoordonts?healthConditionID=203,244&consumeOrAvoid=consume&limit=30
```

Allowlisted endpoint names (anything else 404s):
`healthconditions`, `fooditems`, `foodgroups`, `goodfor`, `topdoordonts`,
`suggest`, `detailed`, `references`.

---

## 4. Smoke test

Use `curl -i` (not just `curl`) so you can see the HTTP status line —
that matters here because **HTTP 220 is a valid success status** this
proxy must pass through unchanged, not an error.

**Normal endpoint (expect `200`):**

```sh
curl -i "https://<project-ref>.supabase.co/functions/v1/nutridigm-proxy/foodgroups"
```

**A case likely to return `220` (valid request, empty result)** — e.g. an
obscure/rare condition combo with `/goodfor` or `/suggest` that has no
data. Confirm the response line reads `HTTP/2 220`, not `200`:

```sh
curl -i "https://<project-ref>.supabase.co/functions/v1/nutridigm-proxy/suggest?healthConditionID=203,244&fineFoodGroup=k2"
```

If you don't have a condition/group combo handy that's known to be empty,
you can still confirm the pass-through behavior is wired correctly by
reading `supabase/functions/nutridigm-proxy/index.ts` — the fetch response
status is forwarded via `status: upstreamRes.status` with no branching on
`220` anywhere in the function.

**Daily API limit error passthrough** — this one is hard to trigger
on-demand (it only fires once the real key's daily quota is exhausted),
but when it does, the proxy must return it verbatim: HTTP `401` with a
JSON body containing `"code":"APIDAILYLIMITREACHED"`. If you hit this
while testing, confirm with:

```sh
curl -i "https://<project-ref>.supabase.co/functions/v1/nutridigm-proxy/fooditems"
# expect: HTTP/2 401
# body:   {"code":"APIDAILYLIMITREACHED", ...}
```

**Bad/unlisted endpoint (expect `404`):**

```sh
curl -i "https://<project-ref>.supabase.co/functions/v1/nutridigm-proxy/notarealendpoint"
# expect: HTTP/2 404, {"code":"UNKNOWN_ENDPOINT", ...}
```

**CORS preflight (expect `204` with `Access-Control-Allow-Origin` echoed
back only when Origin is in `ALLOWED_ORIGINS`):**

```sh
curl -i -X OPTIONS "https://<project-ref>.supabase.co/functions/v1/nutridigm-proxy/foodgroups" \
  -H "Origin: http://localhost:5173"
```

---

## 5. Client cutover

This wave ships the proxy only. A later wave adds `VITE_NUTRIDIGM_PROXY_URL`
to the client (`src/api/config.js` / `nutridigm.js`), which switches the
client to call the proxy instead of AWS directly, without sending
`subscriptionID` itself.

When that lands:

1. Set `VITE_NUTRIDIGM_PROXY_URL=https://<project-ref>.supabase.co/functions/v1/nutridigm-proxy`
   in your production env (Vercel/Netlify/etc. project settings — not `.env`
   committed to the repo).
2. **Remove `VITE_NUTRIDIGM_SUBSCRIPTION_ID` from production builds** once
   the client is confirmed to be calling through the proxy — leaving it set
   is harmless (the client won't use it once `VITE_NUTRIDIGM_PROXY_URL` is
   set) but it defeats the point of this whole change if it's still baked
   into the prod bundle. Local dev can keep using the subscription ID
   directly (`.env.local`) if you'd rather not stand up a local function.
3. **Key rotation from this point on is just a secret update — no release,
   no code review** (Phase 3.2):
   ```sh
   supabase secrets set NUTRIDIGM_SUBSCRIPTION_ID=<new-value>
   ```
   The function picks up the new value on next invocation; nothing to
   redeploy.

---

## 6. Auth email template (required for the 6-digit OTP flow — Phase 4.3)

Remedi's planned sign-in is email + 6-digit code via Supabase
`signInWithOtp`, **not** a magic link. Supabase's default email templates
send a clickable magic-link URL and do not surface the numeric code at all
— if you don't change the template, users who expect a code will never see
one arrive.

In the Supabase dashboard:

**Auth → Email Templates → Magic Link** (this is the template
`signInWithOtp` uses for email OTP):

1. Open the template editor.
2. Replace the body's link markup — anything using `{{ .ConfirmationURL }}`
   — with the numeric token variable `{{ .Token }}` instead. Minimal
   example body:

   ```html
   <h2>Your Remedi sign-in code</h2>
   <p>Enter this code in the app:</p>
   <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px;">{{ .Token }}</p>
   <p>This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
   ```

3. Save.

**Auth → Providers → Email → OTP expiry**: set to **10 minutes** (600
seconds). This is the server-side expiry — it controls how long
`{{ .Token }}` stays valid, independent of anything in the client.

**Resend cooldown is client-side** — Supabase does not throttle "resend"
attempts beyond its general rate limits
(`supabase/config.toml` → `[auth.rate_limit]` → `token_verifications` /
`sign_in_sign_ups`, already configured). The UI-level cooldown timer
(e.g. "resend in 30s") that keeps users from spamming the resend button is
something the Wave-4 OTP screen needs to implement itself — there's no
dashboard setting for it.

---

## 7. CI / validation notes

This function should ideally be checked with `deno check
supabase/functions/nutridigm-proxy/index.ts` before every deploy — Deno
was not installed in the environment that authored this function, so it
was hand-verified (types, control flow, and Response/Request usage
desk-checked against Deno's documented Fetch API support) but never run
through the actual Deno type checker or `supabase functions serve`.

**Before your first real deploy, run locally:**

```sh
supabase functions serve nutridigm-proxy --no-verify-jwt
# in another terminal:
curl -i "http://127.0.0.1:54321/functions/v1/nutridigm-proxy/foodgroups"
```

(`supabase functions serve` requires Deno; installing it also gives you
`deno check` for free — `brew install deno` or see
[deno.land](https://deno.land) for other install methods.)

If you set up CI for this repo later, add a step that runs `deno check`
against every file in `supabase/functions/*/index.ts` — cheap, catches
typos/type errors before they reach a live deploy.

---

## 8. Client configuration

The client-side switch described prospectively in §5 above is now wired up
(Task T3B): `src/api/config.js` reads `VITE_NUTRIDIGM_PROXY_URL`, and
`src/api/nutridigm.js` builds its request URL from it when set. This is the
one env var that flips the client between the two modes:

| | `VITE_NUTRIDIGM_PROXY_URL` | `VITE_NUTRIDIGM_SUBSCRIPTION_ID` |
|---|---|---|
| **Proxy mode (production)** | set to the deployed function URL | not needed — remove from prod env |
| **Direct mode (local dev)** | unset | set to your Nutridigm key |

If both happen to be set, proxy mode wins — the client never sends a
`subscriptionID` once a proxy URL is present.

**To point the app at the deployed function:**

1. Set, in your production hosting env (Vercel/Netlify/etc. project
   settings — **not** a committed `.env` file):
   ```
   VITE_NUTRIDIGM_PROXY_URL=https://<project-ref>.supabase.co/functions/v1/nutridigm-proxy
   ```
   (No trailing slash needed — the client trims one if present.)
2. Redeploy the client so the new env var is baked into the build.
3. Confirm requests are going through the proxy — open the deployed app,
   check the Network tab for calls to `.../nutridigm-proxy/<endpoint>`
   instead of the AWS host, and confirm none of them carry a
   `subscriptionID` query param.

**Remove from production env once confirmed:**

- `VITE_NUTRIDIGM_SUBSCRIPTION_ID` — leaving it set is harmless (unused once
  `VITE_NUTRIDIGM_PROXY_URL` is present) but defeats the purpose of this
  whole change if the real key is still baked into the prod bundle. Delete
  it from the production hosting env, not from `.env.example`.

**Local dev keeps direct mode** — leave `VITE_NUTRIDIGM_PROXY_URL` unset in
`.env.local` and keep using `VITE_NUTRIDIGM_SUBSCRIPTION_ID` there, so you
don't need a running Supabase function (local or deployed) just to develop.
`.env.example` documents both variables; only fill in the one your current
mode needs.

**Key rotation post-cutover** is a secret update only, per Phase 3.2 — no
client release:
```sh
supabase secrets set NUTRIDIGM_SUBSCRIPTION_ID=<new-value>
```
