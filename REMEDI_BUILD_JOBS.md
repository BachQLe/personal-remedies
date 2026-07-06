# Remedi — Build Job Pack (functional + live Nutridigm API)

> **Status (2026-07-02):** JOB 0's typed API layer is done and has since been hardened further — see [NOTES & OPEN FLAGS](#notes--open-flags-for-the-human) at the bottom for what changed. Recipes (constraint #4 below) are **no longer mocked**; a real Nutridigm recipe source was found (fine food group `l`) and wired up. `/detailed` (the 8th endpoint) is now wired. Treat the JOB descriptions below as the historical spec that shaped the current adapter — where they conflict with the status notes, the status notes win.

Source spec: **`remedi_build_brief.md`** (structure/behavior only). This pack turns that brief into self-contained Sonnet jobs **wired to the real Nutridigm API**, using IDs and response shapes captured from live calls.

**Design is out of scope here.** Visuals come from the existing design system / `REMEDY_RESKIN_JOBS.md`. This brief is *structure, behavior, and API wiring only* — reuse existing components and tokens for everything visual. Where a job says "card/strip/section," it means behavior, not styling.

**How to use:** each `## JOB N` block is a complete prompt for a fresh Sonnet sub-agent. **Run JOB 0 alone and first** — it builds the typed data layer everything else consumes. After JOB 0 merges, JOBS 1–7 run in parallel (disjoint file ownership). Every job must read **GLOBAL CONTEXT** + **THE NUTRIDIGM CONTRACT** below.

---

## GLOBAL CONTEXT (every job reads this)

> ### ⚠️ STACK REALITY — overrides everything below
> This is a **live JavaScript / JSX** repo, **not** TypeScript: React 19, Vite 8, Tailwind 3, Framer Motion, react-router-dom 7, lucide-react icons. **There is no tsconfig — do NOT introduce TypeScript.** Write `.jsx`/`.js`, express "types" as **JSDoc `@typedef`** blocks. Wherever this doc says `.ts`/`.tsx`/"TypeScript interface," read it as `.js`/`.jsx` + JSDoc.
> **Much already exists — extend, don't greenfield:** `src/api/{api.js, mockData.js, storage.js, recommendations.js}` and screens under `src/screens/{home,lookup,plan,recipes,profile,week,dailyPicks}/`, plus `src/components/{shared,onboarding,layout,marketing}/`. **Read the existing file before rewriting it**; reshape it to the brief rather than duplicating. App entry is `src/App.jsx` / `src/main.jsx` (routing is inline in App, there is no `routes.tsx`).

- **Project:** `/Users/bachle/Desktop/personal-remedies/` — Vite + React + Tailwind + Framer Motion + react-router-dom (all JS/JSX). Supabase (auth/DB) + Stripe later — stub now.
- **Verify:** `npm run build` must pass; `npm run dev` to eyeball.
- **Keystone rule:** every screen reads data **only** from the typed API layer `src/api/` (JOB 0). No component hardcodes data or calls Nutridigm directly. Swapping mock→live is a data-source swap, not a rebuild.
- **Reuse, don't restyle:** import existing shared components/tokens. This pack adds *behavior + data*, not new visual language.

### Non-negotiable product constraints (from the brief — will not pass medical review otherwise)
1. **No numeric aggregate health scores in the UI, ever.** Credibility = **tier label (Top / Strong / Good) + study-reference count** only. The API's `value` and `descriptionNumericID` are used **internally** for ranking/tiering and are **never rendered**.
2. **Nutridigm-only.** Every food/assessment/ingredient comes from the Nutridigm set. Search is **constrained to the food dictionary**, so a user can never query an unassessable food → there is **no "not in our database" empty state**.
3. **No unsupported clinical claims.** Defensible, second-person language only.
4. ~~**Recipes are mocked** (Mory supplies real recipe content later). Never wire a third-party recipe API.~~ **Superseded (2026-07-02):** fine food group `'l'` in Nutridigm's own `/suggest` endpoint turned out to contain ~14 real, condition-ranked Food Network recipes (attribution in `notes`, e.g. "FN; Ina Garten"). `getRecipes(profile)` (adapter.js) fetches them for real — no third-party API was ever wired, this is still Nutridigm-only. Steps and cook time remain placeholders (no API for either); everything else (title, tier, matched conditions, per-ingredient citations on open) is real.

