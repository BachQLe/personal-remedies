# USDA FoodData Central pipeline (Task T2D)

*How Remedi gets real nutrition numbers (calories/protein/carbs/fat) for plain foods, without ever calling an external API at runtime.*

## Why this exists

`src/data/nutritionEstimates.js` is a hand-labeled, clearly-flagged **estimate** table — its own header calls it out as a replaceable seam. The Nutridigm API has zero nutrition data (no calories/macros anywhere). USDA FoodData Central (FDC) is the real source: it's free, it's CC0 (public domain — no attribution legally required, though we cite it anyway below), and it actually has measured macros for whole/plain foods.

The design deliberately keeps USDA **out of production**:

```
FDC API (live, rate-limited, needs a key)
        │
        │  scripts/build-usda-map.mjs  (hand-run, offline, this doc)
        ▼
src/data/usda/fdcMap.json + nutrients.json   (committed, CC0, no key needed)
        │
        │  src/api/nutrition.js  (NEXT WAVE — not built by this task)
        ▼
   the running app
```

Nothing under `src/data/usda/` is fetched at request time — it's a build artifact, committed to the repo like `src/data/cache/items.json` already is for Nutridigm's dictionaries.

## Getting a free key

1. Sign up at <https://api.data.gov/signup/> (free, instant, no card).
2. You'll get an email with a key that works for **every** api.data.gov-hosted API, including FDC — 1,000 requests/hour.
3. Add it to `.env` (not `.env.example`, which stays a template):
   ```
   USDA_API_KEY=your-key-here
   ```
   `VITE_USDA_API_KEY` also works (same precedence) if you'd rather keep the `VITE_` prefix convention used elsewhere in this repo — but note the app **never** reads either at runtime; the `VITE_` prefix here is just a naming convenience, not a Vite-env requirement.
4. No key? The script falls back to the public `DEMO_KEY` automatically. It works, but it's shared globally by everyone using the FDC demo tier and is rate-limited hard (in practice we saw it throttle after single-digit requests in a session, well under the nominally-documented ~30/hr, 50/day) — good for a small pilot via `--limit`, not a full run.

## Running it

```bash
# Full run — attempts every subset item that doesn't already have a map entry.
node scripts/build-usda-map.mjs

# Pilot / DEMO_KEY-friendly — only attempts the first N unresolved items.
node scripts/build-usda-map.mjs --limit 40
```

It's safe to re-run at any time:

- Items that already have an entry in `fdcMap.json` (matched OR manually set) are **never** re-searched or re-fetched. A rerun only spends API calls on items still missing from the map, so a `DEMO_KEY` pilot today and a real-key full run next week compose cleanly — the second run just tops up what the first one didn't reach.
- `manualOverride: true` rows are additionally guarded at the merge step (`mergeMapEntries`) — even if some future change fed a fresh result for the same `foodItemID`, a manual row is never overwritten.
- Nutrients are fetched for any `fdcId` referenced by the merged map that isn't already in `nutrients.json` — this also backfills nutrients for an `fdcId` a human points a manual override at.

On an HTTP 429 (rate limited), the script stops the current phase cleanly, keeps everything it already resolved, and records why in `_meta.lastRun.stopReason` in the output files. It never fabricates a result to "finish" a run.

## The subset (what gets mapped)

Union of:
1. Items whose `fineFoodGroup` is one of Remedi's plan-slot groups: `f, d, g1, c2, e, b1, b3, h1, c3, h2` (mirrors `src/api/config.js`'s `PLAN_SLOTS[*].fineGroups`).
2. Every `foodItemID` flagged in `src/data/cache/itemOverlay.generated.json` (the 262-row snack/beverage overlay).

**Recipes (`fineFoodGroup: 'l'`) are never included**, even if overlay-flagged — recipe nutrition comes from MedlinePlus/C1 Nutrition Facts panels (master plan §2.3), not USDA.

As of this writing that subset is **632 items** (the overlay is a strict subset of the plan-slot-group items, so the union equals the plan-slot-group count).

## Matching rules

For each subset item, the query text is `item.displayAs || item.description`, sent to FDC's `/foods/search` as natural text (FDC's own relevance ranking does the heavy lifting there). Results are restricted to `dataType ∈ {Foundation, SR Legacy}` — **Branded is never eligible, at any score**. That's enforced in `isAllowedDataType`/`pickBestMatch`, not just in the search request, as a defense-in-depth measure.

Candidates are then scored locally by comparing **normalized** names (`normalizeFoodName`: lowercase, parentheticals stripped, punctuation stripped, whitespace collapsed):

| Method | Score | Example |
|---|---|---|
| **Exact** | 1.0 | target `"peaches"` vs candidate `"Peaches"` |
| **Starts-with** (token-boundary prefix) | 0.85 | target `"peaches"` vs candidate `"Peaches, yellow, raw"` |
| **Token overlap** (recall) | 0–1.0 | fraction of the target's own words found anywhere in the candidate — e.g. target `"chicken soup"` vs candidate `"chicken breast, raw"` → 0.5 (1 of 2 words) |

