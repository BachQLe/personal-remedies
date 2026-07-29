# Demo Run Sheet — Weekly Zoom w/ Mory (CEO)

**Date:** 2026-07-15 · **Format:** screen share, browser tabs only, no slides · **Dev server:** `npm run dev` → `http://localhost:5173`

Your two worry spots — CACHING and RECIPES — get the longest sections below, with lines scripted word-for-word. Everything else is click path + 1-2 talking points.

---

## Before the call

Do all of this before you dial in.

1. `npm run dev` — start the dev server.
2. **Blank white screen?** Kill duplicate vite processes and restart. This is a known issue, not a code bug — check for more than one vite server running on the port.
3. Complete onboarding once (if not already) so a real profile exists — you need a saved profile for /app/plan and /app/profile to have data to show.
4. Click through every tab once (Home, Profile, Plan, Suggestions → top/groups/recipes, Search, Recipes) to pre-warm the cache. Do this *before* the call so the cache demo shows populated keys, not empty ones.
5. Open Chrome DevTools on the app tab now (Cmd+Opt+I). Dock it to the side. Pre-select the Application tab so you're not fumbling mid-call.
6. Zoom the browser to ~125-150% (Cmd+) so text reads on a shared screen.
7. Pre-open tabs in this exact order (use the order below — it matches the run of show):

| # | Tab | URL |
|---|---|---|
| 1 | Home | `/app/home` |
| 2 | Profile | `/app/profile` |
| 3 | Plan | `/app/plan` |
| 4 | Suggestions — Top | `/app/suggestions?tab=top` |
| 5 | Suggestions — Groups | `/app/suggestions?tab=groups` |
| 6 | Suggestions — Vegetables detail | `/app/suggestions/group/e` |
| 7 | Suggestions — Recipes | `/app/suggestions?tab=recipes` |
| 8 | Recipes | `/app/recipes` |
| 9 | Search | `/app/search` |
| 10 | DevTools on the app tab (Application + Network panels) | — |
| 11 | `docs/food-network-recipes.md` rendered | https://claude.ai/code/artifact/5182517e-bab0-482f-92b3-f2b195d1081c |
| 12 | `docs/medlineplus-recipes.md` rendered | https://claude.ai/code/artifact/1fe315b5-747f-4875-b1af-0377c62f23d4 |
| 13 | `docs/vendor-analysis.md` rendered | https://claude.ai/code/artifact/f2e831c6-57c2-45d7-adca-8f95c3d35d57 |

---

## Discussion agenda (from Mory's Jul 9 email + your asks)

| # | Item | Owner | Where it's covered below |
|---|---|---|---|
| 1 | Handling snacks | Mory asked | Segment 3 (Plan) — built, show live |
| 2 | Handling beverages | Mory asked | Segment 3 (Plan) — built, show live |
| 3 | Additional recipes to add | Mory asked | Recipes segment (docs) |
| 4 | Vendor/competitor analysis (5 providers) | Mory asked | Segment 10 (vendor-analysis doc) |
| 5 | Presentation of the meal plan + user interaction | Mory asked | Segment 3 (Plan) — ask for his feedback live, don't just demo and move on |
| 6 | Pick 3 additional conditions for the trial key | You ask Mory | Raise at end — he offered to pick, key currently only scores 203 (Aging) / 244 (Pneumonia) |
| 7 | Timing on nutrition-facts table | You ask Mory | Raise at end — he promised to pass it over, no ETA yet |
| 8 | Full backlog, sequencing | You ask Mory | Raise at end — needs his prioritization call |

---

## Run of show (order + time budget)

| # | Segment | Tab | Budget |
|---|---|---|---|
| 1 | Warm open | Home | 1 min |
| 2 | Profile — condition dropdown | Profile | 2 min |
| 3 | Plan — 5-slot meal plan | Plan | 4 min |
| 4 | Top Dos & Don'ts | Suggestions (top) | 2 min |
| 5 | Groups → group detail page | Suggestions (groups) | 2 min |
| 6 | Food card flip — conditions tiering | any card | 2 min |
| 7 | Search → segue | Search | 1 min |
| 8 | **CACHING** | DevTools | 6-8 min |
| 9 | **RECIPES** | docs | 6-8 min |
| 10 | Vendor analysis | docs | 2-3 min |
| 11 | Discussion agenda items 6-8 | — | 3-5 min |

