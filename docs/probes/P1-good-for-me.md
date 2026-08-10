# P1 — "Good for me" feature feasibility

**Probe, not a proposal.** This document reports what data exists on the Nutridigm API surface. It does not propose, design, or invent a "good for me" feature. Facts only.

**Live calls used: 2** (both `/goodfor`, within the ≤2 budget).

---

## Method

- Read all 8 wrappers in `src/api/nutridigm.js`.
- Read `src/api/adapter.js`, in particular `assessFoodRaw` (`src/api/adapter.js:666-733`), `numericIdToTier` (`src/api/adapter.js:162-173`), and the raw `description`/`verdict`/`score` passthrough at `src/api/adapter.js:729-731`.
- Read `src/api/types.js`'s `Assessment` typedef (`src/api/types.js:75-90`).
- Read the field sets actually present in the three committed snapshots (`src/data/cache/items.json`, `conditions.json`, `groups.json`).
- Read `docs/nutridigm-api.md` (the vendor's swagger spec).
- Made 2 live `/goodfor` calls to compare the documented schema against the real response shape:
  1. `GET /goodfor?foodItemID=147&healthConditionID=203,244` (Salmon, smoked/Lox; two conditions)
  2. `GET /goodfor?foodItemID=369&healthConditionID=203` (Broccoli; one condition)

---

## Every field available, per endpoint

### `/fooditems` (`fetchFoodItems`) — dictionary, snapshotted in `items.json`
Fields present on every one of the 1,485 rows (verified by taking the union of keys across the whole file — see P4 for the full grep): `foodItemID`, `description`, `displayAs`, `coarseFoodGroup`, `fineFoodGroup`, `longDescription`, `unitOfMeasure`. Matches the swagger `FoodItem` schema exactly. No score, no verdict, no condition-relative data — this is a static dictionary, condition-agnostic.

### `/healthconditions` (`fetchHealthConditions`) — dictionary, snapshotted in `conditions.json`
Fields: `healthConditionID`, `description`, `longDescription`, `AKA`, `ICD10`. Static, food-agnostic. `ICD10` exists but nothing in the codebase currently reads it.

### `/foodgroups` (`fetchFoodGroups`) — dictionary, snapshotted in `groups.json`
Fields: `foodGroupID`, `description`, `isFineFoodGroup`, `isCoarseFoodGroup`. Static, no score data.

### `/goodfor` (`fetchGoodFor`) — the endpoint most directly relevant to "good for me"
**Documented schema** (`docs/nutridigm-api.md` `GoodFor` definition): `descriptionNumericID`, `description`, `notes`, `value`.

**Actual observed shape** (single condition — call 2, foodItemID 369, condition 203):
```json
{
  "value": 1.962,
  "description": "More Helpful",
  "descriptionNumericID": 2,
  "notes": ""
}
```
Matches the documented schema exactly. No undocumented fields for a single-condition request.

**Actual observed shape** (two conditions — call 1, foodItemID 147, conditions 203,244):
```json
{
  "value": 0.9539,
  "description": "Helpful",
  "descriptionNumericID": 3,
  "notes": "",
  "conditions": [
    { "value": 1.8125, "description": "More Helpful", "descriptionNumericID": 2, "notes": "" },
    { "value": 0.0953,  "description": "Neutral / OK",  "descriptionNumericID": 4, "notes": "" }
  ]
}
```
**Finding: a `conditions` array appears when 2+ condition IDs are requested, and it is NOT documented anywhere in `docs/nutridigm-api.md`.** It is positional — one entry per `healthConditionID` in the request CSV, same order — each entry carrying its own `value`/`description`/`descriptionNumericID`/`notes`. The top-level `value`/`description`/`descriptionNumericID` is a single reconciled score across all requested conditions, not an average of the per-condition entries in any documented way (0.9539 sits between 1.8125 and 0.0953 but the exact reconciliation formula is not specified anywhere).

`adapter.js`'s `assessFoodRaw` (line 692: `const condData = raw.conditions && raw.conditions[index]`) already depends on this undocumented `conditions` array and defensively no-ops when it's absent. **Consequence confirmed by this probe:** for a profile with exactly ONE condition, `raw.conditions` is `undefined`, so every entry in `assessFood`'s `perCondition` array gets `tier: null` / `numericId: null` even though the top-level reconciled `food.tier` is correct. Only the reconciled tier is trustworthy for single-condition profiles; the per-condition breakdown silently degrades to "no data" in that case. This is existing behavior, not a bug introduced here — flagged because it directly bears on what a "good for me" feature could show per-condition for a single-condition user (nothing, today).

### `/topdoordonts` (`fetchTopDoOrDonts`)
Fields (swagger `TopItems`): `description`, `value`, `foodItemID`, `displayAs`, `notes`. No `descriptionNumericID` — rank + list membership (consume vs. avoid) is the only signal; `adapter.js`'s `normalizeTopFood` never attaches a tier for this reason.

### `/suggest` (`fetchSuggest`)
Fields (swagger `Suggest`, confirmed against this probe's own live `/suggest` calls in P3): `foodItemID`, `foodItemDisplayAs`, `value`, `foodDescription`, `description`, `descriptionNumericID`, `notes`. Has a numeric tier (`descriptionNumericID`) unlike `/topdoordonts`.

### `/detailed` (`fetchDetailed`)
Fields (swagger `Detailed`): `foodItemID`, `foodItemDisplayAs`, `healthConditionID`, `description`, `notes`, `value`. **No `descriptionNumericID`** — this is why `normalizeDetailedFood` (`adapter.js:402-410`) never attaches a tier; the requested `listType` (helpful/neutral/harmful) is the only verdict signal.

### `/references` (`fetchReferences`)
Returns `string[]` — citation strings only, no numeric/verdict data.

---

## What the adapter layer already does with this

- `numericIdToTier` (`adapter.js:162`) maps `descriptionNumericID` 1/2/3 → `Top`/`Strong`/`Good`, 4 → `null` (neutral/no-data), 5/6/7 → `poor`.
- `assessFoodRaw` (`adapter.js:666`) is the one function that keeps the raw numeric data: `score: raw.value`, `verdict: raw.description`, `numericId: raw.descriptionNumericID` (lines 729-731), alongside the reconciled `tier` and the `perCondition[]` breakdown. `types.js`'s `Assessment` typedef documents this as a deliberate, user-approved relaxation (July 2026) of a historical never-expose-numeric-scores rule — but scoped explicitly: "don't surface it as a bare number elsewhere without a product decision."
- **Currently, nothing in the UI renders `score` or `verdict`.** Grepping `FoodDetailCard.jsx` (the only consumer of `assessFood`'s result) shows only `assessment.numericId` is read, and only to feed `FoodRating` (star/skull display via `numericIdToRating` in `src/utils/rating.js`) and `saveGate.js`'s block logic. The human-readable `verdict` string (e.g. "More Helpful", "Neutral / OK") and the raw `score` float exist on every `Assessment` object today and are unused.

---

## What exists / what doesn't (conclusion)

**Exists:**
- A per-food, per-condition-set reconciled verdict (`descriptionNumericID` 1-7 → tier, plus a human-readable label string in `description`) via `/goodfor`, already wired end-to-end into `assessFood`.
- An undocumented per-condition breakdown (`conditions[]`) when 2+ conditions are requested — already consumed defensively by `adapter.js`.
- A raw numeric score (`value`) per food+condition-set — captured but not displayed.
- Supporting citations (`/references`) — already wired and displayed as "N studies" / expandable citation list.
- Condition metadata (`AKA`, `ICD10`) for the health condition itself — not currently read by anything.

**Does not exist:**
- Any explanation of *why* a food is rated a given way (no ingredient/nutrient-level reasoning, no mechanism text) — `description`/`notes` are short labels/blurbs, not explanations.
- Nutrition facts of any kind (confirmed separately by the existing `NutritionFacts` typedef comment in `types.js:227-241`, which documents a prior probe finding zero nutrition fields anywhere in the API).
- A documented formula for how the top-level reconciled score relates to the per-condition `conditions[]` entries when multiple conditions are requested.
- Per-condition breakdown data at all when a profile has only one condition (the `conditions[]` array is simply absent from the response in that case).
