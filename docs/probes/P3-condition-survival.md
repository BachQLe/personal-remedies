# P3 — Condition-filter survival

**Live calls used: 3** (`/suggest?fineFoodGroup=l`, one per condition set — the full P3 budget).

Script: `scripts/probe-suggest.mjs suggest` (raw output archived below). Run once; not repeatable without spending more of the shared daily quota.

---

## Method

Three live calls, exactly as scoped:
1. `GET /suggest?fineFoodGroup=l&healthConditionID=203`
2. `GET /suggest?fineFoodGroup=l&healthConditionID=244`
3. `GET /suggest?fineFoodGroup=l&healthConditionID=203,244`

For each response: total recipe count, how many carry `descriptionNumericID` in the 1-4 band (`normalizePlanGroup`'s safety pre-filter, `src/api/adapter.js:999-1008`), and a `mealType` distribution over the surviving 1-4 band using a script-side replica of `guessMealType` (`src/api/adapter.js:531-537`, keyword table at `:495-523`, replicated verbatim in the probe script).

I also captured a second, stricter band (`descriptionNumericID` 1-3) and a full numericID histogram, for a reason explained below.

## Results

| Condition(s) | Total returned | 1-4 band (survival) | 1-3 band | breakfast | lunch | dinner | snack | beverage |
|---|---|---|---|---|---|---|---|---|
| 203 (Aging) | 19 | 19 (**100%**) | 19 (**100%**) | 2 | 1 | 14 | 2 | 0 |
| 244 (Pneumonia) | 7 | 7 (**100%**) | 7 (**100%**) | 2 | 0 | 4 | 1 | 0 |
| 203,244 (both) | 14 | 14 (**100%**) | 14 (**100%**) | 2 | 0 | 10 | 2 | 0 |

`descriptionNumericID` histogram (raw, before any filtering):
- 203: `{2: 6, 3: 13}`
- 244: `{3: 7}`
- 203,244: `{2: 4, 3: 10}`

No item in any of the three responses carries `descriptionNumericID` 1, 4, 5, 6, or 7. Beverage classification is 0 in all three sets, as expected (no `beverage` keyword exists in `guessMealType`'s table).

## Two findings, not one

**Finding A — the 1-4 safety band is not the binding constraint here.** Every single item `/suggest?fineFoodGroup=l` returns for these condition sets is already tier 2 (Strong) or 3 (Good) — 100% survival in both the 1-4 band and the stricter 1-3 band. `wouldBeExcludedByIsExcludedItem` (a separate check) is also 0 for all three, though that's structurally guaranteed and not meaningful here: `isExcludedItem` treats fine group `'l'` itself as excluded (it's in `EXCLUDED_FINE_GROUPS`), so applying it to `/suggest&fineFoodGroup=l` results would exclude everything — which is exactly why `getRecipesRaw` (`src/api/adapter.js:955-979`) never calls `isExcludedItem` on recipes. This is included in the script/report for completeness, not because it's an active filter for this endpoint.

Note also: the number actually gating whether a recipe can fill a Plan slot is stricter than the "1-4" band this probe was asked to measure. `recipeToPlanCandidate` + `TIER_TO_NUMERIC_ID` (`adapter.js:982, 1243`) requires `numericId` 1-3 (Top/Strong/Good) — a recipe scored Neutral (4) does not fill a slot, only shows up in the general Recipes list/search. Since this pull contains zero 4s anyway, the 1-4 vs. 1-3 distinction doesn't change today's numbers, but it will matter once the 150-recipe C1 batch is scored and starts producing Neutral/harmful results.

**Finding B — the real constraint is the size and shape of the CURRENT recipe library, not the safety filter.** `/suggest?fineFoodGroup=l` currently returns only **19 recipes total for condition 203, 7 for condition 244, and 14 for both together** — this is the entire real-recipe library Nutridigm has scored today (pre-C1-batch), not a sample. That's dramatically smaller than the master plan's 150-recipe target, and the per-mealType shape is lopsided:

- **Lunch is nearly empty**: 1 item for 203, 0 for 244, 0 for both-combined. `guessMealType`'s keyword table only recognizes `salad`/`sandwich`/`wrap` as lunch signals — everything else defaults to `dinner`.
- **Dinner dominates** by construction: it's the fallback bucket for anything not matching a breakfast/lunch/snack keyword (14 of 19 for 203, 4 of 7 for 244, 10 of 14 combined).
- **Breakfast and snack are thin but present**: 2 and 2 (203); 2 and 1 (244); 2 and 2 (combined).
- **Beverage is structurally zero**: no beverage keyword exists in the heuristic at all, so this recipe fine group cannot supply a beverage slot regardless of library size — consistent with the beverages slot being sourced from `isBeverage`-flagged items instead (`SLOT_FLAG_KEY`, `adapter.js:1076`), not from recipe title keywords.

## What this implies for the C1 150-recipe batch

- **19-20 recipes is nowhere near enough** to populate 4 Plan slots (breakfast/lunch/dinner/snacks) with variety for even a single condition, let alone the 271-condition full knowledgebase this will eventually need to serve.
- **Lunch needs disproportionate attention.** The master plan's C1 split (30 B / 35 L / 40 D / 25 S&D / 20 Bev) already allocates more to lunch than the current keyword heuristic would ever classify there on its own — confirming that `guessMealType`'s substring heuristic is not a sufficient classifier for the incoming batch and the C1 spreadsheet's own `meal type` column (an explicit, human-assigned field per the master plan's C1 spec) is the right source of truth going forward, not a runtime title-keyword guess.
- **The two-condition intersection (14) is smaller than either single condition (19, 7)** — consistent with `/suggest` reconciling across all requested conditions and only returning items that clear the bar for the combination, not the union. This matters directly for the Plan screen: the more conditions a real user profile carries, the smaller this pool gets. With only 2 scoreable conditions on the dev key it's not possible to probe how a 5- or 10-condition profile (the eventual real target per Track B item 1: "expand the API key to 10 conditions, weighted toward common comorbidity pairs") would shrink this further, but the trend (19 → 14, a ~26% drop from one condition to two) suggests real multi-condition profiles will see meaningfully smaller eligible libraries than a single-condition demo does today.

## Raw script output

```
GET /suggest {"healthConditionID":"203","fineFoodGroup":"l"} -> total 19, band14 19 (100.0%), band13 19 (100.0%), excluded 0
  mealTypeCounts: {"breakfast":2,"lunch":1,"dinner":14,"snack":2,"beverage":0}
  histogram: {"2":6,"3":13}

GET /suggest {"healthConditionID":"244","fineFoodGroup":"l"} -> total 7, band14 7 (100.0%), band13 7 (100.0%), excluded 0
  mealTypeCounts: {"breakfast":2,"lunch":0,"dinner":4,"snack":1,"beverage":0}
  histogram: {"3":7}

GET /suggest {"healthConditionID":"203,244","fineFoodGroup":"l"} -> total 14, band14 14 (100.0%), band13 14 (100.0%), excluded 0
  mealTypeCounts: {"breakfast":2,"lunch":0,"dinner":10,"snack":2,"beverage":0}
  histogram: {"2":4,"3":10}
```
