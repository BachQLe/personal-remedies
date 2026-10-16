---
name: verify
description: Drive the Remedi app end-to-end with Playwright to verify changes at the UI surface
---

# Verify Remedi changes

## Launch
1. `pkill -f vite` first — duplicate vite servers cause the known blank-white-screen (504 Outdated Optimize Dep).
2. `npm run dev` in the background from the repo root; read output for the URL (default http://localhost:5173).

## Drive
Playwright is installed globally (resolve via `createRequire(execSync('npm root -g') + '/')`), chromium browsers are in `~/Library/Caches/ms-playwright`. Use viewport **430×800** (the app is mobile-first, max-w-[430px]).

- **Skip onboarding**: seed `localStorage.setItem('remedi.v1', JSON.stringify({ profile: { firstName, conditions: [203], allergies: [], dietaryPattern: 'omnivore', religiousRestriction: 'none', medications: [] } }))` then goto `/app/home`. Only conditions **203 (Aging)** and **244 (Pneumonia)** are scoreable on the dev Nutridigm key.
- **Full onboarding flow**: goto `/onboarding`, click mid-screen to skip the word reveal, fill the "Your first name" input (gates the CTA), then a condition slot → search → pick → "Show my top foods!".
- Routes: /app/home, /app/search, /app/suggestions (Dietary Guidance), /app/top, /app/recipes, /app/plan, /app/profile.

## Observe
- Capture console errors (`page.on('console')`) and Nutridigm API calls (`page.on('request')`, filter for topdoordonts/fooditems/references/goodfor/suggest/detailed) — call counts verify the cache/prefetch contract (topdoordonts@limit=50 should be ≤2 per session; /references ≤3 per guidance-list mount).
- API rank lists look alphabetical for single-condition profiles — that's genuine server-side tie-breaking of equal values, NOT a client sort bug (verified against the raw API July 2026).
- Transient `Failed to fetch` on first-ever goodfor can happen on cold start; retry before calling it a bug.

## Observe: request filter gotcha
- When counting Nutridigm calls with a regex like `/suggest|detailed/`, exclude `localhost` first — the dev server serves `/src/screens/suggestions/*.jsx`, which matches `suggest` and looks like 10 phantom API calls per page load.

## Plan screen: My Favorites flow (Oct 2026)
- A plan only ever comes from the user's favorites (the `library` store) or a saved week. Seeding a profile alone and opening `/app/plan` lands on the **"No meal plan yet"** empty state — expected.
- **Quickest scripted path to a filled plan**: `/app/recipes` → click several bookmark buttons (adds to My Favorites) → `/app/plan` → "Build my meal plan" (first run) or the "New meal plan" FAB → "Randomize from my favorites". Lands on today with a "Meal plan created" toast; each meal has at most 3 recipes, none repeated within a day.
- Day view has no shuffle / regenerate / pin / meal tags. Each meal ends with an "Add from favorites" tile; cards have an X (Undo in the toast). "Save day" / "Load day" sit under Beverages; "Save week" and a My Favorites link sit under the day strip.
- `/app/favorites` (My Favorites): favorite recipes (grouping `<select>`), saved days, saved weeks (tap = read-only peek with Delete).
- Condition-change pruning: set `favoritesPrunePending: true` inside the `remedi.v1` object and reload — generation and Load day/week are blocked until `FavoritesPruneNotice` re-scores and clears the flag. With conditions 203/244 nothing is ranked low, so it clears silently; exercising the notice itself needs stubbed scoring.
- 5 slots render in order: Breakfast, Lunch, Dinner, Snacks & Desserts, Beverages. Calories render as a plain `N cal` — no minus, no "~" (see `formatCalories`).
