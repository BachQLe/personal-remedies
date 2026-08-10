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
