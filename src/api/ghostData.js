/**
 * ghostData — placeholder datasets used to render screens in "ghost" (skeleton)
 * mode while real data loads. Shapes mirror what the API returns so each screen
 * renders its real layout exactly; the `.rm-ghost` CSS handles the masking.
 *
 * Photos use a transparent 1×1 pixel so the <img> branch renders (and is then
 * hidden by the ghost CSS, revealing each tile's neutral placeholder box).
 */

import { todayKey } from '../screens/plan/planDates.js';

// transparent 1×1 png
const PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const CONDS = ['Type 2 Diabetes', 'Hypertension (high blood pressure)', 'High cholesterol'];

export const GHOST_PROFILE = {
  conditions: CONDS,
  medications: [],
  allergies: [],
  dietary: [],
  tasteLikes: [],
  tasteDislikes: [],
};

const word = (n) => 'placeholder'.slice(0, Math.max(4, n));

function makeRecipe(i) {
  return {
    id: `ghost-recipe-${i}`,
    title: ['Mediterranean grain bowl', 'Herb-roasted salmon', 'Lentil soup', 'Berry oat parfait', 'Garden stir fry', 'Avocado toast'][i % 6],
    photo: PX,
    sourceName: 'Personal Remedies',
    mealType: ['Breakfast', 'Lunch', 'Dinner', 'Snack'][i % 4],
    matchedConditions: CONDS.slice(0, 1 + (i % 3)),
    ingredients: Array.from({ length: 4 }, (_, j) => ({
      name: word(6),
      signal: j % 2 === 0 ? 'beneficial' : 'neutral',
      matchedConditions: CONDS.slice(0, 1),
    })),
  };
}

// ── RecipesScreen.getRecipes shape ──────────────────────────────────────────
export const GHOST_RECIPES = Array.from({ length: 6 }, (_, i) => makeRecipe(i));

// ── MealQueueScreen dailyPlan (WeeklyPlan) shape ─────────────────────────────

let _planN = 0;

/** A slot's worth of ghost PlanItems (ids unique across all slots). */
const ghostSlot = (count) =>
  Array.from({ length: count }, () => {
    _planN += 1;
    return {
      id: `ghost-plan-${_planN}`,
      name: word(9),
      image: PX,
      group: '',
      fineGroup: '',
      tier: null,
      numericId: null,
      kind: 'food',
    };
  });

/** One day's worth of ghost slots — same shape as a real PlanDayState. */
const ghostDay = () => ({
  generation: 0,
  offsets: { breakfast: 0, lunch: 0, dinner: 0, snacks: 0, beverages: 0 },
  slots: {
    breakfast: ghostSlot(3),
    lunch: ghostSlot(3),
    dinner: ghostSlot(3),
    snacks: ghostSlot(2),
    beverages: ghostSlot(2),
  },
  eaten: [],
  pinned: [],
});

// Only today needs real ghost content — the Plan screen defaults its day
// pager to today, and ghost mode is only ever active before the very first
// build resolves (so no other day can be selected yet). Keyed by the REAL
// local today (not a fixed placeholder date) so the pager's lookup of
// `displayPlan.days[selectedKey]` actually hits this entry.
export const GHOST_PLAN = {
  version: 2,
  conditionsKey: '',
  conditionNames: CONDS.slice(0, 2),
  generation: 0,
  days: { [todayKey()]: ghostDay() },
};
