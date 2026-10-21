// @vitest-environment jsdom
/**
 * FavoritesScreen.test.jsx - My Favorites: empty state sends the user to
 * Browse recipes, the native grouping dropdown switches recency / meal type,
 * and saved days / weeks open a read-only peek whose Delete offers Undo.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('framer-motion', () => ({
  motion: { div: ({ children }) => <div>{children}</div> },
  AnimatePresence: ({ children }) => <>{children}</>,
}));
vi.mock('../../../components/FoodDetailCard.jsx', () => ({ default: () => null }));
const show = vi.fn();
vi.mock('../../../context/SnackbarContext.jsx', () => ({ useSnackbar: () => ({ show }) }));

import FavoritesScreen from '../FavoritesScreen.jsx';
import { addToLibrary, removeFromLibrary, getLibrary } from '../../../state/library.js';
import { storage } from '../../../api/storage.js';
import { getSavedDays, getSavedPlans } from '../../../api/api.js';

const recipe = (id, name) => ({ id, name, image: 'x.jpg', kind: 'recipe', numericId: 2, tier: 'Good', group: null, fineGroup: null });
const stub = [recipe(9001, 'Oatmeal bowl'), recipe(9002, 'Salmon roast')];
const day = { id: 'd1', name: 'Easy day', savedAt: '2026-10-01T00:00:00.000Z', slots: { breakfast: [stub[0]] } };
const week = {
  id: 'w1', name: 'Calm week', savedAt: '2026-10-02T00:00:00.000Z',
  plan: { version: 2, days: { '2026-10-05': { slots: { dinner: [stub[1]] }, eaten: [] }, '2026-10-06': { slots: {}, eaten: [] } } },
};

let container;
let root;
const mount = () => act(async () => {
  root.render(<MemoryRouter><FavoritesScreen /></MemoryRouter>);
});
const byText = (sel, text) => [...container.querySelectorAll(sel)].find((el) => el.textContent.includes(text));
const sheet = () => document.querySelector('[role="dialog"]');

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  show.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  getLibrary().slice().forEach((f) => removeFromLibrary(f.id));
  storage.remove('savedDays');
  storage.remove('savedPlans');
});

describe('FavoritesScreen', () => {
  it('shows the Plan header eyebrow and, with no favorites, an empty state that links to Browse recipes', async () => {
    await mount();
    expect(container.querySelector('p.font-label').textContent).toBe('Plan');
    expect(container.textContent).toContain('No favorites yet');
    expect(container.querySelector('a[href="/app/recipes"]').textContent).toContain('Browse recipes');
    expect(container.querySelector('select')).toBeNull();
  });

  it('lists newest first and regroups by meal type with the native dropdown', async () => {
    stub.forEach((r) => addToLibrary(r));
    await mount();
    const titles = () => [...container.querySelectorAll('button span.font-display')].map((s) => s.textContent);
    expect(titles()).toEqual(['Salmon roast', 'Oatmeal bowl']);
    expect(container.querySelector('a[href="/app/recipes"]').textContent).toContain('Browse more recipes');

    const select = container.querySelector('select');
    expect([...select.options].map((o) => o.textContent)).toEqual(['Most recent', 'By meal type']);
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'meal');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const headings = [...container.querySelectorAll('h3')].map((h) => h.textContent);
    expect(headings).toEqual(['Breakfast', 'Dinner']);
  });

  it('peeks at a saved day, then deletes it with Undo', async () => {
    storage.set('savedDays', [day]);
    await mount();
    await act(async () => { byText('button', 'Easy day').click(); });
    expect(sheet().textContent).toContain('Oatmeal bowl');
    expect(sheet().textContent).toContain('Load a day from the plan');

    await act(async () => { [...sheet().querySelectorAll('button')].find((b) => b.textContent.includes('Delete')).click(); });
    expect(getSavedDays()).toHaveLength(0);
    const [message, opts] = show.mock.calls.at(-1);
    expect(message).toBe('Deleted “Easy day”');
    await act(async () => { opts.onAction(); });
    expect(getSavedDays()).toHaveLength(1);
  });

  it('peeks at a saved week with Day 1 / Day 2 labels', async () => {
    storage.set('savedPlans', [week]);
    await mount();
    await act(async () => { byText('button', 'Calm week').click(); });
    expect(sheet().textContent).toContain('Day 1');
    expect(sheet().textContent).toContain('Day 2');
    expect(getSavedPlans()).toHaveLength(1);
  });
});
