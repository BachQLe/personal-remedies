# Supabase setup

## Applying the schema

The schema lives in `supabase/migrations/`. Apply it one of two ways:

**Option A — SQL editor (fastest, no CLI needed)**
1. Open your project in the [Supabase dashboard](https://supabase.com/dashboard).
2. Go to SQL Editor → New query.
3. Paste the contents of `supabase/migrations/20260624000000_init_schema.sql` and run it.

**Option B — Supabase CLI**
```sh
supabase link --project-ref <your-project-ref>
supabase db push
```

## What's in the schema

`20260624000000_init_schema.sql` creates:

- Reference tables (`conditions`, `allergens`, `dietary_restrictions`, `recipes`) — publicly
  readable, no client write access.
- Owner-only tables (`profiles`, `user_conditions`, `user_allergens`,
  `user_dietary_restrictions`, `taste_swipes`, `daily_picks`) — RLS restricts every row to
  `auth.uid()`.
- A trigger (`on_auth_user_created`) that auto-inserts a `profiles` row for every new
  `auth.users` row.
- Seed rows for `allergens` and `dietary_restrictions`. `conditions` is left empty — it's
  synced from the Nutridigm API separately.

Note: this file supersedes an earlier, simpler `profiles(user_id, conditions int[], ...)`
design that was drafted for this task. That design was never applied — the schema above (with
normalized `user_conditions`, `user_allergens`, etc. tables instead of array/jsonb columns on
`profiles`) already existed in this repo and is what's live. If the app still needs a single
denormalized `conditions int[]` column (Nutridigm numeric health-condition IDs) or `daily_plan`
/`library` JSON blobs on `profiles`, add a follow-up migration rather than editing this one —
Supabase migrations are append-only once applied to a real database.

## Required dashboard configuration (not covered by SQL)

Auth → URL Configuration:
- **Site URL**: your app's origin (e.g. `http://localhost:5173` for dev).
- **Redirect URLs**: add `<origin>/auth/callback` for every origin you use (dev and prod).

Auth → Providers:
- Enable **Google** and fill in a Client ID/Secret (Google Cloud Console → OAuth 2.0 Client).

Project Settings → API:
- Copy the **Project URL** and **anon public key** into `.env` as `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` (see `.env.example`).

## Profile app-state sync

Run `supabase/migrations/20260625000000_profile_app_state.sql` the same way as the init schema (SQL
editor or `supabase db push`). It's additive: adds `conditions int[]`, `preferences jsonb`,
`library jsonb`, and `daily_plan jsonb` columns to `profiles`. No RLS changes — the existing
owner-only policies on `profiles` already cover the new columns.

**What syncs:** the client's localStorage app state — `profile` (→ `conditions` +
`preferences`), `library`, and `dailyPlan` (→ `daily_plan`) — is synced to a single row in
`profiles` keyed by `auth.uid()`. See `src/api/profileSync.js`.

**Merge rule:** newer `updated_at` wins. On sign-in the client compares the remote row's
`updated_at` against a locally-tracked `lastSyncedAt`; if remote is newer (e.g. same user on a
new device), it hydrates localStorage. Otherwise local is pushed up — this is what adopts a
guest's local profile into their account on first sign-in. Ongoing local writes are pushed on a
~2s debounce while signed in. Sync is best-effort and never blocks the UI: the app is fully
functional signed-out (guest mode), and Supabase errors are logged once and swallowed.