Total ~33-38 min.

---

## 1. Warm open — Home

Click path: land on `/app/home` (already open).

Say: "Let's start where we always do — this is the homepage you already gave the thumbs up on. Nothing changed here since last week, I just want it as our anchor point before I show you what's new."

---

## 2. Profile — condition dropdown

Click path: `/app/profile` → open the condition select.

Say: "You asked for the condition list to be built by accessing a table in a database, not hardcoded. Here's the dropdown — it's a native select, and every option in it comes live from the `/healthconditions` API call. Full list, alphabetized, nothing typed in by us."

Say: "One caveat — our trial API key only returns scored data for two conditions right now: Aging and Pneumonia. The full list populates and is selectable, but scoring elsewhere in the app only lights up for those two until the key is upgraded. That's the ask I have for you later — pick 3 more conditions to add to the key."

---

## 3. Plan — 5-slot meal plan

Click path: `/app/plan` → point at each slot → hit shuffle/regenerate on one slot.

Say: "This is the meal plan screen — five slots: breakfast, lunch, dinner, snacks, beverages. That's a direct answer to your ask about snacks and beverages — both are in, both are live."

Say: "Lunch and dinner lead with actual recipes, not just ingredient names. Every slot pulls from the Nutridigm API based on your selected conditions."

Say: "Each slot has its own shuffle — regenerate just that meal without blowing up the rest of the plan."

