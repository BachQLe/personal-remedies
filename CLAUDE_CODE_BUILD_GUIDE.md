# Build Guide — Chronic-Condition Meal Planner (PWA)

**For Claude Code (Sonnet). White, Cal-AI-style UI. Built in separate jobs to keep each session small, cheap, and accurate.**

---

## 0. How to use this document

This is split into **7 jobs**. Run each as its **own Claude Code session**, in order. Do not try to build everything in one session — that's how the agent loses the plot and burns tokens.

**Workflow per job:**
1. Start a fresh session on a new branch: `git checkout -b job-N-name`
2. Paste the repo's `CLAUDE.md` (Section 4 below) + that job's brief + the referenced spec section.
3. Let it build to the job's **Acceptance criteria**.
4. `git commit` when criteria pass, merge to main, then start the next job.

**Why this order:** Job 0 builds the design system, shared components, and the mock API. Every later job only *composes* those — so each feature session is small, stays on-brand automatically, and never needs to see the other jobs' code. That's the token + accuracy win you asked for.

**Run order:** 0 → 1 → 2 → 3 → 4 → 5 → 6. Job 0 is mandatory first; the rest are independent after it.

---

## 1. The design system (Cal AI, in white)

The look is taken directly from the Cal AI screenshots: **pure white canvas, soft-shadowed rounded cards, big confident numbers, small grey labels, tinted-icon squares, circular rings, pill chips, a bottom tab bar with a single floating round button.** Generous whitespace. Nothing dense.

### Palette

| Token | Hex | Use |
|---|---|---|
| `canvas` | `#FFFFFF` | Page background |
| `app-bg` | `#F7F7F8` | App shell behind white cards (subtle grey) |
| `card` | `#FFFFFF` | All cards/surfaces |
| `primary` | `#1B3A2D` (Forest Green) | FAB, primary buttons, active tab, key accents — **this replaces Cal AI's black** |
| `ink` | `#1A1A1A` | Primary text |
| `muted` | `#6B7280` | Secondary text / labels |
| `hairline` | `#ECECEE` | Borders, dividers |
| `gold` | `#C9973A` | Secondary accent, sparing highlights |

> **Brand bridge (recommended):** Cal AI uses pure black for its primary/FAB. We swap in **Forest Green `#1B3A2D`** (the Personal Remedies brand color) so the app reads as clean-Cal-AI *and* stays on-brand. If you'd rather go strict Cal AI, use `#0A0A0A` instead — but green is the call.

### Signal / category accent colors (repurposed from Cal AI's macro icons)

