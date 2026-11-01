// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AddFavoriteSheet from '../AddFavoriteSheet.jsx';

let container;
let root;
const link = () => document.querySelector('[role="dialog"] a');
const mount = (props) => act(() => root.render(
  <MemoryRouter>
    <AddFavoriteSheet options={[]} onAdd={vi.fn()} onClose={vi.fn()} {...props} />
  </MemoryRouter>
));

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('AddFavoriteSheet with nothing to add (8.1)', () => {
  it('keeps the message and links straight to that meal\'s recipes when it has no favorites', () => {
    mount({ slot: { key: 'beverages', label: 'Beverages', recipeMealType: 'beverage' }, hasAny: false });
    expect(document.body.textContent).toContain('You have no Beverages favorites yet.');
    expect(link().getAttribute('href')).toBe('/app/recipes?meal=Beverage');
  });

  it('handles a slot fed by several meal types', () => {
    mount({ slot: { key: 'snacks', label: 'Snacks & Desserts', recipeMealType: ['snack', 'dessert'] }, hasAny: false });
    expect(link().getAttribute('href')).toBe('/app/recipes?meal=Snack');
  });

  it('links to My Favorites when the meal has favorites, all already in the day', () => {
    mount({ slot: { key: 'lunch', label: 'Lunch', recipeMealType: 'lunch' }, hasAny: true });
    expect(link().getAttribute('href')).toBe('/app/favorites');
  });
});
