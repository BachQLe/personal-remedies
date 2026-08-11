# P4 — Item image fields

**Live calls used: 0** (zero, as scoped — snapshot grep only).

---

## Method

Full field-set grep (union of keys) across every row of the committed `src/data/cache/items.json` snapshot (1,485 rows, the complete `/fooditems` dictionary as of the last `scripts/snapshot-nutridigm.mjs` run).

```
total rows: 1485
union of ALL keys: ['coarseFoodGroup', 'description', 'displayAs', 'fineFoodGroup',
                     'foodItemID', 'longDescription', 'unitOfMeasure']
key count: 7
per-key presence count (out of 1485): every one of the 7 keys appears on all 1485 rows
```

This union is exhaustive — there are no row-specific extra fields hiding outside the 7 above, and no row is missing any of the 7. It also matches the swagger `FoodItem` schema in `docs/nutridigm-api.md` exactly (`foodItemID`, `description`, `displayAs`, `coarseFoodGroup`, `fineFoodGroup`, `longDescription`, `unitOfMeasure`) — the vendor's own spec documents the same 7 fields and nothing else.

## Does ANY image-related field exist?

**No.** Grepping the key set for anything matching `image|photo|pic|url|thumb` (case-insensitive) returns zero matches. There is no `imageUrl`, `photoUrl`, `thumbnailUrl`, `pictureId`, or similarly-named field on any item, in any coarse/fine group, anywhere in the dictionary. This matches Track B item 3 in `REMEDI_MASTER_PLAN.md` ("Item table image fields (P4)") being listed as blocked on Mory — the vendor simply hasn't shipped this data yet.

## The existing fallback seam

Two layers already exist in the codebase to compensate for the API's lack of images, confirmed by reading the source directly (not inferred):

### 1. Curation overlay column (`imageFile`) — unused today

`src/api/localTables.js`'s `getOverlayImageFile` (lines 94-102) reads an `imageFile` string per `foodItemID` from a two-layer overlay:
- `src/data/cache/itemOverlay.generated.json` (machine-inferred `isSnack`/`isBeverage` flags — confirmed via direct read, **no row in this file sets `imageFile`**, only `isSnack`/`isBeverage`)
- `src/data/cache/itemOverlay.json` (the hand-curated layer meant to override the generated one) — confirmed via direct read: **`{}`, completely empty.** Zero rows.

So the column exists in the data model and the resolution code path (`getOverlayImageFile` → `getIngredientImage(name, group, imageFile)` in `src/api/ingredientImages.js:211-220`, where a truthy `imageFile` short-circuits straight to `resolveOverlayImage` and wins over everything else) but **zero of the 1,485 items currently have an overlay `imageFile` value.** This matches the master plan's Phase 7.2 note: *"itemOverlay.json audit — 1,223 of 1,485 items carry no overlay row; the manual layer is currently empty. It overrides the generated layer, so it's the file Sunny edits."*

### 2. Runtime image resolver (`ingredientImages.js`) — the actual image source today

`src/api/ingredientImages.js` is what actually renders an image for every food/recipe/plan-candidate card today. It is a **curated keyword-to-Unsplash-photo-ID lookup table** (~160 keyword entries, e.g. `'salmon'` → a specific Unsplash photo ID), with a coarse-group-level fallback (`GROUP_FALLBACKS`, one photo ID per group b/c/d/e/f/g/h/i/k) and a single hardcoded default fallback if nothing matches. `getIngredientImage(name, group, imageFile)` is the single entry point every caller uses (`adapter.js`'s `getRecipesRaw`, `normalizePlanGroup`, `getFoodFacts` all call it). Priority order, confirmed from the source:
1. Overlay `imageFile` (if present — currently never, per above)
2. First keyword substring match in `KEYWORD_MAP`
3. Coarse-group fallback photo
4. Global default fallback photo (a salad bowl)

This means every food/recipe image in the app today is either a keyword-matched stock photo or a generic group fallback — never an image sourced from Nutridigm, and never yet an item-specific curated override (since the overlay column that would carry one is empty).

## Conclusion

**API image support: no.** The `/fooditems` dictionary carries exactly 7 fields, none image-related, confirmed by exhaustive union-of-keys grep across all 1,485 rows and cross-checked against the vendor's own swagger spec. This is not a partial gap — it's a complete absence.

**The path forward is the overlay `imageFile` column + Mory's Track B item 3**, exactly as scoped: the resolution machinery (`getOverlayImageFile` → `getIngredientImage`) already exists and is already wired into every image-rendering call site; the only missing piece is populating `itemOverlay.json` (Sunny's file, per Phase 7.2) with real per-item `imageFile` values, or Mory delivering real image fields from the vendor. Nothing needs to be built to unblock this — it needs to be filled in.

