# Remedi — What Each Page Is For

*Last updated: August 19, 2026. Written against the code as it stands on `main`.*

## The idea in one paragraph

Remedi turns a person's health conditions into concrete food decisions. You tell it what you're dealing with — type 2 diabetes, hypertension, kidney disease, whatever it is — and every screen afterward answers a version of the same question: **given my conditions, what should I eat, what should I avoid, and what's the evidence?** The recommendations are not generic wellness advice; they come from the Nutridigm API, which scores individual foods and recipes against specific conditions and links back to published studies.

Two design commitments shape everything below:

1. **Honesty over completeness.** If the data source doesn't know something, the app says nothing rather than guessing. There are no invented nutrition labels, no fake study counts, no placeholder recipes.
2. **Decisions, not tracking.** Remedi is not a calorie counter or a food diary. It plans and recommends; it doesn't score your day or nag you.

The product is a mobile-first web app. On desktop it renders inside a phone frame so it always reads as the phone experience it's designed to be.

---

## Map of the app

**Public site** → `/` and its sub-pages: the pitch.
**Onboarding** → `/onboarding`: two steps, name and conditions.
**The app** → `/app/*`: five tabs across the bottom — Plan, Search, Home, Choices, Profile. ("Choices" is the tab-bar label for the Best & Worst Choices / Guidance screen at `/app/suggestions` — the full name doesn't fit a five-up tab bar at 10px, so the tab is short and the on-screen title spells it out.)

You can't reach `/app/*` without a saved profile; the app bounces you to onboarding.

---

# Public site

## Landing page — `/`

**Purpose:** Convince a visitor that changing what they eat can meaningfully change a chronic condition, and get them into onboarding.

The page runs top to bottom as: an announcement bar with a countdown offer → the hero ("Less pills, more real food") → an **interactive demo** where you drag condition chips (Diabetes, Hypertension, Kidney Disease) onto a profile and watch the verdict on garlic change in real time → a rotating wheel of real scientific citations → a two-column split for patients vs. providers → free/premium pricing → closing CTA → footer.

The drag demo is the centerpiece: it shows personalization working in five seconds without asking for anything.

Content here is static — no API calls. Every CTA leads to `/onboarding`.

Supporting pages exist at `/providers`, `/developers`, `/science`, `/about`, `/news`, `/contact`, `/terms`, `/privacy`, plus `/login`.

---

# Onboarding — `/onboarding`

Two steps. Target time: about two minutes.

## Step 1 — Welcome

**Purpose:** Set the tone and get a first name.

A headline reveals word by word — *"Everyday food can have medicinal effects. But first — we want to know you."* — then a single input for a first name. Tapping anywhere skips the animation. Nothing is sent anywhere yet; this step exists to make the app feel like it's addressing a person rather than a form.

## Step 2 — Build your health profile

**Purpose:** Capture the conditions that will drive every recommendation in the app.

A search field over the full health-condition dictionary (271 entries), with synonym matching so "hbp" finds hypertension. Each result shows an icon, name, and short description. Picked conditions appear as tiles; you need at least one to continue.

On submit the profile is saved locally, the app pre-warms its data caches in the background, and you land on Home.

---

# The app

## Home — `/app/home`

**Purpose:** The hub. Greet the user by name and give one tap to everything else.

Three entry points, stacked full-width and sized by importance — **Best & Worst Choices** (tallest, the primary destination), **Meal Planner**, and **Food & Nutrient Lookup** — followed by *"Top recommendations for you"*, an auto-advancing, 3D-tilted carousel that fills whatever vertical space is left. Tapping a card opens the detail view; "See all" next to the carousel's label goes to the full recipe browser at `/app/recipes`.

There used to be a fourth block (a dismissible "Discover your best recipes" news banner) and a two-button Food Lookup / Natural Sources Lookup pair. Both are gone: the banner was deleted outright, and the two lookup buttons merged into the single "Food & Nutrient Lookup" block. See "Consequences" further down for what the banner's removal left dangling.

That carousel draws from the same ranked list as the "Do" side of Top Dos & Don'ts, which means it includes **lifestyle factors, not just foods** — exercise, sleep, smoking. Those render with a leaf icon instead of a food photo, because pairing a stock photo with "Exercise" would be nonsense. It fetches once on mount (50 rows, to render 8 cards — a known, unfixed over-fetch), and that call is already warmed at app boot and cached for 8 hours, so in practice it's rarely a cold fetch and never blocks the three buttons above it from being tappable.

## Search — `/app/search`

**Purpose:** Look up one specific thing — food, recipe, nutrient, or herbal supplement — from a single box.

The old two-mode pill switcher (Food Lookup vs. Natural Sources) is gone. One query now fans out to every source at once and results render as up to four labelled sections, each shown only when it has rows:

- **Foods** — the plain food dictionary, filtered locally by name.
- **Recipes** — the profile's condition-ranked recipe list, filtered locally by title.
- **Nutrients** — key vitamins/minerals (what "Natural Sources" used to mean, half of it).
- **Herbal Supplements** — herbal medicines (the other half of "Natural Sources").

Type-ahead with a 300ms debounce, recent searches as tappable chips, results as rows with an icon, title, a real food-group subtitle, and a save button. Tapping a row opens the detail view.

All of it filters locally over bundled/already-cached dictionaries rather than hitting the network fresh, so results are instant. If every source fails at once it's an honest error state; if only one source is down, the working sections still render.

## Recipes — `/app/recipes`

**Purpose:** Browse the full set of condition-matched recipes.

Search box, meal-type filters (All / Breakfast / Lunch / Dinner / Snack), and — if the profile has more than one condition — filter pills per condition. A live count sits above the list ("12 recipes · Breakfast · Diabetes"). Each row carries a thumbnail, title, a match-quality pill (Top / Strong / Good / Use caution), and the source.

The recipes are real Food Network recipes ranked against the user's conditions, with per-condition verdicts from the same evidence pipeline as foods. **What the data source does not have:** cook steps, ingredient lists as instructions, or recipe URLs. So the detail view's "Get the recipe" button runs a web search for the recipe name plus its source rather than pretending to link to a page that doesn't exist. Meal type is inferred from the title, so it's a good guess, not metadata.

Reached from Home's "See all", not from the tab bar.

**Open item:** this is one of two recipe entry points one level below Home — the other is Best & Worst Choices' "Best Recipes" tab (below), which shows top-ranked rails from the same pool rather than the full browsable list. Home itself only has one recipe button now, but the two deeper surfaces still exist side by side and haven't been reconciled.

## Best & Worst Choices — `/app/suggestions`

**Purpose:** The reference section — everything the app knows about your conditions, organized three ways. (Renamed from "Dietary Guidance" — see the boss-review doc for why; the tab bar shows the short form "Choices".)

### Tab 1 — Dos & Don'ts

A ranked list of the ~20 things most worth doing or avoiding, toggled between **Do** and **Don't**. Includes lifestyle items alongside foods, tagged as such with an advisory note.

There is no match-quality badge on this tab, deliberately: the underlying endpoint returns rank without tier scores, and **the rank order is the verdict.** Adding a badge would mean inventing one. Study counts appear opportunistically — only when that data is already cached from elsewhere, so browsing this list never triggers a burst of API calls.

### Tab 2 — Food Groups

A grid of nine food categories (fish & seafood, fruits, and so on). Tapping one opens a detail page — `/app/suggestions/group/:groupId` — with an **Eat / Avoid** switcher and ranked items with study counts.

Only the tab you're looking at is fetched; the other side loads on demand. Empty groups say "Nothing curated here yet" rather than filling space.

### Tab 3 — Best Recipes

Horizontal rails, one per meal slot (Breakfast, Lunch, Dinner, Snacks), showing top-ranked recipes for the user's conditions. Same recipe pool the meal planner picks from, presented read-only for browsing. A slot with nothing scoreable shows "No options yet".

## Meal Planner — `/app/plan`

**Purpose:** Turn the recommendations into an actual week of meals.

The most involved screen in the app, with three views behind a switcher:

**Day view (default)** — a 7-day strip across the top, then four slots: Breakfast, Lunch, Dinner, Snacks, each a small grid of recipe cards with rating and meal tag. Above the slots sits a calorie line reading *"~N cal planned (estimated) · your estimated need ~M"*. You can swipe between days or tap the strip.

**Week view** — all seven days as an accordion, one expanded at a time, with a per-item "mark as eaten" toggle and a per-day nutrition estimate sheet.

**Saved recipes** — your bookmarked recipes, with a one-tap add into the right slot for the current day.

What you can do: **regenerate the day**, **regenerate the whole week**, **shuffle a single slot**, **remove a card** (with undo), or hit the **"New meal plan"** button to open a full-screen picker where you choose recipes yourself and build a week from your picks. If the resulting day lands well under your calorie target, a sheet offers quick additions before you commit.

Interaction model borrows deliberately from Eat This Much (regenerate / shuffle / check off) and adds Season Health's per-item "why this fits your condition" framing — both identified in the vendor analysis as the right patterns, with the condition-driven niche itself largely vacated.

Two things worth stating plainly:

- **The planner is recipes-only.** Ingredients were removed from it entirely — a plan should propose meals, not hand you a raw onion.
- **Pinning is built but not exposed.** The state layer supports pinning items across regenerations, and Shuffle correctly disables when everything in a slot is pinned, but there is currently no pin button on the cards. It's plumbing waiting on a control.

## Profile — `/app/profile`

**Purpose:** Edit the inputs that drive everything else.

Header shows the name and current condition chips. Below:

- **Your conditions** — searchable dropdown over the full 271-condition list, chips with an × to remove. Saves immediately.
- **Daily calorie target** — a single number, default 2000.
- **Medications** — free-text list.
- **Allergies & intolerances** — free-text list.
- **Dietary preferences** — Vegetarian, Vegan, Pescatarian, Avoid Pork, Gluten-Free, Dairy-Free, Low Sodium.

The calorie target is a flat, user-set number by design. An earlier version estimated it from height, weight, age, sex, and activity level via the Mifflin–St Jeor equation; that whole path — formula and biometrics UI — was removed. Asking for body measurements to produce an estimate the user could have typed themselves was friction without payoff, and it pushed the product toward feeling like a calorie tracker, which it isn't.

Signing in is optional. Everything works signed out against local storage; when signed in, profile, saved library, and meal plan sync to the backend with newest-wins on conflict, and every sync error is swallowed so the app never breaks because the network did.

---

## Cross-cutting behavior

### Food & recipe detail

Opens as a flip card from anywhere — Home, Search, Recipes, Best & Worst Choices, Plan. Drag down to dismiss.

**Front:** photo, star rating, name, "Best for" condition chips, description.
**Back:** one row per condition in your profile with a match verdict (Top / Strong / Good / Poor match / Neutral), plus study counts and expandable citations for foods.

Notable absences, all intentional: **no nutrition facts panel** — the data source has no nutrition fields anywhere, verified endpoint by endpoint, so rather than show a placeholder table there is no table. If a study lookup fails, the card says "Couldn't load studies" instead of displaying zero.

### Saving

One rule, applied identically everywhere a bookmark appears: **only recipes can be saved, and never a harmful one.** Tapping a blocked bookmark explains why — *"not available for save because it is an ingredient"* or *"because it's harmful!"* — rather than silently doing nothing. Blocked items show a slashed bookmark. Removal is never blocked: anything already saved can always be taken out.

### What "Neutral" means

A Neutral verdict is not a mild endorsement — it means **the data makes no claim** about that food for that condition. The app never upgrades absence of evidence into a recommendation.

### Where the data comes from

The Nutridigm API, across endpoints for ranked do/don't lists, per-group detail, condition-scoped suggestions, per-condition verdicts, and study references. Dictionaries (foods, conditions, food groups) ship bundled with the app so they cost nothing at runtime; live recommendation calls are cached for 8 hours with stale-while-revalidate. Recipes come through as Food Network recipes carrying real condition rankings and chef attribution.

---

## What every button does

This is the answer to "where does that explanation show up" — read from the current `HomeScreen.jsx`, `MealprepCarousel.jsx`, `TabBar.jsx`, and `App.jsx` route table.

### Home

| Label | Goes to | What happens on tap |
|---|---|---|
| **Best & Worst Choices** (tall lavender button) | `/app/suggestions` | Navigates to the Best & Worst Choices screen — Top Dos & Don'ts, Food Groups, and Best Recipes tabs. This is the tallest of the three buttons; it's the app's primary destination. |
| **Meal Planner** (forest-green card) | `/app/plan` | Navigates to the meal planner (Day view / Week view / Saved recipes). |
| **Food & Nutrient Lookup** (yellow card) | `/app/search` | Navigates to the single search screen covering foods, recipes, nutrients, and herbal supplements. |
| **"See all"** (top-right of the carousel label) | `/app/recipes` | Navigates to the full, browsable recipe list. |
| **A carousel card** (tap anywhere on the card) | No navigation — opens an overlay | Opens the flip-card food/detail view for that item on top of Home. The card seeds instantly with what the carousel already has (name, image), then enriches in the background via `buildRecipeDetail`; every carousel card is a plain food or lifestyle item, never a recipe. Drag down or tap outside to dismiss and return to Home underneath. |
| **Save icon** (top-right corner of a carousel card) | No navigation | Toggles the item's saved state. Since carousel items are foods/lifestyle entries, not recipes, tapping this always shows the "not available for save because it is an ingredient" toast rather than saving — see Saving, above. |

### Bottom tab bar

| Label | Route | What that screen is for |
|---|---|---|
| **Plan** | `/app/plan` | The meal planner: a 7-day strip, four recipe slots per day, regenerate/shuffle controls, and a saved-recipes tab. |
| **Search** | `/app/search` | Food & Nutrient Lookup — one query box, results sectioned into Foods / Recipes / Nutrients / Herbal Supplements. |
| **Home** | `/app/home` | The hub — one tap to the three sections above, plus the recommendation carousel. |
| **Choices** | `/app/suggestions` | Best & Worst Choices — the reference section: ranked Dos & Don'ts, food-group detail pages, and top-ranked recipe rails, organized by the user's conditions. |
| **Profile** | `/app/profile` | Conditions, calorie target, medications, allergies, and dietary preferences — the inputs that drive every recommendation elsewhere in the app. |