---

## THE NUTRIDIGM CONTRACT (embedded in every job)

**Transport:** the live API is reachable through the local MCP server (`nutridigm-mcp/server.js`, 8 tools) and over HTTPS:
`GET {BASE_URL}/{endpoint}?subscriptionID={SUB}&...`
`BASE_URL = https://5jocnrfkfb.execute-api.us-east-1.amazonaws.com/PersonalRemedies/nutridigm/api/v2`
Subscription id lives in `.mcp.json` / env (`NUTRIDIGM_SUBSCRIPTION_ID`) — **never hardcode it in `src/`.**

**Status codes:** `200` ok · `220` ok-but-empty (empty array, **not** an error) · `400 IVHEALTHCONDITIONID` invalid id · `401 NOTAUTHORIZEDHEALTHID` condition not in this key's allow-list · `401 APIDAILYLIMITREACHED` daily cap.

### ⚠️ Demo-key reality (this drives JOB 0's design)
The current key scores **exactly two conditions: Aging = `203`, Pneumonia = `244`.** Every other `healthConditionID` returns `401 NOTAUTHORIZEDHEALTHID` even though `/healthconditions` lists 271 of them. Therefore:
- The dev **seed/default profile MUST be `[203, 244]`** so live calls return real data.
- The adapter must **catch `NOTAUTHORIZEDHEALTHID` and fall back to mock** for that profile — so the UI works with *any* selection in dev, and needs **zero code change** when a full-access key arrives.
- Dictionary endpoints (`/healthconditions`, `/fooditems`, `/foodgroups`) are unrestricted — use them freely for the full browseable lists.

### The 8 endpoints
| Endpoint | Returns | Used for |
|---|---|---|
| `/healthconditions` | `[{healthConditionID, description, longDescription, AKA, ICD10}]` (271) | onboarding's unified searchable list |
| `/fooditems` | `[{foodItemID, description, displayAs, coarseFoodGroup, fineFoodGroup, longDescription, unitOfMeasure}]` | constrained food search (fetch once, cache, filter client-side) |
| `/foodgroups` | `[{foodGroupID, description, isFineFoodGroup, isCoarseFoodGroup}]` | category labels |
| `/goodfor?foodItemID&healthConditionID=csv` | `{value, description, descriptionNumericID, notes, conditions:[…]}` | **single-food assessment** |
| `/topdoordonts?healthConditionID=csv&consumeOrAvoid&limit` | `[{description, foodItemID, displayAs, fineFoodGroup, coarseFoodGroup, value, notes}]` sorted best-first | suggestions, meal-plan seed |
| `/suggest?healthConditionID=csv&fineFoodGroup` | `[{foodItemID, foodItemDisplayAs, foodDescription, description, descriptionNumericID, value, notes}]` | best foods within a fine group; alternatives |
| `/detailed?healthConditionID=csv&coarseFoodGroup&listType=helpful\|neutral\|harmful` | `[{foodItemID, foodItemDisplayAs, healthConditionID, description, notes, value}]` | best foods within a coarse group |
| `/references?healthConditionID&foodItemID` | `["citation string", …]` | **"N studies" count** = array length |

**Reconciliation rule:** pass **ALL** profile conditions as one comma-separated `healthConditionID` list in a **single** call — the engine reconciles them. In `/goodfor`, the top-level `value/description` is the **reconciled** verdict; the `conditions[]` array is the **per-condition** breakdown and is **positional** (entry *i* = the *i*-th condition you passed — **it carries no id**, so preserve input order).

