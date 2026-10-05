// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import items from '../cache/items.json';
import { getNonFoodGuidance, ITEM_CATEGORY, GUIDANCE, DOCTOR_NOTE } from '../nonFoodGuidance.js';
import NonFoodGuidance from '../../components/shared/NonFoodGuidance.jsx';

const lifestyle = items.filter((i) => i.coarseFoodGroup === 'j');
const misclassified = items.filter((i) => i.fineFoodGroup === 'x' && i.coarseFoodGroup !== 'j');

describe('nonFoodGuidance mapping', () => {
  it('finds the expected lifestyle set', () => {
    expect(lifestyle.length).toBe(219);
  });

  it('every coarse-j item resolves to 2-4 tips plus the doctor note', () => {
    for (const i of lifestyle) {
      const g = getNonFoodGuidance({ foodId: i.foodItemID, group: 'j', fineGroup: i.fineFoodGroup, longDescription: i.longDescription });
      expect(g, i.description).not.toBeNull();
      expect(g.tips.length).toBeGreaterThanOrEqual(2);
      expect(g.tips.length).toBeLessThanOrEqual(4);
      expect(g.note).toBe(DOCTOR_NOTE);
    }
  });

  it('every mapped ID is a real coarse-j item and every category has copy', () => {
    const jIds = new Set(lifestyle.map((i) => i.foodItemID));
    for (const [id, cat] of Object.entries(ITEM_CATEGORY)) {
      expect(jIds.has(Number(id)), id).toBe(true);
      expect(GUIDANCE[cat], cat).toBeDefined();
    }
  });

  it('unmapped j items use the fine-group fallback', () => {
    const g = getNonFoodGuidance({ foodId: 99999, group: 'j', fineGroup: 'j1' });
    expect(g.category).toBe('therapyFallback');
    expect(getNonFoodGuidance({ foodId: 99999, group: 'j', fineGroup: 'x' }).category).toBe('lifestyleFallback');
  });

  it('real foods tagged fine group x (e.g. Beef) get no guidance', () => {
    expect(misclassified.length).toBeGreaterThan(0);
    for (const i of misclassified) {
      expect(getNonFoodGuidance({ foodId: i.foodItemID, group: i.coarseFoodGroup, fineGroup: 'x' })).toBeNull();
    }
  });

  it('smoking mentions 1-800-QUIT-NOW and smokefree.gov', () => {
    const g = getNonFoodGuidance({ foodId: 986, group: 'j', fineGroup: 'x' });
    const text = g.tips.join(' ');
    expect(text).toContain('1-800-QUIT-NOW');
    expect(text).toContain('smokefree.gov');
  });

  it('shows the long description only when substantial', () => {
    expect(getNonFoodGuidance({ foodId: 849, group: 'j', longDescription: 'Sweetener' }).about).toBeNull();
    expect(getNonFoodGuidance({ foodId: 849, group: 'j', longDescription: 'A form of alternative medicine and a key component.' }).about).toMatch(/alternative/);
  });
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function mount(props) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  act(() => root.render(<NonFoodGuidance {...props} />));
  return { el, unmount: () => { act(() => root.unmount()); el.remove(); } };
}

describe('<NonFoodGuidance />', () => {
  it('renders tips and doctor note for Exercise', () => {
    const { el, unmount } = mount({ foodId: 898, group: 'j', fineGroup: 'j1' });
    expect(el.querySelector('[data-testid="nonfood-guidance"]')).not.toBeNull();
    expect(el.textContent).toMatch(/150 minutes/);
    expect(el.textContent).toMatch(/not medical advice/);
    expect(el.querySelectorAll('li').length).toBe(3);
    unmount();
  });

  it('renders nothing for a real food', () => {
    const { el, unmount } = mount({ foodId: 9, group: 'b', fineGroup: 'x' });
    expect(el.firstChild).toBeNull();
    unmount();
  });
});
