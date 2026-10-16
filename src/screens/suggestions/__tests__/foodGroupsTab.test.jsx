// @vitest-environment jsdom
/**
 * foodGroupsTab.test.jsx — guards FoodGroupsTab.jsx's basic/fine mode
 * toggle: the resolveMode() URL-resolution rules (default 'basic', explicit
 * ?mode=fine / ?mode=basic, and the retired ?tab=suggest 4th-pill alias
 * resolving to 'fine' — see this file's and FoodGroupsTab.jsx's docblocks),
 * and that a manual PillSwitcher tap actually swaps which list renders.
 *
 * GroupsTab and SuggestTab are mocked out — their own data/loading/skeleton
 * behavior is covered by their own tests; this file only exercises which of
 * the two FoodGroupsTab mounts and what it renders alongside it.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';

vi.mock('../GroupsTab.jsx', () => ({ default: () => <div data-testid="groups-tab" /> }));
vi.mock('../SuggestTab.jsx', () => ({ default: () => <div data-testid="suggest-tab" /> }));

import FoodGroupsTab, { resolveMode } from '../FoodGroupsTab.jsx';

// ── resolveMode (pure function) ──────────────────────────────────────────────

function params(search) {
  return new URLSearchParams(search);
}

describe('resolveMode', () => {
  it('defaults to basic with no mode param', () => {
    expect(resolveMode(params(''))).toBe('basic');
    expect(resolveMode(params('tab=groups'))).toBe('basic');
  });

  it('resolves explicit ?mode=basic and ?mode=fine', () => {
    expect(resolveMode(params('tab=groups&mode=basic'))).toBe('basic');
    expect(resolveMode(params('tab=groups&mode=fine'))).toBe('fine');
  });

  it('treats any unrecognized mode value as basic', () => {
    expect(resolveMode(params('mode=bogus'))).toBe('basic');
  });

  it('resolves the retired ?tab=suggest 4th-pill alias to fine', () => {
    expect(resolveMode(params('tab=suggest'))).toBe('fine');
    // The alias wins even if a (nonsensical) mode=basic rides along, since
    // ?tab=suggest predates 'mode' entirely.
    expect(resolveMode(params('tab=suggest&mode=basic'))).toBe('fine');
  });
});

// ── Component ────────────────────────────────────────────────────────────────

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

function mount(initialEntry, entries = [initialEntry]) {
  return act(async () => {
    root.render(
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        <FoodGroupsTab />
        <Probe />
      </MemoryRouter>
    );
  });
}

function clickPillByLabel(label) {
  const button = [...container.querySelectorAll('button')].find(
    (b) => b.textContent === label
  );
  return act(async () => button.click());
}

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

describe('FoodGroupsTab', () => {
  it('defaults to basic mode: renders GroupsTab and the basic subtitle', async () => {
    await mount('/app/suggestions?tab=groups');
    expect(container.querySelector('[data-testid="groups-tab"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="suggest-tab"]')).toBeNull();
    expect(container.textContent).toContain('Ten broad categories, good for an everyday look.');
    expect(container.textContent).toContain('Basic groups');
    expect(container.textContent).toContain('Fine groups');
  });

  it('?mode=fine deep-links straight into fine mode: renders SuggestTab and the fine subtitle', async () => {
    await mount('/app/suggestions?tab=groups&mode=fine');
    expect(container.querySelector('[data-testid="suggest-tab"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="groups-tab"]')).toBeNull();
    expect(container.textContent).toContain('Narrower groups, good for finding a swap for a food.');
  });

  it('?tab=suggest alias also lands in fine mode', async () => {
    await mount('/app/suggestions?tab=suggest');
    expect(container.querySelector('[data-testid="suggest-tab"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="groups-tab"]')).toBeNull();
  });

  it('a manual tap on "Fine groups" swaps from GroupsTab to SuggestTab (pure client-side, no refetch)', async () => {
    await mount('/app/suggestions?tab=groups');
    expect(container.querySelector('[data-testid="groups-tab"]')).toBeTruthy();

    await clickPillByLabel('Fine groups');

    expect(container.querySelector('[data-testid="suggest-tab"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="groups-tab"]')).toBeNull();
    expect(container.textContent).toContain('Narrower groups, good for finding a swap for a food.');
  });

  it('a manual tap back to "Basic groups" swaps back to GroupsTab', async () => {
    await mount('/app/suggestions?tab=groups&mode=fine');
    expect(container.querySelector('[data-testid="suggest-tab"]')).toBeTruthy();

    await clickPillByLabel('Basic groups');

    expect(container.querySelector('[data-testid="groups-tab"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="suggest-tab"]')).toBeNull();
    expect(container.textContent).toContain('Ten broad categories, good for an everyday look.');
  });
});

describe('FoodGroupsTab mode lives in the URL (checklist 4.10)', () => {
  it('a toggle tap writes ?tab=groups&mode= and replaces the history entry', async () => {
    await mount('/app/suggestions?tab=groups', ['/home', '/app/suggestions?tab=groups']);

    await clickPillByLabel('Fine groups');
    expect(container.querySelector('[data-testid="loc"]').textContent).toBe('/app/suggestions?tab=groups&mode=fine');

    await clickPillByLabel('Basic groups');
    expect(container.querySelector('[data-testid="loc"]').textContent).toBe('/app/suggestions?tab=groups&mode=basic');

    await clickPillByLabel('history back');
    expect(container.querySelector('[data-testid="loc"]').textContent).toBe('/home');
  });

  it('tapping the already-active mode changes nothing', async () => {
    await mount('/app/suggestions?tab=groups&mode=fine');
    await clickPillByLabel('Fine groups');
    expect(container.querySelector('[data-testid="loc"]').textContent).toBe('/app/suggestions?tab=groups&mode=fine');
  });

  it('the retired ?tab=suggest alias drops off once a mode is chosen', async () => {
    await mount('/app/suggestions?tab=suggest');
    await clickPillByLabel('Basic groups');
    expect(container.querySelector('[data-testid="loc"]').textContent).toBe('/app/suggestions?tab=groups&mode=basic');
    expect(container.querySelector('[data-testid="groups-tab"]')).toBeTruthy();
  });
});