### Verdict ladder → UI tier (canonical mapping — implement in JOB 0)
`descriptionNumericID`: `1` Most Helpful · `2` More Helpful · `3` Helpful · `4` Neutral/OK *(also = "no data")* · `5` Consume Less · `6` Consume Much Less · `7` Avoid. `value` is signed (+helpful / −harmful, ≈ ±3).

| `descriptionNumericID` | UI tier | Treatment |
|---|---|---|
| 1 Most Helpful | **Top** | good match |
| 2 More Helpful | **Strong** | good match |
| 3 Helpful | **Good** | good match |
| 4 Neutral/OK | — | not surfaced (also the no-data sentinel) |
| 5 / 6 / 7 | — | **poor match** → triggers "better alternatives" branch |

> This mapping is inferred from the ladder; **FLAG for Bach/Mory to confirm** the exact Top/Strong/Good thresholds.

### Real grounding examples (verified live with profile `[203, 244]`)
- `goodfor(1397 "Organic Kale")` → reconciled **More Helpful** (`value 1.82`); `conditions[0]`=Aging **Most Helpful** (2.99), `conditions[1]`=Pneumonia **Helpful** (0.65).
- `goodfor(669 "Chocolate chip cookies")` → reconciled **Consume Much Less** (−1.76); per-condition Avoid (−2.99) + Consume Less (−0.53).
- `topdoordonts consume` → Water(729), Rice milk(1298), Soy milk(267), Almond Milk(1319), Organic Kale(1397)… *(note: includes lifestyle items like "Rest. Get enough sleep."(985), filter group `j`/`x` out of food lists).*
- `topdoordonts avoid` → Smoking/Tobacco(986), Hot chocolate(689), Chocolate chip cookies(669), Chocolate cake(640)…
- `suggest fineFoodGroup b1` → Pink salmon(148), Sardines(149), Swordfish(171), Snapper(165)…
- `detailed coarseFoodGroup e, helpful` → Organic Kale(1397), Garlic(395), Organic Broccoli(1382), Arugula(359)…
- `references(203, 1397)` → 21 citation strings → renders as **"21 studies."**
- Dictionary-only (exist but **NOT** scoreable on demo key): Diabetes Type-2=16, High Blood Pressure=2, Prediabetes=306, Metabolic Syndrome=308, DASH diet=26.

### Food groups (for category/meal mapping)
Coarse: `b` Meat/Fish/Poultry · `c` Eggs/Beans/Nuts/Seeds · `d` Fruits & Juices · `e` Vegetables · `f` Breads/Grains/Cereals/Pasta · `g` Dairy/Fats/Oils · `h` Desserts/Snacks/Beverages · `i` Herbs/Spices/Fast Foods · `j` Alt therapies/Misc · `k` Key Nutrients/Herbal · `l` Recipes.
Fine: `b1` Fish&Seafood · `b2` Red/Organ Meats · `b3` Poultry · `c1` Eggs · `c2` Beans&Legumes · `c3` Nuts&Seeds · `g1` Dairy · `g2` Fats&Oils · `h1` Sweets&Snacks · `h2` **Beverages** · `i1` Herbs/Spices/Sauces · `i2` Fast/Prepared · `j1` Alt Therapies · `k1` Vitamins/Minerals · `k2` Herbal Supplements.

### Known gaps to mock (flag, don't invent clinically)
- **Calories:** Nutridigm returns none. The Plan screen's per-day (default **2000**) and per-meal calories are **mock metadata** — flag for Mory.
- ~~**Recipes:** mock; group `l` recipe items exist in `/fooditems` but treat the recipe interface as a stub.~~ **Resolved (2026-07-02):** group `l` recipes are fetched for real via `/suggest` (`getRecipes` in adapter.js) — see the constraint-4 status note above. Steps and cook time are still placeholders (no API).
- **Field-name drift:** `displayAs` (fooditems/topdoordonts) vs `foodItemDisplayAs` (suggest/detailed) — **normalize in the adapter** so screens see one shape.

---

