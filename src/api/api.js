import {
  swipeDeckFoods,
  foods,
  recipes,
  dayPlans,
  referencesDb,
  unknownFoodNames,
} from './mockData.js';
import { storage } from './storage.js';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Browser-persisted client state. Survives refresh today; swaps to a real
// backend later by replacing the storage calls below — signatures stay put.
let _profile = storage.get('profile', null);
let _tasteSignals = storage.get('tasteSignals', null);

// ── Date helpers ─────────────────────────────────────────────────────────────
function toISO(date) {
  return date.toISOString().split('T')[0];
}

// Monday-anchored start of the week containing `date`.
function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun … 6 = Sat
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Deterministic rotation so a given date always yields the same generic plan.
function seedFromString(str) {
  let s = 0;
  for (let i = 0; i < str.length; i++) s = (s + str.charCodeAt(i) * (i + 1)) >>> 0;
  return s;
}

function pickRecipeForMeal(mealType, seed, offset = 0) {
  const matching = recipes.filter((r) => r.mealType === mealType);
  const pool = matching.length ? matching : recipes;
  return pool[(seed + offset) % pool.length];
}

// Generic, deterministic-per-date meal plan used when a date has no seeded plan.
function buildGenericPlan(profile, date) {
  const conditions = profile?.conditions ?? [];
  const helpful = foods.filter(
    (f) =>
      f.signal === 'helpful' &&
      f.matchedConditions.some((c) => conditions.includes(c)),
  );
  const fallback = helpful.length ? helpful : foods.filter((f) => f.signal === 'helpful');

  const seed = seedFromString(date);
  const rotate = (arr, n) => {
    if (!arr.length) return arr;
    const k = n % arr.length;
    return arr.slice(k).concat(arr.slice(0, k));
  };
  const pool = rotate(fallback, seed);

  let idx = 0;
  const pick = (n) => {
    const out = pool.slice(idx, idx + n);
    idx += n;
    return out.length === n ? out : pool.slice(0, n);
  };

  return {
    date,
    meals: [
      { slot: 'Breakfast', items: pick(2), recipes: [pickRecipeForMeal('Breakfast', seed, 0)] },
      { slot: 'Lunch', items: pick(2), recipes: [pickRecipeForMeal('Lunch', seed, 1)] },
      { slot: 'Dinner', items: pick(2), recipes: [pickRecipeForMeal('Dinner', seed, 2)] },
      { slot: 'Snack', items: pick(1), recipes: [] },
    ],
  };
}

export const api = {
  async getProfile() {
    await delay(200);
    return _profile;
  },

  async saveProfile(p) {
    await delay(200);
    _profile = { ...p };
    storage.set('profile', _profile);
  },

  async clearProfile() {
    await delay(100);
    _profile = null;
    storage.remove('profile');
  },

  async hasOnboarded() {
    await delay(50);
    return !!_profile;
  },

  async saveTasteSignal(signals) {
    await delay(200);
    _tasteSignals = [...signals];
    storage.set('tasteSignals', _tasteSignals);
  },

  async getTasteSignal() {
    await delay(200);
    return _tasteSignals;
  },

  async getSwipeDeck() {
    await delay(200);
    return swipeDeckFoods;
  },

  async getTopFoods(profile) {
    await delay(200);
    const conditions = profile?.conditions ?? [];

    const rank = (food) =>
      food.matchedConditions.filter((c) => conditions.includes(c)).length;

    const helpful = foods
      .filter((f) => f.signal === 'helpful')
      .sort((a, b) => rank(b) - rank(a));

    const avoid = foods
      .filter((f) => f.signal === 'avoid')
      .sort((a, b) => rank(b) - rank(a));

    const byCategory = {};
    helpful.forEach((f) => {
      if (!byCategory[f.category]) byCategory[f.category] = [];
      byCategory[f.category].push(f);
    });

    return { helpful, avoid, byCategory };
  },

  async getMealPlan(profile, date) {
    await delay(200);
    return dayPlans[date] ?? buildGenericPlan(profile, date);
  },

  // Full 7-day plan (Monday → Sunday) for the week containing `anchorDate`.
  async getWeeklyPlan(profile, anchorDate) {
    await delay(220);
    const start = startOfWeek(anchorDate ? new Date(anchorDate + 'T00:00:00') : new Date());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = toISO(d);
      const plan = dayPlans[iso] ?? buildGenericPlan(profile, iso);
      days.push({
        date: iso,
        weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
        meals: plan.meals,
      });
    }
    return { weekStart: toISO(start), days };
  },

  async getTopRecipeRecommendations(profile, count = 10) {
    await delay(200);
    const conditions = profile?.conditions ?? [];
    return [...recipes]
      .map((r) => ({
        ...r,
        conditionMatchCount: r.matchedConditions.filter((c) => conditions.includes(c)).length,
      }))
      .sort((a, b) => (b.healthScore ?? 0) - (a.healthScore ?? 0))
      .slice(0, count);
  },

  async getRecipes(profile, filters = {}) {
    await delay(200);
    const conditions = profile?.conditions ?? [];
    let result = [...recipes];

    if (conditions.length) {
      const matched = result.filter((r) =>
        r.matchedConditions.some((c) => conditions.includes(c)),
      );
      if (matched.length) result = matched;
    }

    if (filters.mealType && filters.mealType !== 'All') {
      result = result.filter((r) => r.mealType === filters.mealType);
    }

    if (filters.condition && filters.condition !== 'All') {
      result = result.filter((r) => r.matchedConditions.includes(filters.condition));
    }

    return result;
  },

  async getRecipe(id) {
    await delay(200);
    return recipes.find((r) => r.id === id) ?? null;
  },

  async getReferences(foodId, condition) {
    await delay(200);
    const key = `${foodId}:${condition}`;
    return referencesDb[key] ?? [];
  },

  async getIngredientReferences(ingredientName, condition) {
    await delay(100);
    const food = foods.find((f) => f.name.toLowerCase() === ingredientName.toLowerCase());
    if (!food) return [];
    const key = `${food.id}:${condition}`;
    return referencesDb[key] ?? [];
  },

  async lookupFood(query, profile) {
    await delay(200);
    const q = query.trim().toLowerCase();

    const isUnknown = unknownFoodNames.some((n) => n.toLowerCase() === q);
    if (isUnknown) return { known: false, query };

    const food = foods.find((f) => f.name.toLowerCase().includes(q));
    if (!food) return { known: false, query };

    const perCondition = food.matchedConditions.map((condition) => ({
      condition,
      signal: food.signal,
    }));

    return { known: true, food, perCondition };
  },
};
