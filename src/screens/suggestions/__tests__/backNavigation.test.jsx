// @vitest-environment jsdom
/**
 * backNavigation.test.jsx — checklist 4.10 for the guidance screens: Back
 * from a group detail screen returns to where the user actually was (the tab
 * they had open), with the old hardcoded route only as a deep-link fallback;
 * and switching tabs REPLACES the history entry instead of piling up entries.
 *
 * Only presentational/data children are stubbed; SuggestionsScreen,
 * GroupDetailScreen, FineGroupDetailScreen, BackButton and react-router are real.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/api.js', () => ({
  getMealPlanSuggestions: vi.fn(() => new Promise(() => {})),
  buildRecipeDetail: vi.fn(),
  getGroupLabel: vi.fn(async (c) => c),
  getFineFoodGroups: vi.fn(async () => [{ code: 'b1', label: 'Fish & Seafood', coarse: 'b' }]),
  getFineGroupSuggestions: vi.fn(() => new Promise(() => {})),
  getProfile: vi.fn(async () => ({ conditions: [203] })),
}));
// jsdom never completes AnimatePresence exit animations, so the old tab would never unmount.
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }) => children,
  motion: { div: ({ children }) => <div>{children}</div> },
}));
vi.mock('../../../context/SnackbarContext.jsx', () => ({ useSnackbar: () => ({ show: vi.fn() }) }));
vi.mock('../../../components/FoodDetailCard.jsx', () => ({ default: () => null }));
vi.mock('../../../components/shared/BestRecipesRails.jsx', () => ({ default: () => null }));
vi.mock('../TopDosTab.jsx', () => ({ default: () => <div data-testid="top-tab" /> }));
vi.mock('../CategoryDetailPanel.jsx', () => ({ default: () => <div data-testid="detail-panel" /> }));
vi.mock('../FoodGroupsTab.jsx', () => ({
  default: function GroupsStub() {
    const navigate = useNavigate();
    return <button type="button" onClick={() => navigate('/app/suggestions/group/b')}>open group b</button>;
  },
}));

import SuggestionsScreen from '../SuggestionsScreen.jsx';
import GroupDetailScreen from '../GroupDetailScreen.jsx';
import FineGroupDetailScreen from '../FineGroupDetailScreen.jsx';

let container;
let root;

function Probe() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="loc">{pathname + search}</output>
      <button type="button" onClick={() => navigate(-1)}>history back</button>
    </>
  );
}

const mount = (entries, index) => act(async () => {
  root.render(
    <MemoryRouter initialEntries={entries} initialIndex={index}>
      <Routes>
        <Route path="/app/suggestions" element={<SuggestionsScreen />} />
        <Route path="/app/suggestions/group/:groupId" element={<GroupDetailScreen />} />
        <Route path="/app/suggestions/fine/:fineGroupId" element={<FineGroupDetailScreen />} />
        <Route path="*" element={<div />} />
      </Routes>
      <Probe />
    </MemoryRouter>
  );
});
const loc = () => container.querySelector('[data-testid="loc"]').textContent;
const click = (text) => act(async () => {
  [...container.querySelectorAll('button')].find((b) => b.textContent === text
    || b.getAttribute('aria-label') === text).click();
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('SuggestionsScreen tab state lives in the URL', () => {
  it('switching tabs writes ?tab= and REPLACES the entry (history back leaves the screen, not the previous tab)', async () => {
    await mount(['/home', '/app/suggestions'], 1);
    expect(container.querySelector('[data-testid="top-tab"]')).toBeTruthy();

    await click('Food Groups');
    expect(loc()).toBe('/app/suggestions?tab=groups');
    await click('Recipes');
    expect(loc()).toBe('/app/suggestions?tab=recipes');

    await click('history back');
    expect(loc()).toBe('/home');
  });

  it('Back from a group detail screen returns to the tab the user was on', async () => {
    await mount(['/app/suggestions'], 0);
    await click('Food Groups');
    await click('open group b');
    expect(loc()).toBe('/app/suggestions/group/b');

    await click('Go back');
    expect(loc()).toBe('/app/suggestions?tab=groups');
    expect(container.textContent).toContain('open group b'); // Food Groups tab body, not the default Dos & Don'ts
    expect(container.querySelector('[data-testid="top-tab"]')).toBeNull();
  });
});

describe('detail screens fall back only when there is no history (deep link)', () => {
  it('coarse group deep link -> Back lands on the Food Groups tab', async () => {
    await mount(['/app/suggestions/group/b'], 0);
    await click('Go back');
    expect(loc()).toBe('/app/suggestions?tab=groups');
  });

  it('fine group deep link -> Back lands on the Fine groups mode', async () => {
    await mount(['/app/suggestions/fine/b1'], 0);
    await click('Go back');
    expect(loc()).toBe('/app/suggestions?tab=groups&mode=fine');
  });

  it('with history, Back goes to the previous entry, not the hardcoded route', async () => {
    await mount(['/app/plan', '/app/suggestions/fine/b1'], 1);
    await click('Go back');
    expect(loc()).toBe('/app/plan');
  });
});
