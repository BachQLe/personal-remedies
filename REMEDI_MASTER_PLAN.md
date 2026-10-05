# Remedi — Master Build Plan
**10 Aug 2026 · Covers every item from Mory's list · Grounded in the current codebase**

**Strategy:** build everything in the PWA → convert to native at the end → ship iOS 1.0, Android 2.0.

**Sources for this plan:** Mory's punch list, the existing codebase, and Bach's decisions. **`Product_Spec_v3` is not a source and is not authoritative** — it is outdated and contradicts current direction in several places. Do not read it, cite it, or build to it.

**Tracks:**
- **[F]** Fable / Claude Code — code
- **[C]** Claude chat — content, copy, legal, research
- **[B]** Blocked on a person

**Read before starting:** much of the meal planner already exists and is well-built. `src/api/planBuilder.js` handles variety spreading, pinning, shuffle, regeneration, and honest-empty degradation. `src/api/adapter.js` handles condition fallback and caching. Do not rebuild these — extend them.

---

## Phase 0 — Probes [F]
*Run first. Each one gates work below. Report findings; don't build on assumptions.*

- **P1** — "Good for me": inspect every Nutridigm endpoint for fields that could back this feature. Report what exists. **Do not invent the feature.**
- **P2** — Natural Sources: is it API-feasible? If not, disabled "Coming soon" button stands.
- **P3** — Condition-filter survival: against the current recipe set with conditions 203 + 244, count recipes surviving each condition alone and both together. Report percentages. Determines required library size.
- **P4** — Item images: does the Item table expose an image field? Mory listed this as an open API item.
- **P5** — Daily API request limit: instrument request counts per session per endpoint. Not chasing a number from Mory, just making it measurable.

