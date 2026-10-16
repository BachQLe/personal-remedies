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

## Plan screen: picks-only first-run contract (Aug 2026)
- `ensurePlanForWeek` no longer auto-fills a week from the candidate pools on a first-ever run — with no plan in storage yet it returns `{ plan: null }` immediately (zero network, zero writes). Seeding a profile alone (the `remedi.v1` snippet above) and going straight to `/app/plan` now lands on the **Day view empty state** ("No meal plan yet" — `src/screens/plan/MealQueueScreen.jsx`), NOT an auto-filled week. This is expected, not a regression.
- The empty state's secondary action is conditional: "Build from saved recipes" (skips the picker, builds straight from `getLibrary()`) only appears when the library is non-empty; otherwise it reads "Save recipes you like, then build a plan from them" with a link to `/app/recipes`.
- **Quickest scripted path to a filled plan**: open the picker (FAB, or the empty state's "Build your meal plan" CTA) → on the "Best recipes" tab, click any card's "+"/check toggle to pick at least 1 item → "Create meal plan" (disabled at zero picks, with a "Pick at least 1 to continue" helper line in place of the selected-count). Confirming lands back on Day view with a "Meal plan created" toast and only the picked items in their slots.
- 5 slots render in order: Breakfast, Lunch, Dinner, Snacks & Desserts, Beverages (`V` / cup-soda icon). The Beverages rail in the picker is item-led (few/no beverage recipes exist yet) — cards there should still render name/image/tier sanely, just without a `sourceName` subtitle.