Say: "I want your live feedback on this one — does this layout make sense to you as a user, or would you rearrange anything?" *(pause here — this is the "ask his feedback live" agenda item, don't skip past it)*

---

## 4. Top Dos & Don'ts

Click path: `/app/suggestions?tab=top`.

Say: "Top Dos & Don'ts — capped at 20 items, subheading reads 'For your individual profile,' and we dropped the rank numbers you didn't like."

---

## 5. Groups → group detail page

Click path: `/app/suggestions?tab=groups` → tap Vegetables → lands on `/app/suggestions/group/e`.

Say: "This is the 'new page instead of a huge menu' change you asked for. Tap a group, land on its own page with Eat and Avoid lists. The group description text itself is coming from the API, not written by us."

---

## 6. Food card flip — conditions tiering

Click path: tap any food card → it flips to show the back face.

Say: "Flip any card and you get 'Conditions in your profile' with a good, lousy, or neutral tier per condition."

Say: "Deliberately no nutrition facts or study citations here — the API doesn't give us that data, so we don't fabricate it. Recipes only show condition interactions, nothing else. That's an honesty rule we're holding to across the whole app."

---

## 7. Search → segue into caching

Click path: `/app/search` → run one search.

Say: "That's current search. Now — the thing that makes all of this feel instant instead of laggy is caching, and that's backend, so let me actually show you where it lives instead of just telling you about it."

---

## 8. CACHING (the backend one — script every click)

This is not visible UI, so the whole point of this segment is proving it exists by opening DevTools and pointing at real entries. Go slow.

### Opening line

Say: "Last week you asked us to cache the list of conditions, the list of items, and the images. I want to show you that this isn't just a claim — it's sitting right here in the browser, and I can prove it's working in three ways."

### Step 1 — Local Storage: the cached dictionaries

Click path: DevTools → **Application** tab → **Local Storage** → `http://localhost:5173` → type `remedi.cache.v1` in the filter box.

Say: "Every key you see here starts with `remedi.cache.v1` — that's our namespace so we never collide with anything else the browser stores. These three are the ones you asked for by name."

Click path: scroll to / click the `fooditems`, `healthconditions`, and `foodgroups` entries; click one open to show the JSON value.

Say: "This one is the full food item table. This one is the condition list — the same dictionary that feeds the dropdown I showed you on the profile screen. This one is food groups. These are cached client-side so we're not re-fetching the entire table every time you open the app."

Click path: scroll further to show a `suggest` or `topdoordonts` keyed entry.

Say: "And these are the actual suggestion responses — per-profile results, also cached, so a repeat visit doesn't cost us another API call."

### Step 2 — Network tab: almost nothing fires

Click path: DevTools → **Network** tab → type `nutridigm` in the filter → hard reload (Cmd+Shift+R) → then click Home → Suggestions (top) → Plan in the app itself.

Say: "Now watch the network panel while I click through the app. Filter's set to `nutridigm` — that's our API. Home... Guidance... Plan... You're seeing almost nothing fire. The screens are rendering from the cache, not from a live round-trip. If something's stale, it refreshes quietly in the background — you never see a loading spinner for it."

### Step 3 — Cache Storage: the images

Click path: DevTools → **Application** tab → **Cache Storage** → expand `unsplash-images`.

Say: "This is the images cache you asked for. Every food photo the app has shown gets stored here by the service worker so we're not re-downloading the same image from Unsplash every time. 200 images, 30-day expiry — plenty for how much content we're showing."

### Step 4 — Offline closer (do this last)

Click path: DevTools → **Network** tab → throttling dropdown → **Offline** → click around the app (Home, Plan, a group detail page).

Say: "And here's the proof it's real, not just fast — I'm going to go fully offline." *(switch to Offline)* "Watch — the screens still render. That's the cache doing the work, not the network."

**Immediately after this step:** flip throttling back to **Online**. Say: "Okay, back online" — don't leave the call in offline mode.

### What's cached, TTL, and why

| Cached | TTL | Why this TTL |
|---|---|---|
| Food items dictionary | 24h | Rarely changes; a daily refresh is plenty and keeps us off quota |
| Food groups dictionary | 24h | Same — static reference data |
| Health conditions dictionary | 24h | Static reference data; also the source for the profile dropdown |
| Top Dos & Don'ts | 8h | Profile-scoped, changes more often than dictionaries but not minute-to-minute |
| Suggest results | 8h | Same — personalized, refreshed a few times a day |
| Detailed / good-for lookups | 8h | Same tier as suggest |
| Recipes | 8h | Same tier as suggest |
| References | 7 days | Citations/source data, changes essentially never |
| Food images | 30 days / 200 entries (PWA service worker, Workbox CacheFirst) | Photos never change once assigned; long TTL, capped entry count so storage doesn't grow forever |
| Fonts | 1 year (service worker) | Static assets, effectively immutable |

### Why it matters (business framing, use if he asks "why bother")

Say: "Two reasons this isn't just a nice-to-have. One — our trial API key has a daily request cap and only two authorized conditions right now, so every cached call is a call we don't burn against that limit. Two — it's the direct thing you asked for last meeting: cache the conditions list, the items list, and the images. This is us doing exactly that."

---

## 9. RECIPES (the other one — docs, not app)

Don't read the tables line by line. Present method → top highlights → overlap → the decision you need from him.

### Opening line

Say: "This is two documents, not a feature in the app yet — I want your call on what to greenlight before we touch the knowledgebase."

### Doc 1 — Food Network recipes

Click path: open https://claude.ai/code/artifact/5182517e-bab0-482f-92b3-f2b195d1081c.

**Present the method first, not the list:**

Say: "Two lists of 50, both real Food Network recipes with verified URLs — nothing invented. List one is their own dietitian-curated 'healthy' collections — Ellie Krieger, registered dietitian, is behind a lot of it. List two is their most-popular / fan-favorite collections — what people actually search for, verified individually since Food Network blocks bulk scraping of those pages."

**Top 5 highlights — pick a handful, don't scroll the whole table:**

Say: "A few examples so you get the flavor. From the healthy list: Pan-Seared Salmon with Kale and Apple Salad — heart-healthy, omega-3. Healthy White Bean and Kale Soup — 10g fiber, 4g fat. From the popular list: Ina Garten's Perfect Roast Chicken, over 1,400 five-star reviews, and it's actually reasonably healthy too. Baked Feta Pasta — the TikTok-viral one, 600 million-plus views on that hashtag. Alton Brown's Good Eats Roast Turkey — Food Network's single most-reviewed recipe ever."

**Overlap with what already exists:**

Say: "Here's the part that matters for scope — we already carry about 14 Food Network recipes in the Nutridigm knowledgebase, under food group L, and they're already scored per condition through `/suggest`. These 100 are candidates to expand that same catalog, not a new system."

**The decision you're asking for:**

Say: "What I need from you is a greenlight call — which of these, or how many, do you want added to the knowledgebase. The healthy list maps well onto what our API already scores best — fish, legumes, vegetables, whole grains. The popular list is what users will actually search for by name. I'd lean toward doing both, but the volume and sequencing is your call."

### Doc 2 — MedlinePlus recipes

Click path: open https://claude.ai/code/artifact/1fe315b5-747f-4875-b1af-0377c62f23d4.

**Licensing bottom line first — and it's good news:**

Say: "The headline here is good news. MedlinePlus's own written reuse policy explicitly lists 'Healthy recipes' as public domain — we can reproduce them freely with one attribution line: 'Courtesy of MedlinePlus from the National Library of Medicine.' No license fee, no negotiation."

Say: "Their third-party recipe provider turns out to be Food Hero — foodhero.org, a SNAP-Ed program run by Oregon State University Extension, USDA-funded. Food Hero supplies about 85% of MedlinePlus's recipes; the rest come from NHLBI, which is NIH itself, so no third party at all on those."

Say: "One open question before we reuse at scale: the Food Hero content is authored by Oregon State — a state university, not federal — and nothing published spells out that rights chain. My recommendation is a quick confirmation email to Food Hero or NLM before we ingest in bulk. Low effort, low-to-moderate risk."

**Presentation-style learnings second:**

Say: "On presentation — MedlinePlus organizes recipes as 16 flat category tiles. No search, no filters, no condition tagging at all. That's exactly the gap our per-condition scoring fills. The federal gold-standard health site doesn't do what we do — that validates the market gap, it doesn't threaten us."

Say: "Full recommendation is in the doc — happy to walk through it live or let you read it after the call, your call."

---

## 10. Vendor analysis (Mory's ask #4 — docs, not app)

Click path: open https://claude.ai/code/artifact/f2e831c6-57c2-45d7-adca-8f95c3d35d57.

Headlines first, not a read-through — same rule as recipes.

Say: "Last one — the vendor analysis you asked for: five providers, what they do well, what they don't, pricing, and how they reach prospects. Four headlines and then it's all in the doc."

Say: "One — the two leaders in condition-driven meal planning both died. PlateJoy shut down in 2025, Season Health got absorbed in April 2026. The niche we're building in is wide open right now."

Say: "Two — nobody in the set treats snacks and beverages as first-class plan slots. We just built exactly that — you saw it on the Plan screen twenty minutes ago."

Say: "Three — the gold-standard interaction pattern is Eat This Much's regenerate, shuffle, and lock. Our Plan screen already follows it, so we're matching the best UX in the category, not inventing an unproven one."

Say: "Four — pricing clusters at 3 to 15 dollars a month direct-to-consumer, but the condition-driven players were payer-funded B2B2C. Long term that's the highest-leverage channel for us."

---

## Discussion agenda — items to raise (end of call)

Say these near the end, after the two big segments and the vendor recap:

1. **Additional conditions for the key:** "You offered to pick 3 more conditions to add to our trial key beyond Aging and Pneumonia — can we lock those in this week? It unblocks scoring across the rest of the app."
2. **Nutrition-facts table:** "You mentioned passing over a nutrition-facts table — any timing on that? It's the one gap in the honesty rule we're holding everywhere else."
3. **Backlog sequencing:** "I've got a full backlog building up — recipes, additional conditions, nutrition facts, plus whatever comes out of today. Can we take 5 minutes to sequence it so I know what's next?"

---

## If asked / gotchas

| If Mory asks / notices | Say |
|---|---|
| "Why does [condition X] show no data?" | Trial key only authorizes conditions 203 (Aging) and 244 (Pneumonia) right now — everything else in the dictionary is listed but not yet scorable. That's the ask for 3 more conditions. |
| Plan screen shows a "Demo data" badge | That means the live API call fell back to sample data for that slot — usually a transient rate limit or an unauthorized condition. Not a bug, it's the honesty fallback working as designed. |
| "Where are the nutrition facts / calorie counts?" | By design, nowhere. The API doesn't supply verified nutrition data, so we don't show any rather than guess. Same honesty rule that keeps studies off the recipe cards. |
| "Is the caching actually doing anything or is this a mockup?" | That's exactly what the offline demo (Segment 8, step 4) proves — pull the network and the app still renders. |

---

*Prepared 2026-07-15 for Bach's weekly Zoom call with Mory. No slides — this run sheet plus the three doc artifact links are the only materials needed.*
