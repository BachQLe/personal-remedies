// @vitest-environment jsdom
/**
 * RankedRow.test.jsx — checklist 4.15: a row marks an item's standing with the
 * app-wide FoodRating stars/skulls (driven by `numericId`), never the old
 * text tier pill and never a number. Rows without a numericId (Top Dos &
 * Don'ts, Food Groups) show no standing marker at all.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RankedRow from '../RankedRow.jsx';
import CoverageNote from '../CoverageNote.jsx';

let container;
let root;
const render = (ui) => act(() => root.render(ui));

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

describe('RankedRow standing marker', () => {
  it.each([
    [1, /3 of 3 stars/],
    [3, /1 of 3 stars/],
    [5, /1 of 3 skulls/],
    [7, /3 of 3 skulls/],
  ])('numericId %i renders the shared FoodRating glyphs', (numericId, label) => {
    render(<RankedRow food={{ id: 1, name: 'Salmon', numericId }} onSelect={vi.fn()} />);
    const rating = container.querySelector('[role="img"]');
    expect(rating.getAttribute('aria-label')).toMatch(label);
  });

  it('shows no tier pill text and no digit of the underlying score', () => {
    render(<RankedRow food={{ id: 1, name: 'Salmon', tier: 'Top', numericId: 1 }} onSelect={vi.fn()} />);
    expect(container.textContent).toBe('Salmon');
  });

  it('renders no marker when the row has no numericId', () => {
    render(<RankedRow food={{ id: 2, name: 'Walking' }} onSelect={vi.fn()} />);
    expect(container.querySelector('[role="img"]')).toBeNull();
  });
});

describe('RankedRow reference count (still available to callers that pass it)', () => {
  it('shows nothing when no studyCount is passed', () => {
    render(<RankedRow food={{ id: 2, name: 'Walking' }} onSelect={vi.fn()} />);
    expect(container.textContent).not.toMatch(/reference/);
  });
});

describe('RankedRow references tap (Other options, 2.2)', () => {
  it('opens the item on Health Details when the count is tapped', () => {
    const onSelect = vi.fn();
    render(<RankedRow food={{ id: 2, name: 'Iron' }} studyCount={3} onSelect={onSelect} />);
    act(() => container.querySelector('[data-reference-count]').click());
    expect(onSelect).toHaveBeenCalledWith({ id: 2, name: 'Iron', openDetails: true });
  });

  it('opens the item normally when the row itself is tapped', () => {
    const onSelect = vi.fn();
    render(<RankedRow food={{ id: 2, name: 'Iron' }} studyCount={3} onSelect={onSelect} />);
    act(() => container.querySelector('button').click());
    expect(onSelect).toHaveBeenCalledWith({ id: 2, name: 'Iron' });
  });
});

describe('RankedRow serving size (1.5)', () => {
  it("shows PR's serving size for an item that has one", () => {
    render(<RankedRow food={{ id: 588, name: 'Margarine (salted)' }} onSelect={vi.fn()} />);
    expect(container.textContent).toContain('Serving size: 20 g');
  });

  it('shows no size at all for an item without one', () => {
    render(<RankedRow food={{ id: 382, name: 'Daikon' }} onSelect={vi.fn()} />);
    expect(container.textContent).not.toMatch(/serving/i);
  });
});

describe('CoverageNote (4.2)', () => {
  it('names scored and unscored conditions for a partial result', () => {
    render(<CoverageNote coverage={{ scored: ['Aging'], unscored: ['Gout', 'Asthma'] }} />);
    expect(container.textContent).toBe('Showing guidance for: Aging. Not yet available for: Gout, Asthma.');
  });

  it.each([undefined, null, { scored: [], unscored: ['Gout'] }, { scored: ['Aging'], unscored: [] }])(
    'renders nothing unless the result is partial (%j)',
    (coverage) => {
      render(<CoverageNote coverage={coverage} />);
      expect(container.textContent).toBe('');
    },
  );
});
