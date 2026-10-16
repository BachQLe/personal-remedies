// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getMealPlanSuggestions: vi.fn(),
  getRecipes: vi.fn(),
  buildRecipeDetail: vi.fn(),
  getConditionNames: vi.fn(),
}));
const saved = vi.hoisted(() => ({ items: [], listeners: new Set() }));
vi.mock('../../api/api.js', () => api);
vi.mock('../../state/library.js', () => ({
  getLibrary: () => saved.items,
  subscribeLibrary: (callback) => {
    saved.listeners.add(callback);
    callback(saved.items);
    return () => saved.listeners.delete(callback);
  },
  addToLibrary: (item) => {
    saved.items = [...saved.items, item];
    saved.listeners.forEach((callback) => callback(saved.items));
  },
  removeFromLibrary: (id) => {
    saved.items = saved.items.filter((item) => item.id !== id);
    saved.listeners.forEach((callback) => callback(saved.items));
  },
}));
vi.mock('../../components/FoodDetailCard.jsx', () => ({
  default: ({ item, open, onClose }) => open ? (
    <div role="dialog" data-recipe={item.isRecipe}>
      <span>{item.name}</span>
      <span data-testid="ingredients">{JSON.stringify(item.realIngredients)}</span>
      <button onClick={onClose}>Close detail</button>
    </div>
  ) : null,
}));

import MealprepCarousel from './MealprepCarousel.jsx';
import { storage } from '../../api/storage.js';

let container;
let root;
let randomSpy;
const oats = { id: 1, name: 'Oats', image: '/oats.jpg', kind: 'recipe', tier: 'Good', numericId: 3 };
const eggs = { id: 2, name: 'Eggs', image: '/eggs.jpg', kind: 'recipe', tier: 'Good', numericId: 3 };
const tea = { id: 3, name: 'Green tea', image: '/tea.jpg', kind: 'food', tier: 'Top', numericId: 1 };
const stew = { id: 4, name: 'Harsh stew', image: '/stew.jpg', kind: 'recipe', tier: 'poor', numericId: 6 };

function result(breakfast = [oats, eggs], extra = {}) {
  return { candidates: { breakfast, lunch: [], dinner: [], snacks: [], beverages: [tea], ...extra }, conditionNames: ['Aging'], usedFallback: false };
}

// Small LCG so a "different roll" is deterministic.
function roll(seed) {
  let n = seed;
  return () => (n = (n * 9301 + 49297) % 233280) / 233280;
}

const shown = () => [...container.querySelectorAll('[aria-label^="View "]')].map((button) => button.getAttribute('aria-label'));
const manyRecipes = Array.from({ length: 14 }, (_, i) => ({ id: 100 + i, name: `Recipe ${i}`, kind: 'recipe', tier: 'Good', numericId: (i % 4) + 1 }));

function defer() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function mount() {
  await act(async () => { root.render(<MealprepCarousel />); });
}

async function click(label) {
  const button = [...container.querySelectorAll('button')].find((item) => item.getAttribute('aria-label') === label || item.textContent === label);
  expect(button, `button: ${label}`).toBeTruthy();
  await act(async () => button.click());
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  saved.items = [];
  saved.listeners.clear();
  vi.resetAllMocks();
  // Constant roll + equal weights keeps the pick order stable (input order).
  randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
  api.getMealPlanSuggestions.mockResolvedValue(result());
  api.getRecipes.mockResolvedValue({ recipes: [{ id: 1, ingredients: [{ name: 'Rolled oats' }], sourceUrl: 'https://example.com/oats' }] });
  api.buildRecipeDetail.mockImplementation((card) => Promise.resolve({ name: card.name }));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  randomSpy.mockRestore();
  act(() => root.unmount());
  container.remove();
});

