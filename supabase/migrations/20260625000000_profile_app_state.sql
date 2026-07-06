-- Remedi profile app-state columns
-- Scope: additive only. Adds denormalized convenience columns to `profiles`
-- so the client's localStorage app state (profile/library/daily plan) can be
-- synced as a single-row upsert per user, instead of writing to the
-- normalized `user_conditions` / `user_allergens` / `user_dietary_restrictions`
-- / `daily_picks` tables from 20260624000000_init_schema.sql.
--
-- These columns coexist with the normalized tables; adopting the normalized
-- tables for these features later is optional and can happen without
-- touching this column set.
--
-- conditions   — Nutridigm numeric healthConditionID[] (client's `profile.conditions`).
-- preferences  — everything else in the client's local profile object
--                (allergies, diets, taste-calibration prefs, etc.) as opaque jsonb.
-- library      — the client's saved-ingredients library (src/state/library.js), as jsonb array.
-- daily_plan   — the client's most recent accepted Daily Picks plan (src/api/recommendations.js), as jsonb.

alter table profiles add column if not exists conditions  int[] not null default '{}';
alter table profiles add column if not exists preferences jsonb not null default '{}'::jsonb;
alter table profiles add column if not exists library     jsonb not null default '[]'::jsonb;
alter table profiles add column if not exists daily_plan  jsonb;

-- No RLS changes needed: profiles already has owner-only select/insert/update/delete
-- policies keyed on `id = auth.uid()` (see 20260624000000_init_schema.sql), and those
-- policies apply to all columns on the row, including the ones added here.
