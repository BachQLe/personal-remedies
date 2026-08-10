# P5 — Request-count instrumentation

**Live calls used: 0** (instrumentation only — no live calls needed to build or document a counter).

**No dev server or Playwright was run for this probe**, per the task scope. The counter is built and documented here; a full measured baseline (real call counts across a real session) is left to the orchestrator's own Playwright verify passes, as instructed.

---

## What was added

`src/api/nutridigm.js` gained a dev-only, in-memory, per-endpoint request counter. Diff summary (57 lines added, 0 removed, 0 modified — purely additive):

1. **`_requestCounts`** — a module-private `Map<string, number>` keyed by endpoint path (e.g. `'goodfor'`, `'suggest'`, `'topdoordonts'`).
2. **`recordRequest(urlStr)`** — private helper, parses the endpoint from the final path segment of the request URL (so `performRequest`'s existing signature never changes — no new parameter threaded through) and increments that endpoint's counter.
3. **One call site**: `performRequest(urlStr)` now calls `recordRequest(urlStr)` as its first line, before the `fetch`. This is the single choke point ALL real network requests pass through (`request()` → in-flight de-dupe map → `performRequest()` → `fetch()`), so every real request is counted exactly once, and:
   - Requests served by the in-flight de-dupe map (`_inFlight`, concurrent calls to the exact same URL) are **not** double-counted — they share the one `performRequest` call already in flight.
   - Requests served entirely from the persistent `cache.js` TTL cache (a cache hit that never calls `fetchXxx` at all) are **not** counted — they never reach `nutridigm.js`. This means the counter measures actual network egress, not logical "did the app ask for this data" calls — which is the right measurement for API-budget purposes.
4. **`export function getRequestCounts()`** — new named export, returns a plain object snapshot (`Object.fromEntries(_requestCounts)`) so callers can't mutate internal state. Zero risk to existing imports: it's a new export, nothing existing changed shape.
5. **`window.__remediRequestCounts`** — assigned to `getRequestCounts` itself (the function, not a snapshot) at module load, guarded by `import.meta.env?.DEV` (Vite's dev-mode flag, `false`/absent in production builds) and `typeof window !== 'undefined'` (so it's a no-op under Node/SSR/the Vitest environment the other agent's tests run in, unless that environment also sets `DEV`). Complete no-op in production bundles.

No existing function signature changed. No existing behavior changed — `performRequest`'s status-code handling, the in-flight de-dupe, and all 8 wrapper exports (`fetchHealthConditions`, `fetchFoodItems`, `fetchFoodGroups`, `fetchGoodFor`, `fetchTopDoOrDonts`, `fetchSuggest`, `fetchDetailed`, `fetchReferences`) are untouched. Verified with `node --check src/api/nutridigm.js` (syntax OK) and a re-read of the full diff (`git diff src/api/nutridigm.js`) confirming it is 100% additions.

## How to read it

**Browser console** (dev server running):
```js
window.__remediRequestCounts()
// => { goodfor: 3, suggest: 11, topdoordonts: 2, references: 5 }
```

**Playwright** (in a verify pass):
```js
const counts = await page.evaluate(() => window.__remediRequestCounts?.());
```

**From another module** (e.g. a test):
```js
import { getRequestCounts } from '../src/api/nutridigm.js';
const counts = getRequestCounts();
```

Counts are per-session (in-memory only, reset on reload) and per-endpoint, not per-URL — repeated calls to `/goodfor` for different food IDs all increment the same `goodfor` key. This matches what the existing budget contract (below) actually cares about: total requests per endpoint per session, not per-parameter uniqueness.

## Baseline contract (transcribed from `.claude/skills/verify/SKILL.md`)

The verify skill's existing "Observe" section already states expected call-count budgets, captured here verbatim as the baseline this counter should be checked against:

> Capture console errors (`page.on('console')`) and Nutridigm API calls (`page.on('request')`, filter for topdoordonts/fooditems/references/goodfor/suggest/detailed) — call counts verify the cache/prefetch contract (**topdoordonts@limit=50 should be ≤2 per session**; **/references ≤3 per guidance-list mount**).

So the two known numeric expectations going into this instrumentation are:
- **`topdoordonts`** (at `limit=50`): **≤ 2 per session** — this is the shared cache key both `getSuggestions`/`getWorstFoods` (via `cachedTopDoOrDonts`, `adapter.js:73-78`) and `getTopDosAndDonts` reuse, so one "consume" fetch and one "avoid" fetch should be the ceiling regardless of how many screens read them, per the 8h TTL cache.
- **`references`**: **≤ 3 per guidance-list mount** — each food card can trigger one `/references` call per profile condition (`cachedReferences` is keyed per `(conditionId, foodId)`, 7-day TTL), so this bounds how many distinct (condition, food) pairs get fetched per single mount of a guidance list.

No other endpoint has a stated numeric budget in the verify skill today — `goodfor`, `suggest`, `detailed`, and the three dictionary endpoints (`fooditems`/`healthconditions`/`foodgroups`, which should ideally read 0 at runtime since they're statically bundled from `src/data/cache/` via `localTables.js`, never fetched live) have no documented ceiling yet. `window.__remediRequestCounts()` now makes all of these measurable in one call, including confirming the dictionary endpoints truly stay at 0 live requests during a normal session (they're never called by `nutridigm.js` at runtime — only `scripts/snapshot-nutridigm.mjs`, a standalone Node script, calls them, and only when run by hand).

A full measured baseline (real counts from a real Playwright-driven session) was intentionally NOT captured here — the task scope for P5 is the instrumentation and the documented contract, not a live measurement run. That measurement is left to the orchestrator's own Playwright verify passes, which can now read `window.__remediRequestCounts()` directly instead of manually tallying `page.on('request')` events.
