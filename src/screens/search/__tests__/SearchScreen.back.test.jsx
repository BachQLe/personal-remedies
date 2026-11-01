// @vitest-environment jsdom
/**
 * Search results Back (Mory's 30 Oct review, 2.4): returns to the input with the
 * query intact, and an in-flight search never reads as "No matches".
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ searchEverything: vi.fn(), buildRecipeDetail: vi.fn(), getGroupLabel: vi.fn(async (c) => c) }));
vi.mock('../../../api/api.js', () => api);
vi.mock('framer-motion', () => ({
  motion: { div: ({ children, className }) => <div className={className}>{children}</div>, button: ({ children, ...p }) => <button {...p}>{children}</button> },
  AnimatePresence: ({ children }) => <>{children}</>,
}));
vi.mock('../../../components/FoodDetailCard.jsx', () => ({ default: () => null }));
vi.mock('../../../context/SnackbarContext.jsx', () => ({ useSnackbar: () => ({ show: vi.fn() }) }));
vi.mock('../GoodForMeSheet.jsx', () => ({ default: () => null }));

import SearchScreen from '../SearchScreen.jsx';

const DAIKON = { kind: 'food', key: 'food-382', food: { id: 382, name: 'Daikon', group: 'e', fineGroup: 'e' } };
const sections = (foods = []) => ({ foods, recipes: [], nutrients: [], herbals: [] });
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

let container;
let root;
let onClose;

function SearchProbe() {
  return <output data-testid="url-search" hidden>{useLocation().search}</output>;
}

const mount = (entry = '/app/search') => act(async () => {
  root.render(
    <MemoryRouter initialEntries={[entry]}>
      <SearchScreen active onClose={onClose} />
      <SearchProbe />
    </MemoryRouter>
  );
});
const input = () => container.querySelector('input');
const back = () => container.querySelector('button[aria-label="Go back"]');

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  onClose = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  api.searchEverything.mockReset();
  api.searchEverything.mockResolvedValue(sections([DAIKON]));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.localStorage.clear();
});

describe('SearchScreen results and Back', () => {
  it('restores the query and results from the URL', async () => {
    await mount('/app/search?q=daikon');
    await flush();
    expect(input().value).toBe('daikon');
    expect(container.textContent).toContain('Daikon');
  });

  it('shows PR\'s serving size on a food result only when it has one', async () => {
    api.searchEverything.mockResolvedValue(sections([
      DAIKON,
      { kind: 'food', key: 'food-588', food: { id: 588, name: 'Margarine (salted)', group: 'g', fineGroup: 'g2' } },
    ]));
    await mount('/app/search?q=a');
    await flush();
    expect(container.textContent.match(/Serving size: /g)).toHaveLength(1);
    expect(container.textContent).toContain('Serving size: 20 g');
  });

  it('first Back leaves the results for the input, keeping the query and the URL', async () => {
    await mount('/app/search?q=daikon');
    await flush();
    act(() => back().click());
    expect(container.textContent).not.toContain('Daikon');
    expect(input().value).toBe('daikon');
    expect(container.querySelector('[data-testid="url-search"]').textContent).toBe('?q=daikon');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('second Back leaves search', async () => {
    await mount('/app/search?q=daikon');
    await flush();
    act(() => back().click());
    act(() => back().click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Back with nothing typed leaves search straight away', async () => {
    await mount();
    act(() => back().click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has no X in the search field', async () => {
    await mount('/app/search?q=daikon');
    await flush();
    expect(container.querySelector('button[aria-label="Clear search"]')).toBeNull();
  });

  it('never shows "No matches" while the search is in flight', async () => {
    let finish;
    api.searchEverything.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    await mount();
    await flush();
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    await act(async () => {
      setValue.call(input(), 'daikon');
      input().dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.textContent).not.toContain('No matches');
    await act(async () => { await new Promise((r) => setTimeout(r, 320)); });
    expect(container.textContent).not.toContain('No matches');
    await act(async () => { finish(sections()); await new Promise((r) => setTimeout(r, 0)); });
    expect(container.textContent).toContain('No matches');
  });
});
