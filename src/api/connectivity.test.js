// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { isOnline, subscribeOnline } from './connectivity.js';

describe('isOnline', () => {
  const originalOnLine = Object.getOwnPropertyDescriptor(navigator, 'onLine');

  afterEach(() => {
    if (originalOnLine) {
      Object.defineProperty(navigator, 'onLine', originalOnLine);
    }
  });

  it('reflects navigator.onLine when it is true', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    expect(isOnline()).toBe(true);
  });

  it('reflects navigator.onLine when it is false', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    expect(isOnline()).toBe(false);
  });

  it('defaults to true when navigator.onLine is not a boolean (unavailable)', () => {
    Object.defineProperty(navigator, 'onLine', { value: undefined, configurable: true });
    expect(isOnline()).toBe(true);
  });
});

describe('subscribeOnline', () => {
  it('invokes the callback with true on an online event', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeOnline(callback);

    window.dispatchEvent(new Event('online'));

    expect(callback).toHaveBeenCalledWith(true);
    unsubscribe();
  });

  it('invokes the callback with false on an offline event', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeOnline(callback);

    window.dispatchEvent(new Event('offline'));

    expect(callback).toHaveBeenCalledWith(false);
    unsubscribe();
  });

  it('stops invoking the callback after unsubscribe', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeOnline(callback);

    unsubscribe();
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('offline'));

    expect(callback).not.toHaveBeenCalled();
  });

  it('returns a no-op unsubscribe and does not throw when addEventListener is unavailable', () => {
    const originalAdd = window.addEventListener;
    // @ts-ignore — simulate a non-browser-ish environment
    window.addEventListener = undefined;

    let unsubscribe;
    expect(() => {
      unsubscribe = subscribeOnline(() => {});
    }).not.toThrow();
    expect(() => unsubscribe()).not.toThrow();

    window.addEventListener = originalAdd;
  });
});
