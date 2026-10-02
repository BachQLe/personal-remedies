/**
 * ingredientDerivation.test.js — Guards the ingredient list behind
 * FoodDetailCard's back-face "Ingredients" block (src/api/
 * ingredientDerivation.js): title→dictionary matching, the swap-scoping
 * group resolution (including the generic-'x' sibling rescue), and the
 * never-fabricate contract (a title naming no real food yields nothing).
 *
 * Mocks localTables.js with a small fixture dictionary — same `vi.doMock` +
 * fresh dynamic `import()` convention as adapter.substitutes.test.js — so
 * these assertions can't drift with the real 1485-row snapshot.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ITEMS = [
  // Generic staple parked in the excluded 'x' group, with real siblings in 'b2'.
  { foodItemID: 9, displayAs: 'Beef', coarseFoodGroup: 'b', fineFoodGroup: 'x' },
  { foodItemID: 11, displayAs: 'Beef chuck/brisket', coarseFoodGroup: 'b', fineFoodGroup: 'b2' },
  { foodItemID: 16, displayAs: 'Beef liver', coarseFoodGroup: 'b', fineFoodGroup: 'b2' },
  // Qualifier-suffixed rows — reachable from the plain word a title uses.
  { foodItemID: 30, displayAs: 'Broccoli non-organic', coarseFoodGroup: 'e', fineFoodGroup: 'e' },
  { foodItemID: 31, displayAs: 'Lentils', coarseFoodGroup: 'c', fineFoodGroup: 'c2' },
  { foodItemID: 32, displayAs: 'Sweet potatoes', coarseFoodGroup: 'e', fineFoodGroup: 'e' },
  { foodItemID: 33, displayAs: 'Potato non-organic', coarseFoodGroup: 'e', fineFoodGroup: 'e' },
  // A recipe row — must never be matched as an ingredient.
  { foodItemID: 5001, displayAs: 'Three Bean and Beef Chili', coarseFoodGroup: 'l', fineFoodGroup: 'l' },
];

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.doUnmock('../localTables.js');
});

async function load() {
  vi.doMock('../localTables.js', () => ({
    getItemTable: vi.fn(() => ITEMS),
    getConditionTable: vi.fn(() => []),
    getGroupTable: vi.fn(() => []),
    getOverlayImageFile: vi.fn(() => undefined),
  }));
  return import('../ingredientDerivation.js');
}

describe('deriveIngredientsFromTitle', () => {
  it('finds a real dictionary food named in the recipe title', async () => {
    const { deriveIngredientsFromTitle } = await load();
    const [beef] = deriveIngredientsFromTitle('Three Bean and Beef Chili');
    expect(beef.name).toBe('Beef');
    expect(beef.foodItemID).toBe(9);
    expect(beef.derived).toBe(true);
  });

  it('scopes a generic "x" staple by its dictionary siblings', async () => {
    const { deriveIngredientsFromTitle } = await load();
    const [beef] = deriveIngredientsFromTitle('Quick Beef Casserole');
    // Beef's own fine group is 'x' (excluded, unscopeable) — the modal fine
    // group of "Beef chuck/brisket"/"Beef liver" stands in.
    expect(beef.suggestGroup).toBe('b2');
  });

  it('matches plural dictionary rows and qualifier suffixes from a singular title word', async () => {
    const { deriveIngredientsFromTitle } = await load();
    expect(deriveIngredientsFromTitle('Lentil Soup')[0].name).toBe('Lentils');
    const broccoli = deriveIngredientsFromTitle('Broccoli Everything Salad')[0];
    expect(broccoli.name).toBe('Broccoli');
    expect(broccoli.suggestGroup).toBe('e');
  });

  it('prefers the longer phrase and consumes each title word once', async () => {
    const { deriveIngredientsFromTitle } = await load();
    const names = deriveIngredientsFromTitle('Hasselback Sweet Potatoes').map((i) => i.name);
    expect(names).toEqual(['Sweet potatoes']);
  });

  it('never matches a recipe row as an ingredient', async () => {
    const { deriveIngredientsFromTitle } = await load();
    const ids = deriveIngredientsFromTitle('Three Bean and Beef Chili').map((i) => i.foodItemID);
    expect(ids).not.toContain(5001);
  });

  it('returns nothing (never a guess) for a title naming no dictionary food', async () => {
    const { deriveIngredientsFromTitle } = await load();
    expect(deriveIngredientsFromTitle('Pupusas Revueltas')).toEqual([]);
    expect(deriveIngredientsFromTitle('')).toEqual([]);
  });

  it('honors the max cap', async () => {
    const { deriveIngredientsFromTitle } = await load();
    const out = deriveIngredientsFromTitle('Beef Broccoli Lentils Potato', { max: 2 });
    expect(out).toHaveLength(2);
  });
});

describe('resolveCardIngredients', () => {
  it('prefers real overlay ingredients over title derivation', async () => {
    const { resolveCardIngredients } = await load();
    const { ingredients, derived } = resolveCardIngredients({
      name: 'Three Bean and Beef Chili',
      realIngredients: [{ name: 'Beef liver', foodItemID: 16 }],
    });
    expect(derived).toBe(false);
    expect(ingredients).toHaveLength(1);
    expect(ingredients[0].name).toBe('Beef liver');
    expect(ingredients[0].suggestGroup).toBe('b2');
  });

  it('falls back to the title, flagged as derived, when there are no overlay ingredients', async () => {
    const { resolveCardIngredients } = await load();
    const { ingredients, derived } = resolveCardIngredients({ name: 'Quick Beef Casserole' });
    expect(derived).toBe(true);
    expect(ingredients[0].name).toBe('Beef');
  });
});
