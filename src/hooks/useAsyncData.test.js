// @vitest-environment jsdom
/**
 * useAsyncData.test.js — integration coverage for the hook itself (happy
 * path, error classification, retry, offline auto-recovery, the
 * requiresProfile gate, and unmount-race safety).
 *
 * Test-approach note (per T4A's brief): no new test dependency was added.
 * The hook's own state-derivation/error-classification logic is a thin
 * wrapper around src/api/loadState.js's pure functions, which are covered
 * exhaustively in src/api/loadState.test.js. This file instead exercises
 * the *React* half — effect timing, setState-on-unmount guards, the
 * connectivity subscription — via a minimal manual harness built from
 * dependencies already in package.json: React 19's own `act` export (from
 * 'react') and `react-dom/client`'s `createRoot`. `React.createElement` is
 * used directly instead of JSX since this is a plain `.js` file.
 */
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAsyncData } from './useAsyncData.js';
import { storage } from '../api/storage.js';

/** Flush pending microtasks (promise chains) and any due timers/effects. */
function flush(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mounts a host component that calls `useAsyncData` and records every
 * returned snapshot, so tests can assert on state transitions over time.
 */
function mountHook(fetcher, deps, options) {
  const renders = [];
  function Host(props) {
    const result = useAsyncData(props.fetcher, props.deps, props.options);
    renders.push(result);
    return null;
  }

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  return {
    renders,
    latest: () => renders[renders.length - 1],
    render: (nextFetcher, nextDeps, nextOptions) => {
      act(() => {
        root.render(h(Host, { fetcher: nextFetcher, deps: nextDeps, options: nextOptions }));
      });
    },
    mount: () => {
      act(() => {
        root.render(h(Host, { fetcher, deps, options }));
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

const originalOnLine = Object.getOwnPropertyDescriptor(navigator, 'onLine');

function setOnline(value) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

beforeEach(() => {
  window.localStorage.clear();
  setOnline(true);
});

afterEach(() => {
  if (originalOnLine) Object.defineProperty(navigator, 'onLine', originalOnLine);
  vi.restoreAllMocks();
});

describe('useAsyncData — happy path', () => {
  it('starts loading, then resolves to success with the fetched data', async () => {
    const fetcher = vi.fn().mockResolvedValue([{ id: 1 }]);
    const harness = mountHook(fetcher, []);

    harness.mount();
    expect(harness.latest().status).toBe('loading');

    await act(async () => {
      await flush();
    });

    expect(harness.latest().status).toBe('success');
    expect(harness.latest().data).toEqual([{ id: 1 }]);
    expect(harness.latest().fromCache).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);

    harness.unmount();
  });

  it('reports empty status when the fetcher resolves with an empty array', async () => {
    const fetcher = vi.fn().mockResolvedValue([]);
    const harness = mountHook(fetcher, []);
    harness.mount();

    await act(async () => {
      await flush();
    });

    expect(harness.latest().status).toBe('empty');
    harness.unmount();
  });

  it('unwraps a cachedFetchWithMeta-shaped envelope and reports fromCache', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: { a: 1 }, fromCache: true, stale: false });
    const harness = mountHook(fetcher, []);
    harness.mount();

    await act(async () => {
      await flush();
    });

    expect(harness.latest().status).toBe('success');
    expect(harness.latest().data).toEqual({ a: 1 });
    expect(harness.latest().fromCache).toBe(true);
    harness.unmount();
  });
});

describe('useAsyncData — error classification', () => {
  it('classifies a TypeError as error-network', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const harness = mountHook(fetcher, []);
    harness.mount();

    await act(async () => {
      await flush();
    });

    expect(harness.latest().status).toBe('error-network');
    expect(harness.latest().error).toBeInstanceOf(TypeError);
    harness.unmount();
  });

  it('classifies a Nutridigm-shaped auth error as error-api', async () => {
    const apiError = Object.assign(new Error('Unauthorized'), {
      name: 'NutridigmAuthError',
      code: 'NOTAUTHORIZEDHEALTHID',
    });
    const fetcher = vi.fn().mockRejectedValue(apiError);
    const harness = mountHook(fetcher, []);
    harness.mount();

    await act(async () => {
      await flush();
    });

    expect(harness.latest().status).toBe('error-api');
    harness.unmount();
  });
});

describe('useAsyncData — retry', () => {
  it('retry() re-runs the fetcher and recovers to success', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(['recovered']);
    const harness = mountHook(fetcher, []);
    harness.mount();

    await act(async () => {
      await flush();
    });
    expect(harness.latest().status).toBe('error-network');

    act(() => {
      harness.latest().retry();
    });
    await act(async () => {
      await flush();
    });

    expect(harness.latest().status).toBe('success');
    expect(harness.latest().data).toEqual(['recovered']);
    expect(fetcher).toHaveBeenCalledTimes(2);
    harness.unmount();
  });

  it('refetch is the same re-run behavior as retry', async () => {
    const fetcher = vi.fn().mockResolvedValue(['v1']);
    const harness = mountHook(fetcher, []);
    harness.mount();
    await act(async () => {
      await flush();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    act(() => {
      harness.latest().refetch();
    });
    await act(async () => {
      await flush();
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    harness.unmount();
  });
});

describe('useAsyncData — offline auto-recovery', () => {
  it('auto-retries once back online after a network error', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(['back online']);
    const harness = mountHook(fetcher, []);
    harness.mount();

    await act(async () => {
      await flush();
    });
    expect(harness.latest().status).toBe('error-network');
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Simulate the browser coming back online.
    setOnline(true);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await flush();
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(harness.latest().status).toBe('success');
    expect(harness.latest().data).toEqual(['back online']);
    harness.unmount();
  });

  it('does NOT auto-retry an error-api on reconnect (server said no, not the network)', async () => {
    const apiError = Object.assign(new Error('[nutridigm] HTTP 401: Unauthorized'), { status: 401 });
    const fetcher = vi.fn().mockRejectedValue(apiError);
    const harness = mountHook(fetcher, []);
    harness.mount();

    await act(async () => {
      await flush();
    });
    expect(harness.latest().status).toBe('error-api');
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await flush();
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    harness.unmount();
  });

  it('reflects offline-cached when the device goes offline mid-session with data already loaded', async () => {
    const fetcher = vi.fn().mockResolvedValue(['cached data']);
    const harness = mountHook(fetcher, []);
    harness.mount();
    await act(async () => {
      await flush();
    });
    expect(harness.latest().status).toBe('success');

    setOnline(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(harness.latest().status).toBe('offline-cached');
    expect(harness.latest().offline).toBe(true);
    harness.unmount();
  });
});

describe('useAsyncData — requiresProfile gate', () => {
  it('reports empty-no-profile and never calls the fetcher when no profile exists', async () => {
    storage.remove('profile');
    const fetcher = vi.fn().mockResolvedValue(['should not be called']);
    const harness = mountHook(fetcher, [], { requiresProfile: true });
    harness.mount();

    await act(async () => {
      await flush();
    });

    expect(harness.latest().status).toBe('empty-no-profile');
    expect(fetcher).not.toHaveBeenCalled();
    harness.unmount();
  });

  it('fetches normally when a profile exists', async () => {
    storage.set('profile', { conditions: [203] });
    const fetcher = vi.fn().mockResolvedValue(['ok']);
    const harness = mountHook(fetcher, [], { requiresProfile: true });
    harness.mount();

    await act(async () => {
      await flush();
    });

    expect(harness.latest().status).toBe('success');
    expect(fetcher).toHaveBeenCalledTimes(1);
    harness.unmount();
    storage.remove('profile');
  });
});

describe('useAsyncData — unmount race safety', () => {
  it('ignores a resolution that arrives after unmount (no error thrown, no stale update)', async () => {
    let resolveFetch;
    const fetcher = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );
    const harness = mountHook(fetcher, []);
    harness.mount();
    expect(harness.latest().status).toBe('loading');

    harness.unmount();

    expect(() => {
      resolveFetch(['too late']);
    }).not.toThrow();

    await act(async () => {
      await flush();
    });
    // No new render was recorded after unmount — the last recorded snapshot
    // is still the pre-unmount 'loading' one.
    expect(harness.latest().status).toBe('loading');
  });

  it('ignores a stale resolution from a superseded attempt after a fast retry', async () => {
    let resolveFirst;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const fetcher = vi
      .fn()
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce(['second, newer']);

    const harness = mountHook(fetcher, []);
    harness.mount();

    // Retry before the first fetch has resolved.
    act(() => {
      harness.latest().retry();
    });
    await act(async () => {
      await flush();
    });
    expect(harness.latest().status).toBe('success');
    expect(harness.latest().data).toEqual(['second, newer']);

    // Now let the stale first promise resolve — it must NOT clobber the
    // newer state.
    await act(async () => {
      resolveFirst(['first, stale']);
      await flush();
    });

    expect(harness.latest().data).toEqual(['second, newer']);
    harness.unmount();
  });
});
