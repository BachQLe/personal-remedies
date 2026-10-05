// @vitest-environment jsdom
/**
 * SlotSection.test.jsx — Wave 4 guard test for the renamed suggestions
 * trigger ("Suggestions" -> "See other suggestions") and its
 * restored visibility (SHOW_SUGGESTIONS flipped back to `true`).
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('framer-motion', () => ({
  motion: { div: ({ children, ...rest }) => <div {...rest}>{children}</div> },
  AnimatePresence: ({ children }) => <>{children}</>,
}));
vi.mock('../../../components/shared/SaveButton.jsx', () => ({ default: () => null }));

import SlotSection from '../SlotSection.jsx';

const SLOT = { key: 'breakfast', label: 'Breakfast' };

let container;
let root;

async function mount(props) {
  await act(async () => {
    root.render(
      <SlotSection
        slot={SLOT}
        items={[{ id: 1, name: 'Oats', kind: 'food', numericId: 2 }]}
        pinnedIds={[]}
        onShuffle={vi.fn()}
        onSelect={vi.fn()}
        onRemove={vi.fn()}
        onOpenSuggestions={vi.fn()}
        ghost={false}
        shuffling={false}
        onSaveBlocked={vi.fn()}
        {...props}
      />
    );
  });
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

describe('SlotSection suggestions trigger (Wave 4 rename)', () => {
  it('renders "See other suggestions", not the old "Suggestions" label', async () => {
    await mount();
    expect(container.textContent).toContain('See other suggestions');
    expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent.trim() === 'Suggestions')).toBe(false);
  });

  it('calls onOpenSuggestions with the slot key when tapped', async () => {
    const onOpenSuggestions = vi.fn();
    await mount({ onOpenSuggestions });
    const trigger = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('See other suggestions'));
    expect(trigger).toBeTruthy();
    await act(async () => { trigger.click(); });
    expect(onOpenSuggestions).toHaveBeenCalledWith('breakfast');
  });

  it('disables the trigger in ghost mode only', async () => {
    await mount({ ghost: true });
    const trigger = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('See other suggestions'));
    expect(trigger.disabled).toBe(true);
  });

  it('keeps the trigger enabled for an empty slot (Task 13 behavior preserved)', async () => {
    await mount({ items: [] });
    const trigger = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('See other suggestions'));
    expect(trigger.disabled).toBe(false);
  });
});
