// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('framer-motion', () => ({
  motion: { span: ({ children, ...p }) => <span {...p}>{children}</span>, div: ({ children }) => <div>{children}</div> },
  LayoutGroup: ({ children }) => children,
}));

import PlanTabs from '../PlanTabs.jsx';

let container;
let root;

function BackProbe() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(-1)}>back</button>;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(
    <MemoryRouter initialEntries={['/app/plan']}>
      <Routes>
        <Route path="/app/plan" element={<PlanTabs value="/app/plan" />} />
        <Route path="/app/favorites" element={<BackProbe />} />
      </Routes>
    </MemoryRouter>
  ));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const labels = () => [...container.querySelectorAll('button')].map((b) => b.textContent);

describe('PlanTabs', () => {
  it('puts My Meal Plan first, then My Favorites', () => {
    expect(labels()).toEqual(['My Meal Plan', 'My Favorites']);
  });

  it('navigates so the back button on My Favorites returns to the plan', () => {
    act(() => [...container.querySelectorAll('button')].find((b) => b.textContent === 'My Favorites').click());
    expect(labels()).toEqual(['back']);
    act(() => container.querySelector('button').click());
    expect(labels()).toEqual(['My Meal Plan', 'My Favorites']);
  });
});
