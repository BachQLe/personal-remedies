// @vitest-environment jsdom
/**
 * FavoritesPruneNotice.test.jsx - checklist 1.26: silent apply when nothing is
 * low ranked, a notice (applied on OK or dismiss) when something is, and no
 * action at all when scoring is unreachable (retried on the next trigger).
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  pending: false,
  getProfile: vi.fn(async () => ({ conditions: [203] })),
  findRecipesToPrune: vi.fn(),
  applyFavoritesPrune: vi.fn(async () => ({ ok: true })),
}));
vi.mock('../../../api/api.js', () => ({
  getProfile: api.getProfile,
  isFavoritesPrunePending: () => api.pending,
  findRecipesToPrune: api.findRecipesToPrune,
  applyFavoritesPrune: api.applyFavoritesPrune,
}));

import FavoritesPruneNotice from '../FavoritesPruneNotice.jsx';
import { storage } from '../../../api/storage.js';

let container;
let root;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const mount = async () => {
  await act(async () => { root.render(<FavoritesPruneNotice />); });
  await flush();
};
const dialog = () => container.ownerDocument.querySelector('[role="dialog"]');

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  api.pending = false;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('FavoritesPruneNotice', () => {
  it('does nothing when no prune is pending', async () => {
    await mount();
    expect(api.findRecipesToPrune).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();
  });

  it('applies silently, without a notice, when nothing is low ranked', async () => {
    api.pending = true;
    api.findRecipesToPrune.mockResolvedValue({ ok: true, recipes: [], scores: {} });
    await mount();
    expect(api.applyFavoritesPrune).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeNull();
  });

  it('lists the recipes first and applies only when OK is tapped', async () => {
    api.pending = true;
    const result = { ok: true, recipes: [{ id: 1, name: 'Bacon bowl' }, { id: 2, name: 'Fried pie' }], scores: {} };
    api.findRecipesToPrune.mockResolvedValue(result);
    await mount();

    expect(dialog().textContent).toContain('Your favorites changed');
    expect(dialog().textContent).toContain('now rank low for your profile');
    expect(dialog().textContent).toContain('Bacon bowl');
    expect(dialog().textContent).toContain('Fried pie');
    expect(api.applyFavoritesPrune).not.toHaveBeenCalled();

    const ok = [...dialog().querySelectorAll('button')].find((b) => b.textContent === 'OK');
    await act(async () => { ok.click(); });
    expect(api.applyFavoritesPrune).toHaveBeenCalledWith(result, { conditions: [203] });
    expect(dialog()).toBeNull();
  });

  it('also applies when the notice is dismissed', async () => {
    api.pending = true;
    api.findRecipesToPrune.mockResolvedValue({ ok: true, recipes: [{ id: 1, name: 'Bacon bowl' }], scores: {} });
    await mount();
    await act(async () => { dialog().ownerDocument.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(api.applyFavoritesPrune).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeNull();
  });

  it('keeps the flag when scoring is unreachable, then retries when the flag is written again', async () => {
    api.pending = true;
    api.findRecipesToPrune.mockResolvedValueOnce({ ok: false });
    await mount();
    expect(api.applyFavoritesPrune).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();

    api.findRecipesToPrune.mockResolvedValueOnce({ ok: true, recipes: [], scores: {} });
    storage.set('favoritesPrunePending', true);
    await flush();
    expect(api.findRecipesToPrune).toHaveBeenCalledTimes(2);
    expect(api.applyFavoritesPrune).toHaveBeenCalledTimes(1);
  });
});