## EXECUTION ORDER
```
PHASE 1 (blocking, alone):   JOB 0  — Typed API layer + live Nutridigm adapter + mock
PHASE 2 (parallel):          JOB 1  — Universal cards (Ingredient + Recipe)
                             JOB 2  — Onboarding (unified 3-cap profile)
                             JOB 3  — Home hub + Library
                             JOB 4  — Plan / Recipe page
                             JOB 5  — Food Lookup
                             JOB 6  — Suggestions
                             JOB 7  — Loop wiring + guardrail QA   (run LAST)
```
**Parallel-safety:** each job edits only the files it owns; shared types/adapter (JOB 0) and shared cards (JOB 1) are **imported, never edited** by others. If a shared piece is wrong, leave `// API-TODO(JOB0)` / `// CARD-TODO(JOB1)` and move on.

---

## JOB 0 — Typed API layer + Nutridigm adapter (BLOCKING — first, alone)

> **Status: done, and superseded in places** — `mockData.js` and the `SOURCE='live'|'mock'` switch described below were replaced by `withConditionFallback` (per-call NOTAUTHORIZEDHEALTHID retry against `DEFAULT_DEV_CONDITIONS`, no static mock data source) plus `cache.js` (persistent stale-while-revalidate cache). `getRecipesForIngredient`'s "stub, realistic mock recipes" is superseded by the real `getRecipes(profile)` (fine food group `l` via `/suggest`). See [NOTES & OPEN FLAGS](#notes--open-flags-for-the-human) for the full list of what changed since this was written.
>
> Build the data layer the whole app reads from. Read GLOBAL CONTEXT + THE NUTRIDIGM CONTRACT in full.
>
> **Files you own:** `src/api/` — extend the **existing** `api.js` + `mockData.js`; add `types.js` (JSDoc `@typedef`s), `nutridigm.js` (raw client), `adapter.js` (maps raw→typed shape), `config.js` (source switch). Keep `api.js` as the single interface every screen imports; preserve any export names current screens already use (read them first, alias if you must rename).
>
> **Define the interface** (JSDoc-typed; every screen consumes this, nothing else):
> - `searchFoods(query, profile) → Food[]` — client-filter cached `/fooditems` on `description`/`displayAs`; exclude groups `j`,`x`,`l`. Constrained set ⇒ no "unknown food" path.
> - `assessFood(foodId, profile) → Assessment` — `/goodfor`; map reconciled `descriptionNumericID`→`tier` (Top/Strong/Good or `poor`); build `perCondition[]` from the **positional** `conditions[]` zipped with `profile.conditions` (preserve order); for each condition call `/references` and store **count** (+ keep citation strings for the detail view).
> - `getSuggestions(profile) → { categories: { group, label, foods: Food[] }[] }` — `/topdoordonts consume` for the top ranked list + `/detailed` per helpful coarse group; group by food group.
> - `getAlternatives(foodId, profile) → Food[]` — branch on the food's assessed tier: poor → better-matched foods in its `fineFoodGroup` via `/suggest`; good → other good matches (same call). Absorbs the old "Choose This Not That."
> - `getRecipesForIngredient(foodId, profile) → Recipe[]` — **stub**, realistic mock recipes.
> - `buildMealPlan(profile, libraryItems?) → DayPlan` — seed from `/topdoordonts consume`; bucket into **Breakfast/Lunch/Dinner/Snack/Beverages** by food group (Beverages ← `h2`, Snack ← `h1`); fold in `libraryItems`; attach **mock** per-meal + per-day (default 2000) calories.
>
> **Shapes (JSDoc `@typedef` in `types.js`):** `Tier` = `'Top'|'Strong'|'Good'`; `Food` = `{ id, name, group, fineGroup, tier?, referenceTotal? }`; `Assessment` = `{ food, tier|'poor', perCondition: [{ conditionId, conditionName, tier, referenceCount, citations: string[] }] }`; `Profile` = `{ conditions: number[], dietary: string[], … }`; plus `DayPlan`, `Recipe`. **No `value`/`score` field is ever exposed to the UI.**
>
> **Adapter must:** normalize `displayAs`/`foodItemDisplayAs`→`name`; treat `220` as empty (not error); **catch `NOTAUTHORIZEDHEALTHID`/`APIDAILYLIMITREACHED` → fall back to `mockData`** for that call (log once). Source switch in `config.js` (`SOURCE = 'live' | 'mock'`); raw client reads `BASE_URL`/`SUB` from env, never from `src/`.
> **Seed mock + default dev profile = `[203, 244]`** so `SOURCE='live'` returns real data end-to-end. Mock data must mirror live shapes (use the grounding examples).
>
> **Don't:** build any screen/component; expose numeric scores; call Nutridigm from anywhere but `nutridigm.js`.
> **Acceptance:** `npm run build` passes; with `SOURCE='live'` + profile `[203,244]`, `assessFood(1397)` returns tier `Strong` with per-condition reference counts and `getSuggestions` returns kale/garlic/salmon; switching a condition to an unauthorized id silently serves mock; no `value` reaches the typed surface.

