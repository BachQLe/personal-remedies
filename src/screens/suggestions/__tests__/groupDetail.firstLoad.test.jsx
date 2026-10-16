// @vitest-environment jsdom
/**
 * groupDetail.firstLoad.test.jsx — checklist 4.11 ("Basic Groups 'not found'
 * on first load"). Real useAsyncData + api/adapter/cache/localTables; only
 * the network layer (nutridigm.js) and FoodDetailCard are mocked.
 *
 * Findings pinned here:
 *   - A group (coarse or fine) whose data is still in flight renders the
 *     loading skeleton — never the empty copy, never a redirect.
 *   - The group TABLE can't be "not loaded yet": it's a bundled JSON import.
 *   - REPRO of the first-load bug: api.js's getProfile() used to return a
 *     snapshot taken at module load (it now re-reads storage on every call),
 *     but profileSync.pullProfile() writes the profile straight to storage
 *     (after sign-in). The guidance screens then fetched with
 *     `conditions: []` and rendered the "nothing ranked" empty state until a
 *     full reload. profileFallback.js reads storage directly.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const net = vi.hoisted(() => ({ fetchDetailed: vi.fn(), fetchSuggest: vi.fn() }));
vi.mock('../../../api/nutridigm.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchDetailed: net.fetchDetailed,
  fetchSuggest: net.fetchSuggest,
  fetchReferences: vi.fn(async () => []),
}));
vi.mock('../../../components/FoodDetailCard.jsx', () => ({ default: () => null }));

import { storage } from '../../../api/storage.js';
import { clearCache } from '../../../api/cache.js';
import GroupDetailScreen from '../GroupDetailScreen.jsx';
import FineGroupDetailScreen from '../FineGroupDetailScreen.jsx';

const EMPTY_COPY = 'ranked higher for your health profile';
let container;
let root;

function defer() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function mount(entry) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/app/suggestions/group/:groupId" element={<GroupDetailScreen />} />
          <Route path="/app/suggestions/fine/:fineGroupId" element={<FineGroupDetailScreen />} />
          <Route path="/app/suggestions" element={<div data-testid="bounced" />} />
        </Routes>
      </MemoryRouter>
    );
  });
}

// Lets useAsyncData's Promise.resolve().then(fetcher) + getProfile()'s 200 ms delay settle.
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 300)); });

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  clearCache();
  net.fetchDetailed.mockReset();
  net.fetchSuggest.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('4.11 — a group whose data is in flight shows loading, not "not found"', () => {
  it('coarse group: skeleton while /detailed is pending, no redirect, no empty copy; rows after', async () => {
    storage.set('profile', { conditions: [203] });
    const pending = defer();
    net.fetchDetailed.mockReturnValue(pending.promise);

    await mount('/app/suggestions/group/b');
    await settle();

    expect(net.fetchDetailed).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="bounced"]')).toBeNull();
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
    expect(container.querySelector('[role="status"]').textContent).toBe('Nutri is thinking…'); // 4.14
    expect(container.textContent).not.toContain(EMPTY_COPY);

    await act(async () => pending.resolve([{ foodItemID: 101, foodItemDisplayAs: 'Salmon' }]));
    expect(container.textContent).toContain('Salmon');
    expect(container.querySelector('.animate-pulse')).toBeNull();
  });

  it('fine group: skeleton while /suggest is pending, no redirect, no empty copy; rows after', async () => {
    storage.set('profile', { conditions: [203] });
    const pending = defer();
    net.fetchSuggest.mockReturnValue(pending.promise);

    await mount('/app/suggestions/fine/b1');
    await settle();

    expect(net.fetchSuggest).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="bounced"]')).toBeNull();
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
    expect(container.querySelector('[role="status"]').textContent).toBe('Nutri is thinking…'); // 4.14
    expect(container.textContent).not.toContain('ranked for your health profile');

    await act(async () => pending.resolve([
      { foodItemID: 102, foodItemDisplayAs: 'Tuna', descriptionNumericID: 1 },
      { foodItemID: 103, foodItemDisplayAs: 'Swordfish', descriptionNumericID: 6 },
    ]));
    expect(container.textContent).toContain('Tuna');
    // 4.15: the shared FoodRating glyphs, no tier pill text, no digit of the score.
    const labels = [...container.querySelectorAll('[role="img"]')].map((el) => el.getAttribute('aria-label'));
    expect(labels).toEqual([
      '3 of 3 stars — ranked higher for your conditions',
      '2 of 3 skulls — ranked lower for your conditions',
    ]);
    expect(container.textContent).not.toMatch(/\bTop\b|Strong|Good|Poor match/);
  });
});

describe('4.11 — switching Eat/Avoid or group while the next list is in flight', () => {
  const clickPill = (label) => act(async () => {
    [...container.querySelectorAll('button')].find((b) => b.textContent === label).click();
  });

  it('does not keep showing the Eat list under the Avoid tab while Avoid loads', async () => {
    storage.set('profile', { conditions: [203] });
    const avoid = defer();
    net.fetchDetailed.mockImplementation((_ids, _group, listType) =>
      (listType === 'helpful'
        ? Promise.resolve([{ foodItemID: 101, foodItemDisplayAs: 'Salmon' }])
        : avoid.promise));

    await mount('/app/suggestions/group/b');
    await settle();
    expect(container.textContent).toContain('Salmon');

    await clickPill('Avoid');
    await settle();
    expect(container.textContent).not.toContain('Salmon');
    expect(container.querySelector('.animate-pulse')).toBeTruthy();

    await act(async () => avoid.resolve([{ foodItemID: 103, foodItemDisplayAs: 'Bologna' }]));
    expect(container.textContent).toContain('Bologna');
  });
});

describe('4.11 — REPRO: profile written to storage after api.js loaded (profileSync pull)', () => {
  it('requests /detailed with the stored conditions instead of rendering the empty state', async () => {
    // api.js already loaded (static import above) with NO profile in storage;
    // this is exactly what pullProfile() does after a sign-in on a fresh device.
    storage.set('profile', { firstName: 'Mory', conditions: [203, 244], calorieTarget: 2000 });
    net.fetchDetailed.mockResolvedValue([{ foodItemID: 101, foodItemDisplayAs: 'Salmon' }]);

    await mount('/app/suggestions/group/b');
    await settle();

    expect(net.fetchDetailed).toHaveBeenCalledWith('203,244', 'b', 'helpful');
    expect(container.textContent).toContain('Salmon');
    expect(container.textContent).not.toContain(EMPTY_COPY);
  });
});
