// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it } from 'vitest';
import MealQueueScreen from '../MealQueueScreen.jsx';

let container;
let root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

it('no favorites and no plan redirects to Choose recipes', () => {
  act(() => root.render(
    <MemoryRouter initialEntries={['/app/plan']}>
      <Routes>
        <Route path="/app/plan" element={<MealQueueScreen />} />
        <Route path="/app/recipes" element={<p>choose recipes</p>} />
      </Routes>
    </MemoryRouter>
  ));
  expect(container.textContent).toBe('choose recipes');
});