---

## Recommendation — the `imageFile` overlay is the sanctioned path (T7B, Aug 2026)

Restating this probe's own finding for anyone arriving here to actually ship
images: the API will never give Remedi a photo field (confirmed above,
exhaustively, against all 1,485 rows and the vendor's swagger spec). So the
sanctioned path is not "wait for Mory" — it's populate the overlay column
that already exists and is already wired end-to-end. Nothing new needs
building. This section documents the concrete mechanics for whoever (Sunny,
or an engineer helping her) does that work.

### What Sunny would supply, and the exact format

In `src/data/cache/itemOverlay.json` (her file — see §"Curation overlay
column" above and `docs/overlay-audit.md` for the full editing guide), add
an `imageFile` string to any item's entry, alongside or instead of
`isSnack`/`isBeverage`:

```json
{
  "267":  { "isBeverage": true, "imageFile": "soy-milk.jpg" },
  "1319": { "isBeverage": true, "imageFile": "almond-milk.jpg" }
}
```

Confirmed by reading `resolveOverlayImage` (`src/api/ingredientImages.js`
lines 230-233), the value can be **either**:
- a **bare filename** (`"soy-milk.jpg"`) — resolved to `/images/soy-milk.jpg`
  and served from Vite's static-asset convention, i.e. the file must be
  placed at **`public/images/soy-milk.jpg`** in the repo. As of this
  writing `public/images/` does not exist yet — it needs to be created (by
  whoever adds the first real image) alongside the app's other static
  assets in `public/` (currently `favicon.svg`, `icons/`, `icons.svg`,
  `messages.json`).
- or an **already-absolute URL** (`"https://cdn.example.com/soy-milk.jpg"`,
  matched by `/^https?:\/\//`) — useful if images are hosted on a CDN
  instead of committed to the repo.

### How it resolves at runtime

Confirmed by reading the actual call chain, not inferred:

1. `getOverlayImageFile(foodItemID)` (`src/api/localTables.js` lines 94-102)
   reads the `imageFile` field for that id off the same two-layer overlay
   `isSnack`/`isBeverage` use (generated layer, then manual — manual wins).
2. Every image-rendering call site passes that value as the third argument
   to `getIngredientImage(name, group, imageFile)` in
   `src/api/ingredientImages.js` (lines 245-254). A truthy `imageFile`
   **short-circuits straight to `resolveOverlayImage`** and wins over
   everything else — the keyword table (`KEYWORD_MAP`), the coarse-group
   fallback (`GROUP_FALLBACKS`), and the global default salad-bowl fallback
   are all skipped once a real curated image exists for that item.
3. The sentinel-aware sibling `getIngredientImageOrIcon(name, group,
   fineGroup, imageFile)` (same file, lines 286-292) is the one exception:
   a non-food item (see next section) still prefers its category icon over
   a stock photo, but a real curated `imageFile` always wins even there —
   supplying a photo for a non-food item, if ever wanted, is honored, not
   silently dropped.

So populating `imageFile` for an item requires zero code changes — the next
time that item renders anywhere in the app (Plan screen, Search, Food
Detail, Recipes), it picks up the curated photo automatically.

### Non-food items need no images at all — this already shipped

Before prioritizing which items need photos: **coarse group `k` (Key
Nutrients & Herbal Medicines) and fine groups `x`/`j1` (lifestyle/behavior
entries — Exercise, Sleep, Smoking, etc.) already render a category icon
instead of a stock photo**, via `getNonFoodIcon`/`getIngredientImageOrIcon`
(`src/api/ingredientImages.js` lines 200-219, shipped per REMEDI_MASTER_PLAN.md
1.10 decision j). This was a deliberate call: a stock turmeric-latte photo
standing in for "Vitamin D," or a jogger photo standing in for "Exercise,"
would read as a real product photo the app doesn't actually have — exactly
the kind of fabricated specificity Remedi avoids everywhere else. Per
`docs/overlay-audit.md`'s own coverage numbers, coarse group `k` (247 items)
and fine groups `x`/`j1` (205 + 66 = 271 items) together account for **518
of the 1,485 items in the dictionary** — over a third — and none of them
need an `imageFile` entry. Sunny's image effort is best spent on real food
items instead, starting with whichever groups actually render in the app
today (the Plan screen's 10 fetched fine groups — see
`docs/overlay-audit.md` §6 — and Search/Recipes, which cover the rest of
the food-bearing groups).
