// @vitest-environment jsdom
/** Recipe calories on the card front: only the sourced per-serving figure, never a fallback. */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/api.js', () => ({
  getFoodFacts: vi.fn(async () => null),
  assessFood: vi.fn(async () => null),
  getFoodIdByName: vi.fn(async () => null),
  getGroupLabel: vi.fn(async () => null),
}));

import FoodDetailCard from '../FoodDetailCard.jsx';

let container;
let root;
const textFor = async (item) => {
  await act(async () => {
    root.render(<MemoryRouter><FoodDetailCard item={item} open onClose={() => {}} /></MemoryRouter>);
  });
  return document.body.textContent;
};

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('requestAnimationFrame', (cb) => setTimeout(cb, 0));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('FoodDetailCard recipe calories', () => {
  const base = { name: 'Oat bowl', isRecipe: true, mealType: 'breakfast' };
  it('shows the sourced per-serving calories', async () => {
    expect(await textFor({ ...base, nutritionPerServing: { calories: 450 } })).toContain('450 cal per serving');
  });
  it('shows nothing when unsourced', async () => {
    expect(await textFor(base)).not.toContain('cal per serving');
  });
});
