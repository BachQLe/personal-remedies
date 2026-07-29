/**
 * calorieNeeds.js — Pure calorie-estimation helpers (no UI imports).
 *
 * Remedi is explicitly NOT a calorie tracker (no logging, no streaks, no
 * per-food badges — see docs/ product decisions, July 2026). This module
 * exists solely to answer "how much should I eat" at the coarsest possible
 * grain: one estimated daily need (Mifflin-St Jeor), and one estimated total
 * for a day's recommended plan. Both numbers are meant to render ONCE, as
 * plan-level context (Phase 4, src/screens/plan/) — never as a running tally.
 *
 * Every biometric input is OPTIONAL. Every function here degrades to `null`
 * (or an explicitly partial result) rather than fabricate a number — this
 * mirrors the never-invent-data rule already enforced in
 * src/data/nutritionEstimates.js and the NutritionFacts typedef in types.js.
 *
 * @typedef {import('./types.js').Profile} Profile
 */

import { estimateNutrition } from '../data/nutritionEstimates.js';

// ── Unit conversion ──────────────────────────────────────────────────────────
// Profile objects always store metric (heightCm/weightKg) — see the Profile
// typedef in types.js — because Mifflin-St Jeor is defined in cm/kg. The UI
// collects US units (ft+in, lbs) since that's what onboarding-age US users
// expect to type, so every screen that touches these fields converts at the
// edge via the helpers below rather than storing imperial anywhere.

const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.45359237;

/**
 * Convert feet+inches to centimeters for storage on `Profile.heightCm`.
 * @param {number} ft
 * @param {number} inches
 * @returns {number} centimeters (0 if both inputs are non-numeric)
 */
export function ftInToCm(ft, inches) {
  const totalInches = (Number(ft) || 0) * 12 + (Number(inches) || 0);
  return totalInches * CM_PER_INCH;
}

/**
 * Inverse of `ftInToCm` — used to prefill the ft/in inputs from a stored
 * `Profile.heightCm`. Rounds to the nearest whole inch; a round-up to 12"
 * carries into an extra foot so the UI never shows "5 ft 12 in".
 * @param {number|null|undefined} cm
 * @returns {{ft: number, inches: number}} {0, 0} if `cm` isn't a finite number
 */
export function cmToFtIn(cm) {
  if (!Number.isFinite(cm)) return { ft: 0, inches: 0 };
  const totalInches = cm / CM_PER_INCH;
  let ft = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches - ft * 12);
  if (inches === 12) {
    ft += 1;
    inches = 0;
  }
  return { ft, inches };
}

/**
 * Convert pounds to kilograms for storage on `Profile.weightKg`.
 * @param {number} lbs
 * @returns {number} kilograms (0 if non-numeric)
 */
export function lbsToKg(lbs) {
  return (Number(lbs) || 0) * KG_PER_LB;
}

/**
 * Inverse of `lbsToKg` — used to prefill the lbs input from a stored
 * `Profile.weightKg`.
 * @param {number|null|undefined} kg
 * @returns {number} pounds (0 if `kg` isn't a finite number)
 */
export function kgToLbs(kg) {
  if (!Number.isFinite(kg)) return 0;
  return kg / KG_PER_LB;
}

// ── Daily calorie need (Mifflin-St Jeor) ────────────────────────────────────

/**
 * Activity multipliers applied to BMR, standard Mifflin-St Jeor scale.
 * Keyed by `Profile.activityLevel`.
 */
const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/**
 * Default activity level used when height/weight/age/sex are all present but
 * `activityLevel` was left unset. 'light' (not 'sedentary') was chosen
 * deliberately: sedentary is the most punishing multiplier, and defaulting to
 * it would silently under-estimate need for the (likely majority of) users
 * who skip this one optional field without being fully sedentary. 'light'
 * is the closer-to-neutral middle-ground guess.
 */
const DEFAULT_ACTIVITY_LEVEL = 'light';

/**
 * Estimate daily calorie need via the Mifflin-St Jeor equation:
 *   BMR = 10*weightKg + 6.25*heightCm - 5*age + (5 male | -161 female)
 *   need = BMR * activity factor
 *
 * Returns `null` (never a guessed number) if any of height/weight/age/sex is
 * missing — those four are required for the equation to mean anything.
 * `activityLevel` alone is optional and falls back to `DEFAULT_ACTIVITY_LEVEL`
 * (see its doc comment for why 'light' and not 'sedentary').
 *
 * @param {Profile|null|undefined} profile
 * @returns {number|null} integer kcal/day, or null if biometrics are incomplete
 */
