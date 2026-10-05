// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { ENTITLEMENT_CONFIG, hasEntitlement } from '../../../api/entitlements.js';
import RequireEntitlement from '../RequireEntitlement.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const KEYS = ['top_dos_donts', 'food_group_detail', 'suggest', 'plan', 'saved_plans'];
let root, el;

function render(key, variant) {
  el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(
    <MemoryRouter>
      <RequireEntitlement feature={key} variant={variant} open onClose={() => {}}>
        <div data-testid="screen">screen</div>
      </RequireEntitlement>
    </MemoryRouter>,
  ));
}
afterEach(() => {
  act(() => root?.unmount());
  el?.remove();
  for (const k of KEYS) delete ENTITLEMENT_CONFIG.features[k].locked;
});

describe('default config', () => {
  it('leaves every gated key unlocked', () => {
    for (const k of KEYS) {
      expect(ENTITLEMENT_CONFIG.features[k].locked).toBeUndefined();
      expect(ENTITLEMENT_CONFIG.features[k].tier).toBeUndefined();
      expect(hasEntitlement(k)).toBe(true);
    }
  });
});

describe.each(KEYS)('%s', (key) => {
  it('unlocked renders the screen, no upsell', () => {
    render(key);
    expect(document.querySelector('[data-testid="screen"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="entitlement-upsell"]')).toBeNull();
  });
  it('locked renders upsell linking to /app/upgrade', () => {
    ENTITLEMENT_CONFIG.features[key].locked = true;
    render(key, key === 'saved_plans' ? 'sheet' : 'page');
    expect(document.querySelector('[data-testid="screen"]')).toBeNull();
    const a = document.querySelector('[data-testid="entitlement-upsell"] a');
    expect(a.getAttribute('href')).toBe(`/app/upgrade?feature=${key}`);
  });
});
