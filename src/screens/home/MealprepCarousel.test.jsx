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

let container;
let root;
const oats = { id: 1, name: 'Oats', image: '/oats.jpg', kind: 'recipe', tier: 'Good', numericId: 3 };
const eggs = { id: 2, name: 'Eggs', image: '/eggs.jpg', kind: 'recipe', tier: 'Good', numericId: 3 };
const tea = { id: 3, name: 'Green tea', image: '/tea.jpg', kind: 'food', tier: 'Top', numericId: 1 };

function result(breakfast = [oats, eggs]) {
  return { candidates: { breakfast, lunch: [], dinner: [], snacks: [], beverages: [tea] }, conditionNames: ['Aging'], usedFallback: false };
}

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
  api.getMealPlanSuggestions.mockResolvedValue(result());
  api.getRecipes.mockResolvedValue({ recipes: [{ id: 1, ingredients: [{ name: 'Rolled oats' }], sourceUrl: 'https://example.com/oats' }] });
  api.buildRecipeDetail.mockImplementation((card) => Promise.resolve({ name: card.name }));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
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

  it('shows beverage foods in their category with a view action and no misleading save', async () => {
    await mount();
    await click('Beverages');
    expect(container.querySelector('[aria-label="Save Green tea"]')).toBeNull();
    expect(container.querySelector('[aria-label="View details for Green tea"]')).toBeTruthy();
    await click('View details for Green tea');
    expect(container.querySelector('[role="dialog"]').getAttribute('data-recipe')).toBe('false');
    expect(saved.items).toEqual([]);
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