export function estimateDailyNeed(profile) {
  if (!profile) return null;
  const { heightCm, weightKg, age, sex, activityLevel } = profile;

  if (
    !Number.isFinite(heightCm) ||
    !Number.isFinite(weightKg) ||
    !Number.isFinite(age) ||
    (sex !== 'male' && sex !== 'female')
  ) {
    return null;
  }

  const sexConstant = sex === 'male' ? 5 : -161;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexConstant;
  const factor = ACTIVITY_FACTORS[activityLevel] ?? ACTIVITY_FACTORS[DEFAULT_ACTIVITY_LEVEL];

  return Math.round(bmr * factor);
}

// ── BMI (secondary context only — never a health score) ────────────────────

const BMI_UNDERWEIGHT_MAX = 18.5;
const BMI_HEALTHY_MAX = 25;
const BMI_OVERWEIGHT_MAX = 30;

/**
 * Compute BMI from height/weight only. This is explicitly secondary context
 * (a label, not a numeric score surfaced on its own) — per the frozen
 * "no numeric health scores" rule, callers should treat `label` as the thing
 * to render and keep `bmi` itself out of the primary UI unless a product
 * decision says otherwise.
 *
 * @param {Profile|null|undefined} profile
 * @returns {{bmi: number, label: 'Underweight'|'Healthy'|'Overweight'|'Obese'}|null}
 *   null if height or weight is missing/non-positive.
 */
export function computeBMI(profile) {
  if (!profile) return null;
  const { heightCm, weightKg } = profile;
  if (!Number.isFinite(heightCm) || heightCm <= 0 || !Number.isFinite(weightKg) || weightKg <= 0) {
    return null;
  }

  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);

  let label;
  if (bmi < BMI_UNDERWEIGHT_MAX) label = 'Underweight';
  else if (bmi < BMI_HEALTHY_MAX) label = 'Healthy';
  else if (bmi < BMI_OVERWEIGHT_MAX) label = 'Overweight';
  else label = 'Obese';

  return { bmi: Math.round(bmi * 10) / 10, label };
}

// ── Plan-day calorie total ───────────────────────────────────────────────────

/**
 * Sum estimated calories across a day's slot-based plan.
 *
 * Foods resolve through `estimateNutrition` (src/data/nutritionEstimates.js),
 * which keys off fine/coarse food group — the same estimate table already
 * used elsewhere in the app (NutritionFactsSheet, SchedulerView), so a food's
 * calorie contribution is consistent everywhere it's shown.
 *
 * Recipes are always counted as UNCOUNTED here, on purpose. Investigation for
 * this feature (July 2026) confirmed there is no per-recipe calorie metadata
 * reachable synchronously anywhere in the app: the Nutridigm API returns no
 * nutrition fields at all (see the `NutritionFacts` typedef in types.js —
 * `getNutritionFacts` is a stub that always resolves null), and
 * `buildRecipeDetail` (src/api/recipeDetail.js) never derives one either.
 * `nutritionEstimates.js` does carry a per-SLOT recipe guess table
 * (`RECIPE_SLOT_ESTIMATES`), but that's a coarse stand-in built for a
 * different surface (the macro-facts sheet) — reusing it here would mean
 * inventing a number for something we don't actually know, which the honesty
 * rule for this feature explicitly forbids. So: a recipe in the plan always
 * makes the day's total partial.
 *
 * @param {Object<string, import('../state/dailyPlan.js').PlanItem[]>} slotsObject -
 *   `DailyPlan.slots` — slotKey -> PlanItem[] (see src/state/dailyPlan.js).
 * @returns {{total: number, counted: number, uncounted: number}} `total` is
 *   the sum of every resolvable item's estimated calories; `counted` /
 *   `uncounted` are item counts. `uncounted > 0` means `total` is partial —
 *   callers (Phase 4 plan UI) should render it as "~<total>" with a "partial"
 *   hint rather than implying it's the whole day's calories.
 */
export function estimatePlanDayCalories(slotsObject) {
  let total = 0;
  let counted = 0;
  let uncounted = 0;

  if (!slotsObject || typeof slotsObject !== 'object') {
    return { total, counted, uncounted };
  }

  for (const [slotKey, items] of Object.entries(slotsObject)) {
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      if (!item) continue;

      if (item.kind === 'recipe') {
        uncounted += 1;
        continue;
      }

      const estimate = estimateNutrition(item, slotKey);
      if (!estimate) {
        uncounted += 1;
        continue;
      }

      total += estimate.calories;
      counted += 1;
    }
  }

  return { total, counted, uncounted };
}
