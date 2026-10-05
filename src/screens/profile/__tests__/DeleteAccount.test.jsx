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
let mockUser = null;
vi.mock('../../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: mockUser, signOut: vi.fn(), signInWithEmail: vi.fn(), isSupabaseConfigured: true }),
}));
const invoke = vi.fn();
const del = vi.fn();
const signOut = vi.fn(async () => ({}));
vi.mock('../../../lib/supabase.js', () => ({
  isSupabaseConfigured: true,
  supabase: {
    functions: { invoke: (...a) => invoke(...a) },
    from: () => ({ delete: () => ({ eq: (...a) => del(...a) }) }),
    auth: { signOut: (...a) => signOut(...a) },
  },
}));

import { storage } from '../../../api/storage.js';
import ProfileScreen from '../ProfileScreen.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const replace = vi.fn();
Object.defineProperty(window, 'location', { value: { ...window.location, replace }, writable: true });

async function open(label) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => { root.render(h(MemoryRouter, null, h(ProfileScreen))); });
  const row = [...el.querySelectorAll('button')].find((b) => b.textContent === label);
  expect(row).toBeTruthy();
  await act(async () => row.click());
  return { el, root };
}
const btn = (re) => [...document.querySelectorAll('[role="dialog"] button')].find((b) => re.test(b.textContent));

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
  storage.set('profile', { firstName: 'Ada' });
  window.localStorage.setItem('remedi.cache.v1.x', '{}');
});

describe('delete account', () => {
  it('guest: needs confirm tap, then clears device and routes to onboarding', async () => {
    mockUser = null;
    await open('Delete my data');
    expect(storage.get('profile')).toBeTruthy(); // opening the sheet deletes nothing
    expect(document.body.textContent).toContain("can't be undone");
    expect(btn(/cancel/i)).toBeTruthy();
    await act(async () => btn(/^Delete my data$/).click());
    expect(storage.get('profile')).toBeNull();
    expect(window.localStorage.getItem('remedi.cache.v1.x')).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/onboarding');
  });

  it('signed in success: function called, signed out, local cleared', async () => {
    mockUser = { id: 'u1', email: 'a@b.c' };
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await open('Delete account & data');
    expect(invoke).not.toHaveBeenCalled();
    await act(async () => btn(/^Delete account & data$/).click());
    expect(invoke).toHaveBeenCalledWith('delete-account', { method: 'POST' });
    expect(signOut).toHaveBeenCalled();
    expect(storage.get('profile')).toBeNull();
    expect(replace).toHaveBeenCalledWith('/onboarding');
  });

  it('failure: keeps data, stays signed in, shows Retry', async () => {
    mockUser = { id: 'u1', email: 'a@b.c' };
    invoke.mockResolvedValue({ data: null, error: { context: { status: 500 } } });
    await open('Delete account & data');
    await act(async () => btn(/^Delete account & data$/).click());
    expect(storage.get('profile')).toEqual({ firstName: 'Ada' });
    expect(signOut).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Nothing was deleted');
    expect(btn(/^Retry$/)).toBeTruthy();
  });

  it('function not deployed (404): deletes rows client-side and says so', async () => {
    mockUser = { id: 'u1', email: 'a@b.c' };
    invoke.mockResolvedValue({ data: null, error: { context: { status: 404 } } });
    del.mockResolvedValue({ error: null });
    await open('Delete account & data');
    await act(async () => btn(/^Delete account & data$/).click());
    expect(del).toHaveBeenCalledWith('id', 'u1');
    expect(storage.get('profile')).toBeNull();
    expect(document.body.textContent).toContain('removed on request');
    expect(document.querySelector('[role="dialog"] a[href^="mailto:"]')).toBeTruthy();
  });
});
