// @vitest-environment jsdom
/**
 * SuggestionsSheet.test.jsx — Wave 4 guard tests.
 *
 * Covers the three things the full-menu rewrite must get right:
 *  - Level 1 lists ALL 17 fine food groups (getFineFoodGroups()), not
 *    `slot.fineGroups` (the old 2-3-group subset this wave removed).
 *  - A harmful item (numericId 5-7) returned by `getFineGroupSuggestions`
 *    for a drilled-into group never reaches the add-to-slot UI — the sheet
 *    must re-filter to 1-4 itself (`toPlanSafeCandidates`), since that
 *    function's raw output is the browse surface's full 1-7 spread.
 *  - `onSwap` (the "Instead of {name}" scoped-substitute path, from
 *    `getSlotSubstitutes`) still fires correctly for a current slot item
 *    that genuinely scopes to the tapped group — proving the Task 13
 *    empty-scope branch removal didn't take the swap path down with it.
 *
 * `api.js` is mocked wholesale (same pattern as
 * fineGroupDetailScreen.routeValidation.test.jsx / MealprepCarousel.test.jsx)
 * so this exercises only SuggestionsSheet's own rendering/filtering logic,
 * not the real Nutridigm adapter.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getSlotSubstitutes: vi.fn(),
  getCandidatesForSlot: vi.fn(),
  getFineFoodGroups: vi.fn(),
  getFineGroupSuggestions: vi.fn(),
  getGroupLabels: vi.fn(),
}));
vi.mock('../../../api/api.js', () => api);

import SuggestionsSheet from '../SuggestionsSheet.jsx';

// All 17 fine groups (b1 b2 b3 · c1 c2 c3 · d · e · f · g1 g2 · h1 h2 · i1 i2
// · k1 k2), matching getFineFoodGroups()'s real contract (17 entries,
// ascending code order).
const ALL_FINE_GROUPS = [
  { code: 'b1', label: 'Fish & Seafood', coarse: 'b' },
  { code: 'b2', label: 'Meat, Red Meat & Organ Meats', coarse: 'b' },
  { code: 'b3', label: 'Poultry', coarse: 'b' },
  { code: 'c1', label: 'Eggs', coarse: 'c' },
  { code: 'c2', label: 'Beans & Legumes', coarse: 'c' },
  { code: 'c3', label: 'Nuts & Seeds', coarse: 'c' },
  { code: 'd', label: 'Fruits & Juices', coarse: 'd' },
  { code: 'e', label: 'Vegetables', coarse: 'e' },
  { code: 'f', label: 'Breads, Grains & Cereals', coarse: 'f' },
  { code: 'g1', label: 'Dairy', coarse: 'g' },
  { code: 'g2', label: 'Fats & Oils', coarse: 'g' },
  { code: 'h1', label: 'Desserts & Snacks', coarse: 'h' },
  { code: 'h2', label: 'Beverages', coarse: 'h' },
  { code: 'i1', label: 'Herbs & Spices', coarse: 'i' },
  { code: 'i2', label: 'Prepared Foods', coarse: 'i' },
  { code: 'k1', label: 'Vitamins & Minerals', coarse: 'k' },
  { code: 'k2', label: 'Herbal Supplements', coarse: 'k' },
];

// Breakfast's own curated subset (config.js) — deliberately NOT a superset
// of what's asserted below, proving Level 1 doesn't read it.
const BREAKFAST_SLOT = { key: 'breakfast', label: 'Breakfast', fineGroups: ['f', 'd', 'g1'] };

const PROFILE = { conditions: [203, 244] };

let container;
let root;

async function mount(props) {
  await act(async () => {
    root.render(
      <SuggestionsSheet
        open
        onClose={vi.fn()}
        slot={BREAKFAST_SLOT}
        sourceItems={[]}
        profile={PROFILE}
        onSelect={vi.fn()}
        onSwap={vi.fn()}
        onAdd={vi.fn()}
        {...props}
      />
    );
  });
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.resetAllMocks();
  api.getFineFoodGroups.mockResolvedValue(ALL_FINE_GROUPS);
  api.getGroupLabels.mockResolvedValue({
    coarse: new Map([
      ['b', 'Meat, Fish & Poultry'],
      ['c', 'Eggs, Beans, Nuts & Seeds'],
      ['g', 'Dairy, Fats & Oils'],
      ['h', 'Desserts, Snacks & Beverages'],
      ['i', 'Herbs, Spices & Prepared Foods'],
      ['k', 'Key Nutrients & Herbal'],
    ]),
    fine: new Map(),
  });
  api.getSlotSubstitutes.mockResolvedValue({ bySourceItem: [], usedFallback: false });
  api.getCandidatesForSlot.mockResolvedValue([]);
  api.getFineGroupSuggestions.mockResolvedValue({ items: [], usedFallback: false, requestedConditionIds: [] });

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('SuggestionsSheet — Wave 4 full menu', () => {
  it('renders all 17 fine food groups at Level 1, not slot.fineGroups subset', async () => {
    await mount();

    // Proof it's the full menu: groups that are NOT in BREAKFAST_SLOT's own
    // `fineGroups` ('f', 'd', 'g1') still render as rows.
    expect(container.textContent).toContain('Fish & Seafood'); // b1
    expect(container.textContent).toContain('Poultry'); // b3
    expect(container.textContent).toContain('Herbal Supplements'); // k2

    // All 17 labels present.
    for (const fg of ALL_FINE_GROUPS) {
      expect(container.textContent).toContain(fg.label);
    }

    // Coarse-family headers render for multi-group families (b, c, g, h, i,
    // k) but not for the three singleton families (d, e, f — see
    // bucketFineGroups's doc).
    expect(container.textContent).toContain('Meat, Fish & Poultry');
    expect(container.textContent).toContain('Key Nutrients & Herbal');
  });

  it('filters harmful items (numericId 5-7) out of a drilled-into group\'s add list', async () => {
    api.getFineGroupSuggestions.mockResolvedValue({
      items: [
        { id: 1, name: 'Safe Salmon', image: '/s.jpg', group: 'b', fineGroup: 'b1', tier: 'Good', numericId: 2, groupLabel: 'Fish & Seafood', referenceTotal: 5, matchedConditions: [] },
        { id: 2, name: 'Neutral Fish', image: '/n.jpg', group: 'b', fineGroup: 'b1', tier: 'Neutral', numericId: 4, groupLabel: 'Fish & Seafood', referenceTotal: 2, matchedConditions: [] },
        { id: 3, name: 'Harmful Fish', image: '/h.jpg', group: 'b', fineGroup: 'b1', tier: 'Poor', numericId: 6, groupLabel: 'Fish & Seafood', referenceTotal: 1, matchedConditions: [] },
        { id: 4, name: 'Worst Fish', image: '/w.jpg', group: 'b', fineGroup: 'b1', tier: 'Poor', numericId: 7, groupLabel: 'Fish & Seafood', referenceTotal: 1, matchedConditions: [] },
      ],
      usedFallback: false,
      requestedConditionIds: [203, 244],
    });

    const onAdd = vi.fn();
    await mount({ onAdd });

    const row = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Fish & Seafood'));
    expect(row).toBeTruthy();
    await act(async () => { row.click(); });

    expect(container.textContent).toContain('Safe Salmon');
    expect(container.textContent).toContain('Neutral Fish');
    expect(container.textContent).not.toContain('Harmful Fish');
    expect(container.textContent).not.toContain('Worst Fish');

    // The surviving candidate is addable via onAdd, stamped kind: 'food'.
    const addBtn = container.querySelector('[aria-label="Add Safe Salmon to plan"]');
    expect(addBtn).toBeTruthy();
    await act(async () => { addBtn.click(); });
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 1, name: 'Safe Salmon', numericId: 2, kind: 'food' }));
  });

  it('keeps the "Instead of {name}" onSwap path working for a genuinely scoped current item', async () => {
    const sourceItem = { id: 100, name: 'Old Oatmeal', kind: 'food', fineGroup: 'f', numericId: 3 };
    const substitute = { id: 101, name: 'Better Oats', image: '/o.jpg', group: 'f', fineGroup: 'f', tier: 'Good', numericId: 1, kind: 'food' };

    api.getSlotSubstitutes.mockResolvedValue({
      bySourceItem: [{ sourceItem, substitutes: [substitute] }],
      usedFallback: false,
    });

    const onSwap = vi.fn();
    await mount({ sourceItems: [sourceItem], onSwap });

    // Drill into the 'f' group (Breads, Grains & Cereals) — the one
    // `sourceItem` scopes to.
    const row = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes('Breads, Grains & Cereals'));
    expect(row).toBeTruthy();
    await act(async () => { row.click(); });

    expect(container.textContent).toContain('Instead of Old Oatmeal');
    expect(container.textContent).toContain('Better Oats');

    const swapBtn = container.querySelector('[aria-label="Swap in Better Oats"]');
    expect(swapBtn).toBeTruthy();
    await act(async () => { swapBtn.click(); });
    expect(onSwap).toHaveBeenCalledWith(sourceItem, substitute);
  });

  it('still shows the always-on "All {slot} options" section (Task 12, kept per Wave 4 scope)', async () => {
    api.getCandidatesForSlot.mockResolvedValue([
      { id: 200, name: 'Pantry Oats', image: '/p.jpg', group: 'f', fineGroup: 'f', tier: 'Good', numericId: 2, kind: 'food' },
    ]);
    await mount();
    expect(container.textContent).toContain('All Breakfast options');
    expect(container.textContent).toContain('Pantry Oats');
  });
});

describe('SuggestionsSheet — shared DataState (checklist #8)', () => {
  it('shows an error with Retry when the full-list fetch fails, and recovers on Retry', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    api.getCandidatesForSlot.mockRejectedValueOnce(new Error('[nutridigm] boom'));
    await mount();

    expect(container.textContent).toContain('Something went wrong');
    const retry = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Retry');
    expect(retry).toBeTruthy();

    api.getCandidatesForSlot.mockResolvedValue([
      { id: 300, name: 'Recovered Oats', image: '/r.jpg', group: 'f', fineGroup: 'f', tier: 'Good', numericId: 2, kind: 'food' },
    ]);
    await act(async () => { retry.click(); });

    expect(container.textContent).toContain('Recovered Oats');
    expect(container.textContent).not.toContain('Something went wrong');
    consoleError.mockRestore();
  });

  it('shows the offline state (not an empty list) when offline with nothing loaded', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    api.getCandidatesForSlot.mockResolvedValue([]);
    await mount();

    expect(container.textContent).toContain("You're offline");
    onLine.mockRestore();
  });

  it('shows a proper empty state when the slot has no candidates', async () => {
    await mount();
    expect(container.textContent).toContain('No suggestions yet for Breakfast.');
  });
});
