// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const messages = vi.hoisted(() => ({ getActiveMessages: vi.fn(), dismissMessage: vi.fn() }));
vi.mock('../../api/messages.js', () => messages);

import HomeMail from './HomeMail.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container;
let root;
const note = { id: 'n1', title: 'Hello news', body: 'Body text', severity: 'info' };

async function mount() {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route path="/app" element={<HomeMail />} />
          <Route path="/app/profile/important-notes" element={<p>Important notes page</p>} />
        </Routes>
      </MemoryRouter>,
    );
  });
}
const byText = (text) => [...container.ownerDocument.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(text));
const notesLink = () => [...document.querySelectorAll('a')].find((a) => a.textContent.trim().startsWith('Important notes'));
const mailButton = () => container.querySelector('button');

beforeEach(() => {
  vi.resetAllMocks();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('HomeMail', () => {
  it('is a labelled mail button with no unread marker when nothing is active', async () => {
    messages.getActiveMessages.mockResolvedValue([]);
    await mount();
    expect(mailButton().getAttribute('aria-label')).toBe('Important notes and news');
    expect(mailButton().querySelector('span')).toBeNull();
  });

  it('shows an unread dot and opens News with the active messages', async () => {
    messages.getActiveMessages.mockResolvedValue([note]);
    await mount();
    expect(mailButton().getAttribute('aria-label')).toBe('Important notes and news, new');
    expect(mailButton().querySelector('span')).toBeTruthy();

    await act(async () => mailButton().click());
    await act(async () => byText('News').click());
    expect(document.body.textContent).toContain('Hello news');
  });

  it('routes Important notes to its page', async () => {
    messages.getActiveMessages.mockResolvedValue([]);
    await mount();
    await act(async () => mailButton().click());
    expect(notesLink().getAttribute('href')).toBe('/app/profile/important-notes');
    await act(async () => notesLink().click());
    expect(document.body.textContent).toContain('Important notes page');
  });
});
