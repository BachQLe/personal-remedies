# Storage map — client vs server

Reference doc for where Remedi state lives, who writes it, how long it lives, and how (if at all) it's kept in sync with Supabase. Written by reading `src/api/storage.js`, `src/api/cache.js`, `src/api/profileSync.js`, `src/state/*.js`, and `supabase/migrations/20260625000000_profile_app_state.sql` — not guessed. Master plan refs: §3.3 (cache allowlist), §3.4 (profile-change purge), §4.6 (this doc).

## 1. `remedi.v1` — client app state (localStorage)

One root key (`src/api/storage.js`), a flat `{ [logicalKey]: value }` object read/written whole on every `storage.get`/`storage.set` call. `storage.onWrite(cb)` lets `profileSync.js` hook every write without call sites knowing about sync.

| Sub-key | Writer(s) | Holds | Lifetime |
|---|---|---|---|
| `profile` | `src/api/api.js` (`saveProfile`, `clearProfile`, migration in `getProfile`) | The user's `Profile` object — `firstName`, `ageBand`, `conditions[]` (numeric Nutridigm IDs), `allergies`, `dietaryPattern`, `religiousRestriction`, `medications`, `calorieTarget` | Until `clearProfile()` (not currently wired to any UI) or `storage.clear()`. Survives reloads; synced (see §3). |
| `library` | `src/state/library.js` (`addToLibrary`/`removeFromLibrary`) | Array of saved `Food`/recipe objects (the Cookbook / saved-recipes list) | Indefinite; synced. |
| `dailyPlan` | `src/state/dailyPlan.js` (`setPlan`, and every mutator — `markEaten`, `togglePinned`, `removeFromSlot`, `insertIntoSlot`, `addToSlot`) | The `WeeklyPlan` (v2): `conditionsKey`, `conditionNames`, `days` (rolling 7-day window), optional `picksBySlot` (present iff picks-only). v1 single-day shape auto-migrates on read. | Rolling — days fall out of the window as `nextSevenDays()` advances; whole plan discarded to `null` (never rebuilt from pools) on a conditions change, both eagerly on profile save and lazily on next `ensurePlanForWeek` (§3.4/§5). Synced. |
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
  - `row.updated_at > lastSyncedAt` → remote wins: `storage.set` overwrites `profile`/`library` wholesale from the row (each field only if present on the row), `syncMeta.lastSyncedAt` is bumped to `row.updated_at`, and `reloadLibrary()`/`reloadPlan()` are called so the in-memory stores pick up the change. A `_hydrating` flag suppresses the `onWrite`→`schedulePush` echo during this write-back. **`dailyPlan` is conditional** (fixed T5D, gap 2 below): `pullProfile` first checks `isDailyPlanConsistent(row)` — `row.daily_plan.conditionsKey === row.conditions.join(',')` (a null/absent `daily_plan` is trivially consistent). Consistent → hydrate `dailyPlan` from the row as before. Inconsistent → `profile`/`library` still hydrate, but `dailyPlan` is set to `null` instead (a dev-only `console.warn`, never a user-facing error) — the device lands at the honest empty state and re-picks, rather than importing a plan known to be stale for the conditions it was just paired with.
  - Otherwise → push local up (local is at least as new).

## 4. Supabase auth (`sb-*` keys)

Written directly by the `@supabase/supabase-js` SDK (session/refresh tokens), not by any Remedi app code — outside `storage.js`'s `remedi.v1` root entirely, and outside this doc's control surface. `src/lib/supabase.js` just constructs the client (`isSupabaseConfigured` gates everything else on `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` being set).

## 5. Purge & merge rules (master plan §3.4 tracing)

**Status: gaps 1-3 below closed in task T5D** (this section originally documented the pre-T5D behavior as a live audit finding; kept here, updated in place, as the trace of what the purge actually does today — see §6 for the gap numbering this refers to).

**The purge, as implemented (post-T5D).** Two independent mechanisms now enforce the same invariant — "a plan is never shown/synced for conditions it wasn't built for" — from two different trigger points:

1. **Eager, on-save (`purgeDerivedDataForConditionsChange`, `src/api/planBuilder.js`, closes gap 1).** `profileSync.js` registers a `storage.onWrite('profile', ...)` listener (inside `initProfileSync`, but ahead of its Supabase-configured check, so it's active even signed-out / unconfigured) that calls this function with the just-saved `profile.conditions` on every write to the `profile` key — regardless of which screen or code path made the write. If the existing plan's `conditionsKey` doesn't match, the plan is discarded (`setPlan(null)`) synchronously, before the next debounced push can go out. This is deliberately network-free (no `loadCandidates`/fallback resolution) — see the function's own doc for the one narrow edge case that trades off (a demo-fallback collision) in favor of never leaving a stale pair in place.
2. **Lazy, on-mount (`ensurePlanForWeek`, closes gap 3).** Still the only place a conditions change is *rebuilt around* — but the contract changed: `existing.conditionsKey !== conditionsKey` now means **discard and return `{ plan: null, usedFallback: false }`**, the exact same shape a first-ever build returns, rather than rebuilding all 7 days from the candidate pools. `MealQueueScreen` already renders its "Build your meal plan" empty-state CTA for that shape, so a conditions change now correctly sends the user back to the picker instead of silently downgrading a picks-only plan into a pool-auto-filled one (the picks-only default's whole premise — "re-picking is the honest reset," `generatePlanFromPicks`'s own doc comment — was being violated by the pre-T5D rebuild).

**Does the purge propagate to the synced remote `daily_plan`?** Yes, and now promptly: mechanism 1 above means the *local* `dailyPlan` is already `null` by the time `profileSync`'s `storage.onWrite('dailyPlan', ...)` listener fires (from `purgeDerivedDataForConditionsChange`'s own `setPlan(null)` call) and schedules the debounced push — so the remote row is corrected within one push cycle (~2s) of the conditions edit, not "whenever the Plan tab is next opened."

