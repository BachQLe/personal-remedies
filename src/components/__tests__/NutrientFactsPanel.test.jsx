// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import NutrientFactsPanel from '../NutrientFactsPanel.jsx';
import { nutrientDetail, sortForNutrientQuery } from '../../screens/search/nutrientDetail.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root; let host;
function render(ui) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(ui));
}
afterEach(() => { act(() => root?.unmount()); host?.remove(); });

describe('NutrientFactsPanel', () => {
  it('shows per-serving USDA values with source + matched description, and toggles to per 100 g', () => {
    render(<NutrientFactsPanel foodId={440} />);
    expect(host.textContent).toContain('Source: USDA FoodData Central');
    expect(host.textContent).toContain('Matched to: Spinach, raw');
    expect(host.querySelector('[data-testid="nutrient-basis"]').textContent).toMatch(/^Per serving \(30 g/);
    expect(host.textContent).toContain('Vitamin K');
    const per100 = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Per 100 g');
    act(() => per100.click());
    expect(host.querySelector('[data-testid="nutrient-basis"]').textContent).toBe('Per 100 g');
  });

  it('says "Nutrition data not available" for an unmatched food and shows no numbers or source', () => {
    render(<NutrientFactsPanel foodId={499} />);
    expect(host.textContent).toContain('Nutrition data not available');
    expect(host.textContent).not.toContain('Source: USDA');
    expect(host.textContent).not.toMatch(/\d\s?(mg|mcg|kcal)/);
  });
});

describe('nutrientDetail (search answer line)', () => {
  it('answers with real amounts for a matched food', () => {
    expect(nutrientDetail('calcium', { id: 596 })).toMatch(/^Calcium: \d+ mg per 100 g · \d+ mg per serving \(1 cup\)$/);
  });
  it('is honest about unmatched foods and silent without a nutrient', () => {
    expect(nutrientDetail('calcium', { id: 499 })).toBe('Calcium: no USDA data');
    expect(nutrientDetail(undefined, { id: 596 })).toBeNull();
  });
});

describe('sortForNutrientQuery', () => {
  const row = (id, name, fineGroup) => ({ kind: 'food', food: { id, name, fineGroup } });
  it('puts cow\'s milk above coconut milk and milk crackers', () => {
    const foods = [
      row(103, 'Milkfish', 'b1'), row(233, 'Coconut milk', 'e'), row(492, 'Milk crackers', 'c2'),
      row(596, 'Whole milk', 'd'), row(592, '2% fat milk', 'd'), row(595, 'Skim milk', 'd'),
    ];
    const names = sortForNutrientQuery(foods, { nutrient: 'calcium', food: 'milk' }).map((r) => r.food.name);
    expect(names.slice(0, 3).sort()).toEqual(['2% fat milk', 'Skim milk', 'Whole milk']);
    expect(names[names.length - 1]).toBe('Milkfish');
  });
});