Only the single best-scoring allowed candidate is kept, and only if its score clears **`MATCH_THRESHOLD = 0.75`** — deliberately conservative, so a 2-word target needs both words present (or better) to match at all. Ties break: higher score → stronger method (exact > startsWith > tokenOverlap) → earlier `dataType` in the priority list (Foundation over SR Legacy) → shorter candidate name.

**Anything that doesn't clear the threshold is left unmatched — it simply does not appear as a key in `fdcMap.json`.** There is no placeholder, no `null` entry, no "best guess." Absence from the map *is* the "no USDA data" signal, same spirit as `estimateNutrition`'s `null` return and the master plan's frozen guardrail: never fabricate a number.

## Output files

### `src/data/usda/fdcMap.json`

```json
{
  "_meta": {
    "generatedAt": "2026-08-10T19:51:00.000Z",
    "fdcDataVersion": "FDC API v1 (accessed 2026-08-10); USDA does not expose a single unified dataset version via the API — each matched item's fdcId links to its own FDC record for provenance.",
    "subsetSize": 632,
    "matchedCount": 27,
    "unmatchedCount": 605,
    "matchThreshold": 0.75,
    "dataTypePriority": ["Foundation", "SR Legacy"],
    "lastRun": { "keyTier": "demo", "limit": 40, "attempted": 40, "matchedThisRun": 27, "unmatchedThisRun": 13, "stoppedEarly": true, "stopReason": "429 rate limited by FDC API during search phase" }
  },
  "items": {
    "2": { "fdcId": 173692, "matchedName": "Fish, anchovy, european, raw", "dataType": "SR Legacy", "matchScore": 0.85, "manualOverride": false }
  }
}
```

`items` is keyed by **Nutridigm `foodItemID`** (as a string, since JSON object keys are strings). A `foodItemID` with no key here has no USDA match — never a null placeholder.

### `src/data/usda/nutrients.json`

```json
{
  "_meta": { "generatedAt": "...", "fdcDataVersion": "...", "fdcIdCount": 27, "lastRun": { "...": "..." } },
  "nutrients": {
    "173692": {
      "per100g": { "calories": 131, "protein": 20.35, "carbs": 0, "fat": 4.84 },
      "perServing": { "amount": 100, "unit": "g", "calories": 131, "protein": 20.35, "carbs": 0, "fat": 4.84 },
      "portionSource": "100 g"
    }
  }
}
```

`nutrients` is keyed by **`fdcId`** (as a string). `per100g` is always present when the item matched (any macro FDC didn't report comes back `null`, never `0` or a guess). `perServing` is only present when FDC's `foodPortions` gave us a usable gram weight to scale to — it's a straight proportional scale of the real `per100g` values (`value × gramWeight / 100`), not an independently reported number, so it's math, not fabrication. `portionSource` records which portion was used (e.g. `"1 cup, chopped"`) or `"none"` when FDC had no portion data for that food, in which case only `per100g` is usable.

## Hand-fixing a bad match

Sometimes the automated match is wrong or FDC's search just doesn't have a good candidate. To fix it:

1. Search <https://fdc.nal.usda.gov/> yourself for the right food, note its `fdcId`.
2. Edit `src/data/usda/fdcMap.json` directly — set the item's `fdcId` (and update `matchedName`/`dataType` to match reality), and set `"manualOverride": true`.
3. If that `fdcId` doesn't already have a row in `nutrients.json`, the next run of `node scripts/build-usda-map.mjs` will fetch it automatically (nutrient fetching runs for any referenced `fdcId` missing from `nutrients.json`, manual or not) — or fetch it yourself the same way and hand-add the `nutrients.json` row.
4. Every future rerun leaves `manualOverride: true` rows completely alone (guarded in `mergeMapEntries` — see `src/api/__tests__/build-usda-map.test.js` for the guard test). To reset a row back to automated matching, delete it from `fdcMap.json` (and its `nutrients.json` entry, if you want fresh nutrients too) and rerun.

## Attribution

USDA FoodData Central data is [CC0 1.0 (public domain)](https://fdc.nal.usda.gov/license) — no attribution is legally required to use or redistribute it. We cite it anyway: **"Nutrition data provided by the USDA FoodData Central."**

## Runtime contract for the next wave (`src/api/nutrition.js`)

This task (T2D) ships the pipeline and the committed data — **no runtime consumer**. The next wave builds `src/api/nutrition.js`, a resolver with this fallback order:

```
1. C1 recipe panel (recipes only, fineFoodGroup 'l') — not covered by this pipeline at all
2. USDA table (this pipeline) — src/data/usda/fdcMap.json → src/data/usda/nutrients.json
3. Group estimate — src/data/nutritionEstimates.js, flagged `estimated: true`
4. null — no data, never guess
```

To look up an item by Nutridigm `foodItemID`:

```js
const mapEntry = fdcMap.items[String(foodItemID)];       // undefined if never matched
if (mapEntry) {
  const nutrientEntry = nutrients.nutrients[String(mapEntry.fdcId)];
  // nutrientEntry.per100g is always present (any missing macro is `null`)
  // nutrientEntry.perServing is present only when a usable FDC portion existed
}
```

A missing `mapEntry` means: fall through to step 3 (group estimate) or step 4 (`null`) — **not** a zero, not an average, not a rounded guess. That's the same rule this pipeline itself follows (see "Matching rules" above) and the master plan's frozen guardrail.
