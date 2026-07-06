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
 * - 'l' = recipes, which have their own surface (RecipesScreen/RecipeDetail)
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
