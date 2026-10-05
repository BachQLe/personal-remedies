// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import ConsentStep from '../ConsentStep.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('ConsentStep', () => {
  it('disables Continue until the checkbox is ticked', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    act(() => root.render(<ConsentStep onNext={() => {}} onBack={() => {}} />));
    const box = el.querySelector('input[type="checkbox"]');
    const cont = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Continue');
    expect(box.checked).toBe(false);
    expect(cont.disabled).toBe(true);
    act(() => box.click());
    expect(cont.disabled).toBe(false);
    act(() => root.unmount());
    el.remove();
  });
});
