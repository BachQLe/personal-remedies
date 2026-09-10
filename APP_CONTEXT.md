# Remedi App — Planning Reference

> Generated 2026-07-01, updated 2026-07-02 after the API-hardening/recipes/profile-sync refactor. Use this doc to brief Opus on the codebase without reading every file.
> Stack: React 19 + Vite + React Router v7 + Framer Motion + Tailwind + Supabase

---

## Setup required

- `.env`/`.env.local` needs: `VITE_NUTRIDIGM_SUBSCRIPTION_ID` (app fails fast with a console error and `NutridigmConfigError` on any API call if unset — see `IS_CONFIGURED` in `src/api/config.js`), plus `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (auth/sync silently disable, not a hard failure, if unset — see `isSupabaseConfigured`). Copy `.env.example` as a starting point.
- Supabase dashboard: Auth → URL Configuration needs **Site URL** set to your app origin, and **Redirect URLs** must include `<origin>/auth/callback` for every origin used (dev + prod). Auth → Providers → **Google** must be enabled with a Client ID/Secret.
- Run both migrations in `supabase/migrations/` (SQL editor or `supabase db push`): `20260624000000_init_schema.sql` (base schema) then `0002_profile_app_state.sql` (adds `conditions int[]`/`preferences jsonb`/`library jsonb`/`daily_plan jsonb` to `profiles` for the client-side sync — see [Profile Sync](#profile-sync-supabase---srcapiprofilesyncjs)).

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Routing & Auth](#routing--auth)
3. [Onboarding Flow](#onboarding-flow)
4. [App Screens](#app-screens)
5. [Global State](#global-state)
6. [API & Data Layer](#api--data-layer)
7. [Shared Components](#shared-components)
8. [Layout Components](#layout-components)
9. [Top-Level Components](#top-level-components)
10. [Design System](#design-system)
11. [Static Data & Utilities](#static-data--utilities)
12. [Marketing Pages](#marketing-pages)

---

## Architecture Overview

Remedi is a food-as-medicine mobile-first PWA (max-width 430px) that maps the user's health conditions to food recommendations using the Nutridigm API. The app is split into:

- **Marketing site** — public-facing pages at `/`, `/about`, `/science`, etc.
- **Onboarding** — profile builder at `/onboarding`
- **App** — gated by onboarding; bottom-tab navigation at `/app/*`
- **Daily Picks** — standalone full-screen flow at `/onboarding/daily-picks`

Phone layout is enforced via `max-w-[430px]` and `AppShell` with `pb-28` bottom padding. A `PhoneFrame` wrapper (toggle `Cmd+Shift+P`) shows the app in a browser-side phone mockup.

---

## Routing & Auth

### Route Map

```
/                         → Landing page (Hero, Pricing, CTAs)
/login                    → Email magic-link + Google OAuth
/auth/callback            → Supabase OAuth redirect handler
/survey                   → Marketing questionnaire (not tied to profile)
/providers /developers /science /about /news /contact /terms /privacy

/onboarding               → Profile builder (conditions picker)
/onboarding/daily-picks   → Daily Picks full-screen flow (no TabBar)

/app/home                 → HomeScreen (AppShell with TabBar)
/app/search               → SearchScreen
/app/suggestions          → SuggestionsScreen
/app/plan                 → MealQueueScreen
/app/profile              → ProfileScreen
```

### Auth Flow

Provider: Supabase (`src/lib/supabase.js`, `isSupabaseConfigured` gates a null client when env vars are missing). `AuthContext` wraps the entire app and calls `initProfileSync()` (see [Profile Sync](#profile-sync-supabase---srcapiprofilesyncjs)) once on mount.

- `signInWithEmail(email)` → `supabase.auth.signInWithOtp()` (passwordless)
- `signInWithGoogle()` → OAuth redirect, redirectTo `/auth/callback`
- `signOut()` → `supabase.auth.signOut()`
- Session restored via `getSession()` on mount + `onAuthStateChange` subscription
- Context exposes: `user`, `loading`, `signInWithEmail`, `signInWithGoogle`, `signOut`

**`AuthCallback.jsx` fix:** the OAuth redirect exchange (`detectSessionInUrl`) happens asynchronously, so a single `getSession()` call on mount could previously race it and return `null` even right after a successful Google sign-in, bouncing the user back to `/login`. Fixed by listening for `onAuthStateChange`'s `SIGNED_IN`/`SIGNED_OUT` events AND polling `getSession()`, resolving on whichever fires first, with an 8s (`TIMEOUT_MS`) fallback to `/login` if neither fires.

### Onboarding Gate

`RequireOnboarding` HOC reads `profile` from localStorage synchronously. Redirects to `/onboarding` if missing (prevents auth flash). After profile saved, goes to `/app/home`.

---

## Onboarding Flow

**File:** `src/components/onboarding/index.jsx`

Single `OnboardingPage` with 2 sequential steps. Transitions via Framer Motion opacity fade (0.4s, ease `[0.22, 1, 0.36, 1]`).

### Step 0 — RemediWelcome (`src/components/onboarding/RemediWelcome.jsx`)

Animated word-by-word reveal (y:-12px+blur(4px) → visible). Timing: `INITIAL_DELAY=0.6s`, `WORD_IN=0.4s`, `WORD_STEP=0.085s gap`, `BEAT=0.45s pause`. Respects `prefers-reduced-motion`. Tap anywhere skips animation. "Set up my profile" button appears after sequence completes.

### Step 1 — ProfileBuilder (`src/components/onboarding/ProfileBuilder.jsx`)

- Top bar (tan bg-paper-200): back arrow + "Build your profile" (Quantico 16px, slides down from `y:'-100%'`)
- Bottom bar: back button + "Show my top foods!" (slides up); disabled until `conditions.length > 0`
- Central blue form area (`#BBCEFF`) with `ConditionsPanel` nested inside
- On submit: calls `api.saveProfile({ conditions, allergies, dietaryPattern, religiousRestriction })` → navigates to `/app/home`

**ConditionsPanel (nested in ProfileBuilder):**
- Search matches on `description` OR any Nutridigm-provided `AKA` alias (semicolon-separated, e.g. "AUD" for Alcohol Use Disorder) from the `/healthconditions` dictionary. `conditionSynonyms.js` is now a fallback-only backstop for terms the API's own AKA field doesn't cover.
- Empty query → full alpha-sorted condition list from `api.getConditions()`
- Results card: frosted glass (`rgba(255,255,255,0.22)`), rounded-t-24px
  - "IN PROFILE" section: selected chips with close icons
  - Scrollable available conditions list; each row's `longDescription` (truncated) renders as sub-text when present
  - Loading: 7-row staggered skeleton loaders
- Closed state: 3 horizontal boxes (aspect-[4/5]) — filled (white bg, condition name) or empty (dashed border, + Add)
- Click empty box → opens search; click filled → removes condition

**Profile state shape:** `{ conditions: number[], allergies: [], dietaryPattern: 'omnivore', religiousRestriction: 'none', medications: [] }`. `conditions` is Nutridigm `healthConditionID[]` (numeric) — see [Condition IDs](#condition-ids-vs-names) below.

---

## App Screens

### HomeScreen — `/app/home`
**File:** `src/screens/home/HomeScreen.jsx`

Two-zone layout: forest-300 header (greeting, search bar, profile button) + paper-100 shell (2-column quick-action cards, dismissable Discovery banner → daily-picks, MealprepCarousel). SearchScreen consumed as inline overlay (`active`/`onClose` props). No API calls on mount.

### MealprepCarousel
**File:** `src/screens/home/MealprepCarousel.jsx`

Horizontal infinite-scroll 3D-tilted carousel. Fetches via `getRecommendations('breakfast'|'lunch'|'dinner', offset, count)`. Velocity-driven `rotateY` tilt (MAX_TILT=20°, SMOOTH=0.18). Auto-advances every 6.4s. Teleports scroll position between copies at edges. Opens `RecipeDetailCard` on tap via `buildRecipeDetail(card)`.

---

### DailyPicksScreen — `/onboarding/daily-picks`
**File:** `src/screens/dailyPicks/DailyPicksScreen.jsx`

Multi-phase meal-picking flow (dark blue bg). No TabBar.

**Phases:**
1. `loading` — word-by-word reveal, 8.5s min wait; fetches 12 recs/slot for all MEAL_SLOTS in background
2. `ready` — fork icon + "We found X options. Let me see!" button
3. `picking` — swipeable `MealStepCards` grid (3 cards/page, drag-up to advance page); `StepBar` progress
4. `overview` — `ConfirmationOverview` with all selected picks

**Saving:** `saveDailyPlan(selections)` on "Build my plan" tap.
**Auto-fill:** Remaining slots filled with top-ranked recs if user doesn't pick manually.
**Animation:** Framer Motion `snappySlide`/`snappyVertical` spring transitions. `AnimatedMealWord` morphs meal slot label.
**Local state:** `phase`, `mealIndex`, `cardPage`, `picksBySlot`, `allRecsBySlot`, `saving`, `direction`, `swipeAxis`

**Sub-components:**
- `ConfirmationOverview` — read-only bottom sheet grouped by slot; staggered entrance; auto-filled badge
- `MealSection` — per-slot fetcher with "+ more options" pagination
- `MealStepCards` — 3 large colored cards (green/yellow/blue); `popLayout` AnimatePresence for selection reflow
- `RecommendationCard` — ranked card with TierBadge (Top/Strong/Good), ref count, matched conditions
- `Recap` — pinned bottom panel for selected picks (used in plan context, not DailyPicks main flow)

---

### PlanScreen — `/app/plan` (renders MealQueueScreen)
**File:** `src/screens/plan/MealQueueScreen.jsx`

Dual-panel (Meal Queue + Cookbook) with foods/beverages toggle. Fetches queue/library via `getQueue`/`getLibrary` subscriptions. Queue shows 4 items (PAGE_SIZE=4, CHUNK=16). Snackbar with undo on item removal (`insertIntoQueue` undo). `FoodImageCard` grid (4/5 aspect, tier badge, check/plus actions).

**Also in `/app/plan`:**
- `PlanScreen.jsx` — week-navigation meal plan; calls `buildMealPlan(profile)` per day; `WeekStrip` + `DayStrip`; `Confetti` on initial load; 5 meal sections (Breakfast/Lunch/Dinner/Snack/Beverages); `RecipeCard` with `context="planner"`; food cards open `SwapSheet` (healthier same-fine-group swaps via `getAlternatives`, tier-filtered `/suggest`) for a one-tap ingredient swap

---

### RecipesScreen — `/app/recipes` (accessible from nav)
**File:** `src/screens/recipes/RecipesScreen.jsx`

2-column recipe grid backed by **real recipes**: `api.getRecipes(profile)` fetches Nutridigm fine food group `'l'` (~14 condition-ranked Food Network recipes) via `/suggest`. Ghost mode (skeleton) while loading, `GHOST_RECIPES` as loading placeholder only (not a permanent mock — real data replaces it once `getRecipes` resolves). Fetches profile via `api.getProfile()`; falls back to a demo `[203, 244]` profile if none saved. Filters: meal type pills (best-effort `mealType` guess from title keywords), condition dropdown (resolved display names via `getConditionNames`), text search. `DemoDataChip` shown when `usedFallback` is true. Tapping a recipe opens `RecipeDetail`; since `getRecipes` doesn't return a per-ingredient breakdown, `buildRecipeIngredients(recipe, profile)` (recipeDetail.js) enriches it on open with real `assessFood`/`/topdoordonts` data. `EmptyState` on no results.

---

### SearchScreen — `/app/search`
**File:** `src/screens/search/SearchScreen.jsx`

Fullscreen overlay (fixed inset, z-30). Props: `active`, `onClose`, `name`. Debounced search (300ms) via `searchFoodsAndRecipes(query, profile)`. Animated padding top: idle (3vh) → center (26vh) → results (9vh). Recent searches via `getRecentSearches`/`addRecentSearch`. `FoodDetail` and `RecipeDetail` sheets on result tap.

---

### SuggestionsScreen — `/app/suggestions`
**File:** `src/screens/suggestions/SuggestionsScreen.jsx`

Two sticky tabs: **Best & Worst** and **Recipe Picks**.

- **Best & Worst:** `getSuggestions(profile)` + `getWorstFoods(profile)` → `IngredientCarousel` (3D-tilted, velocity-tilt, edge fade) per group. Jump-to dropdown. "See list view" opens the list-view sheet (drag-to-dismiss, threshold 100px) inline in this file, which shows "N studies" trust signals: the top 3 rows are warm-loaded via `warmReferenceCount` (max 3 network calls), the rest read cache-only via `getCachedRefCount` (never triggers a fetch — renders nothing if not yet cached). Tapping a category opens `CategoryDetailSheet` (`src/screens/suggestions/CategoryDetailSheet.jsx`) — a `/detailed`-backed drill-down with a Helpful/Neutral/Harmful segmented control; only the active tab is fetched, on demand, 8h-cached; no tier badges (list membership is the verdict).
- **Recipe Picks:** Slot dropdown → `getRecommendations(slot, 0, 9)` → 9 recs. Skeleton loaders.
- `IngredientCarouselCard` has bookmark toggle (addToLibrary / removeFromLibrary). `onSelectFood` opens `FoodDetail`.

---

### ProfileScreen — `/app/profile`
**File:** `src/screens/profile/ProfileScreen.jsx`

Mirrors HomeScreen layout (forest-300 header + paper-100 shell). Fetches profile + `getCategoryTopPicks()` (mock, 8 picks). `CategoryCarousel` (autoAdvance) + inline editor: `ConditionsEditor` (searchable, adds/removes conditions), `MacroGoalsStub` (disabled), `SubEditRow` buttons for Medications/Allergies/Dietary (open `BottomSheet` sub-editors). Save via `api.saveProfile()`. AuthContext provides `user`/`signOut`.

**Sub-components:**
- `CategoryCarousel` — 3D-tilted; taps navigate to `/app/suggestions?category=${categoryId}`; 6.4s auto-advance; edge fade bars
- `SwipeDeck` — Tinder-style food preference; drag threshold 80px; returns `onComplete(likes[], dislikes[])`

---

## Global State

All state persists to `localStorage` via `src/api/storage.js` (namespaced under `remedi.v1`). Three pub/sub modules in `src/state/`:

### library.js — Saved ingredients
- Storage key: `library`
- `getLibrary()` → `Food[]` | `addToLibrary(food)` | `removeFromLibrary(foodId)` | `clearLibrary()`
- `subscribeLibrary(callback)` → unsubscribe fn (fires immediately + on change)
- Food shape: `{ id, name, image?, group?, tier?, referenceTotal? }`

### queue.js — Meal queue
- Storage key: `queue`
- `getQueue()` | `addToQueue(item)` → bool (false if duplicate) | `removeFromQueue(id)` | `insertIntoQueue(item, index)` (undo) | `clearQueue()`
- `subscribeQueue(callback)` → unsubscribe fn

### recentSearches.js — Search history
- Storage key: `recentSearches`, max 8 entries
- `getRecentSearches()` → `string[]` (newest first, deduped case-insensitive)
- `addRecentSearch(term)` | `clearRecentSearches()`
- No pub/sub

### Profile (in `api/api.js`)
- Storage key: `profile`
- `api.getProfile()` / `api.saveProfile(p)` / `api.clearProfile()`
- Shape: `{ conditions: number[], dietary?: string[], allergies?: string[], medications?: string[] }`
- Also cached in `_profile` memory variable
- **`conditions` is `number[]` of Nutridigm `healthConditionID`s** (not display-name strings — that was a bug in earlier builds). `api.getProfile()` runs a one-time silent migration (`migrateProfileConditions`): if any entry in a stored profile's `conditions` is a string, it resolves each name → `healthConditionID` via a case-insensitive match against the cached `/healthconditions` dictionary (`api.getConditions()`), drops unmatched entries, and persists the migrated numeric array back to storage. Numeric profiles pass through untouched. Display names are resolved on demand via `getConditionName(id)`/`getConditionNames(ids)` (adapter.js), never stored.

### Daily Plan (in `recommendations.js`)
- Storage key: `dailyPlan`
- `saveDailyPlan(selections)` / `getDailyPlan()`
- Shape: `{ date: ISO string, selections: Recommendation[] }`

---

## API & Data Layer

### Nutridigm Raw Client — `src/api/nutridigm.js`

`request(endpoint, params)` — appends `subscriptionID`, treats HTTP 220 as empty (null), 401 as `NutridigmAuthError` (with `.code` — `NOTAUTHORIZEDHEALTHID` or `APIDAILYLIMITREACHED`), 400 as Error. Throws `NutridigmConfigError` fast (before any fetch) when `VITE_NUTRIDIGM_SUBSCRIPTION_ID` is unset (`IS_CONFIGURED` in config.js) — distinct from `NutridigmAuthError` so the demo-condition fallback doesn't try to "retry" a missing key. In-flight requests are de-duped by full URL (`_inFlight` map in nutridigm.js): concurrent calls to the same endpoint+params share one network request/promise.

**All 8 endpoints are wired** (previously 7 — `/detailed` was unused):

| Endpoint | Purpose |
|----------|---------|
| `GET /healthconditions` | All conditions |
| `GET /fooditems` | Full food dictionary |
| `GET /foodgroups` | Group definitions — powers real category labels via `getGroupLabels`/`getGroupLabel` |
| `GET /goodfor?foodItemID=X&healthConditionID=Y` | Single food assessment vs conditions |
| `GET /topdoordonts?healthConditionID=X&consumeOrAvoid=(consume\|avoid)&limit=N` | Top/worst foods |
| `GET /suggest?healthConditionID=X&fineFoodGroup=B1` | Same-group recommendations; also powers alternatives/swaps and real recipes (fine group `l`) |
| `GET /detailed?healthConditionID=X&coarseFoodGroup=E&listType=(helpful\|neutral\|harmful)` | Category deep-dive — powers the category explorer (`getCategoryDetail`, `CategoryDetailSheet`) |
| `GET /references?healthConditionID=X&foodItemID=Y` | Citations for food+condition pair |

### Config — `src/api/config.js`

- `NUTRIDIGM_BASE_URL` — env `VITE_NUTRIDIGM_BASE_URL` or default AWS endpoint
- `NUTRIDIGM_SUBSCRIPTION_ID` — env `VITE_NUTRIDIGM_SUBSCRIPTION_ID`
- `IS_CONFIGURED` — `true` once the subscription ID is set; gates fast-fail in `nutridigm.js`
- `DEFAULT_DEV_CONDITIONS` — `[203, 244]` (fallback when auth fails)
- `EXCLUDED_COARSE_GROUPS` — `['j', 'x', 'l']` (non-food items filtered everywhere; `'l'` recipes are excluded from food listings but fetched separately by `getRecipes`)
- `COARSE_GROUP_LABELS` — code → label map (e.g., `'b': 'Meat, Fish & Poultry'`). **Demoted to an offline fallback** — `getGroupLabel`/`getGroupLabels` (adapter.js), sourced from live `/foodgroups`, is now the source of truth for both coarse and fine group labels.
- `MEAL_SLOT_MAP` — fine group → meal slot (e.g., `'h2': 'Beverages'`)

### Cache — `src/api/cache.js`

Persistent localStorage cache (namespace `remedi.cache.v1.`, schema-versioned) with stale-while-revalidate semantics, sitting on top of an in-memory `Map` so repeat calls in the same session skip `JSON.parse`. `cachedFetch(key, ttlMs, fetcher)`: fresh entry → return cached, no network; stale entry → return stale immediately + background revalidate (de-duped); missing/version-mismatched → await fetcher, persist, return. `peekCache(key)` reads without ever triggering a fetch (used by `getCachedRefCount`). Deliberately separate from `storage.js` (different namespace) so cache writes never fire `storage.js`'s `onWrite` hook / profileSync push.

TTLs: dictionaries (fooditems/foodgroups/healthconditions) 24h; topdoordonts/suggest(recipes)/detailed 8h; references 7d (citations are static curated data).

### Adapter — `src/api/adapter.js`

| Function | Returns | Notes |
|----------|---------|-------|
| `searchFoods(query, profile)` | `Food[]` (max 50) | Client-side filter on cached food dictionary |
| `assessFood(foodId, profile)` | `Assessment\|null` | Calls `/goodfor` + `/references` per condition via `Promise.allSettled` (see [References honesty](#references-honesty)) |
| `getSuggestions(profile)` | `SuggestionsResult` | Top "consume" foods by category via `/topdoordonts` |
| `getWorstFoods(profile)` | `SuggestionsResult` | Top "avoid" foods by category via `/topdoordonts` |
| `getAlternatives(foodId, profile)` | `Food[]` | Same-group substitutes via `/suggest` (top 10); powers `SwapSheet` |
| `getCategoryDetail(profile, coarseGroup, listType)` | `{ items: Food[], usedFallback }` | `/detailed` helpful/neutral/harmful drill-down; no tier (list membership is the verdict) |
| `getRecipes(profile)` | `{ recipes: Recipe[], usedFallback }` | **Real recipes** — `/suggest` on fine food group `'l'` (~14 condition-ranked Food Network recipes); see [Recipes are real](#recipes-are-real) |
| `getConditionName(id)` / `getConditionNames(ids)` | `string` / `string[]` | Resolves `healthConditionID` → display name via cached `/healthconditions` |
| `getConditionIdByName(name)` | `number\|null` | Reverse lookup (case-insensitive) |
| `getFoodIdByName(name)` | `number\|null` | Reverse lookup against the food dictionary |
| `getGroupLabels()` / `getGroupLabel(code)` | `{coarse,fine} Maps` / `string` | Real labels from `/foodgroups`; falls back to `COARSE_GROUP_LABELS` only if the API/cache is unavailable |
| `getCachedRefCount(foodId, conditionIds)` | `number\|null` | Reads `/references` totals from cache only — **never** makes a network call; `null` if any pair isn't cached yet |
| `warmReferenceCount(foodId, conditionId)` | `Promise<number\|null>` | Eagerly fetches+caches one food+condition reference count (network call, rate-limit-aware caller responsibility) |
| `buildMealPlan(profile, libraryItems?)` | `DayPlan` | Daily meal slots; 2000 cal target |
| `getConditions()` | `HealthCondition[]` | Cached in memory after first fetch |
| `getFoodGroups()` | `FoodGroup[]` | Cached in memory after first fetch |
| `getFoodDictionary()` | `Food[]` | Cached; excludes groups j/x/l |

**`withConditionFallback(conditionIds, fn)`** centralizes the `NOTAUTHORIZEDHEALTHID` retry: calls `fn(conditionIds)`; on that specific auth error, retries once with `DEFAULT_DEV_CONDITIONS` and returns `{ result, usedFallback: true }`. Every profile-driven adapter function (`assessFood`, `getSuggestions`, `getWorstFoods`, `getCategoryDetail`, `getAlternatives`, `getRecipes`, `buildMealPlan`) routes through this, so `usedFallback` propagates consistently to the UI (`DemoDataChip` renders on affected screens: RecipesScreen, SuggestionsScreen, PlanScreen, DailyPicksScreen). **Does not** retry on `APIDAILYLIMITREACHED` (quota exhaustion — a different condition set won't help) or any other error type — those rethrow as-is.

### Recommendations — `src/api/recommendations.js`

Specialized for Daily Picks. Transforms meal-plan foods into `Recommendation` shape via `buildMealPlan` (which already retries through `withConditionFallback`). Since `/topdoordonts` (the source of these foods) carries no tier data, **no fabricated tier is assigned** — `tier: null` on every recommendation, and card components treat that as "no badge" rather than defaulting to a label. `rank` still orders cards. `blurb` surfaces the real Nutridigm `notes` field (deduped/cleaned via `cleanNotes`), falling back to `food.groupLabel` when notes are empty.

- `getRecommendations(slot, offset, limit=3)` → `Recommendation[]`
- `getSlotCount(slot)` → total count for slot
- `getUsedFallback()` → whether the last load fell back to `DEFAULT_DEV_CONDITIONS`
- `saveDailyPlan(selections)` / `getDailyPlan()`

### Recipe Detail — `src/api/recipeDetail.js`

`buildRecipeDetail(card, profile)` / `buildRecipeIngredients(recipe, profile)` — assembles full recipe payload for real recipes returned by `getRecipes`. Derives per-ingredient tiers via real `assessFood()` (real tiers + citations, not fabricated). Gets complementary ingredients via `/topdoordonts` (top 10). **Cook time and steps remain placeholders** — Nutridigm has no API for either; cook time is derived from ingredient count (≤3 → 15 min, ≤5 → 25 min, >5 → 35 min) and steps are demo text.

### Ingredient Images — `src/api/ingredientImages.js`

Maps Nutridigm food names to curated Unsplash photo IDs via keyword substring matching. Group-level fallbacks. URL format: `https://images.unsplash.com/photo-{id}?w=600&q=80&auto=format&fit=crop`. ~120+ keywords.

### Ghost Data — `src/api/ghostData.js`

Placeholder data for loading states (mirrors real API shapes). Exports: `GHOST_PROFILE`, `GHOST_TOP_FOODS`, `GHOST_PLAN`, `GHOST_RECIPES`. `.rm-ghost` CSS class masks photos with transparent 1×1 PNG.

### Storage — `src/api/storage.js`

Namespaced localStorage wrapper. Root key: `remedi.v1`. Methods: `get(key, fallback)`, `set(key, value)`, `remove(key)`, `clear()`. Silent fallback to in-memory on quota/privacy errors. `onWrite(callback)` — subscribe to every `set`/`remove` across all keys (any key, not filtered); used by `profileSync.js` to trigger a debounced remote push without every call site knowing about sync.

### Profile Sync (Supabase) — `src/api/profileSync.js`

localStorage remains the synchronous source of truth; the app works fully signed-out (guest mode). For signed-in users, `initProfileSync()` (called once from `AuthContext`) hooks `storage.onWrite` for the three synced keys (`profile`, `library`, `dailyPlan`) and schedules a debounced (~2s trailing) write-through to the user's `profiles` row via `schedulePush()`/`pushNow()`. On `SIGNED_IN`, `pullProfile(user)` fetches the remote row and reconciles by **newer `updated_at` wins**: if remote is newer (same user, new device) it hydrates localStorage and notifies `src/state/` stores to reload (`reloadLibrary()`); otherwise local is pushed up — this is what **adopts a guest's local profile into their account on first sign-in** (a fresh auth-trigger row has an old `updated_at`). Never throws into callers; Supabase errors are logged once (`console.warn`) and swallowed. `splitProfile`/`joinProfile` convert between the local `profile` object and the remote row's `conditions int[]` + `preferences jsonb` columns.

**Supabase client** — `src/lib/supabase.js`: `isSupabaseConfigured` (bool, both `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set) gates a null vs real client so a missing env never crashes the app (auth/sync features just no-op).

### Type Definitions

| Type | Key Fields |
|------|-----------|
| `Food` | `id: number`, `name: string`, `group: string` (coarse), `fineGroup: string`, `tier?: Tier`, `referenceTotal?: number \| null` (null = unknown, never 0-as-unknown) |
| `Tier` | `'Top' \| 'Strong' \| 'Good'` |
| `TierOrPoor` | `Tier \| 'poor' \| null` (null = neutral, 'poor' = harmful) |
| `Profile` | `conditions: number[]` (Nutridigm `healthConditionID`s), `dietary?`, `allergies?`, `medications?` |
| `Assessment` | `food: Food`, `tier: TierOrPoor`, `perCondition: ConditionAssessment[]`, `usedFallback: boolean` |
| `ConditionAssessment` | `conditionId`, `conditionName`, `tier: TierOrPoor`, `referenceCount`, `citations: string[]`, `referenceStatus: 'ok' \| 'error'` |
| `DayPlan` | `date: string`, `meals: MealSlot[]`, `totalCalories: number`, `usedFallback: boolean` |
| `Recommendation` | `id`, `name`, `slot`, `tier: null` (topdoordonts has no tier data — never fabricated), `referenceCount`, `rank`, `blurb?` (real `notes` or groupLabel fallback), `matchedConditions?`, `image?` |
| `HealthCondition` | `healthConditionID: number`, `description`, `longDescription`, `AKA`, `ICD10` |
| `Recipe` | `id`, `foodId`, `title`, `tier: TierOrPoor`, `sourceName` (e.g. "Food Network · Ina Garten", parsed from `notes`), `matchedConditions`, `photo`, `mealType` (best-effort keyword guess) |

**Tier mapping (Nutridigm descriptionNumericID):** 1→Top, 2→Strong, 3→Good, 4→null (neutral, also the "no data" sentinel), 5/6/7→'poor'. Real tiers only exist where the API returns `descriptionNumericID` — `/suggest` and `/goodfor` paths. `/topdoordonts` and `/detailed` carry no tier field, so `Recommendation.tier` and `/detailed`-derived `Food` are never given a fabricated tier.

---

## Shared Components

**`BottomSheet`** — `open`, `onClose`, `children`, `title?`. Fixed full-screen backdrop + 85vh max-height drawer. Manages `document.body.overflow`.

**`Card`** — variants: default/flat/raised/warm/forest/lavender/plum. Padding: sm/md/lg. Props: `title`, `eyebrow`, `action`, `onClick` (adds hover lift).

**`CategoryCard`** — Category filter tile with icon + label + count. CATEGORY_CONFIG maps names to icon+colors.

**`ConditionTag`** — Props: `condition`, `onRemove?`, `solid?`, `compact?`, `truncate?`. Uses `getConditionMeta()` for icon + color.

**`EmptyState`** — Props: `icon`, `title`, `body`, `action`. Centered layout with forest-50 icon circle.

**`FoodImageCard`** — Universal full-frame image card (4/5 aspect default). Props: `id`, `image`, `badge`, `title`, `subtitle`, `action`, `actionOnClick`, `gradient`. Top-left badge (primary/success/info variant). Top-right action slot. Bottom overlay text.

**`Icon`** — Lucide icon wrapper mapping kebab-case names. Also exports `BackArrow` custom SVG component. 50+ icon keys.

**`Pill`** — Selectable chip. Props: `children`, `selected`, `onClick`. forest-700 when selected, white+sand border when not.

**`PrimaryButton`** — Full-width forest-700 CTA. Props: `disabled`, `loading` (spinner), `type`. Corner tick accent (11×11px white/60 border top-right).

**`SearchInput`** — Text input with leading search icon. Props: `value`, `onChange`, `placeholder`, `autoFocus`.

**`SecondaryButton`** — Pill-shaped outline button. white bg, sand-200 border, hover:forest-50.

**`SignalChip`** — Brand food guidance signal. Props: `signal` (beneficial/limit/avoid), `compact?`, `label?`. Full mode: h-30px pill. Compact: dot + label.

**`Skeleton`** / **`SkeletonGroup`** — Loading placeholders. Shapes: text/heading/circle/card/pill/block. `tint` prop for color variant.

**`StatRing`** — Circular SVG progress ring. Props: `value`, `max`, `label`, `sublabel`, `tone` (forest/yellow/lavender/beneficial/limit/avoid), `size` (default 96), `thickness` (default 9).

**`Stats`** — Marketing section: 3 animated counters (45K patients, 300+ conditions, 100K+ articles). Triggers on scroll into view.

**`StepProgress`** — Segmented onboarding progress bar. Props: `current`, `total`. h-1 bars, forest-700 fill.

**`Stepper`** — +/- increment control. Props: `value`, `min`, `max`, `onChange`. Forest-700 plus button.

**`StudyReferences`** — Collapsible citation list. Props: `references[]`, `loading`. "See N studies" toggle. AnimatedPanel (height 0 → scrollHeight).

---

## Layout Components

**`TabBar`** — Fixed bottom nav bar (z-40, `safe-area-bottom`, max-w-430px). 4 NavLinks: `/app/home`, `/app/search`, `/app/plan`, `/app/profile`. Active: blue-950 icon+label. Inactive: char-400.

**`FAB`** — Currently renders null (unused).

**`PhoneFrame`** — Desktop iframe phone mockup (430×932). Toggle `Cmd+Shift+P` or `?noframe` URL param. Auto-disables on window < 500px. Seed-scattered food icons, Dynamic Island, scaling logic.

**`Sidebar`** — Desktop left nav (hidden on mobile, `hidden lg:flex`). w-64, forest-900 bg. 4 NavLinks + "Check a food" CTA. Active: yellow-400 left bar + dot.

---

## Top-Level Components

**`FoodDetail.jsx`** — Bottom sheet for food assessment. `assessFood(food.id, profile)` on mount. Per-condition breakdown (name, tier, ref count, expandable `StudyReferences`). "Add to library" button. Props: `food`, `profile`, `onClose`, `onAddToLibrary`.

**`IngredientCard.jsx`** — Universal ingredient card. Props: `food`, `onAddToLibrary`, `onSelect`, `compact`. Compact: inline row. Full: card with initial circle (forest-600 bg). BookmarkPlus action.

**`LibraryStrip.jsx`** — Horizontal scrollable saved ingredients strip (72px mini-cards). `subscribeLibrary` subscription. Hover-remove button. Used on HomeScreen.

**`RecipeCard.jsx`** — Props: `recipe`, `context` ('browse'|'planner'), `onViewRecipe`, `onAddToPlanner`, `onFavorite`. Browse: calendar icon + "Add to planner". Planner: heart icon + "Add to menu" (forest-700 bg).

**`RecipeDetail.jsx`** — Context-aware bottom sheet. Props: `recipe`, `profile`, `onClose`. Hero image (h-52), metadata (prep/cook time, servings — cook time still placeholder), profile match banner (matched conditions, beneficial count), per-ingredient breakdown with signal chips + expandable studies (real citations via `assessFood`). Ingredient rows open `SwapSheet` for a healthier alternative when one exists.

**`RecipeDetailCard.jsx`** — Full-screen flip-card modal. Props: `recipe`, `open`, `onClose`. Front: full-bleed image + info panel. Back: ingredients list + numbered steps (steps still demo placeholders). Drag-to-dismiss (100px threshold). 3D flip (`preserve-3d`). Save (Bookmark) toggle. Body scroll lock.

**`SwapSheet.jsx`** (`src/components/SwapSheet.jsx`) — Bottom sheet of healthier same-fine-group swaps for a food. Props: `open`, `onClose`, `food`, `profile`, `onSwap`. Fetches `getAlternatives(food.id, profile)` (real, tier-filtered `/suggest` call) once on open, not per-card. Used from PlanScreen food cards and RecipeDetail ingredient rows. Shows `DemoDataChip` when the underlying call used the fallback conditions.

**`CategoryDetailSheet.jsx`** (`src/screens/suggestions/CategoryDetailSheet.jsx`) — Category explorer drill-down for the Best & Worst tab, backed by `/detailed` (`getCategoryDetail`). Dark drag-to-dismiss sheet titled with the real group label; segmented Helpful/Neutral/Harmful control, fetching only the active tab on demand (8h cached). No tier badges — list membership is the verdict. Tapping a row hands the food to the parent, which opens `FoodDetail`.

**`DemoDataChip.jsx`** (`src/components/shared/DemoDataChip.jsx`) — Small chip rendered when an adapter call's `usedFallback` is true (i.e. the profile's real conditions hit `NOTAUTHORIZEDHEALTHID` and the call silently retried with `DEFAULT_DEV_CONDITIONS`). Shown on RecipesScreen, SuggestionsScreen, PlanScreen/SwapSheet, CategoryDetailSheet, DailyPicksScreen.

---

## Design System

### Colors (CSS variables in `src/styles/remedy/tokens/colors.css`)

| Group | Key Stops |
|-------|-----------|
| Forest (primary action) | 50 → 950; base #B4D85C, action #4F7118 |
| Blue (ink/navy) | 50 → 950; base #5878E0, deepest #080E30 |
| Lavender (panel surface) | 50 → 950; panel #C8A8E8 |
| Charcoal (text) | 900 #211E1B, 700, 500, 400, 300 |
| Sand (borders/dividers) | 200 #E6E6E0, 100 #EEEEE9 |
| Paper (backgrounds) | 200 #F5F5F0, 100 #FAFAF8 |
| Benefit | 700 #1F6B43, 600 #2F8C5A, 100 #DCEDE2 |
| Caution | 700 #8A5D15, 600 #C98A2E, 100 #F6E8CB |
| Avoid | 700 #9E3A22, 600 #C04A2F, 100 #F6DED5 |
| Info | 600 #3F6E86, 100 #DDE8ED |

**Semantic aliases:** `--text-heading` (blue-950), `--surface-page`, `--surface-card`, `--surface-panel` (lavender), `--border-subtle` (sand-200), `--border-focus` (forest-600), `--ring-focus` (forest 35% opacity ring).

### Typography

| Variable | Font | Notes |
|----------|------|-------|
| `--font-display` | Chillax | Headings |
| `--font-sans` | Switzer | Body text |
| `--font-label` | Quantico | Uppercase UI labels |
| `--font-mono` | IBM Plex Mono | Numbers/code |

**Type scale:** display 56px, h1 40px, h2 30px, h3 23px, h4 19px, body-lg 18px, body 16px, body-sm 14px, caption 13px, label 12px.

### Shadows

`shadow-card`, `shadow-xs`, `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-sheet`, `shadow-inset`

### Motion Presets

Spring configs (Framer Motion):
- `chipSpring`: stiffness 500, damping 30
- `snappySpring`: stiffness 600, damping 38
- `settleFast`: stiffness 1100, damping 60
- Slide ease: `[0.22, 1, 0.36, 1]`
- Duration tokens: `duration-fast` 140ms, `duration-base` 240ms, `duration-slow` 400ms

### 3D Carousel Pattern (reused in 3 places)

Velocity-driven `rotateY` tilt: `MAX_TILT=20°`, `SMOOTH=0.18`, idle timeout resets to 0°. Auto-advance every 6.4s. Infinite scroll via 3 copies (teleport at edges). Edge-fade: **5 decreasing-opacity vertical bars** (never CSS gradient).

---

## Static Data & Utilities

### `src/data/conditions.js`
250+ health condition strings (A-Z); used as onboarding picker fallback when API unavailable.

### `src/data/conditionSynonyms.js`
~43 alias → canonical name mappings (e.g., `'t2d'` → `'Type 2 diabetes'`, `'hbp'` → `'Hypertension'`). **Demoted to a fallback layer** — the condition picker now matches primarily against the Nutridigm dictionary's own `AKA` field (semicolon-separated aliases returned by `/healthconditions`); this file only backstops terms the API's AKA data doesn't cover.

### `src/data/medications.js`
42 common medications + branded names (Ozempic, Humira, etc.). `medicationSynonyms` object: ~23 brand-to-generic mappings.

### `src/data/taste-probes.js`
10 diverse probe foods (Blueberry Pancakes, Shakshuka, Carbonara, etc.) for taste calibration. Each has: `id`, `name`, `cuisine`, `spice` (0–1), `plantForward` (−1 to +1), `sweetness`, `seafood`, Unsplash image URL, color hex.

`inferTasteProfile(swipes)` → `{ spiceTolerance, plantForward, sweetTooth, cuisineAffinity[], seafoodOk, confidence }`. Used in onboarding taste calibration (SwipeDeck → profile).

### `src/utils/conditionMeta.js`
`getConditionMeta(condition)` → `{ icon (material-symbols), color }`. Keyword-based routing: ~130+ regex keywords partition into allergy/disease/general categories.

### `src/hooks/useIsPhone.js`
`useIsPhone()` → boolean. Detects Android|iPhone|iPod|Opera Mini|IEMobile|WPDesktop via user agent regex.

---

## Marketing Pages

| Page | Route | Purpose |
|------|-------|---------|
| `Login.jsx` | `/login` | Email OTP + Google OAuth. States: `email`, `error`, `emailSent`, `loading` |
| `Survey.jsx` | `/survey` | 4-step questionnaire (goal, conditions, diet, age). Not tied to auth/profile. Fun facts loading state. |
| `AuthCallback.jsx` | `/auth/callback` | OAuth redirect handler — see [Auth Flow](#auth-flow) fix note below |
| `About.jsx` | `/about` | Team/mission. 12 team members. Leadership grid with initials avatars. Partners CTA band. |
| `Science.jsx` | `/science` | Credibility page. Math: 90 nutrients × 2000+ foods × 300+ conditions = impossible. 5 credibility items including US Patent No. 8504385. |
| `Providers.jsx` | `/providers` | B2B/partner page |
| `Developers.jsx` | `/developers` | API/developer program page |
| `News.jsx` | `/news` | Press/news page |
| `Contact.jsx` | `/contact` | Contact form |
| `PrivacyPolicy.jsx` | `/privacy` | Privacy policy |
| `TermsOfUse.jsx` | `/terms` | Terms of use |

---

## Key Architectural Patterns

1. **Signal tier system** — Foods ranked Top/Strong/Good/poor with distinct color tokens (benefit-600, forest-700, char-700, avoid-600). Neutral (tier=null) shown without signal chip. Tiers only exist where the API provides `descriptionNumericID` (`/goodfor`, `/suggest`); `/topdoordonts`- and `/detailed`-sourced foods never get a fabricated tier.
2. **Pub/sub state modules** — `library.js`, `queue.js` use `subscribeX(callback)` pattern; components call subscribe on mount, return unsubscribe on unmount.
3. **Memory + persistent caching** — Food dictionary, conditions, food groups cached in module-level variables after first fetch within a session, backed by `cache.js`'s persistent localStorage stale-while-revalidate layer (dictionaries 24h, topdoordonts/suggest/detailed/recipes 8h, references 7d) so repeat visits across sessions don't re-hit the daily-limited API.
4. **`withConditionFallback` (NOTAUTHORIZEDHEALTHID fallback)** — Centralized in adapter.js; any profile-driven call that hits `NOTAUTHORIZEDHEALTHID` retries once with `DEFAULT_DEV_CONDITIONS = [203, 244]` and marks the result `usedFallback: true` → `DemoDataChip` renders. `APIDAILYLIMITREACHED` is never retried (rethrown as-is).
5. **Ghost mode loading** — Loading states mirror real API shapes (`GHOST_PROFILE`, `GHOST_PLAN`, `GHOST_RECIPES`, etc.) so layout doesn't shift; `GHOST_RECIPES` is a loading placeholder only, not a stand-in for missing recipe data (recipes are real — see below). `.rm-ghost` CSS class masks photos.
6. **Bottom sheet + flip card pattern** — `BottomSheet` for sub-editors; `FoodDetail`/`RecipeDetail`/`SwapSheet`/`CategoryDetailSheet` for detail/drill-down views; `RecipeDetailCard` for full-screen 3D flip.
7. **Phase-based state machines** — Multi-step flows (DailyPicksScreen, onboarding) use an explicit `phase` string state rather than step indexes.
8. **`AppShell`** — Wraps `/app/*` routes; adds `TabBar` + FAB; enforces `max-w-[430px]` + `pb-28` to avoid tab bar overlap.
9. **Taste inference** — `inferTasteProfile(swipes)` deterministic function: swipe pass/fail on 10 probe foods → weighted cuisine affinity, spice tolerance, plant-forward score.
10. **Recipes are real** — `getRecipes(profile)` (adapter.js) fetches Nutridigm fine food group `'l'` via `/suggest` (~14 condition-ranked Food Network recipes, attribution parsed from `notes`). RecipesScreen and recipe detail views use real tiers + citations. Only steps and cook time remain placeholders (no Nutridigm API for either).
11. **Condition IDs, not names** — `profile.conditions` is `number[]` of Nutridigm `healthConditionID`s. `api.getProfile()` silently migrates any legacy name-based profile on read. Display names are always resolved on demand via `getConditionName(s)`, never persisted.
12. **Honest "unknown" over fabricated data** — `referenceTotal`/`referenceCount` totals are `null` (not 0) when a `/references` fetch failed (`Promise.allSettled` + per-condition `referenceStatus`), so the UI never implies "no studies" when it simply couldn't check.
