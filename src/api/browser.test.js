// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { openUrl, printPage, share } from './browser.js';

describe('openUrl', () => {
  it('opens the url in a new tab with noopener,noreferrer', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
    openUrl('https://example.com');
    expect(openSpy).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
    openSpy.mockRestore();
  });

  it('does not throw and does not call window.open for an empty url', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
    openUrl('');
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });
});

describe('printPage', () => {
  it('calls window.print', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    printPage();
    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });

  it('does not throw when window.print is unavailable', () => {
    const original = window.print;
    // @ts-ignore — simulate an environment without the Print API
    window.print = undefined;
    expect(() => printPage()).not.toThrow();
    window.print = original;
  });
});

describe('share', () => {
  const originalShare = navigator.share;
  const originalClipboard = navigator.clipboard;

  afterEach(() => {
    // Restore navigator between tests since each test stubs it differently.
    Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true });
    vi.restoreAllMocks();
  });

  it('uses navigator.share when available and reports ok/method: share', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: shareMock, configurable: true });

    const result = await share({ title: 'Kale', text: 'Great for iron' });

    expect(shareMock).toHaveBeenCalledWith({ title: 'Kale', text: 'Great for iron' });
    expect(result).toEqual({ ok: true, method: 'share' });
  });

  it('treats an AbortError from navigator.share as a cancellation, not a failure', async () => {
    const abortError = new Error('cancelled');
    abortError.name = 'AbortError';
    const shareMock = vi.fn().mockRejectedValue(abortError);
    Object.defineProperty(navigator, 'share', { value: shareMock, configurable: true });

    const result = await share({ title: 'Kale', text: 'Great for iron' });

    expect(result).toEqual({ ok: true, method: 'share' });
  });

  it('reports a real failure when navigator.share rejects with a non-abort error', async () => {
    const permissionError = new Error('denied');
    permissionError.name = 'NotAllowedError';
    const shareMock = vi.fn().mockRejectedValue(permissionError);
    Object.defineProperty(navigator, 'share', { value: shareMock, configurable: true });

    const result = await share({ title: 'Kale', text: 'Great for iron' });

    expect(result.ok).toBe(false);
    expect(result.method).toBe('share');
    expect(result.error).toBe(permissionError);
  });

  it('falls back to clipboard when navigator.share is unavailable', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const result = await share({ title: 'Kale', text: 'Great for iron' });

    expect(writeText).toHaveBeenCalledWith('Great for iron');
    expect(result).toEqual({ ok: true, method: 'clipboard' });
  });

  it('returns method: none when neither share nor clipboard is available', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });

    const result = await share({ title: 'Kale', text: 'Great for iron' });

    expect(result).toEqual({ ok: false, method: 'none' });
  });

  it('reports a clipboard failure distinctly from a share failure', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    const clipboardError = new Error('clipboard blocked');
    const writeText = vi.fn().mockRejectedValue(clipboardError);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const result = await share({ title: 'Kale', text: 'Great for iron' });

    expect(result.ok).toBe(false);
    expect(result.method).toBe('clipboard');
    expect(result.error).toBe(clipboardError);
  });
});