---

## JOB 1 — Universal cards: Ingredient + Recipe (shared)

> Build the two universal objects every surface composes. Read GLOBAL CONTEXT + THE NUTRIDIGM CONTRACT. JOB 0 merged — consume its types; reuse existing design-system components for all visuals.
>
> **Files you own:** `src/components/IngredientCard.jsx`, `src/components/RecipeCard.jsx`.
>
> **IngredientCard** (Lookup results, Suggestions, alternatives, recipe ingredient rows):
> - Primary action **"add to library"** (a library-add affordance, **not** a star).
> - Shows **tier label (Top/Strong/Good) + study-reference count** ("21 studies"). **Never a number/score.**
> - Tap → food detail view (per-food reference content; the old "Food Facts" lives here as a detail, not a separate feature). Detail lists the `perCondition` tiers + expandable citations from `assessFood`.
>
> **RecipeCard** — one component, **location-driven variant** via a `context` prop; `view recipe` always present:
> - Outside planner (Lookup/Suggestions/browse): corner **calendar-plus** → add recipe to planner.
> - On planner: **"add to menu"** + corner **heart** (favorite).
>
> **Save-verb semantics (keep distinct, never share an icon):** **library-add = ingredients**; **heart = recipes/meals**.
>
> **Don't:** build screens; expose scores; create two recipe components.
> **Acceptance:** `npm run build` passes; IngredientCard shows tier+count and a working detail with per-condition citations; RecipeCard swaps action by `context`; no numeric score anywhere; ingredient vs recipe verbs/icons are distinct.

---

## JOB 2 — Onboarding (unified profile, 3-cap)

