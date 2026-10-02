// @vitest-environment jsdom
/**
 * fineGroupDetailScreen.routeValidation.test.jsx — guards
 * FineGroupDetailScreen.jsx's route-param validation: an unknown
 * `:fineGroupId` must redirect to the Food Groups tab's fine mode
 * (/app/suggestions?tab=groups&mode=fine), a known one must not, and
 * — because the valid-code set comes from the ASYNC getFineFoodGroups()
 * (unlike GroupDetailScreen's synchronous CATEGORY_GRID_GROUPS constant) —
 * the in-flight resolution window must never flash a redirect for a code
 * that simply hasn't been checked yet.
 *
 * useAsyncData and every presentational child are mocked out so this test
 * exercises only the screen's own validation logic, not data fetching or
 * child rendering (those are covered elsewhere — RankedRow, DataState,
 * FoodDetailCard, CoverageNotice all have their own tests/are exercised via
 * manual verification).
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getFineFoodGroups: vi.fn(),
  getFineGroupSuggestions: vi.fn(),
  getGroupLabel: vi.fn(() => Promise.resolve('Fish & Seafood')),
  getProfile: vi.fn(() => Promise.resolve({ conditions: [9001] })),
}));
vi.mock('../../../api/api.js', () => api);

const routerState = vi.hoisted(() => ({ params: { fineGroupId: 'b1' } }));
vi.mock('react-router-dom', () => ({
  useParams: () => routerState.params,
  useNavigate: () => vi.fn(),
  Navigate: ({ to }) => <div data-testid="navigate" data-to={to} />,
}));

vi.mock('../../../hooks/useAsyncData.js', () => ({
  useAsyncData: () => ({ status: 'loading', data: undefined, retry: vi.fn() }),
}));

vi.mock('../../../components/FoodDetailCard.jsx', () => ({ default: () => null }));
vi.mock('../../../components/shared/RankedRow.jsx', () => ({ default: () => null }));
vi.mock('../../../components/shared/PageHeader.jsx', () => ({
  default: ({ children }) => <div>{children}</div>,
}));
vi.mock('../../../components/shared/GlassPanel.jsx', () => ({
  default: ({ children }) => <div>{children}</div>,
}));
vi.mock('../../../components/shared/BackButton.jsx', () => ({
  default: () => <button aria-label="Go back" />,
}));
vi.mock('../../../components/shared/DataState.jsx', () => ({ default: () => null }));
vi.mock('../CoverageNotice.jsx', () => ({ default: () => null }));
vi.mock('../ProfileSetupAction.jsx', () => ({ default: () => null }));

import FineGroupDetailScreen from '../FineGroupDetailScreen.jsx';

let container;
let root;

function defer() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function mount() {
  await act(async () => { root.render(<FineGroupDetailScreen />); });
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.resetAllMocks();
  api.getGroupLabel.mockResolvedValue('Fish & Seafood');
  api.getProfile.mockResolvedValue({ conditions: [9001] });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('FineGroupDetailScreen route-param validation', () => {
  it('does not redirect for a known fine-group code once the menu resolves', async () => {
    routerState.params = { fineGroupId: 'b1' };
    api.getFineFoodGroups.mockResolvedValue([
      { code: 'b1', label: 'Fish & Seafood', coarse: 'b' },
      { code: 'b2', label: 'Meat, Red Meat & Organ Meats', coarse: 'b' },
    ]);
    await mount();
    expect(container.querySelector('[data-testid="navigate"]')).toBeNull();
  });

  it('redirects to the Suggest tab for an unknown fine-group code once the menu resolves', async () => {
    routerState.params = { fineGroupId: 'not-a-real-code' };
    api.getFineFoodGroups.mockResolvedValue([
      { code: 'b1', label: 'Fish & Seafood', coarse: 'b' },
    ]);
    await mount();
    const nav = container.querySelector('[data-testid="navigate"]');
    expect(nav).toBeTruthy();
    expect(nav.getAttribute('data-to')).toBe('/app/suggestions?tab=groups&mode=fine');
  });

  it('never flashes a redirect while the real code list is still resolving', async () => {
    routerState.params = { fineGroupId: 'b1' };
    const menu = defer();
    api.getFineFoodGroups.mockReturnValue(menu.promise);
    await mount();
    // Still in-flight — must not have redirected yet, valid or not.
    expect(container.querySelector('[data-testid="navigate"]')).toBeNull();
    await act(async () => menu.resolve([{ code: 'b1', label: 'Fish & Seafood', coarse: 'b' }]));
    // Resolved as valid — still no redirect.
    expect(container.querySelector('[data-testid="navigate"]')).toBeNull();
  });

  it('redirects if the menu fails to resolve at all (no known-valid code to render against)', async () => {
    routerState.params = { fineGroupId: 'b1' };
    api.getFineFoodGroups.mockRejectedValue(new Error('network down'));
    await mount();
    const nav = container.querySelector('[data-testid="navigate"]');
    expect(nav).toBeTruthy();
    expect(nav.getAttribute('data-to')).toBe('/app/suggestions?tab=groups&mode=fine');
  });
});
