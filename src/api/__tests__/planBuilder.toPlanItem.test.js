/**
 * planBuilder.toPlanItem.test.js — Guard tests for Track 1D (in-app recipe
 * preview sheet): `toPlanItem`'s three additive fields (`sourceUrl`,
 * `attribution`, `nutritionPerServing`).
 *
 * Unlike the other ten copied fields (carried through as possibly-
 * `undefined`, same shape the candidate had), these three are only ever
 * present on the returned PlanItem when the source candidate actually has
 * them — the key itself is omitted (not merely `undefined`-valued) when
 * absent, so a plain food's persisted PlanItem — and any plan saved before
 * this task — stays exactly as lean as before.
 *
 * Pure-function test, no storage/network involved — `toPlanItem` never
 * touches `src/state/dailyPlan.js`'s persisted plan or the network, so this
 * runs in vitest's default 'node' environment (no jsdom docblock needed).
 */
import { describe, expect, it } from 'vitest';
import { toPlanItem } from '../planBuilder.js';

describe('toPlanItem', () => {
  it('preserves sourceUrl, attribution, and nutritionPerServing when present on the candidate', () => {
    const candidate = {
      id: 1,
      name: 'Baked Salmon',
      image: 'https://img/salmon.jpg',
      group: 'b',
      fineGroup: 'l',
      tier: 'Top',
      numericId: 1,
      kind: 'recipe',
      sourceName: 'MedlinePlus',
      sourceUrl: 'https://medlineplus.gov/recipes/baked-salmon',
      attribution: 'MedlinePlus',
      nutritionPerServing: { calories: 320, protein: 28 },
    };

    const item = toPlanItem(candidate);

    expect(item.sourceUrl).toBe('https://medlineplus.gov/recipes/baked-salmon');
    expect(item.attribution).toBe('MedlinePlus');
    expect(item.nutritionPerServing).toEqual({ calories: 320, protein: 28 });
    // Every pre-existing field still comes through unchanged.
    expect(item.id).toBe(1);
    expect(item.name).toBe('Baked Salmon');
    expect(item.kind).toBe('recipe');
  });

  it('omits sourceUrl, attribution, and nutritionPerServing as KEYS (not just undefined values) when absent', () => {
    const candidate = {
      id: 2,
      name: 'Spinach',
      image: '',
      group: 'e',
      fineGroup: 'e1',
      tier: 'Good',
      numericId: 2,
      kind: 'food',
    };

    const item = toPlanItem(candidate);

    expect('sourceUrl' in item).toBe(false);
    expect('attribution' in item).toBe(false);
    expect('nutritionPerServing' in item).toBe(false);
    expect(Object.keys(item).sort()).toEqual(
      ['fineGroup', 'group', 'id', 'image', 'kind', 'name', 'numericId', 'sourceName', 'substituteFineGroup', 'tier'].sort()
    );
  });

  it('omits a field that is explicitly undefined on the candidate, same as absent', () => {
    const candidate = {
      id: 3,
      name: 'Legacy Item',
      kind: 'food',
      sourceUrl: undefined,
      attribution: undefined,
      nutritionPerServing: undefined,
    };

    const item = toPlanItem(candidate);

    expect('sourceUrl' in item).toBe(false);
    expect('attribution' in item).toBe(false);
    expect('nutritionPerServing' in item).toBe(false);
  });

  it('carries through only the fields that are actually present, independently of one another', () => {
    const item = toPlanItem({
      id: 4,
      name: 'Partial Recipe',
      kind: 'recipe',
      sourceUrl: 'https://medlineplus.gov/recipes/partial',
      // attribution and nutritionPerServing intentionally absent.
    });

    expect(item.sourceUrl).toBe('https://medlineplus.gov/recipes/partial');
    expect('attribution' in item).toBe(false);
    expect('nutritionPerServing' in item).toBe(false);
  });
});