> One screen, no confirmation step — on completion go **straight to Home**. Read GLOBAL CONTEXT + THE NUTRIDIGM CONTRACT. Consume JOB 0 (`getConditions` from `/healthconditions`, `saveProfile`).
>
> **Files you own:** `src/screens/onboarding/`.
>
> **Do:**
> - **One unified, alpha-sorted, fully-browseable list** mixing conditions, dietary restrictions, allergies, health objectives, dietary-guideline programs, athletic goals, medications — **not** separate pages. Source it from `/healthconditions`.
> - **Single type-to-filter search field** (primary path; avoids miss-selection). Every option also visible/scrollable.
> - **Tag-as-icon** on each row so the user sees what each entry is (condition vs allergy vs diet vs medication…); put a matching icon **inside the search field** too. (Icon set = design system.)
> - **Hard cap of 3 total selections** across the unified list; hitting the cap blocks more with a **non-punitive** message framed as *guidance quality* ("fewer = stronger, less-diluted guidance").
> - Dietary options to include: vegan, vegetarian, avoid pork, USDA/FDA guideline programs. **Exclude kosher & halal** (engine can't differentiate).
> - **Dev nudge:** since the live key only scores **203 (Aging)** & **244 (Pneumonia)**, make those trivially selectable (and the seed default) so live data shows during testing.
>
> **FLAG for Bach:** do *medications* count against the 3-cap? Built **inside** the cap by default — confirm.
> **Don't:** add a confirmation/overview screen; split into category pages; ask for calories/weight/activity; include kosher/halal.
> **Acceptance:** unified searchable+browseable list; 3-cap enforced with positive framing; icons on rows and in field; completing saves a `Profile` and routes to Home; kosher/halal absent.

---

## JOB 3 — Home (the hub) + Library

> Home is a **hub, not a funnel** — the user is always in charge. Read GLOBAL CONTEXT + THE NUTRIDIGM CONTRACT. Consume JOB 0 + JOB 1 cards.
>
> **Files you own:** `src/screens/home/`, `src/components/LibraryStrip.jsx`, library state store (`src/state/library.js`).
>
> **Do (top→bottom):**
> 1. **Large squarish primary CTA "build my meal plan"** → `buildMealPlan(profile, libraryItems)` → Plan screen (JOB 4).
> 2. **Library strip directly below the CTA** — the user's saved **ingredients** (added via IngredientCard's library-add). Physically adjacent because it's the plan's staging ground; each item is **two clicks from being added to the plan**.
> 3. **Info-tool entry points** below the library → Food Lookup (JOB 5) and Suggestions (JOB 6).
> - Any auto-filled best picks are labeled **"our suggestions based on your preferences"**; respect non-changes as valid choices.
> - Library store is shared (Lookup/Suggestions write to it). Optionally feeds `buildMealPlan`.
>
> **Don't:** make Home a forced sequence; make Library a separate nav destination; expose scores.
> **Acceptance:** CTA builds a plan from the live/mock profile; Library strip renders saved ingredients and adds them to the plan in two clicks; Lookup + Suggestions reachable; suggestion auto-fills are labeled as such.

---

## JOB 4 — Plan / Recipe page

> Replaces the all-seven-days view; defaults to **a single day (today)**. Read GLOBAL CONTEXT + THE NUTRIDIGM CONTRACT. Consume JOB 0 (`buildMealPlan`) + JOB 1 RecipeCard (planner context).
>
> **Files you own:** `src/screens/plan/`.
>
> **Do:**
> - **Week strip** of 7 day-pills; tap switches the day below; current day selected by default.
> - **Next-week navigation** (forward control / swipe) **regenerates the plan from the clinical profile** — forward weeks are freshly built via `buildMealPlan`, never blank.
> - **Five meal sections per day, in order: Breakfast / Lunch / Dinner / Snack / Beverages** (Beverages its own section). Each holds RecipeCards in **planner variant** (JOB 1: "add to menu" + heart).
> - **Calories:** **per-day total at day level (default 2000/day, no auto-adjust in v1)** + **per-meal calories on each card** (compact scale). Numbers from JOB 0's **mock** calorie metadata — user self-repairs by reading them; app never auto-corrects. *Optional:* visual-only flag when a day runs notably high/low.
> - On building/confirming a plan, fire a **celebratory completion moment** (behavior only; animation per design system).
>
> **Don't:** show the old 7-day view by default; auto-adjust calories; build meal-cycling or a shopping list (out of scope).
> **Acceptance:** day strip switches days; next-week regenerates from profile; five ordered sections incl. Beverages; per-day + per-meal calories shown (mock); completion moment fires.

---

## JOB 5 — Food Lookup ("is this good for me")

