/**
 * config.js — environment configuration for the Nutridigm API layer.
 */

/**
 * Nutridigm API base URL.
 * Reads from VITE_NUTRIDIGM_BASE_URL or falls back to the default endpoint.
 */
export const NUTRIDIGM_BASE_URL =
  import.meta.env.VITE_NUTRIDIGM_BASE_URL ||
  'https://5jocnrfkfb.execute-api.us-east-1.amazonaws.com/PersonalRemedies/nutridigm/api/v2';

/**
 * Nutridigm subscription ID — NEVER hardcoded in source.
 * Must be set in .env / .env.local as VITE_NUTRIDIGM_SUBSCRIPTION_ID.
 */
export const NUTRIDIGM_SUBSCRIPTION_ID =
  import.meta.env.VITE_NUTRIDIGM_SUBSCRIPTION_ID || '';

/**
 * True when the Nutridigm subscription ID has been configured.
 * When false, nutridigm.js fails fast with NutridigmConfigError instead of
 * making a doomed request that would 401.
 */
export const IS_CONFIGURED = NUTRIDIGM_SUBSCRIPTION_ID !== '';

if (!IS_CONFIGURED) {
  console.error(
    '[config] VITE_NUTRIDIGM_SUBSCRIPTION_ID is not set. ' +
    'Copy .env.example to .env.local and fill in your Nutridigm subscription ID.'
  );
}

/**
 * Default dev profile conditions — the only two this demo key scores.
 */
export const DEFAULT_DEV_CONDITIONS = [203, 244];

/**
 * Fine food groups to exclude from food lists (non-food / lifestyle items).
 *
 * Filtering by FINE group (not coarse) matters: real foods like Taro leaves
 * and pork liver carry `coarseFoodGroup: 'x'` with a valid fine group, so a
 * coarse-based exclusion silently drops legitimate foods app-wide. See
 * `isExcludedItem` in adapter.js for the full (defensive) exclusion logic.
 *
 * - 'x', 'j1' = lifestyle/behavior items (Exercise, Sleep, Smoking, etc.)
 * - 'l' = recipes, which have their own surface (RecipesScreen/FoodDetailCard)
 */
export const EXCLUDED_FINE_GROUPS = ['x', 'j1', 'l'];

/**
 * Offline fallback labels for coarse food groups ONLY.
 *
 * The Nutridigm /foodgroups endpoint returns real human labels for both
 * coarse AND fine groups (see adapter.js `getGroupLabels`/`getGroupLabel`),
 * which is the source of truth used everywhere at runtime. This static map
 * exists solely as a last-resort fallback for when the API/cache is
 * unavailable (e.g. first load with no network) — do not add new consumers
 * of this map directly; prefer `getGroupLabel`/`getGroupLabels` from
 * adapter.js.
 */
export const COARSE_GROUP_LABELS = {
  b: 'Meat, Fish & Poultry',
  c: 'Eggs, Beans, Nuts & Seeds',
  d: 'Fruits & Juices',
  e: 'Vegetables',
  f: 'Breads, Grains & Cereals',
  g: 'Dairy, Fats & Oils',
  h: 'Desserts, Snacks & Beverages',
  i: 'Herbs, Spices & Prepared Foods',
  k: 'Key Nutrients & Herbal',
};

/**
 * Meal slot assignments by fine food group.
 * Used by buildMealPlan to bucket foods into meal slots.
 */
export const MEAL_SLOT_MAP = {
  h2: 'Beverages',
  h1: 'Snack',
};

/**
 * Slot-based meal plan configuration (Plan screen — /app/plan).
 *
 * Array order IS render order (breakfast → lunch → dinner → snacks). Each
 * entry:
 * - `fineGroups` — /suggest fine food groups whose /suggest results (which
 *   carry tier-bearing descriptionNumericID data, unlike /topdoordonts-free
 *   surfaces) are pooled and round-robin interleaved to fill the slot.
 * - `recipeMealType` — links to the `mealType` field on Recipe (see
 *   getRecipes()/guessMealType in adapter.js).
 * - `recipeLead` — when true, matching recipes are prepended ahead of plain
 *   foods for this slot (lunch/dinner lead with a recipe); when false they're
 *   appended (breakfast/snacks).
 * - `size` — number of items auto-filled into this slot per generation.
 *
 * The `beverages` slot was removed (July 2026, user-approved) — 4 slots
 * total now. Stale `beverages` keys may still exist in old localStorage
 * plans; nothing iterates a day's slots outside of mapping this array, so
 * they're simply never read/rendered.
 */
export const PLAN_SLOTS = [
  { key: 'breakfast', label: 'Breakfast', fineGroups: ['f', 'd', 'g1'], recipeMealType: 'breakfast', recipeLead: false, size: 3 },
  { key: 'lunch',     label: 'Lunch',     fineGroups: ['c2', 'e', 'b1'], recipeMealType: 'lunch',   recipeLead: true,  size: 3 },
  { key: 'dinner',    label: 'Dinner',    fineGroups: ['b3', 'b1', 'e'], recipeMealType: 'dinner',  recipeLead: true,  size: 3 },
  { key: 'snacks',    label: 'Snacks',    fineGroups: ['h1', 'c3'],      recipeMealType: 'snack',   recipeLead: false, size: 2 },
];

/** Slot keys in render order — `PLAN_SLOTS.map((s) => s.key)`. */
export const PLAN_SLOT_KEYS = PLAN_SLOTS.map((s) => s.key);
