/**
 * saveGate.test.js — Guards the save-block precedence added for Task T2C:
 * 'ingredient' → 'harmful' → 'unscored' → null.
 *
 * 'unscored' exists because a recipe with no numericId is a recipe the live
 * Nutridigm API has never scored (Track B item 2 / REMEDI_MASTER_PLAN.md) —
 * the app's entire safety model runs off numericId, so an unscored recipe
 * must be treated as unknown, never as "safe by default." Without this
 * check, a recipe enriched by the C1 content overlay
 * (src/api/recipeIngestion.js) but never scored by the API would reach
 * `recipeToSaveItem` as `numericId: null, tier: null` and silently pass.
 */
import { describe, expect, it } from 'vitest';
import { getSaveBlockReason, SAVE_BLOCK_MESSAGES, recipeToSaveItem } from '../saveGate.js';

describe('getSaveBlockReason precedence', () => {
  it('blocks non-recipes as "ingredient" regardless of tier/numericId', () => {
    expect(getSaveBlockReason({ kind: 'food', numericId: 1, tier: 'Top' })).toBe('ingredient');
    expect(getSaveBlockReason({ kind: undefined })).toBe('ingredient');
    expect(getSaveBlockReason(null)).toBe('ingredient');
  });

  it('blocks harmful recipes by numericId (5-7)', () => {
    expect(getSaveBlockReason({ kind: 'recipe', numericId: 5 })).toBe('harmful');
    expect(getSaveBlockReason({ kind: 'recipe', numericId: 6 })).toBe('harmful');
    expect(getSaveBlockReason({ kind: 'recipe', numericId: 7 })).toBe('harmful');
  });

  it('blocks harmful recipes carrying only tier === "poor" (no numericId)', () => {
    expect(getSaveBlockReason({ kind: 'recipe', tier: 'poor' })).toBe('harmful');
  });

  it('blocks unscored recipes: no finite numericId AND no tier', () => {
    expect(getSaveBlockReason({ kind: 'recipe', numericId: null, tier: null })).toBe('unscored');
    expect(getSaveBlockReason({ kind: 'recipe' })).toBe('unscored'); // both fields simply absent
    expect(getSaveBlockReason({ kind: 'recipe', numericId: undefined, tier: undefined })).toBe('unscored');
    expect(getSaveBlockReason({ kind: 'recipe', numericId: NaN, tier: null })).toBe('unscored');
  });

  it('allows a scored-neutral recipe (numericId 4 -> tier null) to save', () => {
    expect(getSaveBlockReason({ kind: 'recipe', numericId: 4, tier: null })).toBeNull();
  });

  it('allows a positively-scored recipe to save', () => {
    expect(getSaveBlockReason({ kind: 'recipe', numericId: 1, tier: 'Top' })).toBeNull();
    expect(getSaveBlockReason({ kind: 'recipe', numericId: 2, tier: 'Strong' })).toBeNull();
    expect(getSaveBlockReason({ kind: 'recipe', numericId: 3, tier: 'Good' })).toBeNull();
  });

  it('reports "harmful" (not "unscored") when signals disagree — harmful wins', () => {
    // tier says harmful, numericId absent: should never fall through to unscored.
    expect(getSaveBlockReason({ kind: 'recipe', tier: 'poor', numericId: undefined })).toBe('harmful');
  });
});

describe('SAVE_BLOCK_MESSAGES', () => {
  it('has copy for every non-null block reason', () => {
    expect(SAVE_BLOCK_MESSAGES.ingredient).toBeTruthy();
    expect(SAVE_BLOCK_MESSAGES.harmful).toBeTruthy();
    expect(SAVE_BLOCK_MESSAGES.unscored).toBeTruthy();
  });

  it('unscored copy is neutral/honest, not alarmist (that is what "harmful" is for)', () => {
    const copy = SAVE_BLOCK_MESSAGES.unscored.toLowerCase();
    expect(copy).not.toMatch(/skull|harm|danger|unsafe|risk/);
  });
});

describe('recipeToSaveItem round-trip', () => {
  it('a scored recipe maps to a saveable item', () => {
    const recipe = { id: 555, title: 'Baked Salmon', photo: 'x.jpg', tier: 'Top', numericId: 1 };
    expect(getSaveBlockReason(recipeToSaveItem(recipe))).toBeNull();
  });

  it('a scored-neutral recipe (numericId 4) maps to a saveable item', () => {
    const recipe = { id: 558, title: 'Neutral Dish', tier: null, numericId: 4 };
    expect(getSaveBlockReason(recipeToSaveItem(recipe))).toBeNull();
  });

  it('an unscored recipe (no numericId/tier at all) maps to a blocked item', () => {
    const recipe = { id: 556, title: 'Unscored Dish' };
    const item = recipeToSaveItem(recipe);
    expect(item.numericId).toBeNull();
    expect(item.tier).toBeNull();
    expect(getSaveBlockReason(item)).toBe('unscored');
  });

  it('a harmful recipe maps to a blocked item', () => {
    const recipe = { id: 557, title: 'Harmful Dish', tier: 'poor', numericId: 6 };
    expect(getSaveBlockReason(recipeToSaveItem(recipe))).toBe('harmful');
  });
});