> Search-driven info surface; **deliberately not connected** to Suggestions. Read GLOBAL CONTEXT + THE NUTRIDIGM CONTRACT. Consume JOB 0 (`searchFoods`, `assessFood`, `getAlternatives`) + JOB 1 IngredientCard.
>
> **Files you own:** `src/screens/lookup/`.
>
> **Do:**
> - Search field **constrained to the Nutridigm food set** (cached `/fooditems`) — so the user can't land on an unassessable food; **no miss state to design.**
> - Selecting a food shows its **assessment**: tier (Top/Strong/Good) + **per-condition study-reference counts**, reconciled across all profile conditions (`assessFood`).
> - **Alternatives fall out of the same result** (absorbs "Choose This Not That" — no separate compare UI): poor match → better-matched foods; good match → other good matches (`getAlternatives`).
> - Every food shown is an **IngredientCard** → carries library-add, feeding the loop.
>
> **Don't:** add a separate comparison screen; fabricate verdicts; show a numeric score; connect to Suggestions.
> **Acceptance:** searching is constrained to the food set; a result shows tier + per-condition reference counts + inline alternatives that branch on tier; results are IngredientCards with working library-add.

---

## JOB 6 — Suggestions ("what's best for me")

> Browse-driven, profile-ranked info surface; **not connected** to Lookup. Read GLOBAL CONTEXT + THE NUTRIDIGM CONTRACT. Consume JOB 0 (`getSuggestions`) + JOB 1 IngredientCard.
>
> **Files you own:** `src/screens/suggestions/`.
>
> **Do:**
> - **Defaults to a populated ranked list** — **no empty/search-first state**; opening it immediately shows what's good for the user (the proactive principle).
> - Organized as **best food categories**, then **best foods within a category** (`getSuggestions` → category groups; drill in via `/detailed`/`/suggest`). Filter out non-food groups `j`/`x`.
> - Every food is an **IngredientCard** (library-add → loop).
>
> **Don't:** add a search-first/empty state; connect to Lookup; expose scores.
> **Acceptance:** opens already populated with ranked categories and foods for the live/mock profile; drill-down lists best foods per category; all IngredientCards with library-add.

---

## JOB 7 — Loop wiring + guardrail QA (run LAST)

> Wire the two browse surfaces to the plan **through the library** and run the guardrail sweep. Read GLOBAL CONTEXT + THE NUTRIDIGM CONTRACT. Runs after JOBS 0–6 merge; read access to all of `src/`.
>
> **The loop:** `Suggestions → ingredient → [add to library] → plan` and `Lookup → ingredient → [add to library] → plan`. The two surfaces **never talk to each other**; the **Library is the only bridge** (shared store from JOB 3). Verify an ingredient added in either surface appears in Home's Library strip and is two clicks into the plan.
>
> **QA sweep (report + fix trivial):**
> - **No numeric scores / health gauges anywhere** — credibility is only tier + reference count. Grep for stray `value`/score rendering.
> - **No "not in database" empty state** in Lookup (search is constrained).
> - **No out-of-scope surfaces, not even stub entry points:** LLM/chat, food scanning, off-plan checker, meal-cycling, grocery/shopping list, kosher/halal, native build.
> - Live-key sanity: profile `[203,244]` returns real data; unauthorized condition silently serves mock (no crash/console error).
> - Save-verb hygiene: library-add = ingredients, heart = recipes — never conflated.
> - `npm run build` passes; `npm run dev` renders onboarding → home → plan → lookup → suggestions clean on mobile (390px).
>
> **Acceptance:** loop verified through the Library; guardrail report shows zero scores, zero out-of-scope surfaces, zero "unknown food" state; build passes.

---

## NOTES & OPEN FLAGS (for the human)

