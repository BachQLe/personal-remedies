// @vitest-environment jsdom
/**
 * SlotSection.test.jsx - one meal of the day view: X removes, the + tile adds
 * from favorites (also the only thing in an empty meal), and the retired
 * shuffle / pin / meal-tag / suggestions controls are gone.
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
        onSelect={vi.fn()}
        onRemove={vi.fn()}
        onAdd={vi.fn()}
        onOpenSuggestions={vi.fn()}
        ghost={false}
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

const labels = () => Array.from(container.querySelectorAll('button, [role="button"]')).map((b) => b.getAttribute('aria-label') || b.textContent.trim());

describe('SlotSection', () => {
  it('removes a card with its X, naming the recipe', async () => {
    const onRemove = vi.fn();
    const item = { id: 1, name: 'Oats', kind: 'food', numericId: 2 };
    await mount({ items: [item], onRemove });
    const x = container.querySelector('[aria-label="Remove Oats from plan"]');
    expect(x).toBeTruthy();
    await act(async () => { x.click(); });
    expect(onRemove).toHaveBeenCalledWith('breakfast', item);
  });

  it('shows the + tile after the cards and calls onAdd with the slot key', async () => {
    const onAdd = vi.fn();
    await mount({ onAdd });
    const tile = container.querySelector('[aria-label="Add from favorites to Breakfast"]');
    expect(tile).toBeTruthy();
    await act(async () => { tile.click(); });
    expect(onAdd).toHaveBeenCalledWith('breakfast');
  });

  it('shows the + tile as the only thing in an empty meal', async () => {
    await mount({ items: [] });
    expect(container.querySelectorAll('[aria-label^="Remove"]')).toHaveLength(0);
    expect(container.querySelector('[aria-label="Add from favorites to Breakfast"]')).toBeTruthy();
  });

  it('has no shuffle, pin or suggestions control (SHOW_SUGGESTIONS is off)', async () => {
    await mount();
    const text = labels().join('|');
    expect(text).not.toMatch(/shuffle|pin|suggestions/i);
  });

  it('disables the + tile in ghost mode', async () => {
    await mount({ ghost: true });
    expect(container.querySelector('[aria-label="Add from favorites to Breakfast"]').disabled).toBe(true);
  });
});
