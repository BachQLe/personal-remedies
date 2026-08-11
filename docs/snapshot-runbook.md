# Snapshot runbook — `scripts/snapshot-nutridigm.mjs`

Operational runbook for re-running the Nutridigm dictionary snapshotter.
Written by reading `scripts/snapshot-nutridigm.mjs`, `src/api/config.js`,
`src/api/adapter.js` (`withConditionFallback`), `src/components/onboarding/ProfileBuilder.jsx`,
and `src/data/__tests__/cacheAllowlist.test.js` — not guessed. Master plan
ref: §3.5 ("Re-run `scripts/snapshot-nutridigm.mjs` when Mory expands the
key; wire the 10 conditions through").

## 1. What the script does, and does NOT do

`node scripts/snapshot-nutridigm.mjs` fetches exactly three Nutridigm
**dictionary** endpoints and overwrites their committed snapshots:

| Endpoint | Written to | Row ID field |
|---|---|---|
| `/fooditems` | `src/data/cache/items.json` | `foodItemID` |
| `/healthconditions` | `src/data/cache/conditions.json` | `healthConditionID` |
| `/foodgroups` | `src/data/cache/groups.json` | `foodGroupID` |

That's the full allowlist. Master plan §3.3: *"items, conditions, groups
ONLY — remedy and nutrient-content data are too large and not permitted
under API terms."* `src/data/__tests__/cacheAllowlist.test.js` enforces this
two ways: (i) `src/data/cache/` may only ever contain
`{items,conditions,groups,itemOverlay,itemOverlay.generated}.json` — nothing
else — and (ii) the script's `TABLES` array (the sole thing that decides
what gets written) is statically inspected to confirm it names only those
three files. **Do not add a fourth table** (e.g. a `/topdoordonts` or
`/suggest` snapshot) to this script — that would fail the allowlist test by
design, and would violate the API terms the allowlist exists to enforce.
Remedy/suggestion/detail data has its own, separate, short-TTL runtime cache
(`remedi.cache.v1.*`, `src/api/cache.js`, 8h/7d TTLs, never committed —
see `docs/storage-map.md` §2) which is a completely different mechanism and
is out of scope for this script.

## 2. Prerequisites

- A `.env` or `.env.local` at the repo root with `VITE_NUTRIDIGM_SUBSCRIPTION_ID`
  set to a valid Nutridigm subscription key. The script hand-parses these
  files itself (it's a plain Node script, not Vite-processed, so it can't
  read `import.meta.env` the way `src/api/config.js` does) — same two vars,
  `.env.local` wins over `.env` on conflicts.
- Optionally `VITE_NUTRIDIGM_BASE_URL` if pointing at something other than
  the default AWS endpoint. Direct-mode only — the script talks to
  Nutridigm directly, never through the Supabase proxy
  (`supabase/functions/nutridigm-proxy`), since it needs the raw key anyway.
- If neither var is set, the script prints an error and exits `1` before
  making any request — it will not silently write empty/partial files.

## 3. Why this is hand-run, never CI

The Nutridigm API enforces a **daily call limit** on the subscription key.
This script burns 3 calls (one per dictionary endpoint) every time it runs.
Wiring it into CI — even on a schedule — risks colliding with normal app
usage against the same key and exhausting the daily quota for real users.
Run it by hand, only when there's a specific reason to believe the
knowledgebase changed (e.g. Mory says conditions/items/groups were added,
renamed, or removed — see §5 for the "key gains more scoreable conditions"
case specifically, which does NOT by itself require a re-run).

## 4. Running it and reading the diff

```
node scripts/snapshot-nutridigm.mjs
```

For each of the three tables, it prints a diff **before** overwriting the
file, comparing the freshly-fetched rows against whatever was previously
committed at that path (keyed by that table's ID field, deep-equality per
row):

```
[items] 1842 → 1849 rows
  added:   7 (2201, 2202, 2203, 2204, 2205, 2206, 2207)
  removed: 0
  changed: 3 (118, 402, 917)
```

- **added** — IDs present in the fresh fetch but not the previous file.
- **removed** — IDs present in the previous file but absent from the fresh
  fetch (Nutridigm retired/renamed the row, or it fell out of the key's
  scope).
- **changed** — IDs present in both, but with at least one field different
  (deep-equal check across all fields on the row — a changed
  `longDescription`, `ICD10`, `AKA`, group tag, etc. all count).

The write happens unconditionally right after the diff prints — the script
does not pause for confirmation. That's why review happens **after** the
run, via `git diff`, before committing (§5), not by intercepting the script
itself.

## 5. Reviewing before committing

