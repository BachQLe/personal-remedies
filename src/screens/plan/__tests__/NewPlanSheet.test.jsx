// @vitest-environment jsdom
/**
 * NewPlanSheet.test.jsx - the one New Meal Plan sheet: the two choices, the
 * favorites-count nudge (checklist 1.25), and the saved-weeks view.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Items carry the slots they fit, so the real overlay/keyword bucketing stays out of this test.
vi.mock('../../../api/api.js', () => ({
  favoritesBySlot: (favs) => {
    const out = { breakfast: [], lunch: [], dinner: [], snacks: [], beverages: [] };
    for (const f of favs) for (const s of f.fits) out[s].push(f);
    return out;
  },
}));

import NewPlanSheet from '../NewPlanSheet.jsx';

const fav = (id, ...fits) => ({ id, name: `Recipe ${id}`, fits });
const many = (slot, n, from = 0) => Array.from({ length: n }, (_, i) => fav(from + i, slot));
const week = { id: 'w1', name: 'Calm week', savedAt: '2026-10-01T00:00:00.000Z' };

let container;
let root;
const mount = (props) => act(async () => {
  root.render(
    <MemoryRouter>
      <NewPlanSheet favorites={[]} weeks={[]} ready generating={false} onRandomize={vi.fn()} onLoadWeek={vi.fn()} onClose={vi.fn()} {...props} />
    </MemoryRouter>
  );
});
const button = (text) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(text));

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

describe('NewPlanSheet', () => {
  it('nudges, naming the short meals, when any meal has 3 or fewer favorites', async () => {
    await mount({ favorites: [...many('breakfast', 5), ...many('lunch', 2, 100)] });
    expect(container.textContent).toContain('Tip: pick more than 3 favorites per meal for more variety');
    expect(container.textContent).toContain('Short on: Lunch, Dinner, Snacks & Desserts, Beverages');
    expect(container.textContent).not.toContain('Short on: Breakfast');
    expect(container.querySelector('a[href="/app/favorites"]')).toBeTruthy();
  });

  it('shows no nudge when every meal has more than 3', async () => {
    const favorites = ['breakfast', 'lunch', 'dinner', 'snacks', 'beverages'].flatMap((s, i) => many(s, 4, i * 10));
    await mount({ favorites });
    expect(container.textContent).not.toContain('Tip:');
    expect(button('Randomize from my favorites').disabled).toBe(false);
  });

  it('explains and disables randomizing when no favorite fits any meal', async () => {
    await mount({ favorites: [] });
    expect(container.textContent).toContain('None of your favorites fit a meal yet');
    expect(button('Randomize from my favorites').disabled).toBe(true);
  });

  it('randomizes on tap while a short list still runs', async () => {
    const onRandomize = vi.fn();
    await mount({ favorites: many('breakfast', 1), onRandomize });
    await act(async () => { button('Randomize from my favorites').click(); });
    expect(onRandomize).toHaveBeenCalledTimes(1);
  });

  it('disables Load a saved week when there are none, and lists them when there are', async () => {
    await mount({ favorites: many('breakfast', 4) });
    expect(button('Load a saved week').disabled).toBe(true);
    expect(container.textContent).toContain('No saved weeks yet');

    const onLoadWeek = vi.fn();
    await mount({ favorites: many('breakfast', 4), weeks: [week], onLoadWeek });
    await act(async () => { button('Load a saved week').click(); });
    await act(async () => { button('Calm week').click(); });
    expect(onLoadWeek).toHaveBeenCalledWith('w1');
  });
});
