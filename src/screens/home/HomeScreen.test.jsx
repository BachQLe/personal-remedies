// @vitest-environment jsdom
/**
 * Home's meal-plan module (Prompt B 1.1): three states, read from the plan on
 * the device, never a network call on Home load.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/messages.js', () => ({ getActiveMessages: vi.fn(async () => []), dismissMessage: vi.fn() }));

import HomeScreen from './HomeScreen.jsx';
import { storage } from '../../api/storage.js';
import { reloadPlan, setPlan } from '../../state/dailyPlan.js';
import { todayKey } from '../plan/planDates.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container;
let root;

const empty = { breakfast: [], lunch: [], dinner: [], snacks: [], beverages: [] };
const planWithToday = (slots) => ({
  version: 2, conditionsKey: '203', conditionNames: ['Aging'], days: { [todayKey()]: { slots: { ...empty, ...slots }, eaten: [] } },
});
const module = () => container.querySelector('.home-screen__body > a');

async function mount() {
  await act(async () => {
    root.render(<MemoryRouter><HomeScreen /></MemoryRouter>);
  });
}

beforeEach(() => {
  storage.clear();
  reloadPlan();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  storage.clear();
  reloadPlan();
  vi.restoreAllMocks();
});

describe('HomeScreen meal-plan module', () => {
  it('asks for a health profile when there are no conditions', async () => {
    storage.set('profile', { firstName: 'Amy', conditions: [] });
    await mount();
    expect(module().textContent).toBe('Create your health profile to get meal suggestions');
    expect(module().getAttribute('href')).toBe('/app/profile');
  });

  it('points to My Favorites when there is a profile but no plan', async () => {
    storage.set('profile', { conditions: [203] });
    await mount();
    expect(module().textContent).toBe('Pick your favorites to build your week');
    expect(module().getAttribute('href')).toBe('/app/favorites');
  });

  it("shows today's meals, first item per meal, Breakfast to Beverages, linking to that day", async () => {
    storage.set('profile', { conditions: [203] });
    setPlan(planWithToday({
      breakfast: [{ id: 1, name: 'Oatmeal' }, { id: 2, name: 'Toast' }],
      dinner: [{ id: 3, name: 'Salmon Baked in Foil' }],
      beverages: [{ id: 4, name: 'Green tea' }],
    }));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await mount();

    const rows = [...module().querySelectorAll('dl > div')].map((row) => [row.querySelector('dt').textContent, row.querySelector('dd').textContent]);
    expect(rows).toEqual([['Breakfast', 'Oatmeal'], ['Dinner', 'Salmon Baked in Foil'], ['Beverages', 'Green tea']]);
    expect(module().getAttribute('href')).toBe(`/app/plan?day=${todayKey()}`);
    expect(container.textContent).not.toMatch(/loading/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('has small How to use and Important Notes links', async () => {
    storage.set('profile', { conditions: [203] });
    await mount();
    const links = [...container.querySelectorAll('nav[aria-label="About the app"] a')].map((a) => [a.textContent, a.getAttribute('href')]);
    expect(links).toEqual([['How to use', '/app/how-to-use'], ['Important Notes', '/app/profile/important-notes']]);
  });
});
