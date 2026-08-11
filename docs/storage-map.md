# Storage map — client vs server

Reference doc for where Remedi state lives, who writes it, how long it lives, and how (if at all) it's kept in sync with Supabase. Written by reading `src/api/storage.js`, `src/api/cache.js`, `src/api/profileSync.js`, `src/state/*.js`, and `supabase/migrations/20260625000000_profile_app_state.sql` — not guessed. Master plan refs: §3.3 (cache allowlist), §3.4 (profile-change purge), §4.6 (this doc).

## 1. `remedi.v1` — client app state (localStorage)

One root key (`src/api/storage.js`), a flat `{ [logicalKey]: value }` object read/written whole on every `storage.get`/`storage.set` call. `storage.onWrite(cb)` lets `profileSync.js` hook every write without call sites knowing about sync.

| Sub-key | Writer(s) | Holds | Lifetime |
|---|---|---|---|
| `profile` | `src/api/api.js` (`saveProfile`, `clearProfile`, migration in `getProfile`) | The user's `Profile` object — `firstName`, `ageBand`, `conditions[]` (numeric Nutridigm IDs), `allergies`, `dietaryPattern`, `religiousRestriction`, `medications`, `calorieTarget` | Until `clearProfile()` (not currently wired to any UI) or `storage.clear()`. Survives reloads; synced (see §3). |
| `library` | `src/state/library.js` (`addToLibrary`/`removeFromLibrary`) | Array of saved `Food`/recipe objects (the Cookbook / saved-recipes list) | Indefinite; synced. |
| `dailyPlan` | `src/state/dailyPlan.js` (`setPlan`, and every mutator — `markEaten`, `togglePinned`, `removeFromSlot`, `insertIntoSlot`, `addToSlot`) | The `WeeklyPlan` (v2): `conditionsKey`, `conditionNames`, `days` (rolling 7-day window), optional `picksBySlot` (present iff picks-only). v1 single-day shape auto-migrates on read. | Rolling — days fall out of the window as `nextSevenDays()` advances; whole plan discarded/rebuilt on a conditions change (§3.4). Synced. |
| `queue` | `src/state/queue.js` | Legacy pre-slot-plan item list | Dead code path — no longer written by any active UI flow (queue.js is unused by screens as of the slot-based plan rewrite), only *read once* by `consumeLegacyQueue()` to fold leftovers into a first-ever `generatePlanFromPicks` call. Not synced (not in `SYNCED_KEYS`) — a value here never leaves the device. |
| `schedule` | `src/state/schedule.js` | `ScheduleState` — a *different*, day-keyed "cooked/scheduled" tracker (`scheduleItem`, `setCooked`) with its own 14-day auto-prune (`PRUNE_DAYS`) | Self-pruning, 14 days trailing. **Not synced** (not in `SYNCED_KEYS`) — device-local only, and not addressed by the master-plan §3.4 purge rule at all (see Known gaps). |
| `recentSearches` (and `recentSearches:<scope>` for non-default scopes, e.g. per embedding surface) | `src/state/recentSearches.js` | Most-recent-first list of executed search terms, capped at 8, deduped case-insensitively | Indefinite, per-scope. Not synced. |
| `syncMeta` | `src/api/profileSync.js` (`setSyncMeta`) | `{ lastSyncedAt: string|null }` — the local bookmark used to decide whether a pulled remote row is newer than what this device last saw | Indefinite; itself never synced (it's the merge-arbiter, not app data). |

## 2. `remedi.cache.v1.*` — response cache (localStorage, `src/api/cache.js`)

A **separate namespace**, deliberately outside `storage.js` so cache writes never fire `storage.onWrite` (cache churn must never trigger a remote push). Each entry: `{ v: SCHEMA_VERSION, ts, data }`, with an in-memory `Map` in front so repeat reads in one session skip `JSON.parse`. Fetch-through with stale-while-revalidate: fresh → served from cache; stale → served immediately + background refetch; missing/version-mismatched → awaited fetch.

| Key pattern | Built by (adapter.js) | TTL |
|---|---|---|
| `topdoordonts:{conditionsCSV}:{consumeOrAvoid}:{limit}` | `cachedTopDoOrDonts` | 8h (`TOPDOORDONTS_TTL_MS`) |
| `suggest:{conditionsCSV}:{fineFoodGroup}` | `cachedSuggest` (backs both `getMealPlanSuggestions` and `getRecipes`'s `recipes:{csv}:l`) | 8h (`SUGGEST_TTL_MS`) |
| `recipes:{conditionsCSV}:l` | `getRecipesRaw` | 8h (`RECIPES_TTL_MS`) |
| `detailed:{conditionsCSV}:{coarseGroup}:{listType}` | `getCategoryDetailRaw` | 8h (`DETAILED_TTL_MS`) |
| `goodfor:{conditionId}:{foodId}` | (goodfor lookup) | 8h (`GOODFOR_TTL_MS`) |
| `refs:{conditionId}:{foodId}` | `cachedReferences` / `getCachedRefCount` (read-only peek, never fetches) | 7d (`REFERENCES_TTL_MS`) — the one documented exception to the 48h remedy-data bound, because `/references` returns static bibliographic citations, not per-user remedy data |

All TTL constants are exported from `src/api/adapter.js` and enforced ≤48h (except `REFERENCES_TTL_MS`) by `src/data/__tests__/cacheAllowlist.test.js` part (iii).

**This layer vs the committed snapshot layer.** `src/data/cache/` (checked into git, NOT this runtime cache) holds exactly `items.json` / `conditions.json` / `groups.json` (dictionaries) plus two overlay files, written only by `scripts/snapshot-nutridigm.mjs`. Master plan §3.3's allowlist rule — "items, conditions, groups ONLY; remedy/nutrient-content data is not permitted under API terms" — governs *that* directory, and is enforced by `cacheAllowlist.test.js` parts (i)/(ii) (file-listing + static source inspection of the snapshot script). `remedi.cache.v1.*` is a completely different mechanism: a runtime, per-browser, short-TTL cache of *remedy* data (topdoordonts/suggest/detailed/goodfor/references) — explicitly allowed to hold this data because it's ephemeral (8h/7d, per-device, never committed), which is exactly what part (iii) of the same test guards (TTL ceiling instead of a content allowlist).

## 3. Supabase — `profiles` table sync (`src/api/profileSync.js`)

One denormalized row per signed-in user (`supabase/migrations/20260625000000_profile_app_state.sql`, additive columns on the pre-existing `profiles` table):

| Column | Type | Source (local key) |
|---|---|---|
| `conditions` | `int[]` | `profile.conditions` (filtered to numbers only — see `splitProfile`) |
| `preferences` | `jsonb` | `profile` minus `conditions` (opaque blob — firstName, ageBand, allergies, dietaryPattern, religiousRestriction, medications, calorieTarget, whatever else lands on `profile`) |
| `library` | `jsonb` | `library` (array), defaults `[]` |
| `daily_plan` | `jsonb` | `dailyPlan`, nullable |
| `onboarding_completed` | (existing column) | set `true` on push whenever a local profile exists |
| `updated_at` | timestamptz | stamped by the client on every push (`new Date().toISOString()`) |

RLS: owner-only (`id = auth.uid()`), inherited from the base `profiles` policies — no new policies needed for these columns.

**`SYNCED_KEYS`** (`initProfileSync`, `profileSync.js`): exactly `{'profile', 'library', 'dailyPlan'}`. `storage.onWrite` fires for every key, but only a write to one of these three schedules a push — `queue`, `schedule`, `recentSearches*`, `syncMeta` are never pushed and never pulled.

**Push path:** any write to a synced key → `schedulePush()` (2s trailing debounce, reset on each call) → `pushNow(user)` reads the *current* `profile`/`library`/`dailyPlan` from `storage` (not the value that triggered the write — always a fresh full read) and upserts all three plus a new `updated_at`. Fire-and-forget; errors logged once via `console.warn` and swallowed. `saveProfile`/`clearProfile` also call `schedulePush()` directly (redundant with the `onWrite` hook, harmless — just resets the same timer twice).

**Pull path (`pullProfile`, "newer `updated_at` wins"):** runs (a) on `initProfileSync()`'s initial `getSession()` if a session already exists, i.e. on every app load while signed in, and (b) on every `SIGNED_IN` auth event. Fetches the row, compares `row.updated_at` against local `syncMeta.lastSyncedAt`:
  - No remote row / no `updated_at` yet → push local up (this is what migrates a guest profile into a fresh account on first sign-in).
  - `row.updated_at > lastSyncedAt` → remote wins: `storage.set` overwrites `profile`/`library`/`dailyPlan` wholesale from the row (each field only if present on the row), `syncMeta.lastSyncedAt` is bumped to `row.updated_at`, and `reloadLibrary()`/`reloadPlan()` are called so the in-memory stores pick up the change. A `_hydrating` flag suppresses the `onWrite`→`schedulePush` echo during this write-back.
  - Otherwise → push local up (local is at least as new).

Nothing here validates that a hydrated `dailyPlan.conditionsKey` matches the just-hydrated `profile.conditions` — see Known gaps.

## 4. Supabase auth (`sb-*` keys)

Written directly by the `@supabase/supabase-js` SDK (session/refresh tokens), not by any Remedi app code — outside `storage.js`'s `remedi.v1` root entirely, and outside this doc's control surface. `src/lib/supabase.js` just constructs the client (`isSupabaseConfigured` gates everything else on `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` being set).

## 5. Purge & merge rules (master plan §3.4 tracing)

**The purge, as implemented.** `ensurePlanForWeek` (`src/api/planBuilder.js`) is the only place a conditions change is detected: `conditionsChanged = existing.conditionsKey !== conditionsKey`. When true, it (a) drops every existing day (`keptDays = {}` — nothing carries over) and (b) drops `picksBySlot` (`picksBySlot = conditionsChanged ? null : existing.picksBySlot`), then rebuilds all 7 days from scratch and `setPlan()`s the result.

**Side effect of (b) worth flagging alongside the purge:** because `picksBySlot` is nulled out, the rebuilt days are filled via `fillSlots` (the legacy candidate-pool auto-fill) rather than `fillFromPicks`, and the resulting plan object carries no `picksBySlot` field at all. A conditions change therefore silently downgrades a picks-only plan back into an auto-filled one — the user is never sent back to the picker to re-pick against the new condition set, despite `generatePlanFromPicks`'s own doc comment asserting "re-picking is the honest reset."

**Does the purge propagate to the synced remote `daily_plan`?** Yes, but only:
1. When something actually calls `ensurePlanForWeek` — and the only caller in the whole app is `MealQueueScreen`'s mount effect. Changing conditions on `ProfileScreen` (`ConditionsEditor` → `save({conditions})` → `saveProfile`) does **not** itself purge the plan; it only pushes the new `profile.conditions` up. If the user hasn't opened the Plan tab since, the local (and freshly-pushed remote) `dailyPlan` still reflects the *old* condition set — a real but transient window where the remote row holds mismatched `conditions` + `daily_plan.conditionsKey`.
2. Once the Plan tab is opened, `ensurePlanForWeek` purges+rebuilds, `setPlan()` writes `dailyPlan` locally, `storage.onWrite('dailyPlan')` fires, and (being in `SYNCED_KEYS`) schedules a push that — after the 2s debounce — overwrites the remote `daily_plan` with the corrected plan. This is eventually consistent, not immediate.

**Can a stale remote plan get pulled back down over a locally-purged one?** Yes — this is the sharper gap. `pullProfile` hydrates `profile`, `library`, and `dailyPlan` unconditionally from whatever row it fetches, with **no cross-check that the row's `daily_plan.conditionsKey` matches the row's own `conditions`**, let alone the device's just-hydrated profile. Concrete race:
- Device A changes conditions but hasn't opened the Plan tab yet → pushes `{conditions: NEW, daily_plan: <plan built for OLD>}` as one row (see point 1 above).
- Device B (same account — second device, or the same device after a sign-out/sign-in that re-triggers `pullProfile`) pulls that row before Device A's later corrective push lands. Device B's `remedi.v1` now holds `profile.conditions = NEW` and `dailyPlan.conditionsKey = OLD` — an inconsistent pair, written directly via `storage.set`, bypassing `ensurePlanForWeek` entirely.
- This only self-heals once Device B's Plan tab is opened (the one and only place that runs the conditions-changed check). Any other screen reading plan state in the meantime would see a plan built for the wrong condition set. (In the current app, only `MealQueueScreen` reads `getPlan()`/`subscribePlan()` at all, so nothing else is *currently* misled by this — but the storage layer itself has no guard against it.)

**Is the `remedi.cache.v1.*` remedy cache invalidated on a conditions change?** No — it's "merely keyed around it," exactly as flagged in the task brief. Every remedy-data cache key (`suggest:`, `topdoordonts:`, `detailed:`, `recipes:`, `goodfor:`) folds `conditionsCSV`/`conditionId` into the key itself, so a conditions change simply addresses a *different* set of keys — old-condition entries are never actively deleted, they just go unreferenced until their TTL would have expired anyway (up to 8h) or forever if the user never returns to that exact condition set. No correctness bug (stale entries are never served for the *new* conditions), but unbounded, unswept growth in `localStorage` over a long-lived install with a user who changes conditions repeatedly.

## 6. Known gaps

1. **Conditions-change purge does not reach the synced remote `daily_plan` until the Plan tab is opened.** Between a conditions edit on `ProfileScreen` and the next `MealQueueScreen` mount, the remote `profiles` row can hold `conditions` and `daily_plan` built for two different condition sets. Not corrected in this wave per the task brief (documentation only).
2. **`pullProfile` can hydrate a locally-purged device with a stale, mismatched remote plan.** No validation that `daily_plan.conditionsKey` agrees with `conditions` on the same row, or with the local profile being hydrated alongside it. Currently masked by the fact that only `MealQueueScreen` ever reads plan state, and only that screen's mount effect re-runs the conditions check — but the storage layer offers no structural guarantee, and a future screen reading `getPlan()` directly (e.g. a Home-screen "today's plan" widget) would be exposed to it immediately.
3. **A conditions change silently drops `picksBySlot` and reverts to legacy candidate-pool auto-fill**, rather than requiring the user to re-pick (contradicting `generatePlanFromPicks`'s own "re-picking is the honest reset" comment in `planBuilder.js`). This is a `planBuilder.js` logic gap, not strictly a storage-layer one, but it's what actually gets synced under gap #1/#2, so it's noted here.
4. **`remedi.cache.v1.*` is never swept.** Entries are naturally partitioned by conditions/food/group key (so nothing stale is ever served), but old entries are never deleted — a device that cycles through many condition sets over time accumulates orphaned cache entries indefinitely.
5. **`schedule` (src/state/schedule.js) is a second, independent plan-adjacent store that isn't synced and isn't purged on a conditions change** — master plan §3.4's purge rule was written with `dailyPlan` in mind and doesn't obviously apply to it, since `schedule` isn't conditions-derived candidate data, but it also isn't reconciled with `dailyPlan` in any way documented in code; the two can drift (e.g. an item cooked/scheduled for a day that `dailyPlan`'s rolling window has since dropped). Out of scope to fix here; flagged for awareness.
6. **`queue` (src/state/queue.js) is fully dead as a write path** but still has a live writer module and a live one-time reader (`consumeLegacyQueue`) — not a correctness bug, just unswept legacy surface area worth eventually removing.
