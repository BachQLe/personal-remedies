# Boss Review — August 2026

*Written August 19, 2026, against the code as it stands on `main` after this wave's changes. Answers his 18 comments in the order he gave them, grouped under the four headings he used. Each entry: the comment verbatim, what we found when we checked, and what we did — Changed, Answered, or Left alone.*

Two of these comments (#7, #8) were the reason this document exists: "where does that explanation show up?" Nowhere, before this wave. It now lives in `docs/app-pages.md`, under "What every button does."

---

## Home page

**1. "Nutrient look up instead of Natural Sources on 'home' page??"**
**Found:** Home had two half-width buttons, "Food Lookup" and "Natural Sources Lookup," and "Natural Sources" wasn't a name that told you what was inside (key nutrients + herbal medicines).
**Did:** The two buttons are merged into one full-width Home button, **"Food & Nutrient Lookup."** "Natural Sources" as a Home-level label is gone. (It survives one level down, as a section split — see #16.)
**Status: Changed.**

**2. "Two different buttons for best Recipes on the Home page??? Must be one. Perhaps the lower bubble, since we are NOT going to display worst recipes."**
**Found:** The old "Discover your best recipes" news banner and the carousel both effectively pointed at recipes, on top of the four home buttons.
**Did:** The banner is deleted outright — `HomeScreen.jsx` now has exactly one recipe-adjacent surface on Home: the "Top recommendations for you" carousel, with "See all" going to `/app/recipes`. That resolves the *Home-page* duplication.
**Caveat — do not read this as fully resolved:** one level below Home, two recipe surfaces still exist side by side and were not reconciled — the carousel's "See all" (`/app/recipes`, the full browsable list) and Best & Worst Choices' "Best Recipes" tab (top-ranked rails from the same pool, browse-only). Flagged as an open follow-up in `docs/app-pages.md`.
**Status: Changed** (Home-level duplication), **open item remains** (see Consequences below).

**3. "Everything on the home page and within the app is dietary guidance, so a button with that name is questionable!! Dietary Guidance → Best and Worst Choices?"**
**Found:** Confirmed — the button, the `PageHeader` on `SuggestionsScreen.jsx` and `GroupDetailScreen.jsx`, and the bottom tab all said some form of "Guidance."
**Did:** Renamed throughout. Home tile now reads "Best & Worst Choices" with subtitle "Top Dos & Don'ts, food groups & best recipes." Both `PageHeader label="Best & Worst Choices"` calls updated. The bottom tab bar couldn't fit the full name (five tabs at 10px font) so it reads **"Choices"** instead — see #9's note on why that's a deliberate shortening, not a different rename.
**Status: Changed.**

**4. "Where do they get recommendations for best vegs, fruits, etc.?? Not clear from the options on home page."**
**Found:** This lives inside Best & Worst Choices' **Food Groups** tab — a grid of nine categories (fish & seafood, fruits, vegetables, etc.), each opening a detail page (`/app/suggestions/group/:groupId`) with an Eat/Avoid switcher and ranked items.
**Did:** No code change for this one — it's a navigation-depth question, answered here and in `docs/app-pages.md`. The Home tile's new subtitle ("food groups & best recipes") at least names it one tap earlier than before.
**Status: Answered.**

**5. "What is the purpose of X in the upper right corner of 'Discover your best recipes'???"**
**Found:** It was the dismiss control for the in-app news/alerts banner (`src/api/messages.js`'s `dismissMessage`), which persisted the dismissal to `localStorage` so a dismissed message stayed dismissed.
**Did:** The whole banner — X included — is gone from Home. `messages.js` and `public/messages.json` are still in the tree (see Consequences) but nothing renders them anymore.
**Status: Changed.**

**6. "What exactly do we display on the lower half??? Should we do it?? It will slow down loading of Home page."**
**Found / decision:** The carousel stays — that was an explicit product call, not something this wave revisited. What it is: "Top recommendations for you," an auto-advancing, 3D-tilted lane of cards drawn from the same ranked list as Top Dos & Don'ts' "Do" side (so it includes lifestyle items like exercise and sleep, not just foods).
On loading: it fires one live Nutridigm call on mount (`getHomeRecommendations` → `getTopDosAndDonts`), which fetches **50 rows to render 8 cards** — a known, unaddressed inefficiency, not something we fixed this wave. That call is already prefetched at app boot (`src/api/prefetch.js`) and cached for 8 hours (`TOPDOORDONTS_TTL_MS` in `adapter.js`), with a skeleton shown while it's in flight, so it doesn't block the three buttons above it from being tappable. **No timing measurement was taken** — we're not claiming a number, just describing the caching/prefetch mechanics.
**Status: Answered; carousel left alone by design. Over-fetch left alone, unaddressed.**

**7. "What exactly happen if I tap on each of the buttons on the Home page?? Where in our checklist/document does that explanation show up??"**
**Found:** Nowhere, before this wave — confirmed by checking `docs/app-pages.md` as it stood.
**Did:** Added a "What every button does" section to `docs/app-pages.md` with a full Home table — every button, its route, and exactly what happens on tap (including the carousel's per-card behavior and "See all").
**Status: Answered.**

**8. "What exactly happen if I tap on each of the buttons at the bottom of the page?? Where in our checklist/document does that explanation show up??"**
**Found:** Same — not documented anywhere.
**Did:** Same section in `docs/app-pages.md` includes a Bottom Tab Bar table: label, route, and what each destination screen is for.
**Status: Answered.**

**9. "Why is Dietary Guidance bubble bigger than other bubbles??"**
**Found:** Deliberate — `HomeScreen.jsx` gives that button `py-6` against `py-3` on the other two, plus a larger icon well and title size. It's marked in the file's own header comment as "the tallest of the three entry tiles (this is the primary destination)."
**Did:** Kept the sizing as-is (still the tallest, now labeled Best & Worst Choices instead of Dietary Guidance); its subtitle was updated to name what's inside — Top Dos & Don'ts, food groups, and best recipes — so the size difference now reads as "this is the hub for three things," not an unexplained visual accident.
**Status: Answered; sizing left alone by design.**

---

## Meal Plan Page

**10. "The explanation below No meal Plan should be under Build your meal plan."**
**Found:** Confirmed the old order had the explanatory line above the button.
**Did:** In `MealQueueScreen.jsx`'s first-run empty state, the order is now: "No meal plan yet" title → **"Build my meal plan" button** → the explanation paragraph ("Pick recipes you like and we'll build your week around them — nothing gets added automatically.") below it.
**Status: Changed.**

**11. "We must choose either the 'My meal plan' lingo or 'Your meal plan' lingo, but not randomly use both."**
**Found:** Mixed usage across the screen — header, button, and share text didn't agree.
**Did:** Unified on **"My."** The page header now reads "My Meal Plan," the empty-state button reads "Build my meal plan," and the share text reads "My Remedi meal plan." No "Your meal plan" phrasing remains on this screen.
**Status: Changed.**

**12. "Below Build your plan. They don't build .. we do"**
**Found:** Agreed with the premise — a first-time user isn't the one assembling the week; the app is.
**Did:** Two things address this together: the button itself is now first-person ("Build **my** meal plan," #11), and the explanatory copy underneath now attributes the work correctly — "Pick recipes you like and **we'll build** your week around them — nothing gets added automatically."
**Status: Changed.**

**13. "What does browse recipe do that build meal plan does not?? Why need both??"**
**Found:** They do genuinely different things, but the fair version of this question is really about the *old* behavior — before this wave, "Build your meal plan" and the "New meal plan" FAB called the exact same handler (`setPickerOpen(true)`), so having two differently-labeled buttons that did the same thing was a real point of confusion (see #14).
**Did (as it stands now):** **"Browse recipes"** navigates away to `/app/recipes` — it's for acquiring raw material, browsing the full recipe catalog with no commitment. **"Build my meal plan"** opens `MealPlannerPicker`, a full-screen picker overlay *in place*, and produces an actual week of scheduled meals (`generatePlanFromPicks`). One browses; the other commits. That distinction was always real in the data model — it just wasn't visible in the UI before the FAB was disambiguated (#14).
**Status: Answered.**

**14. "Which button should first time user tap on, Build meal plan or New meal plan??"**
**Found:** Before this wave, a first-time user with zero plan saw **both** "Build your meal plan" (empty-state button) and the floating "New meal plan" FAB simultaneously, and — per #13 — they called the identical handler. There was no way to tell them apart from behavior alone.
**Did:** The FAB is now hidden during the first-run empty state (`!firstRunEmpty &&` guard in `MealQueueScreen.jsx`, with a comment explaining exactly this: "a first-time user would otherwise see two buttons doing the identical `setPickerOpen(true)`"). A first-time user now sees exactly one button — "Build my meal plan." The FAB reappears once a plan exists, where "New meal plan" correctly means "replace the current one."
**Status: Changed.**

---

## Saved Recipe page

**15. "Food Look up does not display recipes. It only handles food Items/ingredients??"**
**Found:** The premise was partly wrong — Food Lookup already returned recipes matched by title (`searchFoodsAndRecipes`, and now `searchEverything`'s "Recipes" section) alongside plain foods; it was never food-items-only.
What was genuinely wrong: the **Saved Recipes empty state** on the Meal Plan page said something to the effect of "save foods and recipes from Food Lookup" — but foods can never be saved at all. `src/utils/saveGate.js`'s `getSaveBlockReason` returns `'ingredient'` for anything that isn't `kind: 'recipe'`, full stop; that's been a hard rule since the ingredient-removal work, not new this wave.
**Did:** Fixed the empty-state copy to match reality: **"No saved recipes yet — save recipes as you browse."** with a **"Browse recipes"** button → `/app/recipes`. It no longer implies foods are saveable.
**Status: Answered** (his premise about Food Lookup was mistaken) **+ Changed** (the copy that actually was wrong).

---

## Food look up page

**16. "Why is NS showing up here?? If that is what we want, then should we combine the two buttons on Home into one and call it 'Food and Nutrient Lookup'??"**
**Found:** Agreed with his own proposed fix.
**Did:** Exactly that. The Home buttons merged into one, named **"Food & Nutrient Lookup"** (#1), and the search screen itself now sections one query's results into **Foods / Recipes / Nutrients / Herbal Supplements** instead of switching between two separate modes.
**Status: Changed.**

**17. "Pull down menu on NS should only display Nutrients NOT all the Items."**
**Found — the actual bug was NOT a missing filter.** Natural Sources (`searchNaturalSources` in `adapter.js`) was already correctly scoped to coarse group `'k'` before this wave; that part worked. Two other things made it *look* like everything was showing up:
  (a) every search result row was hardcoded to the subtitle "Ingredient" — the code read a `category` field that `normalizeFood` never sets, so a herbal supplement and a vitamin looked identically labeled and indistinguishable from a plain food.
  (b) group `'k'` genuinely mixes two different things: 169 of its 247 rows are herbal supplements (Goji berry, Aloe Vera, …) that read as ordinary foods at a glance, alongside the 78 actual nutrient entries.
**Did:** Fixed both underlying causes rather than adding a filter that was never missing: real food-group labels now render (via `getGroupLabel`, resolved from the bundled `/foodgroups` dictionary), and the "Natural Sources" results are split client-side on `fineGroup` into two separate sections — **Nutrients** (`k1`) and **Herbal Supplements** (`k2`) — so they're no longer lumped together looking like undifferentiated "Items."
**Status: Changed** (root causes fixed; his diagnosis of "wrong filter" wasn't quite it).

**18. "Pull down menu for Food Lookup should only show Food Items not nutrients."**
**Found — this one WAS a real bug.** `searchFoods` (the function backing "Food Lookup") had **no group filter at all** — it was a strict superset of Natural Sources' results. Searching "vitamin" returned 11 results, and all 11 were nutrients, zero were foods.
**Did:** `searchFoods` now explicitly excludes coarse group `'k'` (`if (effectiveCoarseGroup(item) === 'k') continue;` in `adapter.js`), so nutrients and herbal supplements no longer leak into the Foods section.
**Status: Changed.**

---

## Consequences & open items

- **The news/alerts channel lost its only mount point.** Deleting the "Discover your best recipes" banner (#5) removed the sole place `src/api/messages.js`'s `getActiveMessages`/`dismissMessage` and `public/messages.json` were ever rendered. Both files are still in the tree, fully functional, wired to nothing. `REMEDI_MASTER_PLAN.md` §4.7 ("News / alerts channel. In-app message surface now; push once native.") is reopened — there is currently no in-app surface for it at all.
- **`Remedi_Build_Checklist_v3.docx`** — this wave did not touch the binary; the deltas described in this document (renames, the merged Search screen, the FAB fix, the Saved Recipes copy fix, etc.) still need to be folded into it by whoever owns that file.
- **The carousel's 50-rows-for-8 over-fetch** (#6) is unaddressed, by choice — it's flagged, not fixed.
- **The two-recipe-surfaces follow-up from #2** — Home is down to one recipe entry point, but `/app/recipes` (browse) and Best & Worst Choices' Best Recipes tab (top-ranked rails) still overlap one level down and haven't been reconciled.