| Token | Hex | Meaning |
|---|---|---|
| `helpful` | `#34A853` | Food is helpful for the profile (green) |
| `avoid` | `#E5573F` | Food to avoid (coral/red — Cal AI's protein color) |
| `accent-amber` | `#E89B3B` | Grains/category motif (Cal AI's carbs color) |
| `accent-blue` | `#4A90D9` | Fish/fats motif (Cal AI's fats color) |

These color the food-category cards (Vegetables=green, Fish=blue, etc.) and the helpful/avoid signals. **They are never numeric scores** — see Section 2.

### Shape, depth, type

- **Radii:** cards `rounded-3xl` (24px); inner chips/inputs `rounded-2xl` (16px); pills & FAB `rounded-full`.
- **Shadow:** soft and low. Cards: `shadow-[0_2px_14px_rgba(0,0,0,0.04)]`. FAB: `shadow-[0_6px_20px_rgba(27,58,45,0.28)]`.
- **Padding:** cards `p-5`/`p-6`; screen gutters `px-5`; card gaps `gap-3`/`gap-4`.
- **Font:** **Satoshi** (already in the brand kit — weights 400/500/700/900). Use it for everything. Big numbers = 700–900, tight tracking (`tracking-tight`). Headers `text-2xl`/`text-3xl` bold. Labels `text-sm` muted medium. Load via Fontshare or self-host.
- **Gradient bars** (progress only) may use inline JSX `style` with `rgba` + degree gradients, e.g. `style={{ background: 'linear-gradient(90deg, rgba(52,168,83,1) 0%, rgba(201,151,58,1) 100%)' }}`.

---

## 2. CRITICAL translation note — read before any UI

We are copying Cal AI's **look, not its features.** Cal AI is a calorie tracker; this app is the opposite. Every job brief repeats these, but internalize them now:

**DO NOT build (these are Cal AI features we deliberately reject):**
- ❌ Calorie counts, macro tracking (protein/carbs/fats grams), calorie goals
- ❌ Food logging, diet diaries, "recently logged/uploaded"
- ❌ Streaks, badges, flame counters, gamification
- ❌ Weight tracking / progress charts
- ❌ A single **"Health Score X/10"** or any aggregate eat/don't-eat number

**The health-score gauge is the #1 thing NOT to clone.** The clinical engine returns *direction* (helpful / harmful per condition), not a magnitude — so any "7/10" number would be invented, and invented clinical numbers won't pass Medical Director sign-off. **Instead, show:**
- **Condition-match tags** ("Helpful for: Diabetes, Hypertension")
- **Counts** ("12 helpful foods · 3 to avoid")
- **Study references** behind each recommendation (the real credibility engine)

When you'd reach for a Cal-AI score bar, reach for tags + a reference count instead.

**What we keep from Cal AI:** the white aesthetic, card layouts, circular rings (for *counts*, not calories), the day strip, photo-forward food cards, the bottom-sheet detail view, pills, the tab bar + FAB.

---

## 3. Architecture & folder structure

Stack (locked): **TypeScript · Vite + React · Tailwind · React Router · PWA**. (Supabase auth/persistence and Stripe come later — stub them.)

**The keystone rule: every screen reads data only from `src/api/api.ts`.** No component hardcodes data, no component calls a real backend. `api.ts` is a mock that returns the *shape we hope the Personal Remedies API exposes*. When Mory confirms the real API, we implement it behind the same interface and no screen changes. This is what lets us build the whole app now, before the API is confirmed.

```
src/
  api/
    types.ts          # all shared TS types
    mockData.ts       # realistic fake data
    api.ts            # interface + mock implementation (THE adapter)
  components/         # shared primitives — built ONLY in Job 0
  screens/
    onboarding/       # Job 1
    dashboard/        # Job 2
    mealplan/         # Job 3
    recipes/          # Job 4
    lookup/           # Job 5
    settings/         # Job 6
  theme/tokens.ts     # mirrors tailwind.config
  routes.tsx
  App.tsx  main.tsx
tailwind.config.js
public/manifest.json  public/icons/
CLAUDE.md
```

### The mock API contract (build in Job 0, in `api/`)

```ts
// types.ts (abridged — Job 0 fleshes out)
export type Condition = { id: string; name: string };
export type Profile = {
  conditions: Condition[];          // up to 3
  medications: string[];
  allergies: string[];
  dietary: string[];                // 'vegetarian' | 'halal' | ...
  tasteLikes: string[];
  tasteDislikes: string[];
};
export type FoodSignal = 'helpful' | 'avoid' | 'neutral';
export type Food = {
  id: string; name: string; photo: string; category: string;
  signal: FoodSignal;
  matchedConditions: string[];      // conditions this helps (drives tags)
  referenceCount: number;           // drives "see the studies"
};
export type Reference = { source: string; year?: number; url?: string };
export type Recipe = {
  id: string; title: string; photo: string; sourceName: string; // taste-quality proxy
  matchedConditions: string[];
  ingredients: { name: string; signal: FoodSignal; matchedConditions: string[] }[];
};
export type LookupResult =
  | { known: true; food: Food; perCondition: { condition: string; signal: FoodSignal }[] }
  | { known: false; query: string };
export type DayPlan = {
  date: string;
  meals: { slot: 'Breakfast'|'Lunch'|'Dinner'|'Snack'; items: Food[]; recipes: Recipe[] }[];
};

// api.ts — mock implementation, async, ~200ms simulated latency
export const api = {
  getProfile():               Promise<Profile | null>,
  saveProfile(p: Profile):    Promise<void>,
  getSwipeDeck():             Promise<Food[]>,            // for taste calibration
  getTopFoods(p: Profile):    Promise<{ helpful: Food[]; avoid: Food[]; byCategory: Record<string, Food[]> }>,
  getMealPlan(p: Profile, date: string): Promise<DayPlan>,
  getRecipes(p: Profile, filters?): Promise<Recipe[]>,
  getRecipe(id: string):      Promise<Recipe>,
  getReferences(foodId: string, condition: string): Promise<Reference[]>,
  lookupFood(query: string, p: Profile): Promise<LookupResult>,   // returns {known:false} for unknowns
};
```

Mock data should be domain-real: conditions (Type 2 Diabetes, Hypertension, CKD…), helpful foods (salmon, broccoli, blueberries, lentils, spinach, walnuts…), avoid foods (processed meats, high-sodium soups…), references (e.g. "Am J Clin Nutr, 2019", "NIH/NIDDK"). Make `lookupFood` return `{known:false}` for at least one input (e.g. a branded snack) so the unknown state is testable.

---

## 4. `CLAUDE.md` — drop this in the repo root; every session loads it

```md
# Project rules — read before writing any code

PRODUCT: A meal-planning PWA for people managing multiple chronic conditions.
It gives the user the most helpful foods + recipes for their health profile, with
the studies behind each recommendation. It is NOT a calorie tracker.

AESTHETIC: White / Cal-AI style. Pure white canvas, soft-shadow rounded-3xl cards,
big Satoshi numbers, grey labels, tinted-icon squares, circular rings, pill chips,
bottom tab bar + one Forest-Green floating round button. Use the tokens in
tailwind.config.js / src/theme/tokens.ts. Primary color = Forest Green #1B3A2D.

NEVER BUILD (Cal AI features we reject): calorie counts, macros/grams, food logging,
"recently logged", streaks, badges, flame counters, weight tracking, or any
"Health Score X/10" / aggregate eat-don't-eat number. The engine gives helpful/harmful
DIRECTION only — show condition-match tags, counts, and study references instead.

DATA: Every screen reads ONLY from src/api/api.ts (a mock). Never hardcode data in a
component. Never call a real backend. Keep all types in src/api/types.ts.

SHARED CODE: Reuse components in src/components/. Do not modify shared components,
tokens, or types unless the current job says to. If you need a new shared primitive,
say so before adding it.

QUALITY: TypeScript strict. Mobile-first (390px). Accessible tap targets (≥44px).
Commit when the job's acceptance criteria pass.
```

---

# THE JOBS

Each block below is a self-contained brief. Copy it (plus `CLAUDE.md` and the named spec section) into a fresh Claude Code session.

---

## JOB 0 — Foundation (do this first, everything depends on it)

**Goal:** Project scaffold, design tokens, the full shared component library, and the mock API. No feature screens yet — just the toolkit + a "kitchen sink" route that renders every component so you can eyeball the design system.

**Build:**
1. Vite + React + TS + Tailwind + React Router. Strict TS. Satoshi font loaded.
2. `tailwind.config.js` + `src/theme/tokens.ts` with the full palette/radii/shadows from Section 1.
3. `src/api/types.ts`, `src/api/mockData.ts`, `src/api/api.ts` exactly per Section 3 (async, ~200ms latency, realistic chronic-condition data, one unknown-food case).
4. **Shared components** in `src/components/` (all white/Cal-AI styled):
   - `Card`, `PrimaryButton`, `SecondaryButton`, `Pill`, `SearchInput`, `EmptyState`
   - `StatRing` (SVG circular progress, thick stroke — used for **counts**, e.g. "12 helpful")
   - `ConditionTag` (tinted chip), `SignalChip` (helpful/avoid icon+label)
   - `CategoryCard` (tinted-icon square + label + count → category of foods)
   - `FoodCard` (rounded photo + name + condition-match tags + chevron)
   - `RecipeCard` (photo + title + source name + tags)
   - `Stepper` (qty +/−), `BottomSheet` (slide-up sheet)
   - `StudyReferences` (expandable list of `Reference[]`, fetched via `getReferences`) — the credibility component, reused everywhere
   - `DayStrip` (horizontal S–S week selector, Cal-AI style; selectable; dot if a plan exists)
   - `SwipeDeck` (Tinder-style like/dislike card deck)
   - `StepProgress` (onboarding step indicator)
   - `TabBar` (bottom nav: **Home · Plan · Recipes · Profile**) + `FAB` (center, Forest Green, label "Check a food")
5. A `/kitchen-sink` dev route rendering one of each component with mock data.
6. `routes.tsx` with placeholder routes for every screen; `App.tsx` shell with `TabBar` + `FAB`.
7. PWA basics: `manifest.json`, app icons placeholder, installable.

**Acceptance:** `npm run dev` boots; `/kitchen-sink` shows every component on-brand (white, rounded, soft shadows, green primary, Satoshi); `api.ts` returns mock data incl. one unknown-food result; TabBar + FAB render; TS strict passes; no calorie/score/logging UI anywhere.

**Do not:** build any feature screen, add any health-score/calorie/streak component, or hardcode data outside `mockData.ts`.

---

## JOB 1 — Onboarding & Profile capture
**Spec:** v3 §5.1. **Consumes:** `getSwipeDeck`, `saveProfile`, `getProfile`.

**Goal:** A clean multi-step onboarding that builds the `Profile`, one question per screen, Cal-AI calm.

**Screens (use `StepProgress` at top of each):**
1. Conditions — searchable multi-select, **max 3**, chosen ones as `ConditionTag` chips.
2. Medications — searchable add/remove list.
3. Allergies & intolerances — searchable add/remove.
4. Dietary restrictions — toggle pills (Vegetarian, Vegan, Halal, Kosher, + cultural).
5. **Taste calibration** — `SwipeDeck`: like/dislike ~12 food cards, ~10 seconds. Dislikes weighted heaviest (note in code). Skippable.
6. Done → save via `saveProfile` → route to Dashboard.

**UX:** big header + short helper line per step; large tap targets; Forest-Green "Continue" pinned bottom; back arrow; progress persists if you go back.

**Acceptance:** all 5 steps complete and persist a `Profile` (in-memory/Supabase-stub); max-3-conditions enforced; swipe deck records likes/dislikes; finishing lands on Dashboard with the profile available.

**Do not:** ask for calories, weight, activity level, or anything the engine can't use. No account/payment screens (stub auth later).

---

## JOB 2 — Dashboard / Home
**Spec:** v3 §5.2. **Consumes:** `getProfile`, `getTopFoods`.

**Goal:** The home screen = "what should I be eating?" Repurpose Cal AI's home layout onto helpful foods.

**Layout (top→bottom):**
- Header: logo + greeting. Active condition chips (`ConditionTag`). **No streak/flame.**
- Hero card: "Your top helpful foods" with a `StatRing` or count badge showing **"N helpful · M to avoid"** (counts, not calories).
- **Category row** (replaces Cal AI's macro cards): `CategoryCard`s — Vegetables, Fruits, Nuts & Seeds, Fish, etc. — each tinted, with a count, tapping into that category's foods.
- **"Most helpful for you"** list: `FoodCard`s (photo, name, condition-match tags, `StudyReferences` expand). This is the repurposed "recently logged" list — but it's *recommendations*, not logs.
- **"Foods to avoid"** collapsible section, `avoid`-colored.
- FAB → Lookup (Job 5).

**Acceptance:** dashboard pulls `getTopFoods(profile)` and renders categories + helpful list + avoid section; every food shows condition-match tags and a working "see the studies" expand; counts shown, **no score/calorie number**; empty/loading states handled.

**Do not:** add logging, calories, macros, streaks, or a health-score gauge.

---

## JOB 3 — Meal Plan (calendar view)
**Spec:** v3 §5.2/§5.3. **Consumes:** `getMealPlan`, `getReferences`.

**Goal:** A weekly meal plan the user navigates by day. Calendar-style, Cal-AI clean.

**Layout:**
- Top: `DayStrip` (the Cal AI day selector) — tap a day to load its plan. Default = today. A subtle dot marks days with a plan.
- Optional: a compact **month grid** toggle for jumping dates (keep it lightweight — week strip is primary).
- Selected day: meal sections **Breakfast / Lunch / Dinner / Snack**, each a `Card` with recommended foods + recipe suggestions (`FoodCard` / `RecipeCard`), all condition-approved and taste-ranked.
- Each item: condition-match tags + "see the studies" expand. Tap a recipe → recipe detail (Job 4's `BottomSheet`/screen).
- A quiet reassurance line per day: "Every item matched to your profile." **No daily calorie/macro total.**

**Acceptance:** day strip switches days and reloads `getMealPlan(profile, date)`; four meal slots render with approved items; recipes open detail; studies expand works; nothing shows calories or a daily score.

**Do not:** add calorie totals, macro sums, or a "day score." Keep the month grid minimal — don't build a full scheduling calendar.

---

## JOB 4 — Recipe Suggestions
**Spec:** v3 §5.3 + §5.4. **Consumes:** `getRecipes`, `getRecipe`, `getReferences`.

**Goal:** Browse condition-approved recipes (knowledgebase only — no third-party recipe source) and view a recipe detail modeled on Cal AI's Nutrition screen — **minus the health score.**

**Screens:**
- List/grid of `RecipeCard`s: photo, title, **source name** (e.g. "NYT Cooking" — this is the taste-quality signal), condition-match tags. Filters: meal type, condition emphasis.
- Recipe detail (`BottomSheet` or full screen, Cal-AI Nutrition layout): big food photo top; title; **Ingredients** list where each ingredient shows a `SignalChip` (helpful/neutral) + which conditions it helps; `StudyReferences` per ingredient-condition. Save / dismiss actions (optional, never required).
- **Where Cal AI shows "Health Score 7/10," show instead:** "Matched to your profile" + the helpful ingredients highlighted + a reference count. No number.

**Acceptance:** recipes load and filter; only condition-approved recipes appear; detail shows ingredients with signals + per-ingredient studies; source name shown as taste proxy; **no health-score bar, no calories/macros**; save/dismiss work.

**Do not:** pull from Edamam or any external recipe API; add ratings/stars; add a health score or macro panel.

---

## JOB 5 — Food Lookup
**Spec:** v3 §5.5. **Consumes:** `lookupFood`, `getReferences`.

**Goal:** Type a single food → is it helpful or to avoid for *my* conditions, with the studies. The FAB destination. Built thin.

**Screen:**
- `SearchInput` for a food/ingredient.
- Known result: a clear verdict header (Helpful / Avoid / Mixed) using signal colors, a **per-condition breakdown** (chips: "Diabetes → helpful", "CKD → avoid"), and `StudyReferences`.
- **Unknown result** (`{known:false}`): friendly `EmptyState` — "We don't have data on this one yet." No guessing, no fabricated verdict.

**Acceptance:** searching a known food shows verdict + per-condition + studies; searching the seeded unknown food shows the honest empty state; reachable from the FAB.

**Do not:** invent a verdict for unknown foods; add a numeric score; pull external data. Keep it minimal — this is the smallest screen.

---

## JOB 6 — Studies polish, Settings, PWA & QA
**Consumes:** everything; **touches** shared `StudyReferences`, adds Settings.

**Goal:** Tighten the credibility component, add profile editing, finalize PWA, full pass.

**Build:**
- Polish `StudyReferences`: clean expandable, source + year, external-link affordance, graceful "references available on request" if a pair has none.
- **Settings/Profile screen** (the Profile tab): edit conditions/meds/allergies/dietary, re-run taste swipe, sign-out stub, a disabled "Upgrade" placeholder (paywall deferred — do not build pricing logic).
- PWA: finalize `manifest.json`, real icons, installability, offline shell for static assets.
- QA pass: every screen on-brand and white; consistent radii/shadow/spacing; loading + empty states everywhere; mobile (390px) clean; **global check — zero calories, macros, logging, streaks, or health-score numbers anywhere**; TS strict clean.

**Acceptance:** profile editable end-to-end; PWA installs; references component solid; full app demoable start→finish on mock data; guardrail sweep passes.

**Do not:** build Stripe/pricing logic, food delivery, multi-user profiles, or social features.

---

## 5. After the build

- When Mory confirms the API shape, implement the real layer **behind `api.ts`** — screens don't change. (If it's "Shape B" — per-food lookup only — the reconciliation/iteration lives in `api.ts`, still behind the same functions.)
- Then wire Supabase (auth + profile persistence) and, only once usage justifies a paywall, Stripe.
- Keep the mock as the test/demo backend so the app stays demoable without the real API.