1. Run the script (§4). Read the three diff blocks in the terminal output —
   do the added/removed/changed counts look plausible given what Mory said
   changed? A `removed` count anywhere near the total row count, or a
   `changed` count that touches nearly every row, is a signal something
   went wrong upstream (wrong endpoint, wrong key scope) rather than a real
   knowledgebase update — don't commit on autopilot.
2. `git diff -- src/data/cache/items.json src/data/cache/conditions.json src/data/cache/groups.json`
   to see the actual JSON diff. These files are pretty-printed
   (`JSON.stringify(sorted, null, 2)`) and sorted ascending by ID, so the
   diff is stable and readable — a single new row shows as a clean insert,
   not a whole-file rewrite.
3. Confirm no other file changed. The script only ever touches those three
   paths (enforced statically by the cache-allowlist test, §1) — `git
   status` should show exactly `items.json` / `conditions.json` /
   `groups.json` (whichever tables actually drifted; a table with zero
   added/removed/changed still gets rewritten byte-for-byte with the same
   content, so `git diff` on it will be empty even though the script wrote
   it).
4. Run `npx vitest run` — `cacheAllowlist.test.js` and anything that reads
   these dictionaries (`src/api/localTables.js` consumers) should still be
   green. The snapshot files are statically imported at build time
   (`localTables.js`), so a malformed row (missing required field, wrong
   type) would typically surface as a test failure or a runtime error
   somewhere that reads it, not silently.
5. Commit the three files together with a message naming what changed
   (e.g. "Re-snapshot Nutridigm dictionaries: +7 items, 10 conditions
   scoreable"). Don't commit the snapshot as a side effect of an unrelated
   change — keep it isolated so the diff is easy to audit later.

## 6. Does expanding the key to 10 conditions require ANY code change?

**No — this is purely data/key-side. No app code change is required.**
Traced through the actual call path:

- **The condition *picker* is already unrestricted.** Onboarding's
  condition search (`src/components/onboarding/ProfileBuilder.jsx`) sources
  its list from `getConditions()` — the full committed
  `src/data/cache/conditions.json` dictionary, currently **271 rows**. A
  user can already search and select any of those 271 conditions today;
  there is no cap, and no code path filters the picker down to whatever the
  subscription key happens to be authorized to score. Expanding the key's
  authorization from 2 conditions to 10 doesn't add anything new to *pick*
  — those 10 (whichever IDs Mory names) are almost certainly already rows
  in `conditions.json` (the dictionary is the catalog of all conditions
  Nutridigm knows about; key authorization is a separate, narrower
  "which of these can this key fetch scored data for" permission). Re-running
  the snapshot (§4) is only needed if Mory says the *dictionary itself*
  gained/lost/renamed rows — not because of the authorization change alone.
- **Real user conditions already flow untouched.** `profile.conditions`
  (set by the picker, read by `src/api/recommendations.js`,
  `src/api/adapter.js`, `src/api/recipeDetail.js`, and every screen that
  requests remedy data) is sent to Nutridigm as-is, whatever the user
  picked. There's no per-screen allowlist of "supported" condition IDs in
  application code to update.
- **`DEFAULT_DEV_CONDITIONS`** (`src/api/config.js`, currently `[203,
  244]`) is a **fallback constant**, not a routing table. It's used in
  exactly two situations: (a) as the default request when no profile exists
  yet (guest/dev convenience), and (b) as `withConditionFallback`'s
  (`src/api/adapter.js` ~:142) one-shot retry substitute when a request 401s
  with `NOTAUTHORIZEDHEALTHID` — i.e. when the profile's conditions include
  at least one the key can't score. Today that fallback fires for
  269 of the 271 dictionary conditions (everything except 203/244). After a
  10-condition expansion, it fires for 261 instead of 269 — **strictly
  fewer users hit the fallback path**, but the mechanism itself needs no
  change: `withConditionFallback` doesn't know or care how many conditions
  the key supports, it just retries once with whatever
  `DEFAULT_DEV_CONDITIONS` names, and that constant stays valid as long as
  203/244 remain authorized post-expansion (expanding a key's scope is
  additive by definition, so they will).
- Optional, not required: a maintainer could widen
  `DEFAULT_DEV_CONDITIONS` itself to include a couple of the newly
  authorized IDs, for a marginally more representative guest/dev demo
  experience. This is a one-line constant edit if ever wanted — it is not
  necessary for the 10 conditions to work for real, signed-in users with
  their own profile.

**Bottom line:** ask Mory to confirm which 10 `healthConditionID`s are now
authorized, spot-check that they already appear in `src/data/cache/conditions.json`
(if any are missing, that's the one case that needs a re-run per §4-5), and
otherwise ship nothing — the client already requests, receives, and renders
whatever conditions a profile holds, with no hardcoded ceiling.
