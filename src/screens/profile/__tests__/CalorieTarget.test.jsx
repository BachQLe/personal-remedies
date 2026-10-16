// @vitest-environment jsdom
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/api.js', () => ({
  getProfile: vi.fn(async () => ({ firstName: 'Ada', conditions: [], medications: [] })),
  saveProfile: vi.fn(),
  getConditionNames: vi.fn(async () => []),
  getConditions: vi.fn(async () => []),
}));
vi.mock('../../../api/messages.js', () => ({ getActiveMessages: vi.fn(async () => []) }));
vi.mock('../../../api/profileSync.js', () => ({ pullProfile: vi.fn(), cancelPendingPush: vi.fn() }));
vi.mock('../../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn(), signInWithEmail: vi.fn(), isSupabaseConfigured: false }),
}));

import { saveProfile } from '../../../api/api.js';
import ProfileScreen from '../ProfileScreen.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const dialogBtn = (re) => [...document.querySelectorAll('[role="dialog"] button')].find((b) => re.test(b.textContent));

async function openSheet() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => { root.render(h(MemoryRouter, null, h(ProfileScreen))); });
  const row = [...el.querySelectorAll('button')].find((b) => b.textContent.includes('Daily calorie target'));
  await act(async () => row.click());
  return root;
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('calorie target presets', () => {
  it.each([
    ['Men · 2,250', 2250],
    ['Women · 1,800', 1800],
  ])('%s fills the field and saves only the number', async (label, kcal) => {
    await openSheet();
    expect(document.getElementById('calorie-target-input').value).toBe('2000'); // fallback
    await act(async () => dialogBtn(new RegExp(`^${label}$`)).click());
    expect(document.getElementById('calorie-target-input').value).toBe(String(kcal));
    await act(async () => dialogBtn(/^Save$/).click());
    expect(saveProfile).toHaveBeenCalledTimes(1);
    const saved = saveProfile.mock.calls[0][0];
    expect(saved.calorieTarget).toBe(kcal);
    expect(saved).not.toHaveProperty('sex');
  });

  it('field stays editable after picking a preset', async () => {
    await openSheet();
    await act(async () => dialogBtn(/^Men/).click());
    const input = document.getElementById('calorie-target-input');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '1950');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => dialogBtn(/^Save$/).click());
    expect(saveProfile.mock.calls[0][0].calorieTarget).toBe(1950);
  });
});
