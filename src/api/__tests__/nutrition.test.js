/**
 * nutrition.test.js — Guard tests for the layered nutrition resolver
 * (src/api/nutrition.js, Task T3D).
 *
 * Tiers: recipe panel, then the estimate seam, then null. USDA is cut
 * (checklist 2.1/2.2), so a plain food only ever resolves via the estimate
 * table.
 */
import { describe, expect, it } from 'vitest';
import { resolveNutrition } from '../nutrition.js';
import { estimateNutrition } from '../../data/nutritionEstimates.js';

// ── Tier 1 — recipe source panel (real, per-serving) ────────────────────────

describe('resolveNutrition — tier 1: recipe panel', () => {
  it('returns the panel macros verbatim, estimated:false, source:"panel"', () => {
    const recipe = {
      id: 501,
      kind: 'recipe',
      nutritionPerServing: { calories: 420, protein: 30, carbs: 35, fat: 15 },
    };
    expect(resolveNutrition(recipe, 'dinner')).toEqual({
      calories: 420,
      protein: 30,
      carbs: 35,
      fat: 15,
      estimated: false,
      source: 'panel',
    });
  });

  it('panel beats a food group / recipe slot that would otherwise resolve at tier 3', () => {
    const recipe = {
      id: 502,
      kind: 'recipe',
      fineGroup: 'b1', // would resolve via FINE_GROUP_ESTIMATES if panel weren't present
      nutritionPerServing: { calories: 111, protein: 1, carbs: 1, fat: 1 },
    };
    const result = resolveNutrition(recipe, 'breakfast');
    expect(result.source).toBe('panel');
    expect(result.calories).toBe(111);
  });

  // Anti-fabrication guard (Track 1A — relaxed overlay schema): a recipe
  // whose C1 overlay row only had a transcribed calorie number (no
  // protein/carbs/fat) must still resolve at tier 1 with the real calorie
  // figure intact — it must NEVER fall through to tier 3 and have
  // `estimateNutrition` invent a calorie number for it. `fineGroup: 'b1'`
  // here is deliberately a group `estimateNutrition` WOULD resolve, so a
  // fall-through would be silently indistinguishable by calorie count alone
  // if this test only checked `source`.
  it('a recipe with only nutritionPerServing.calories (no macros) resolves at tier 1, never estimated', () => {
    const recipe = {
      id: 503,
      kind: 'recipe',
      fineGroup: 'b1',
      nutritionPerServing: { calories: 210 },
    };
    const result = resolveNutrition(recipe, 'lunch');
    expect(result.calories).toBe(210);
    expect(result.source).toBe('panel');
    expect(result.estimated).toBe(false);
  });

  // Bug fix (Task C2, Sept 2026): the schema now permits a panel with
  // macros but NO calorie figure (Mory's real recipe source has no calorie
  // column at all — see recipeIngestion.js's "NUTRITION RELAXATION" note),
  // and this module's own contract (see file header) is that an absent
  // value is always `null`, never `undefined`. Before the fix, a bare
  // destructure let `calories` come back `undefined` here, which
  // NutritionFactsSheet then rendered as the literal string "undefined
  // kcal" (no guard beyond `resolved` being truthy).
  it('a recipe with nutritionPerServing present but calories absent resolves calories to null, not undefined', () => {
    const recipe = {
      id: 504,
      kind: 'recipe',
      nutritionPerServing: { protein: 12, carbs: 20, fat: 5 },
    };
    const result = resolveNutrition(recipe, 'lunch');
    expect(result.source).toBe('panel');
    expect(result.estimated).toBe(false);
    expect(result.calories).toBeNull();
    expect(result.calories).not.toBeUndefined();
    expect(result.protein).toBe(12);
    expect(result.carbs).toBe(20);
    expect(result.fat).toBe(5);
  });

  it('a recipe with only nutritionPerServing.calories resolves the absent macros to null, not undefined', () => {
    const recipe = {
      id: 505,
      kind: 'recipe',
      nutritionPerServing: { calories: 210 },
    };
    const result = resolveNutrition(recipe, 'lunch');
    expect(result.protein).toBeNull();
    expect(result.carbs).toBeNull();
    expect(result.fat).toBeNull();
    expect(result.protein).not.toBeUndefined();
    expect(result.carbs).not.toBeUndefined();
    expect(result.fat).not.toBeUndefined();
  });
});

