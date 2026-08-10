/**
 * nutrition.test.js — Guard tests for the layered nutrition resolver
 * (src/api/nutrition.js, Task T3D).
 *
 * Runs against the REAL committed USDA tables (src/data/usda/fdcMap.json /
 * nutrients.json), which ship empty (`items: {}` / `nutrients: {}`) — that
 * IS production today, so these tests double as the "empty tables"
 * equivalence proof: with tier 1 (panel) and tier 2 (USDA) both unable to
 * hit, `resolveNutrition` must fall through to tier 3 and match
 * `estimateNutrition` byte-for-byte (plus the added `source` field).
 *
 * Tier-2 (USDA) matching WITH data present is covered separately in
 * nutrition.usda.test.js, which mocks the two JSON tables — kept in its own
 * file so `vi.mock`'s file-level hoisting doesn't affect these tests.
 */
import { describe, expect, it } from 'vitest';
import { resolveNutrition, resolveDayTotals } from '../nutrition.js';
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
});

// ── Tier 2 absent (empty tables) → falls through to tier 3 ─────────────────

describe('resolveNutrition — tier 2 (USDA) absent with empty committed tables', () => {
  it('a plain food item with no panel and no USDA match falls through to the estimate tier', () => {
    const item = { id: 999999, fineGroup: 'b1', kind: 'food' };
    const result = resolveNutrition(item);
    expect(result.source).toBe('estimate');
    expect(result.estimated).toBe(true);
  });
});

// ── Tier 3 — hand-labeled estimate ──────────────────────────────────────────

describe('resolveNutrition — tier 3: estimate fallback', () => {
  it('resolves via fine food group', () => {
    const item = { id: 1, fineGroup: 'b1' };
    const result = resolveNutrition(item);
    expect(result).toEqual({ calories: 180, protein: 25, carbs: 0, fat: 8, estimated: true, source: 'estimate' });
  });

  it('resolves via coarse food group when fine group is absent/unlisted', () => {
    const item = { id: 2, group: 'e9' };
    const result = resolveNutrition(item);
    expect(result).toEqual({ calories: 50, protein: 2, carbs: 10, fat: 0, estimated: true, source: 'estimate' });
  });

  it('resolves a recipe via the per-slot table when it has no food group and no panel', () => {
    const item = { id: 3, kind: 'recipe' };
    const result = resolveNutrition(item, 'lunch');
    expect(result).toEqual({ calories: 450, protein: 25, carbs: 45, fat: 18, estimated: true, source: 'estimate' });
  });

  it('resolves a recipe in the beverages slot via RECIPE_SLOT_ESTIMATES.beverages', () => {
    const item = { id: 4, kind: 'recipe' };
    const result = resolveNutrition(item, 'beverages');
    expect(result).toEqual({ calories: 120, protein: 2, carbs: 24, fat: 1, estimated: true, source: 'estimate' });
  });
});

// ── Tier 4 — nothing resolves anywhere ──────────────────────────────────────

describe('resolveNutrition — tier 4: null (never guess)', () => {
  it('returns null for a falsy item', () => {
    expect(resolveNutrition(null)).toBeNull();
    expect(resolveNutrition(undefined)).toBeNull();
  });

  it('returns null for a food item with no fine/coarse group match', () => {
    const item = { id: 5, group: 'zz' };
    expect(resolveNutrition(item)).toBeNull();
  });

  it('returns null for a recipe with no panel, no group, and no slotKey', () => {
    const item = { id: 6, kind: 'recipe' };
    expect(resolveNutrition(item)).toBeNull();
  });

  it('returns null for a recipe with no panel and a slotKey not in RECIPE_SLOT_ESTIMATES', () => {
    const item = { id: 7, kind: 'recipe' };
    expect(resolveNutrition(item, 'not-a-real-slot')).toBeNull();
  });
});

// ── Empty-tables equivalence proof ──────────────────────────────────────────

describe('resolveNutrition === estimateNutrition today (both USDA tables empty, no panel data)', () => {
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

// ── resolveDayTotals ─────────────────────────────────────────────────────────

describe('resolveDayTotals', () => {
  it('returns null for empty/missing items', () => {
    expect(resolveDayTotals([])).toBeNull();
    expect(resolveDayTotals(undefined)).toBeNull();
  });

  it('sums calories/protein/carbs/fat and reports real vs estimated vs none counts', () => {
    const items = [
      // real (panel)
      { id: 100, kind: 'recipe', name: 'Panel recipe', nutritionPerServing: { calories: 400, protein: 20, carbs: 30, fat: 10 } },
      // estimated (fine group)
      { id: 101, name: 'Fish', fineGroup: 'b1' }, // {calories:180, protein:25, carbs:0, fat:8}
      // estimated (recipe slot, via item.fromSlot)
      { id: 102, kind: 'recipe', name: 'Slot recipe', fromSlot: 'snacks' }, // {calories:200, protein:5, carbs:25, fat:8}
      // none (unresolvable)
      { id: 103, name: 'Mystery', group: 'zz' },
    ];

    const totals = resolveDayTotals(items);
    expect(totals).toEqual({
      calories: 400 + 180 + 200,
      protein: 20 + 25 + 5,
      carbs: 30 + 0 + 25,
      fat: 10 + 8 + 8,
      itemCount: 4,
      realCount: 1,
      estimatedCount: 2,
      noneCount: 1,
    });
  });

  it('uses item.fromSlot as the slot key, mirroring estimateDayTotals', () => {
    const items = [{ id: 200, kind: 'recipe', fromSlot: 'dinner' }];
    const totals = resolveDayTotals(items);
    // RECIPE_SLOT_ESTIMATES.dinner = {calories: 550, ...}
    expect(totals.calories).toBe(550);
    expect(totals.estimatedCount).toBe(1);
  });

  it('a day of entirely unresolvable items still sums to zero with noneCount === itemCount', () => {
    const items = [{ id: 300, group: 'zz' }, { id: 301, group: 'zz' }];
    const totals = resolveDayTotals(items);
    expect(totals).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      itemCount: 2,
      realCount: 0,
      estimatedCount: 0,
      noneCount: 2,
    });
  });
});