**Un-cut:** "Suggest" was previously listed here as cut ("undefined, from an outdated spec. Not building it."). That objection is resolved — Nutridigm's fine food groups are the vendor's own stable taxonomy (`docs/nutridigm-api.md`'s `FoodGroup` feature: 19 fine-group codes), and `/suggest` keys directly on one of them plus a condition set. Suggest is being built now, in parallel with this wave, as a 4th tab inside Best & Worst Choices (`/app/suggestions/fine/:fineGroupId`) — condition-ranked suggestions per fine food group, over the 17 groups eligible for it (19 total minus `j1` and `l`, the same two codes `EXCLUDED_FINE_GROUPS` in `src/api/config.js` already excludes elsewhere as lifestyle/recipe, not food). See §6.7 for where this surface falls on the free/premium boundary.

---

## Phase 1 — Meal Planner [F]
*The centerpiece. Extends existing code.*

### 1.1 Restore the Beverages slot
Removed July 2026; restoring is mostly un-deleting. The scaffolding survived:
- `MEAL_SLOT_MAP` still routes `h2 → 'Beverages'`
- `RECIPE_SLOT_ESTIMATES` still has a `beverages` row
- 49 items already carry `isBeverage` in `itemOverlay.generated.json`

Work: add the `PLAN_SLOTS` entry (`key: 'beverages'`, `fineGroups: ['h2']`, `recipeMealType: 'beverage'`, `recipeLead: false`, `size: 1`), add the `MEAL_TYPE_META` entry (letter "V", icon, tone class), restore `h2` routing in `inferSlotKey` (it currently falls through to the group switch by design — reverse that), update the comment blocks in `config.js` and `mealTypeMeta.jsx` that document the removal.

Stale `beverages` keys already exist in old localStorage plans and were harmlessly ignored — confirm they now read correctly rather than colliding.

### 1.2 Rename Snacks → "Snacks & Desserts"
Label only. `h1` is "snacks & sweets," so desserts are already in the pool. Update `PLAN_SLOTS.label` and `MEAL_TYPE_META.snacks.label`.

### 1.3 Picks-only is the default
The user always chooses what goes in the plan. `generatePlanFromPicks` + `picksBySlot` already implement this and are structurally incapable of introducing an un-picked item. Audit every entry point to confirm the candidate-pool auto-fill path (`fillSlots`) is never the default. Keep `shuffleSlot` as the deliberate escape hatch it is.

### 1.4 New: build a plan from saved recipes
`saveGate.js` already restricts the library to recipes only and blocks skull-rated ones at save time, so the library is a pre-validated pick source. Wire: read `library.js` → `generatePlanFromPicks(profile, savedRecipes)`. Add an entry point on the Plan screen. Empty-library state points at Recipes.

### 1.5 Rolling window + regenerate on demand
Rolling 7-day window from today is correct and already built (`nextSevenDays`, `ensurePlanForWeek`). `regenerateWeek` exists — confirm it's reachable from the UI and that a picks-only plan regenerates from picks, not pools.

### 1.6 Recipe ingredients
`Recipe.ingredients` exists in the type but is passed as `[]` nearly everywhere. Populate it, render it on RecipeDetail, and feed it to the calorie math.

### 1.7 External link-out
**Implemented** as an in-app preview sheet, not a raw link-out. `sourceUrl`/`attribution` flow through `toPlanItem` (`src/api/planBuilder.js`) and `RecipeLinkSheet.jsx` (`src/components/`) renders photo/title/calories(if real)/attribution with an explicit "Open at [host]" hand-off through `openUrl()` (`src/api/browser.js`), opened from `FoodDetailCard.jsx`'s CTA. Follow-up from the Sept 2026 meeting (checklist 1.7 below): an iframe/in-app-browser viewer was considered and ruled out — `medlineplus.gov` sends `x-frame-options: SAMEORIGIN` + `frame-ancestors 'self'` (verified live, not assumed), so framing it is impossible. The preview sheet is the honest substitute.

### 1.8 Calorie model — leave the shape alone
`Profile.calorieTarget` (2000 default, editable in Profile) summed once at plan creation via `estimatePlanDayCalories`, with `CalorieGapSheet` offering a top-up. Per the header comment in `src/api/calorieNeeds.js` (July 2026 product decision), this renders once as plan-level context and **never** as a running tally. Only change: confirm beverages are counted once slot 1.1 is back.

### 1.9 Print / share the plan
Mory's "hard copy of meal plan." Printable week summary + share. Keep it plain — this user prints it and takes it to the store.

### 1.10 Non-food items
Herbal meds, nutrients, alt therapies, misc. remarks are in the item table. Exclude from the planner, never render as food, category icon rather than a photo.

### 1.11 Category-scoped selection rule (Sept 2026 meeting item 1.13)
Breakfast/snacks/beverages slots draw from *both* top-scoring recipes and flagged individual items; lunch/dinner stay recipes-only so raw meat/fish cuts never surface as a meal (see Frozen, below). Config-driven via `PLAN_SLOTS`' `itemFlagKey` (`src/api/config.js`: breakfast→`isBreakfast`, snacks→`isSnack`, beverages→`isBeverage`, lunch/dinner→`null`), merged in `adapter.js`'s `mergeCandidatePools`. `isBreakfast` is new — generated conservatively by `scripts/flag-snack-beverage.mjs`'s `classifyBreakfast` (tight allowlist: cereal/oatmeal/oat bran/granola/bagel/waffle/pancake/grits/muffin in fine group `f`, yogurt/cottage cheese in `g1`; fruit `d` is deliberately never blanket-tagged). Sunny's hand-curated `itemOverlay.json` overrides any generated flag, as always. **DONE.**

---

## Phase 2 — Nutrition data [F]
`src/data/nutritionEstimates.js` is explicitly built as a replaceable seam — its own header says to replace it the moment real data exists. That's the integration point.

- **2.1** USDA FoodData Central client. Free data.gov key, 1,000 req/hr, `api.nal.usda.gov/fdc/v1/`. Prefer Foundation Foods and SR Legacy over Branded.
- **2.2** Item → FDC ID mapping table, cached locally (CC0, no terms conflict).
- **2.3** Recipes sourced from MedlinePlus ship with FDA Nutrition Facts panels, so their per-serving calories come from the source, not USDA. USDA covers plain foods and any recipe without a panel.
- **2.4** Keep every number rendered as "~N (estimated)" until it's real vendor data. Unmatched items show without calorie data — never guess.
- **2.5** Recipe calorie table (Sept 2026 meeting item 2.5) — Mory's 5-column Recipes table (`FI`, `FI_TEXT`, `Meal`, `Calorie Count`, `URL`) is a strict subset of the existing `RecipeOverlayRow` schema, not a new table. `src/api/types.js`'s validator is relaxed: only `name`, `sourceUrl`, `mealType`, `fineFoodGroup: 'l'`, and `nutritionPerServing.calories` are required; macros/ingredients/servings/time are optional and, when absent, omitted from the joined `Recipe` rather than null- or `[]`-filled. `scripts/build-recipe-overlay.mjs` builds `src/data/recipeOverlay.json` from CSV. See Frozen, below, for the permanent constraint this schema encodes. **DONE.**

---

## Phase 3 — API, secrets, caching [F]

- **3.1** **Move the Nutridigm key off the client** into a Supabase Edge Function proxy. A JS bundle unpacks; so does a native binary. Do this while the surface is small.
- **3.2** Key rotation = change one Supabase secret. No release, no review. Only possible once 3.1 lands.
- **3.3** Cache allowlist: items, conditions, groups **only**. Remedy and nutrient-content data are too large and not permitted under API terms. Enforce with an explicit allowlist plus a test that fails on any write outside it.
- **3.4** Cache invalidation: version/ETag + TTL + pull-to-refresh. Profile change purges derived data — already implemented in `ensurePlanForWeek` (conditions change discards every day including picks). Verify it holds.
- **3.5** Re-run `scripts/snapshot-nutridigm.mjs` when Mory expands the key; wire the 10 conditions through.
- **3.6** Encode the gotchas as tests: HTTP **220** = success-with-empty (not an error) · `Neutral`/`OK` = neutral *or* no data, never a safety guarantee · `suggest` takes `fineFoodGroup`, `detailed` takes `coarseFoodGroup`.

---

## Phase 4 — States and user experience [F]

- **4.1** State matrix on every data-dependent screen, as one shared pattern: loading · empty (no results) · empty (no profile) · error (network) · error (API) · offline (cached) · offline (no cache).
- **4.2** Partial-data state: when some conditions resolve and others don't, name which conditions the guidance covers. Never present partial as complete.
- **4.3** Auth: email + 6-digit code, no passwords. Supabase `signInWithOtp` — **override the email template to send the token, not a magic link**, or codes never arrive. Resend cooldown, expiry, clipboard paste.
- **4.4** Signup captures email only. Conditions, meds, allergies come in ProfileBuilder after first auth.
- **4.5** First-time vs returning user paths (Mory's item). First-time → ProfileBuilder → first plan. Returning → straight to today.
- **4.6** Client vs server storage: profile and library sync via `profileSync.js` already; document what lives where and confirm the purge rule covers both.
- **4.7** News / alerts channel. In-app message surface now; push once native.

---

## Phase 5 — Accessibility [F]
*From Mory's list: "Accessibility pass." Scope below is negotiable with him — the first four items are near-free while writing components; the rest can move post-1.0.*

- Dynamic Type / text scaling to max with no clipping — test at max, not default
- 44×44px minimum touch targets
- WCAG AA contrast verified programmatically across all palette pairings
- Screen reader labels, hints, roles on every interactive element; correct reading order
- Reduce Motion honored globally — wrap the animation layer, not each call site
- **No color-only meaning.** Helpful vs harmful always carries an icon or word

---

## Phase 6 — Monetization scaffolding [F]

- **6.1** `hasEntitlement(featureKey)` gate (`src/api/entitlements.js`) — **DONE, config-driven, nothing wired to gate yet.** `ENTITLEMENT_CONFIG` is the single source of truth: `defaultUnlocked: true` plus a `features` map of `{ key, label, description, [tier] }` descriptors. `hasEntitlement(featureKey)` returns `false` only for a feature whose own entry carries a `tier`; everything else (registered-untiered or unknown) falls through to `defaultUnlocked`. No feature carries a `tier` today, so every call resolves `true` — everything stays unlocked. `listFeatures()` returns every registered descriptor plus its resolved `unlocked` flag, and is what `PaywallScreen.jsx` renders its "what's included" list from, so the roster is never hardcoded twice. The free/paid split becomes a one-line config change later (flip `defaultUnlocked` to `false`, or add `{ tier: 'plus' }` to specific features) with no call-site changes, because every screen already calls `hasEntitlement`/`listFeatures` rather than reading config directly. See 6.7–6.9 below for the boundary this registers and what's still unresolved.
- **6.2** Paywall screen — Mory's "page that sells in-app purchase." Not built. Blocked on 6.9's open questions (where entitlement state lives, what a lapsed user sees) being answered first.
- **6.3** RevenueCat rather than raw StoreKit: receipt validation, restore, trials, cancellation come free, and Android 2.0 becomes config rather than a second implementation. Wire at native conversion.
- **6.4** Restore Purchases is **required by Apple** — its absence is a routine rejection. Build it regardless of trial strategy.
- **6.5** Trials run through TestFlight beta (no billing setup needed); promo codes post-launch. Per Mory. **Note the tension with 6.8**: `Pricing.jsx`'s live copy promises a "7-day free trial — no card to start" as the commercial trial mechanism, which is a different thing from a TestFlight beta trial. Not reconciled — flagged as open in 6.9.
- **6.6** Android billing → Release 2.0.

### 6.7 — Free/premium boundary (Wave 5, Oct 2026)
Source of truth: `src/components/marketing/Pricing.jsx`'s live copy (Free: "Natural sources for 90+ nutrients," "Food facts and nutrient content," "Plain-language guidance," "No credit card required." Premium: "Everything in Free," "Personal health profile across conditions," "Top do's and don'ts for your profile," "Choose this not that and suggestions for you," "7-day free trial -- no card to start.") The rule that falls out of that copy: **free is informational, premium is condition-scored against the user's own health profile.**

| Surface | Side | `ENTITLEMENT_CONFIG` key | Why |
|---|---|---|---|
| Food lookup / search (`SearchScreen.jsx`) | Free | — (unregistered) | Not scored against a profile — matches "Food facts and nutrient content." |
| Nutrient/food facts (`FoodDetailCard.jsx` facts view) | Free | — (unregistered) | Same — raw facts, no condition reconciliation. |
| Plain-language guidance | Free | — (unregistered) | Matches "Plain-language guidance" verbatim. |
| Top Do's & Don'ts (`src/screens/suggestions/TopDosTab.jsx`) | Premium | `top_dos_donts` | Condition-scored ranking — matches "Top do's and don'ts for your profile." |
| Food Groups Eat/Avoid detail (`CategoryDetailPanel.jsx`, `GroupDetailScreen.jsx`) | Premium | `food_group_detail` | Condition-scored eat/avoid verdict per item — matches "Choose this not that." |
| Suggest surface (new 4th Choices tab, `/app/suggestions/fine/:fineGroupId`, built in parallel this wave) | Premium | `suggest` | Condition-ranked list per fine food group off `/suggest` — matches "suggestions for you." |
| Plan screen (meal planner) | Premium | `plan` | Slots are populated from condition-filtered candidate pools (`adapter.js` pre-filters to `numericId` 1-4) — inherently profile-scored. |
| Saved plans (`SavedPlansSheet.jsx`) | Premium | `saved_plans` | Persisted output of a premium surface; gating the builder but not its saves would be incoherent. |

**Wired (Oct 2026):** each key is enforced by `<RequireEntitlement feature="...">` (`src/components/shared/RequireEntitlement.jsx`) — route wrappers in `App.jsx` for `food_group_detail`, `suggest`, `plan`; inline in `SuggestionsScreen` (Top Do's tab) and as a sheet in `MealQueueScreen` (saved plans). Locking = add `locked: true` to the feature's config entry; the gate shows an upsell linking to `/app/upgrade?feature=<key>`. Nothing is locked by default.

`ENTITLEMENT_CONFIG.features` in `src/api/entitlements.js` registers the last five rows under the keys above. Search, food facts, and plain-language guidance are free by omission — they're deliberately absent from that config, not pending addition. None of the five rows carries a `tier` yet (6.1), so this table is a spec of where gates will eventually go, not a description of current behavior — today every row resolves unlocked via `defaultUnlocked: true`.

### 6.8 — Trial model implications
Pricing's premium tier reads "7-day free trial -- no card to start." Read literally, that means: no payment method is collected to begin the trial, so there is no card on file to silently charge at day 8. That implies, whenever the trial is actually implemented, the app will need to track at least:
- **Trial start timestamp** — when the 7-day clock began, per user.
- **Trial expiry** — start + 7 days; the clock `hasEntitlement` will eventually read from (per-feature, once a feature is given a `tier`).
- **Lapsed vs. never-subscribed** — a user who finished a trial and didn't convert is a different state from one who never started a trial at all (the latter should presumably still see the "start free trial" offer; the former's re-entry behavior is unanswered — see 6.9).

None of this state exists yet. `entitlements.js` deliberately carries none of it — it's pure config and pure functions, no storage, no network, no state machine. This is explicitly out of scope for Wave 5; see 6.9.

### 6.9 — Open questions (unresolved, not invented)
These could not be answered from the repo and are logged here rather than guessed at:
- **Where entitlement state lives** — undecided. Supabase is already in this project (profile/library sync via `profileSync.js`, Phase 3's Edge Function proxy) and is the obvious candidate for trial start/expiry and subscription status, but no table, schema, or sync path exists yet. (Note: the *payment processor* question is already answered — 6.3 names RevenueCat as the chosen vendor for native conversion — so what's open here is specifically where state lives, not who processes payment.)
- **Restore-purchase on a new device** — Apple requires this (6.4) for IAP generally, but nothing here defines how it reconciles against whatever store holds entitlement state above. Unanswered.
- **What a lapsed user sees** — no paywall screen exists (6.2 is not built), so there's no defined experience for a user whose trial or subscription has ended. Whether they fall back to a read-only free view, a blocking paywall, or something else is not decided.
- **6.5 vs. Pricing's trial copy** — as noted in 6.5, Mory's TestFlight-beta trial plan and `Pricing.jsx`'s advertised "7-day free trial — no card to start" read as two different trial mechanisms. Not reconciled here; needs a product decision, not a code change.

---

## Phase 7 — Content integration [F]
- **7.1** Ingest the 150-recipe table once Mory has scored them (see Track C).
- **7.2** `itemOverlay.json` audit — 1,223 of 1,485 items carry no overlay row; the manual layer is currently empty. It overrides the generated layer, so it's the file Sunny edits.
- **7.3** Food item images + non-food placeholder system. Depends on P4.
- **7.4** CSV ingest pipeline (Sept 2026 meeting item 7.1b) — `scripts/build-recipe-overlay.mjs` reads a quote-aware CSV (shared parser: `scripts/lib/csv.mjs`) and regenerates `src/data/recipeOverlay.json` wholesale each run (`npm run recipes:build`). Default path `content/recipes.csv`, overridable by argument. **DONE, pending Sunny's actual CSV.**
- **7.5** Content-QA tooling for Sunny's 50-recipe pass (Sept 2026 meeting item 7.1c) — `scripts/validate-recipe-csv.mjs` (`npm run recipes:validate`) is a read-only, zero-network-by-default report: FI is 4-digit and exists in `items.json`, fine group is `l`, `Meal` is a recognized type, calories are numeric and in a sane 10–2500 kcal range, URL is https, no duplicate FIs, names non-empty. **Tooling DONE; the human content-QA review itself is still open**, pending Sunny's real 50 recipes.

---

## Phase 8 — Native conversion [F]
*Last. Only after the PWA works.*

- **8.1** Extract `packages/core` — **~80% already done**: `planBuilder.js`, `calorieNeeds.js`, `nutritionEstimates.js`, `dailyPlan.js`, `saveGate.js`, `rating.js` are pure JS with no DOM imports. Finish the boundary and lint-enforce it.
- **8.2** Expo SDK 57 / RN 0.86, New Architecture (mandatory from SDK 55), TypeScript strict.
- **8.3** Component swap: `div`→`View`, `button`→`Pressable`, Tailwind→NativeWind, Framer Motion→Reanimated 3, react-router→expo-router.
- **8.4** Guideline 4.2 features — a WebView wrap gets rejected, so the native build must earn its install: offline browse, push notifications, share sheet, home screen widget, biometric lock on the health profile.
- **8.5** Long lists → FlatList/FlashList virtualization.
- **8.6** Platform surface that doesn't exist in the PWA: safe areas, keyboard avoidance, Android back button, deep links.

**While building the PWA, four rules keep this cheap:** logic in `core` never in components · flexbox only, no CSS grid · no hover-dependent interactions · no `window`/`document`/`localStorage` outside a thin adapter.

---

## Track C — Claude chat (not code)

- **C1** — **150 MedlinePlus recipes.** Public domain, attribution required. Columns: name · source URL · attribution · meal type · also-fits · raw ingredients · **ingredients mapped to Nutridigm `foodItemID`** · servings · calories + macros per serving · dietary tags · total time · `fineFoodGroup: 'l'`. Split ~30 B / 35 L / 40 D / 25 S&D / 20 Bev, multi-category where it fits, best effort on beverages. Delivered as xlsx (for Mory and Sunny) + JSON (for ingestion). Pilot batch first for schema approval.
- **C2** — Health-claim audit. Mory's line: *"Health-claim audit against Apple and Google policy. Some of our current language will not survive review."* Every user-facing string in the app checked against Apple 1.4.1 / 5.1.1 and Google's health policy; replacements proposed for anything that fails.
- **C3** — Privacy policy. Health data, so not boilerplate.
- **C4** — Terms of service.
- **C5** — Medical disclaimer language **and placement map** — which screen, which moment. Placement is what reviewers check.
- **C6** — App Privacy nutrition label answers, both stores.
- **C7** — App name + trademark pre-screen (USPTO, domain, App Store collision).
- **C8** — ASO: keywords, subtitle, description, promo text.
- **C9** — Store artwork spec sheet. iOS 1.0 needs a 1024×1024 icon + 6.9"/6.5" screenshots. The 1024×500 feature graphic is a **Play** asset — Release 2.0.
- **C10** — Free vs paid split proposal + pricing.
- **C11** — Support and feedback channel plan; review-response policy.

---

## Track B — Blocked on people

**Mory:**
1. Expand the API key to 10 conditions, weighted toward common comorbidity **pairs** — reconciliation is the product, and pairs are what exercise it. *Top blocker.*
2. Ingest and score the 150 recipes. They're food items in fine group `l`; the API assigns tier/`numericId`. **Until scored, they must not ship** — the app's safety filtering runs entirely off `numericId`: `adapter.js` pre-filters plan candidates to 1–4, and `saveGate.js` blocks saving anything harmful. A recipe with no `numericId` passes through both unchecked.
3. Item table image fields (P4).
4. App Store Connect invite — Admin or App Manager. Without it there's no TestFlight, builds, or IAP setup. He holds the account.
5. Revenue share agreement.

**Sunny:** `itemOverlay.json` flag edits.

**Apple:** Developer enrollment is a 24–48h clock and gates TestFlight, IAP, and signed builds. Store review rounds are unknown.

---

## Release split

**1.0 — iOS:** meal planner (5 slots), picks + saved-recipe plans, recipes with ingredients and link-out, guidance, Top Dos & Don'ts, Food Facts, search, profile, auth, accessibility, paywall scaffolding, legal docs.

**2.0:** Android, expanded conditions (top 50), Natural Sources if P2 clears, lessons from reviews.

**Context note (Sept 2026, not a checklist item):** an MD has referred a patient to Personal Remedies. The clinic is a prospective first pilot site, sitting behind the existing dietitian-approval gate — no scope change from this. Freemium split (C10) remains parked, Mory's call.

---

## Frozen — do not touch
*Each item below traces to the codebase, Mory, or a decision Bach made — not to any spec document. Meeting notes elsewhere reference a `constraints-and-learnings.md` file — it doesn't exist in this repo; this section is its equivalent.*

- **DailyPicks** — untouched, per Mory's review
- **Numeric health scores stay out of the UI** — `types.js` is explicit that `tier` is surfaced and "never the raw numeric value." `numericId` drives ranking and safety filtering only; tier labels and reference counts are what render
- **No running calorie tally** — `calorieNeeds.js`, July 2026 product decision. The gap sheet fires once at plan creation
- **SwapSheet** — already deleted from the codebase. `shuffleSlot` and Pin are the sanctioned re-roll; don't reintroduce it
- **Recipe directions text** — never republished. Ingredients (facts, not copyrightable) plus a link to the source. Bach's call, 10 Aug
- **Never fabricate a number** — `estimateNutrition` returns `null` rather than guessing when an item has no food group to key off. Hold that line anywhere new data is added
- **Health copy** — Fable does not write or reword user-facing health claims. Those come out of the C2 audit
- **Recipe calories are a transcribed number, never a sum** — the source of truth is Mory's 5-column Recipes table (`FI`, `FI_TEXT`, `Meal`, `Calorie Count`, `URL`), flowing through `scripts/build-recipe-overlay.mjs` into `recipeOverlay.json`. No table or API we maintain maps a recipe to its ingredients' nutrition; summing ingredients is permanently off the table, not deferred. A recipe with no overlay row shows no calorie number — same honesty rule as an unmatched item
- **Lunch and dinner are recipes-only** — `PLAN_SLOTS`' `itemFlagKey: null` for both slots (`src/api/config.js`) keeps their candidate pools recipes-only; non-recipe items, raw meat/fish cuts especially, must never surface there. Locked by `src/api/__tests__/adapter.categoryScoped.test.js`