**Can a stale remote plan get pulled back down over a locally-purged one?** No longer silently — `pullProfile` (gap 2, closed) now checks `isDailyPlanConsistent(row)` (`row.daily_plan.conditionsKey === row.conditions.join(',')`) before hydrating `dailyPlan`; an inconsistent row still hydrates `profile`/`library` but hydrates `dailyPlan` as `null` instead, landing the device at the honest empty state rather than importing known-stale derived data. This is a second, independent line of defense (row-level self-consistency, not a cross-device race check) — the two mechanisms together mean neither a same-device edit nor a remote pull can leave `profile.conditions` and `dailyPlan.conditionsKey` disagreeing on a device for longer than one write.

**Is the `remedi.cache.v1.*` remedy cache invalidated on a conditions change?** No — it's "merely keyed around it," exactly as flagged in the task brief. Every remedy-data cache key (`suggest:`, `topdoordonts:`, `detailed:`, `recipes:`, `goodfor:`) folds `conditionsCSV`/`conditionId` into the key itself, so a conditions change simply addresses a *different* set of keys — old-condition entries are never actively deleted, they just go unreferenced until their TTL would have expired anyway (up to 8h) or forever if the user never returns to that exact condition set. No correctness bug (stale entries are never served for the *new* conditions), but unbounded, unswept growth in `localStorage` over a long-lived install with a user who changes conditions repeatedly.

## 6. Known gaps

1. ~~**Conditions-change purge does not reach the synced remote `daily_plan` until the Plan tab is opened.**~~ **FIXED (T5D).** `profileSync.js`'s `initProfileSync` now registers a `storage.onWrite('profile', ...)` guard (active even signed-out / Supabase-unconfigured) that calls the new `purgeDerivedDataForConditionsChange` (`src/api/planBuilder.js`) on every profile write, discarding a plan built for different conditions the instant the write happens — not the next time `ensurePlanForWeek` happens to run. Its own `setPlan(null)` then flows through the normal `dailyPlan` sync path, so the corrected (nulled) plan reaches the remote row within one debounced push cycle instead of waiting on a Plan-tab mount.
2. ~~**`pullProfile` can hydrate a locally-purged device with a stale, mismatched remote plan.**~~ **FIXED (T5D).** `pullProfile` now checks `isDailyPlanConsistent(row)` (`row.daily_plan.conditionsKey === row.conditions.join(',')`) before hydrating `dailyPlan`; `profile`/`library` still hydrate from an inconsistent row, but `dailyPlan` hydrates as `null` instead of the stale plan (dev-only `console.warn`, never a raw error to the user).
3. ~~**A conditions change silently drops `picksBySlot` and reverts to legacy candidate-pool auto-fill.**~~ **FIXED (T5D).** `ensurePlanForWeek`'s changed-conditions branch no longer rebuilds from the pools at all — it discards the plan and returns `{ plan: null, usedFallback: false }`, the same no-plan contract a first-ever build returns, so the user is sent back to the picker (re-picking is the honest reset) instead of getting a silently downgraded auto-filled week.
4. **`remedi.cache.v1.*` is never swept.** Entries are naturally partitioned by conditions/food/group key (so nothing stale is ever served), but old entries are never deleted — a device that cycles through many condition sets over time accumulates orphaned cache entries indefinitely.
5. ~~**`schedule` (src/state/schedule.js) is a second, independent plan-adjacent store that isn't synced and isn't purged on a conditions change.**~~ **FIXED.** Rule: any change to a guidance-relevant profile field (`conditions`, `allergies`, `medications`, `dietaryPattern`, `religiousRestriction`) wipes the prior meal-plan selections immediately. `profileSync.js`'s `profile` `onWrite` hook now diffs a `guidanceFingerprint` of the profile (order-insensitive) and, on a change, calls `purgeMealPlanForProfileChange` (`src/api/planBuilder.js`), which clears the live plan (including `picksBySlot`, i.e. the picks), the active-saved-plan pointer, and the `schedule` store (`clearSchedule`). **Deliberately kept:** the `library` (saved recipes) and the `savedPlans` list — user-authored collections, not condition-derived caches; a loaded saved plan whose conditions no longer match is still discarded by `ensurePlanForWeek` on the next Plan mount. Non-guidance edits (name, calorie target, ageBand) wipe nothing. With no prior profile to diff against (first save), it falls back to the old conditions-key check. `schedule` itself remains unsynced.
6. **`queue` (src/state/queue.js) is fully dead as a write path** but still has a live writer module and a live one-time reader (`consumeLegacyQueue`) — not a correctness bug, just unswept legacy surface area worth eventually removing.
