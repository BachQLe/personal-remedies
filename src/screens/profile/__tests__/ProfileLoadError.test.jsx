// @vitest-environment jsdom
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/api.js', () => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
  getConditionNames: vi.fn(async () => []),
  getConditions: vi.fn(async () => []),
}));
vi.mock('../../../api/messages.js', () => ({ getActiveMessages: vi.fn(async () => []) }));
vi.mock('../../../api/profileSync.js', () => ({ pullProfile: vi.fn() }));
vi.mock('../../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn(), signInWithEmail: vi.fn(), isSupabaseConfigured: false }),
}));

import { getProfile } from '../../../api/api.js';
import ProfileScreen from '../ProfileScreen.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('ProfileScreen load failure', () => {
  it('shows an error with Retry (no demo data), and retry reloads', async () => {
    getProfile.mockRejectedValueOnce(new Error('boom'));
    getProfile.mockResolvedValueOnce({ firstName: 'Ada', conditions: [], medications: [] });
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    await act(async () => { root.render(h(MemoryRouter, null, h(ProfileScreen))); });
    expect(el.textContent).not.toContain('Metformin');
    const retry = [...el.querySelectorAll('button')].find((b) => /try again|retry/i.test(b.textContent));
    expect(retry).toBeTruthy();
    await act(async () => { retry.click(); });
    expect(el.textContent).toContain('Ada');
    expect(el.textContent).toContain('Help & feedback');
    await act(async () => root.unmount());
  });
});
