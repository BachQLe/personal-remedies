// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ getGoodForMe: vi.fn() }));
vi.mock('../../../api/api.js', () => api);

import GoodForMeSheet from '../GoodForMeSheet.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root; let host;
async function render(ui) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(ui); });
  await act(async () => { await Promise.resolve(); });
}
afterEach(() => { act(() => root?.unmount()); host?.remove(); vi.clearAllMocks(); });

describe('GoodForMeSheet', () => {
  it('renders the overall verdict, per-condition rows and notes', async () => {
    api.getGoodForMe.mockResolvedValue({
      rows: [
        { conditionId: 203, conditionName: 'Aging', status: 'ok', numericId: 2, label: 'More Helpful', notes: 'High in fiber.' },
        { conditionId: 244, conditionName: 'Pneumonia', status: 'unauthorized', numericId: null, label: null, notes: '' },
      ],
    });
    await render(<GoodForMeSheet food={{ id: 7, name: 'Broccoli' }} profile={{ conditions: [203, 244] }} onClose={() => {}} />);
    expect(api.getGoodForMe).toHaveBeenCalledTimes(1);
    const verdict = document.querySelector('[data-testid="good-for-me-verdict"]');
    expect(verdict.dataset.kind).toBe('good');
    expect(verdict.textContent).toContain('Ranked higher for you');
    const text = document.querySelector('[data-testid="good-for-me-rows"]').textContent;
    expect(text).toContain('Aging');
    expect(text).toContain('More Helpful');
    expect(text).toContain('High in fiber.');
    expect(text).toContain("Can't be scored yet");
  });

  it('shows an honest error with Retry when the lookup rejects', async () => {
    api.getGoodForMe.mockRejectedValue(new Error('boom'));
    await render(<GoodForMeSheet food={{ id: 7, name: 'Broccoli' }} profile={{ conditions: [203] }} onClose={() => {}} />);
    expect(document.querySelector('[data-testid="good-for-me-verdict"]').dataset.kind).toBe('error');
    expect(document.body.textContent).toContain('Retry');
  });

  it('does not fetch while closed (food null)', async () => {
    await render(<GoodForMeSheet food={null} profile={{ conditions: [203] }} onClose={() => {}} />);
    expect(api.getGoodForMe).not.toHaveBeenCalled();
  });
});
