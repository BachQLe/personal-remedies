/**
 * config.js — environment configuration for the Nutridigm API layer.
 *
 * Two ways to reach Nutridigm, chosen by which env vars are set:
 *
 *   - **Proxy mode** (production) — `VITE_NUTRIDIGM_PROXY_URL` points at the
 *     deployed Supabase Edge Function (`supabase/functions/nutridigm-proxy`,
 *     REMEDI_MASTER_PLAN.md §3.1/§3.2). The subscription key lives server-side
 *     as a Supabase secret and is never shipped in the client bundle; the
 *     proxy injects it and strips any client-supplied `subscriptionID`. Key
 *     rotation from here on is just `supabase secrets set
 *     NUTRIDIGM_SUBSCRIPTION_ID=<new-value>` — no client release. See
 *     docs/deploy-supabase.md "Client configuration" for setup.
 *   - **Direct mode** (local dev) — `VITE_NUTRIDIGM_SUBSCRIPTION_ID` is sent
 *     straight to `VITE_NUTRIDIGM_BASE_URL` (AWS) as a `subscriptionID` query
 *     param, same as before the proxy existed. Convenient for local dev
 *     without standing up a Supabase function; not meant for production.
 *
 * When both are set, proxy mode wins (see `nutridigm.js`'s `request()`).
 */

/**
 * Nutridigm API base URL — used only in direct mode.
 * Reads from VITE_NUTRIDIGM_BASE_URL or falls back to the default endpoint.
 */
export const NUTRIDIGM_BASE_URL =
  import.meta.env.VITE_NUTRIDIGM_BASE_URL ||
  'https://5jocnrfkfb.execute-api.us-east-1.amazonaws.com/PersonalRemedies/nutridigm/api/v2';

/**
 * Nutridigm subscription ID — NEVER hardcoded in source. Used only in direct
 * mode (ignored once `NUTRIDIGM_PROXY_URL` is set).
 * Must be set in .env / .env.local as VITE_NUTRIDIGM_SUBSCRIPTION_ID.
 */
export const NUTRIDIGM_SUBSCRIPTION_ID =
  import.meta.env.VITE_NUTRIDIGM_SUBSCRIPTION_ID || '';

/**
 * Deployed Nutridigm proxy URL (Supabase Edge Function) — production mode.
 * Reads from VITE_NUTRIDIGM_PROXY_URL. Trailing slash trimmed so
 * `nutridigm.js` can join `${NUTRIDIGM_PROXY_URL}/${endpoint}` without a
 * double slash regardless of how the env var was entered. Empty string when
 * unset, which is how `nutridigm.js` detects direct mode.
 */
export const NUTRIDIGM_PROXY_URL =
  (import.meta.env.VITE_NUTRIDIGM_PROXY_URL || '').replace(/\/+$/, '');

/**
 * True when the Nutridigm client has enough configuration to make a request
 * — either a proxy URL (production) or a subscription key (direct/dev mode).
 * When false, nutridigm.js fails fast with NutridigmConfigError instead of
 * making a doomed request that would 401.
 */
export const IS_CONFIGURED = NUTRIDIGM_PROXY_URL !== '' || NUTRIDIGM_SUBSCRIPTION_ID !== '';

if (!IS_CONFIGURED) {
  console.error(
    '[config] Neither VITE_NUTRIDIGM_PROXY_URL nor VITE_NUTRIDIGM_SUBSCRIPTION_ID ' +
    'is set. Copy .env.example to .env.local and fill in one of them ' +
    '(proxy URL for pointing at a deployed function, or a subscription ID ' +
    'for direct dev access).'
  );
}

/**
 * Default dev profile conditions — the only two this demo key scores.
 */
export const DEFAULT_DEV_CONDITIONS = [203, 244];

/**
 * Max items shown per category/direction list on the Suggestions screens —
 * Top Dos & Don'ts (per direction) and Food Groups' category detail (per
 * Eat/Avoid list). A single named constant so every list-capping call site
 * stays in sync rather than hand-rolling its own magic number.
 */
export const MAX_RECOMMENDATIONS_PER_CATEGORY = 20;

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
  j: 'Alternative Therapies & Misc.',
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
 * The `beverages` slot was removed July 2026 (user-approved) and restored
 * August 2026 (user-approved) — 5 slots total again. Stale `beverages` keys
 * from PRE-July-2026 localStorage plans were never deleted (nothing purged
 * them while the slot was gone), so they simply become readable/renderable
 * again now that this array maps a `beverages` key once more — no migration
 * needed. Conversely, days built DURING the July–August gap (the 4-slot era)
 * have no `beverages` key on `day.slots` at all — every read of
 * `day.slots.beverages` must tolerate `undefined` via `?? []` rather than
 * assume the key exists.
 */
export const PLAN_SLOTS = [
  { key: 'breakfast', label: 'Breakfast', fineGroups: ['f', 'd', 'g1'], recipeMealType: 'breakfast', recipeLead: false, size: 3 },
  { key: 'lunch',     label: 'Lunch',     fineGroups: ['c2', 'e', 'b1'], recipeMealType: 'lunch',   recipeLead: true,  size: 3 },
  { key: 'dinner',    label: 'Dinner',    fineGroups: ['b3', 'b1', 'e'], recipeMealType: 'dinner',  recipeLead: true,  size: 3 },
  { key: 'snacks',    label: 'Snacks & Desserts', fineGroups: ['h1', 'c3'], recipeMealType: 'snack',   recipeLead: false, size: 2 },
  { key: 'beverages', label: 'Beverages', fineGroups: ['h2'],           recipeMealType: 'beverage', recipeLead: false, size: 1 },
];

/** Slot keys in render order — `PLAN_SLOTS.map((s) => s.key)`. */
export const PLAN_SLOT_KEYS = PLAN_SLOTS.map((s) => s.key);

/**
 * Max number of named plan snapshots a user can keep under storage.js's
 * 'savedPlans' key (see `saveCurrentPlan`/`getSavedPlans` in planBuilder.js).
 * Enforced by BLOCKING a new save at the cap with a clear message — never
 * silently evicting the oldest save, never fabricating extra capacity.
 */
export const MAX_SAVED_PLANS = 4;