describe('home meal carousel', () => {
  it('shares save state with the library without opening the card, and toggles removal', async () => {
    await mount();
    await click('Save Oats');
    expect(saved.items).toEqual([expect.objectContaining({ id: 1, name: 'Oats', kind: 'recipe', sourceUrl: 'https://example.com/oats' })]);
    expect(container.querySelector('[aria-label="Unsave Oats"]').getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    await click('Unsave Oats');
    expect(saved.items).toEqual([]);

    await act(async () => {
      saved.items = [oats];
      saved.listeners.forEach((callback) => callback(saved.items));
    });
    expect(container.querySelector('[aria-label="Unsave Oats"]')).toBeTruthy();
  });

  it('shows recipes only: non-recipe items and harmful recipes never appear, empty categories are hidden', async () => {
    api.getMealPlanSuggestions.mockResolvedValue(result([oats, stew], { lunch: [{ ...tea, id: 9 }] }));
    await mount();
    expect(shown()).toEqual(['View Oats']);
    const tabs = [...container.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent);
    expect(tabs).toEqual(['Breakfast']);
    expect(container.textContent).not.toContain('Green tea');
    expect(container.textContent).not.toContain('Harsh stew');
  });

  it('weights the pick, saves it with a timestamp, and shows the same set on revisit within a day', async () => {
    api.getMealPlanSuggestions.mockResolvedValue(result(manyRecipes));
    randomSpy.mockImplementation(roll(1));
    await mount();
    const first = shown();
    expect(first).toHaveLength(6);
    const saved1 = storage.get('homeRecipePicks');
    expect(saved1.picks.breakfast).toHaveLength(6);
    expect(Date.now() - saved1.at).toBeLessThan(5000);

    // Revisit with different luck: the saved set wins, nothing is re-saved.
    await act(async () => root.unmount());
    root = createRoot(container);
    randomSpy.mockImplementation(roll(2));
    await mount();
    expect(shown()).toEqual(first);
    expect(storage.get('homeRecipePicks')).toEqual(saved1);

    // Past a day the set rotates.
    storage.set('homeRecipePicks', { ...saved1, at: Date.now() - 25 * 60 * 60 * 1000 });
    await act(async () => root.unmount());
    root = createRoot(container);
    await mount();
    expect(shown()).not.toEqual(first);
    expect(Date.now() - storage.get('homeRecipePicks').at).toBeLessThan(5000);
  });

  it('re-picks when the profile conditions change', async () => {
    api.getMealPlanSuggestions.mockResolvedValue(result(manyRecipes));
    storage.set('profile', { conditions: [2, 1] });
    randomSpy.mockImplementation(roll(1));
    await mount();
    const first = shown();
    expect(storage.get('homeRecipePicks').stamp).toBe('1,2');

    randomSpy.mockImplementation(roll(2));
    await act(async () => storage.set('profile', { conditions: [3] }));
    expect(storage.get('homeRecipePicks').stamp).toBe('3');
    expect(shown()).not.toEqual(first);
  });

  it('shows the "Nutri is thinking" note while the first load is pending', async () => {
    api.getMealPlanSuggestions.mockReturnValue(new Promise(() => {}));
    await mount();
    const note = [...container.querySelectorAll('[role="status"]')].find((node) => node.textContent === 'Nutri is thinking…');
    expect(note).toBeTruthy();
  });

  it('preserves real recipe ingredients and does not reopen a dismissed async detail', async () => {
    const detail = defer();
    api.buildRecipeDetail.mockReturnValue(detail.promise);
    await mount();
    await click('View Oats');
    expect(container.querySelector('[data-testid="ingredients"]').textContent).toContain('Rolled oats');
    await click('Close detail');
    await act(async () => detail.resolve({ name: 'Oats detail' }));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('does not let an older detail request replace a newer selection', async () => {
    const first = defer();
    const second = defer();
    api.buildRecipeDetail.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await mount();
    await click('View Oats');
    await click('View Eggs');
    await act(async () => first.resolve({ name: 'Outdated oats detail' }));
    expect(container.querySelector('[role="dialog"]').textContent).toContain('Eggs');
    await act(async () => second.resolve({ name: 'Eggs detail' }));
    expect(container.querySelector('[role="dialog"]').textContent).toContain('Eggs detail');
  });

  it('shows a fetch failure and makes Retry load the real categories', async () => {
    api.getMealPlanSuggestions.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(result());
    await mount();
    expect(container.textContent).toContain('Connection problem');
    expect(container.textContent).not.toContain('No breakfast ideas yet');
    await click('Retry');
    expect(container.querySelector('[aria-label="View Oats"]')).toBeTruthy();
    expect(api.getMealPlanSuggestions).toHaveBeenCalledTimes(2);
  });
});
