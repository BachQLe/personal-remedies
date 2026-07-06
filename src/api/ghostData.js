/**
 * ghostData — placeholder datasets used to render screens in "ghost" (skeleton)
 * mode while real data loads. Shapes mirror what the API returns so each screen
 * renders its real layout exactly; the `.rm-ghost` CSS handles the masking.
 *
 * Photos use a transparent 1×1 pixel so the <img> branch renders (and is then
 * hidden by the ghost CSS, revealing each tile's neutral placeholder box).
 */

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

function makeFood(i, signal = 'beneficial') {
  return {
    id: `ghost-food-${i}`,
    name: ['Spinach', 'Salmon', 'Walnuts', 'Blueberries', 'Lentils', 'Avocado', 'Oats', 'Broccoli', 'Almonds'][i % 9],
    photo: PX,
    referenceCount: 3 + (i % 5),
    signal,
    matchedConditions: CONDS.slice(0, 1 + (i % 3)),
  };
}

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

// ── HomeScreen.getTopFoods shape ────────────────────────────────────────────
export const GHOST_TOP_FOODS = {
  helpful: Array.from({ length: 9 }, (_, i) => makeFood(i, 'beneficial')),
  avoid: Array.from({ length: 3 }, (_, i) => makeFood(i, 'avoid')),
  byCategory: {
    Vegetables: Array.from({ length: 4 }, (_, i) => makeFood(i)),
    Fruits: Array.from({ length: 3 }, (_, i) => makeFood(i)),
    Proteins: Array.from({ length: 3 }, (_, i) => makeFood(i)),
    Grains: Array.from({ length: 2 }, (_, i) => makeFood(i)),
  },
};

// ── PlanScreen.getMealPlan shape ────────────────────────────────────────────
export const GHOST_PLAN = {
  meals: [
    { slot: 'Breakfast', items: [makeFood(0)], recipes: [] },
    { slot: 'Lunch', items: [makeFood(1), makeFood(2)], recipes: [] },
    { slot: 'Dinner', items: [makeFood(3)], recipes: [makeRecipe(0)] },
    { slot: 'Snack', items: [makeFood(4)], recipes: [] },
  ],
};

// ── RecipesScreen.getRecipes shape ──────────────────────────────────────────
export const GHOST_RECIPES = Array.from({ length: 6 }, (_, i) => makeRecipe(i));
