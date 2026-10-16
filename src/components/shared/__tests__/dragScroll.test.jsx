// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dragScrollProps } from '../dragScroll.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, el;

function setup(onClick) {
  el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(
    <div data-testid="rail" {...dragScrollProps}>
      <button onClick={onClick}>card</button>
    </div>,
  ));
  return { rail: el.firstChild, card: el.querySelector('button') };
}

// jsdom has no PointerEvent: build a plain event carrying the fields we read.
function pointer(type, target, props) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerType: 'mouse', button: 0, ...props });
  act(() => { target.dispatchEvent(event); });
}

afterEach(() => {
  act(() => root?.unmount());
  el?.remove();
});

describe('dragScrollProps', () => {
  it('scrolls the rail with a mouse drag, suspends snap meanwhile, and swallows the click', () => {
    const onClick = vi.fn();
    const { rail, card } = setup(onClick);
    rail.scrollLeft = 100;
    pointer('pointerdown', card, { clientX: 200 });
    expect(rail.style.scrollSnapType).toBe('none');
    pointer('pointermove', window, { clientX: 150 });
    expect(rail.scrollLeft).toBe(150);
    pointer('pointerup', window, {});
    expect(rail.style.scrollSnapType).toBe('');
    act(() => card.click());
    expect(onClick).not.toHaveBeenCalled();
  });

  it('leaves a plain tap alone', () => {
    const onClick = vi.fn();
    const { card } = setup(onClick);
    pointer('pointerdown', card, { clientX: 200 });
    pointer('pointermove', window, { clientX: 198 });
    pointer('pointerup', window, {});
    act(() => card.click());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('ignores touch pointers (native swipe) and cancels native image drag', () => {
    const { rail, card } = setup(() => {});
    pointer('pointerdown', card, { clientX: 200, pointerType: 'touch' });
    expect(rail.style.scrollSnapType).toBe('');
    const drag = new Event('dragstart', { bubbles: true, cancelable: true });
    card.dispatchEvent(drag);
    expect(drag.defaultPrevented).toBe(true);
  });
});
