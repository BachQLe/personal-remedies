// @vitest-environment jsdom
/**
 * WhatsNewSheet.test.js — coverage for Profile's "What's new" sheet (Task
 * W4, REMEDI_MASTER_PLAN.md §4.7). WhatsNewSheet itself doesn't fetch — it's
 * handed an already-resolved `messages` list and reports dismissals back up
 * via `onDismiss` (see ProfileScreen.jsx's wiring) — so these tests mock
 * src/api/messages.js's `dismissMessage` rather than exercising the real
 * fetch/cache/storage stack (that's covered by src/api/__tests__/messages.test.js).
 *
 * Uses the same manual mount harness as src/hooks/useAsyncData.test.js
 * (React's own `act` + `react-dom/client`'s `createRoot`, no new test
 * dependency) since this repo has no @testing-library/react installed.
 * `Host` mirrors ProfileScreen's own state wiring — it owns `messages` and
 * removes the dismissed row via `onDismiss`, so the "clicking Dismiss
 * removes the row" assertion exercises the real parent/child contract, not
 * a stub.
 */
import { act, createElement as h, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../api/messages.js', () => ({
  dismissMessage: vi.fn(),
}));

import { dismissMessage } from '../../../api/messages.js';
import WhatsNewSheet from '../WhatsNewSheet.jsx';

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
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
      container.remove();
    },
  };
}

/** Mirrors ProfileScreen's wiring: owns `messages`, filters on `onDismiss`. */
function Host({ initialMessages }) {
  const [messages, setMessages] = useState(initialMessages);
  return h(WhatsNewSheet, {
    messages,
    onDismiss: (id) => setMessages((prev) => prev.filter((m) => m.id !== id)),
    onClose: () => {},
  });
}

const MESSAGES = [
  { id: 'a', title: 'Message A', body: 'Body A', severity: 'info', dismissible: true },
  { id: 'b', title: 'Message B', body: 'Body B', severity: 'notice', dismissible: false },
];

function findDismissButton(container, title) {
  return Array.from(container.querySelectorAll('button')).find(
    (btn) => btn.getAttribute('aria-label') === `Dismiss ${title}`
  );
}

beforeEach(() => {
  dismissMessage.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WhatsNewSheet', () => {
  it('renders active messages', () => {
    const { container, unmount } = mount(h(Host, { initialMessages: MESSAGES }));

    expect(container.textContent).toContain('Message A');
    expect(container.textContent).toContain('Body A');
    expect(container.textContent).toContain('Message B');
    expect(container.textContent).toContain('Body B');

    unmount();
  });

  it('clicking Dismiss removes the row and calls through to dismissMessage', () => {
    const { container, unmount } = mount(h(Host, { initialMessages: MESSAGES }));

    const dismissBtn = findDismissButton(container, 'Message A');
    expect(dismissBtn).toBeTruthy();
    expect(dismissBtn.textContent.trim()).toBe('Dismiss');

    act(() => {
      dismissBtn.click();
    });

    expect(dismissMessage).toHaveBeenCalledTimes(1);
    expect(dismissMessage).toHaveBeenCalledWith('a');
    expect(container.textContent).not.toContain('Message A');
    // The non-dismissed row stays put.
    expect(container.textContent).toContain('Message B');

    unmount();
  });

  it('a row with dismissible:false shows no Dismiss button', () => {
    const { container, unmount } = mount(h(Host, { initialMessages: MESSAGES }));

    expect(findDismissButton(container, 'Message B')).toBeUndefined();
    // Sanity check the dismissible row's button IS found by the same helper.
    expect(findDismissButton(container, 'Message A')).toBeTruthy();

    unmount();
  });

  it('an empty list renders the empty state', () => {
    const { container, unmount } = mount(h(Host, { initialMessages: [] }));

    expect(container.textContent).toContain("You're all caught up");
    expect(container.querySelectorAll('button[aria-label^="Dismiss "]')).toHaveLength(0);

    unmount();
  });
});