### Resolved since this pack was written
- **JOB 0's typed API layer is done and has been hardened further.** All 8 endpoints are now wired (`/detailed` was the 8th, previously unused — it now powers a category explorer, `CategoryDetailSheet`, drilling into helpful/neutral/harmful per coarse group with no fabricated tier). The static-mock (`mockData.js` / `SOURCE='live'|'mock'`) fallback described in JOB 0 was replaced by `withConditionFallback` (centralized per-call `NOTAUTHORIZEDHEALTHID` retry against `DEFAULT_DEV_CONDITIONS`, propagating `usedFallback` → `DemoDataChip` in the UI) plus a persistent localStorage cache (`src/api/cache.js`, stale-while-revalidate, namespaced `remedi.cache.v1`) so the daily rate limit isn't burned on every reload. `APIDAILYLIMITREACHED` is deliberately never retried. `nutridigm.js` also gained in-flight request de-dupe and a fast-fail `NutridigmConfigError` when the subscription ID env var is unset.
- **Recipes are no longer mocked.** Nutridigm fine food group `l` (via `/suggest`) turned out to contain ~14 real, condition-ranked Food Network recipes — `getRecipes(profile)` (adapter.js) fetches them; RecipesScreen and recipe detail views use real tiers + citations. Steps and cook time are still placeholders (no Nutridigm API for either) — see the still-open flag below.
- **`getAlternatives`/`/suggest`** now also power a dedicated `SwapSheet` component (healthier same-fine-group swaps, surfaced on PlanScreen food cards and RecipeDetail ingredient rows), not just the Lookup/Suggestions "better alternatives" branch.
- **Condition IDs bug fixed.** `profile.conditions` is now correctly `number[]` of Nutridigm `healthConditionID`s everywhere (some earlier code paths stored/compared display-name strings). `api.getProfile()` silently migrates any legacy name-based profile found in localStorage on read.
- **References honesty.** `assessFood` now uses `Promise.allSettled` per condition and tags each with `referenceStatus: 'ok'|'error'`; a failed `/references` fetch surfaces as `referenceTotal: null` (unknown), never a fabricated `0` ("no studies"). Trust-signal UI (list view) warms only the top 3 rows live (`warmReferenceCount`, max 3 calls) and reads everything else cache-only (`getCachedRefCount`, zero network calls).
- **Honest tiers on `/topdoordonts`-sourced cards.** That endpoint carries no tier data, so the rank-based fake Top/Strong/Good badges on Daily Picks cards were removed (`tier: null` → no badge shown); card blurbs now surface the real Nutridigm `notes` advisory text (cleaned/deduped) instead, falling back to the group label.
- **Condition picker** now matches on the Nutridigm dictionary's own `AKA` aliases + `longDescription` (not just the static `conditionSynonyms.js`, which is demoted to a fallback-only backstop); `ICD10` is shown in the profile editor.
- **Real category/group labels.** `/foodgroups` now backs `getGroupLabel`/`getGroupLabels`; the static `COARSE_GROUP_LABELS` map in config.js is demoted to an offline-only fallback.
- **Supabase (Track C):** Google OAuth existed but `AuthCallback.jsx`'s `getSession()` had a race with the async OAuth redirect exchange — fixed via `onAuthStateChange` + an 8s timeout fallback. `src/lib/supabase.js` is now guarded (`isSupabaseConfigured`; null client, no crash, when env vars are missing). New: `src/api/profileSync.js` — localStorage stays the source of truth (guest mode fully works signed-out); signed-in users get a debounced (~2s) write-through to their `profiles` row plus a pull-on-login merge (newer `updated_at` wins), and first sign-in adopts the guest's local profile. `supabase/migrations/0002_profile_app_state.sql` adds denormalized columns (`conditions int[]`, `preferences`/`library`/`daily_plan` jsonb) to the existing normalized `profiles` table from the init schema — the normalized tables (`user_conditions` etc.) are kept but unused for now, by decision. `storage.js` gained an `onWrite` hook; `initProfileSync()` runs once from `AuthContext`.

### Still open
- **Demo key = 2 conditions (203 Aging, 244 Pneumonia).** All other ids 401 until Mory issues a full-access key; the fallback (now `withConditionFallback`) means no code change when it arrives — just widen the seed profile.
- **Tier thresholds** (Top/Strong/Good ← descriptionNumericID 1/2/3) are still inferred — confirm with Mory.
- **Calories** are still mock (API has none) — confirm source with Mory before launch.
- **Medications vs 3-cap** still unresolved (built inside the cap) — confirm with Bach.
- **Recipe steps and cook time** remain placeholders (demo text / ingredient-count heuristic) — no Nutridigm API surfaces either; flag for Mory if real step content ever becomes available.
