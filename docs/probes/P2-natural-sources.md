# P2 — Natural Sources feasibility

**Live calls used: 0** (snapshots + source only, as scoped).

---

## Correction to the probe's premise

The task brief (and `REMEDI_MASTER_PLAN.md`'s Phase 0 P2 line: *"If not, disabled 'Coming soon' button stands"*) describes a **disabled "Coming soon" Natural Sources button** that needs a feasibility verdict before it can be turned on.

**That button no longer exists in the codebase as of the current `HEAD` (commit `63ba737`).** It existed earlier in this project's history and was already removed/enabled before this probe started:

- Commit `048092b` ("Build onboarding flow and restructure app for mobile-first experience") introduced it: `HomeScreen.jsx` had a `disabled aria-disabled="true"` button labeled "Natural Sources" with sublabel "Coming soon" (confirmed via `git show 048092b:src/screens/home/HomeScreen.jsx` / `bcb4360:...`, lines ~159-172).
- Commit `63ba737` ("Replace meal queue with slot-based meal planner (Mory demo)") changed the button to live, removed the `disabled`/`aria-disabled` attributes and the "Coming soon" label, and renamed it "Natural Sources Lookup." The current source comment at `src/screens/home/HomeScreen.jsx:20` reads *"Food Lookup / Natural Sources — two half-width buttons, both live."*
- `git log --follow -p -- src/screens/home/HomeScreen.jsx` shows the exact diff: `-  Natural Sources / -  Coming soon` → `+  Natural Sources Lookup` (live `onClick={() => navigate('/app/search?mode=natural')}`-style handler).

So the premise this probe was meant to gate is already moot for the Home Screen button — it ships live today. What follows is a feasibility assessment of the underlying Natural Sources **feature surface** regardless, since the master plan's Release 2.0 line ("Natural Sources if P2 clears") implies a fuller feature than the current search-only surface.

---

## What's live today

1. **Search.** `SearchScreen.jsx` has a `natural` mode (`MODES.natural`, lines 33-42) that calls `searchNaturalSourceItems` (`src/api/api.js:112-122`) → `searchNaturalSources` (`src/api/adapter.js:621-639`), which does a **client-side filter over the already-cached `/fooditems` dictionary** — zero network calls beyond the dictionary that's already bundled at build time. Filters to `effectiveCoarseGroup(item) === 'k'` and a case-insensitive substring match on the query, capped at 50 results.
2. **Browse / category detail.** `GroupsTab.jsx`'s `CATEGORY_GRID_GROUPS` (line 29) already includes `'k'` alongside the 8 other coarse groups (b,c,d,e,f,g,h,i). Tapping the "Key Nutrients & Herbal" tile navigates to `/app/suggestions/group/k` → `GroupDetailScreen.jsx`, which is coarse-group-agnostic and renders `CategoryDetailPanel` for whatever `groupId` it's given — including `k`. `CategoryDetailPanel` is backed by `getCategoryDetail` → `/detailed?coarseFoodGroup=k&...`, which the swagger spec confirms is a valid `coarseFoodGroup` value (`docs/nutridigm-api.md`: *"Valid values for coarseFoodGroup are: b, c, d, e, f, g, h, i, j, k and l"*). So the helpful/neutral/harmful browse experience other coarse groups get is **already wired for `k` too** — no code change needed.
3. **Detail card / assessment.** `FoodDetailCard.jsx` and `assessFood`/`getFoodFacts` are id-driven, not group-scoped — any `foodItemID` returned by the search or category-detail surfaces above (including `k` items) already flows into the same detail card, `/goodfor` assessment, and `/references` citations as any other food.

## Data available for `k` (Key Nutrients & Herbal Medicines)

Counted from the committed `src/data/cache/items.json` snapshot (1,485 total rows):

| | count |
|---|---|
| `coarseFoodGroup === 'k'` (or fine group starts with `k`) | **247** |
| — fine group `k1` | 78 |
| — fine group `k2` | 169 |

Field set on every `k` row (union of keys, same as every other item): `foodItemID`, `description`, `displayAs`, `coarseFoodGroup`, `fineFoodGroup`, `longDescription`, `unitOfMeasure`. No image field (see P4). Example rows:

```json
{ "foodItemID": 302, "description": "Goji berry", "displayAs": "Goji berry", "coarseFoodGroup": "k", "fineFoodGroup": "k2", "longDescription": "Dried. Aka wolfberry...", "unitOfMeasure": "30" }
{ "foodItemID": 967, "description": "Probiotics", "displayAs": "Probiotics", "coarseFoodGroup": "k", "fineFoodGroup": "k1", "longDescription": "Microorganisms that are believed to provide health benefits...", "unitOfMeasure": "gram" }
```

`unitOfMeasure` on these rows carries dosage-flavored values not seen on plain foods (e.g. `"mg"`, `"gram"`, `"mEq/d"`, `"30"`) — informational, not currently surfaced anywhere in the UI.

## Enrichment feasibility (from source code, no live calls needed to confirm)

- **`/detailed` enrichment**: feasible and already wired (see GroupDetailScreen above) — `coarseFoodGroup=k` is a documented-valid value.
- **`/goodfor` enrichment**: feasible — `/goodfor` takes any `foodItemID`, group-agnostic. `FoodDetailCard` already calls it for any item id, `k`-group or not.
- **`/suggest` enrichment**: NOT applicable to the coarse-group browse case — `/suggest` takes a `fineFoodGroup`, not `coarseFoodGroup`, and would need `k1`/`k2` passed explicitly per fine group (unused today for Natural Sources; only used for recipes group `l` and the 3-fine-group-per-slot Plan candidate pools).
- **Cached localStorage responses**: `src/api/cache.js` persists live responses under `localStorage` key namespace `remedi.cache.v1.<key>` (e.g. `detailed:<conditions>:k:<listType>`, `goodfor:<conditions>:<foodId>`) with an 8h TTL. This static, non-browser analysis has no access to an actual browser's `localStorage` to inspect real persisted entries — noting the cache key format for completeness rather than claiming to have inspected live cache contents. No live API call was made to populate or inspect this cache for this probe (per the zero-live-call constraint on P2).

## Verdict

**Natural Sources is already API-feasible and already shipped**, both as a search surface (live today) and — via the pre-existing, coarse-group-agnostic `GroupsTab`/`GroupDetailScreen`/`CategoryDetailPanel` pipeline — as a "Best & Worst" style browse surface with `/detailed` enrichment. The disabled "Coming soon" button this probe was meant to gate a decision on was already replaced with a live button in commit `63ba737`, before this probe ran. There is no remaining "does the button stand" question for the master plan's Phase 0 gate — the master plan's own Release 2.0 line ("Natural Sources if P2 clears") can be marked cleared based on code that already exists, not a future build.

The only unaddressed gap specific to `k` items is the same one P4 identifies for the whole item dictionary: no image field.
