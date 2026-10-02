// @vitest-environment jsdom
/**
 * RecipeLinkSheet.test.js — Guard tests for Track 1D (in-app recipe
 * preview sheet).
 *
 * RecipeLinkSheet is the honest substitute for framing medlineplus.gov
 * (the only recipe source — verified to send
 * `x-frame-options: SAMEORIGIN` + `frame-ancestors 'self'`, so an iframe is
 * impossible): it shows a preview of what the user is about to open, then
 * hands off via a single explicit button that calls `openUrl`
 * (src/api/browser.js) — the only file allowed to touch `window.open`.
 *
 * Uses the same manual mount harness as
 * src/screens/profile/__tests__/WhatsNewSheet.test.js (React's own `act` +
 * `react-dom/client`'s `createRoot`, no @testing-library/react in this
 * repo). `src/api/browser.js` is mocked so the CTA's `openUrl` call can be
 * asserted without touching a real `window.open`.
 *
 * The render container is deliberately left DETACHED from `document.body`
 * (never `appendChild`ed) — RecipeLinkSheet portals its actual sheet
 * content straight into `document.body` via `createPortal` (fixing a real
 * Playwright-verified bug: mounted normally, the sheet inherited
 * FoodDetailCard's `fixed inset-0 z-30` stacking context, which capped its
 * `z-[70]` below the app's TabBar and let TabBar intercept taps on the
 * sheet's button). Leaving the container detached proves the sheet's
 * dialog doesn't depend on the container being in the live document at
 * all — every assertion below queries `document.body`, not `container`.
 */
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/browser.js', () => ({
  openUrl: vi.fn(),
}));

import { openUrl } from '../../api/browser.js';
import RecipeLinkSheet from '../RecipeLinkSheet.jsx';

function mount(element) {
  const container = document.createElement('div'); // deliberately not appended to document.body
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

function findDialog() {
  return document.body.querySelector('[role="dialog"]');
}

const SOURCE_ITEM = {
  name: 'Baked Salmon',
  image: 'https://img/salmon.jpg',
  sourceUrl: 'https://medlineplus.gov/recipes/baked-salmon',
  attribution: 'MedlinePlus',
  nutritionPerServing: { calories: 320 },
};

const NO_CALORIE_ITEM = {
  name: 'Mystery Recipe',
  kind: 'recipe',
  mealType: 'Lunch',
  fineGroup: 'b1', // would produce a group estimate elsewhere — must not leak in here
  sourceName: 'Food Network',
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('RecipeLinkSheet', () => {
  it('portals the sheet dialog into document.body, not the render container', () => {
    const { container, unmount } = mount(
      h(RecipeLinkSheet, { open: true, onClose: () => {}, item: SOURCE_ITEM })
    );

    const dialog = findDialog();
    expect(dialog).toBeTruthy();
    expect(document.body.contains(dialog)).toBe(true);
    expect(container.contains(dialog)).toBe(false);

    unmount();
  });

  it('renders the calorie line when the item has a real per-serving number', () => {
    const { unmount } = mount(
      h(RecipeLinkSheet, { open: true, onClose: () => {}, item: SOURCE_ITEM })
    );

    expect(document.body.textContent).toContain('~320 calories, per serving');

    unmount();
  });

  it('renders no calorie line when the item has no real per-serving number', () => {
    const { unmount } = mount(
      h(RecipeLinkSheet, { open: true, onClose: () => {}, item: NO_CALORIE_ITEM })
    );

    expect(document.body.textContent).not.toContain('calories, per serving');

    unmount();
  });

  it('clicking the hand-off button calls openUrl with the resolved url, and nothing else', () => {
    const { unmount } = mount(
      h(RecipeLinkSheet, { open: true, onClose: () => {}, item: SOURCE_ITEM })
    );

    const button = Array.from(document.body.querySelectorAll('button')).find((btn) =>
      btn.textContent.includes('Open at medlineplus.gov')
    );
    expect(button).toBeTruthy();

    act(() => {
      button.click();
    });

    expect(openUrl).toHaveBeenCalledTimes(1);
    expect(openUrl).toHaveBeenCalledWith('https://medlineplus.gov/recipes/baked-salmon');

    unmount();
  });

  it('shows attribution and hostname for a real source, and renders nothing when closed', () => {
    const { unmount } = mount(
      h(RecipeLinkSheet, { open: true, onClose: () => {}, item: SOURCE_ITEM })
    );
    expect(document.body.textContent).toContain('Directions are hosted by MedlinePlus');
    expect(document.body.textContent).toContain('medlineplus.gov');
    unmount();
    expect(findDialog()).toBeNull();

    const closed = mount(
      h(RecipeLinkSheet, { open: false, onClose: () => {}, item: SOURCE_ITEM })
    );
    expect(findDialog()).toBeNull();
    closed.unmount();
  });

  it('shows honest fallback copy — no false "hosted by" claim — when there is no real sourceUrl', () => {
    const { unmount } = mount(
      h(RecipeLinkSheet, { open: true, onClose: () => {}, item: NO_CALORIE_ITEM })
    );

    expect(document.body.textContent).toContain(
      "We don't have a source link for this recipe yet — search the web for it."
    );
    expect(document.body.textContent).not.toContain('hosted by');
    expect(document.body.textContent).not.toContain('google.com');

    const button = Array.from(document.body.querySelectorAll('button')).find((btn) =>
      btn.textContent.includes('Search for this recipe')
    );
    expect(button).toBeTruthy();

    unmount();
  });

  it('renders nothing when item is null/absent, without throwing', () => {
    expect(() => {
      const { unmount } = mount(h(RecipeLinkSheet, { open: true, onClose: () => {}, item: null }));
      expect(findDialog()).toBeNull();
      unmount();
    }).not.toThrow();
  });
});
