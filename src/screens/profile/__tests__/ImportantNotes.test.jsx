// @vitest-environment jsdom
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ImportantNotesScreen from '../ImportantNotesScreen.jsx';
import { buildSupportMailto } from '../supportMailto.js';
import { SUPPORT_EMAIL, PUBLISHER_CREDIT } from '../importantNotesContent.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('ImportantNotesScreen', () => {
  it('renders disclaimer, sources, legal links and credit', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    await act(async () => {
      root.render(h(MemoryRouter, null, h(ImportantNotesScreen)));
    });
    const text = el.textContent;
    expect(text).toContain('not medical advice');
    expect(text).toContain('911');
    expect(text).toContain('Nutridigm');
    expect(text).toContain(PUBLISHER_CREDIT);
    expect(el.querySelector('a[href="/privacy"]')).not.toBeNull();
    expect(el.querySelector('a[href="/terms"]')).not.toBeNull();
    expect(el.querySelector('button[aria-label="Go back"]')).not.toBeNull();
    await act(async () => root.unmount());
  });
});

describe('buildSupportMailto', () => {
  it('targets the support address with subject, version and user agent', () => {
    const url = buildSupportMailto('TestAgent/1.0');
    expect(url.startsWith(`mailto:${SUPPORT_EMAIL}?subject=`)).toBe(true);
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('subject')).toBe('Personal Remedies feedback');
    expect(params.get('body')).toMatch(/App version: \d+\.\d+\.\d+/);
    expect(params.get('body')).toContain('Device: TestAgent/1.0');
  });
});
