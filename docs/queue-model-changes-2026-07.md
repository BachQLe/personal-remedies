# Queue Model — Necessary Changes & DB Verification

*Companion to the deck `Remedi-Meal-Guidance-Not-Planning.pptx`. Prepared July 2026. Captures the product decision (queues over calendar), the code changes it implies, and the database verification done this pass.*

## The decision

The meal-plan idea is delivered as **queues, not a calendar**. Other planners create value by helping people *organize* meals across days (their moat is the dated grid + grocery list). Remedi creates value by *telling people what to eat* for their conditions. A calendar adds friction our (already-motivated, condition-driven) user never asked for, and it's the seam where tracker behavior sneaks back in. Mealime is the model: subtract until it's a suggestion.

This preserves Mory's "the meal plan is the vehicle" — the recommended set is still the product spine. We only remove the dates underneath it.

## Necessary code changes (for Claude Code)

1. **Retire the calendar/scheduler surface.** The repo currently ships a weekly, dated plan: `src/state/dailyPlan.js` is actually a `WeeklyPlan` (7 dated days), driven by `ensurePlanForWeek()` / `regenerateWeek()` in `src/api/planBuilder.js`, with UI in `src/screens/plan/DayStrip.jsx`, `ScheduleSheet.jsx`, `SchedulerView.jsx`, `planDates.js`. Replace the day-strip/scheduler with five persistent **queues** (one per `PLAN_SLOTS` entry: breakfast, lunch, dinner, snacks, beverages), each a short list ranked by condition tier, with a shuffle/refresh action. No dates, no 7-day window.
2. **Keep** the recommended set as the delivered "plan," recipe-forward for lunch/dinner (`recipeLead` in `config.js`), and keep the **daily calorie total** (`estimatePlanDayCalories` in `src/api/calorieNeeds.js`) — reframed as "today's recommendation total," not a tracked day.
3. **Wire queues to the tagged candidate pools** already built: `flaggedPoolAcrossGroups()` in `adapter.js` reads `isSnack`/`isBeverage` from the overlay. No new fetching.
4. **Simplify persistence**: collapse the dated `days: {YYYY-MM-DD}` map to per-slot queue state. Migrate existing `dailyPlan` blobs.

## Database verification (done this pass)

Verified against `src/data/cache/`:

- **Local cache is correct and complete.** Three bundled tables load with zero runtime network via `src/api/localTables.js`: **1,485 items**, **271 conditions**, **28 groups**. No duplicate item IDs, no overlay keys pointing at missing items.
- **Snack/beverage tagging extended to cover all real candidates.** The generator `scripts/flag-snack-beverage.mjs` previously only tagged fine groups `h1`/`h2`/`d`/`c3` (218 items). Dairy (`g1`) and breads/grains (`f`) held obvious snacks and beverages with **no tags**. Added conservative, name-based rules:
  - Dairy → beverage: the milks, buttermilk, chocolate milk, kefir (excludes condensed/evaporated — baking ingredients).
  - Dairy → snack: all cheeses, cottage cheese, yogurt.
  - Breads → snack: crackers, granola bars, bread sticks, melba toast, rice crisps.
  - Breads → beverage: rice milk.
  - Correctly left untagged: butter, sour cream, whipped cream, half & half, light cream, whey, condensed/evaporated milk.
  - Existing exclusions preserved (Honey, Molasses, Jams, Jellies, Frostings, Pie crust, Puff pastry, Dessert toppings) — a food *group* isn't a meal category.
- **New total: 262 tagged items** (up from 218). Generator is reproducible and idempotent; hand-curated overrides still live in `src/data/cache/itemOverlay.json` (currently empty) and always win over the generated layer.

Re-run the tagging anytime with: `node scripts/flag-snack-beverage.mjs`

## Open flag for Mory

Recipes still carry **no calories/serving field** (`Recipe` typedef in `src/api/types.js`; `recipeDetail.js` notes the API has none). So any day total that includes a recipe is partial — `estimatePlanDayCalories` marks recipes `uncounted` rather than fabricating a number. Decision needed: either source recipe-level calories (NIH recipes ship them — see the meal-planning-apps research doc) or accept partial totals labeled as such.