// ── No panel → falls through to the estimate tier ───────────────────────────

describe('resolveNutrition — no panel', () => {
  it('a plain food item with no panel falls through to the estimate tier', () => {
    const item = { id: 999999, fineGroup: 'b1', kind: 'food' };
    const result = resolveNutrition(item);
    expect(result.source).toBe('estimate');
    expect(result.estimated).toBe(true);
  });
});

// ── Tier 2 — hand-labeled estimate ──────────────────────────────────────────

describe('resolveNutrition — tier 2: estimate fallback', () => {
  it('resolves via fine food group', () => {
    const item = { id: 900001, fineGroup: 'b1' };
    const result = resolveNutrition(item);
    expect(result).toEqual({ calories: 180, protein: 25, carbs: 0, fat: 8, estimated: true, source: 'estimate' });
  });

  it('resolves via coarse food group when fine group is absent/unlisted', () => {
    const item = { id: 900002, group: 'e9' };
    const result = resolveNutrition(item);
    expect(result).toEqual({ calories: 50, protein: 2, carbs: 10, fat: 0, estimated: true, source: 'estimate' });
  });

  it('resolves a recipe via the per-slot table when it has no food group and no panel', () => {
    const item = { id: 900003, kind: 'recipe' };
    const result = resolveNutrition(item, 'lunch');
    expect(result).toEqual({ calories: 450, protein: 25, carbs: 45, fat: 18, estimated: true, source: 'estimate' });
  });

  it('resolves a recipe in the beverages slot via RECIPE_SLOT_ESTIMATES.beverages', () => {
    const item = { id: 900004, kind: 'recipe' };
    const result = resolveNutrition(item, 'beverages');
    expect(result).toEqual({ calories: 120, protein: 2, carbs: 24, fat: 1, estimated: true, source: 'estimate' });
  });
});

// ── Tier 3 — nothing resolves anywhere ──────────────────────────────────────

describe('resolveNutrition — tier 3: null (never guess)', () => {
  it('returns null for a falsy item', () => {
    expect(resolveNutrition(null)).toBeNull();
    expect(resolveNutrition(undefined)).toBeNull();
  });

  it('returns null for a food item with no fine/coarse group match', () => {
    const item = { id: 900005, group: 'zz' };
    expect(resolveNutrition(item)).toBeNull();
  });

  it('returns null for a recipe with no panel, no group, and no slotKey', () => {
    const item = { id: 900006, kind: 'recipe' };
    expect(resolveNutrition(item)).toBeNull();
  });

  it('returns null for a recipe with no panel and a slotKey not in RECIPE_SLOT_ESTIMATES', () => {
    const item = { id: 900007, kind: 'recipe' };
    expect(resolveNutrition(item, 'not-a-real-slot')).toBeNull();
  });
});

// ── Empty-tables equivalence proof ──────────────────────────────────────────

describe('resolveNutrition === estimateNutrition when there is no panel data', () => {
  const sample = [
    ['fine group match', { id: 10, fineGroup: 'b1' }, undefined],
    ['fine group match (beverages)', { id: 11, fineGroup: 'h2' }, 'beverages'],
    ['coarse group fallback', { id: 12, group: 'f9' }, undefined],
    ['coarse group fallback (beverages)', { id: 13, group: 'h9' }, 'beverages'],
    ['recipe, per-slot estimate', { id: 14, kind: 'recipe' }, 'breakfast'],
    ['recipe, beverages slot estimate', { id: 15, kind: 'recipe' }, 'beverages'],
    ['unresolvable food -> null on both', { id: 16, kind: 'food', group: 'zz' }, undefined],
  ];

  it.each(sample)('%s', (_label, item, slotKey) => {
    const legacy = estimateNutrition(item, slotKey);
    const resolved = resolveNutrition(item, slotKey);

    if (legacy === null) {
      expect(resolved).toBeNull();
    } else {
      expect(resolved).toEqual({ ...legacy, source: 'estimate' });
      expect(resolved.estimated).toBe(true);
    }
  });
});
