// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import DataState, { SlowLoadingNote } from '../DataState.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, el;

function render(node) {
  el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(node));
}
afterEach(() => {
  act(() => root?.unmount());
  el?.remove();
});

describe('SlowLoadingNote', () => {
  it('renders the status line, delayed by CSS class (no timers)', () => {
    render(<SlowLoadingNote className="extra" />);
    const note = el.querySelector('[role="status"]');
    expect(note.textContent).toBe('Nutri is thinking…');
    expect(note.classList.contains('slow-loading-note')).toBe(true);
    expect(note.classList.contains('extra')).toBe(true);
  });
});

describe('DataState loading', () => {
  it('shows the skeleton plus the slow-load note', () => {
    render(<DataState status="loading" screenName="recipes"><p>done</p></DataState>);
    expect(el.querySelector('[aria-label="Loading recipes"]')).toBeTruthy();
    expect(el.textContent).toContain('Nutri is thinking…');
    expect(el.textContent).not.toContain('done');
  });

  it('does not show the note once loaded', () => {
    render(<DataState status="success"><p>done</p></DataState>);
    expect(el.textContent).toBe('done');
  });
});
