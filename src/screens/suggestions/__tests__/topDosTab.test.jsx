// @vitest-environment jsdom
/**
 * topDosTab.test.jsx — Top Dos & Don'ts list rows: no reference-count badge
 * (4.13), "Nutri is thinking…" under the bespoke skeleton (4.14), and the
 * partial-coverage line (4.2).
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getTopDosAndDonts: vi.fn(),
  getCachedRefCount: vi.fn(() => 12),
}));
vi.mock('../../../api/api.js', () => api);
vi.mock('../profileFallback.js', () => ({
  resolveProfileWithConditions: async () => ({ conditions: [203, 244] }),
}));

import { storage } from '../../../api/storage.js';
import TopDosTab from '../TopDosTab.jsx';

let container;
let root;
const mount = () => act(async () => { root.render(<TopDosTab onSelectFood={vi.fn()} />); });

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  storage.set('profile', { conditions: [203, 244] });
  api.getTopDosAndDonts.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('TopDosTab', () => {
  it('4.13: rows carry no "N references" badge even when a count is cached', async () => {
    api.getTopDosAndDonts.mockResolvedValue({ items: [{ id: 1, name: 'Blueberries', group: 'd' }], unscorableReason: null });
    await mount();
    expect(container.textContent).toContain('Blueberries');
    expect(container.textContent).not.toMatch(/reference/i);
    expect(api.getCachedRefCount).not.toHaveBeenCalled();
  });

  it('4.14: the skeleton is followed by the slow-load note while the fetch is pending', async () => {
    api.getTopDosAndDonts.mockReturnValue(new Promise(() => {}));
    await mount();
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
    expect(container.querySelector('[role="status"]').textContent).toBe('Nutri is thinking…');
  });

  it('4.2: names the covered and uncovered conditions for a partial result', async () => {
    api.getTopDosAndDonts.mockResolvedValue({
      items: [{ id: 1, name: 'Blueberries', group: 'd' }],
      unscorableReason: "We can't score food for Gout yet.",
      coverage: { scored: ['Aging'], unscored: ['Gout'] },
    });
    await mount();
    expect(container.textContent).toContain('Showing guidance for: Aging. Not yet available for: Gout.');
  });
});
