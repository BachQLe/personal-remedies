// @vitest-environment jsdom
/**
 * Back from Other options returns to the food's Health Details (checklist 4.10),
 * not just the list that was behind the card. Real FoodDetailCard and router.
 */
import { useState } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useNavigate, Outlet } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/api.js', () => ({
  getFoodFacts: vi.fn(async () => ({ longDescription: null, group: 'k', fineGroup: 'k1' })),
  assessFood: vi.fn(async () => ({
    food: { id: 1129, group: 'k', fineGroup: 'k1', referenceTotal: 0 }, tier: null, numericId: 3, perCondition: [],
  })),
  getFoodIdByName: vi.fn(),
  getGroupLabel: vi.fn(async () => 'Vitamins, Minerals & Other'),
}));

import FoodDetailCard from '../FoodDetailCard.jsx';
import RestoredFoodCard from '../RestoredFoodCard.jsx';

let container;
let root;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const buttonByText = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(text));

function ListScreen() {
  const [item, setItem] = useState(null);
  return (
    <>
      <p>list screen</p>
      <button type="button" onClick={() => setItem({ foodId: 1129, name: 'Iron', group: 'k', fineGroup: 'k1' })}>open iron</button>
      <FoodDetailCard item={item} open={!!item} onClose={() => setItem(null)} />
    </>
  );
}

function OtherOptions() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(-1)}>back from other options</button>;
}

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('requestAnimationFrame', (cb) => setTimeout(cb, 0));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/list']}>
        <Routes>
          <Route element={<><Outlet /><RestoredFoodCard /></>}>
            <Route path="/list" element={<ListScreen />} />
            <Route path="/app/suggestions/fine/k1" element={<OtherOptions />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
  });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('RestoredFoodCard', () => {
  it('reopens the card when Back returns from Other options, and closing it stays closed', async () => {
    act(() => buttonByText('open iron').click());
    await flush();
    await flush();
    act(() => buttonByText('Other options').click());
    await flush();
    expect(buttonByText('back from other options')).toBeDefined();

    act(() => buttonByText('back from other options').click());
    await flush();
    await flush();
    expect(document.body.textContent).toContain('list screen');
    expect(buttonByText('Other options')).toBeDefined();

    act(() => document.querySelector('button[aria-label="Close"]').click());
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(buttonByText('Other options')).toBeUndefined();
    expect(document.body.textContent).toContain('list screen');
  });
});
