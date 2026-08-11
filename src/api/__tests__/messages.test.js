// @vitest-environment jsdom
/**
 * messages.test.js — Guard tests for Task T5C Part C (REMEDI_MASTER_PLAN.md
 * §4.7: "News / alerts channel. In-app message surface now; push once
 * native."), covering src/api/messages.js's `getActiveMessages`/`dismissMessage`.
 *
 * Needs jsdom for two reasons: src/api/storage.js's dismissal persistence
 * only activates when `window` exists (see its `typeof window ===
 * 'undefined'` guard — under plain `node` it silently no-ops), and
 * src/api/cache.js's localStorage persistence has the same guard.
 *
 * Each test gets a FRESH copy of messages.js (and, transitively, cache.js)
 * via `vi.resetModules()` + dynamic `import()` — same idiom used by
 * src/api/__tests__/adapter.recipeOverlay.test.js. This matters because
 * cache.js keeps an in-memory Map keyed by a fixed 'messages.json' string
 * (messages.js doesn't parametrize the cache key), so without a fresh
 * module instance per test, the first test's mocked fetch response would
 * stay cached in memory for every later test regardless of localStorage
 * being cleared.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Fresh (un-cached) messages.js module, isolated from other tests' cache state. */
async function freshMessages() {
  vi.resetModules();
  return import('../messages.js');
}

/** Minimal fetch Response stand-in, same shape src/api/__tests__/usda.test.js uses. */
function fakeResponse(ok, body) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  };
}

function mockFetchOnce(ok, body) {
  globalThis.fetch = vi.fn().mockResolvedValue(fakeResponse(ok, body));
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const NOW = Date.parse('2026-08-10T12:00:00Z');
const PAST = '2020-01-01T00:00:00Z';
const FUTURE = '2099-01-01T00:00:00Z';

describe('getActiveMessages — window filtering', () => {
  it('includes a message with no startsAt/endsAt at all (missing dates = always active)', async () => {
    mockFetchOnce(true, [{ id: 'a', title: 'A', body: 'body a' }]);
    const { getActiveMessages } = await freshMessages();

    const active = await getActiveMessages(NOW);
    expect(active.map((m) => m.id)).toEqual(['a']);
  });

  it('includes a message with startsAt/endsAt explicitly null (same as missing)', async () => {
    mockFetchOnce(true, [{ id: 'a', title: 'A', body: 'body a', startsAt: null, endsAt: null }]);
    const { getActiveMessages } = await freshMessages();

    const active = await getActiveMessages(NOW);
    expect(active.map((m) => m.id)).toEqual(['a']);
  });

  it('excludes a message whose startsAt is in the future ("before" the window)', async () => {
    mockFetchOnce(true, [{ id: 'future', title: 'Future', body: 'not yet', startsAt: FUTURE }]);
    const { getActiveMessages } = await freshMessages();

    const active = await getActiveMessages(NOW);
    expect(active).toEqual([]);
  });

  it('includes a message when now is between startsAt and endsAt ("within" the window)', async () => {
    mockFetchOnce(true, [{ id: 'current', title: 'Current', body: 'live now', startsAt: PAST, endsAt: FUTURE }]);
    const { getActiveMessages } = await freshMessages();

    const active = await getActiveMessages(NOW);
    expect(active.map((m) => m.id)).toEqual(['current']);
  });

  it('excludes a message whose endsAt is in the past ("after" the window)', async () => {
    mockFetchOnce(true, [{ id: 'expired', title: 'Expired', body: 'too late', endsAt: PAST }]);
    const { getActiveMessages } = await freshMessages();

    const active = await getActiveMessages(NOW);
    expect(active).toEqual([]);
  });

  it('filters a mixed batch to only the currently-active ones, preserving source order', async () => {
    mockFetchOnce(true, [
      { id: 'expired', title: 'Expired', body: 'x', endsAt: PAST },
      { id: 'evergreen', title: 'Evergreen', body: 'x' },
      { id: 'future', title: 'Future', body: 'x', startsAt: FUTURE },
      { id: 'current', title: 'Current', body: 'x', startsAt: PAST, endsAt: FUTURE },
    ]);
    const { getActiveMessages } = await freshMessages();

    const active = await getActiveMessages(NOW);
    expect(active.map((m) => m.id)).toEqual(['evergreen', 'current']);
  });

  it('accepts a Date instance for `now`, not just an epoch-ms number', async () => {
    mockFetchOnce(true, [{ id: 'a', title: 'A', body: 'x', startsAt: PAST, endsAt: FUTURE }]);
    const { getActiveMessages } = await freshMessages();

    const active = await getActiveMessages(new Date(NOW));
    expect(active.map((m) => m.id)).toEqual(['a']);
  });
});

describe('getActiveMessages — dismissal filtering + persistence', () => {
  it('excludes a message id that has been dismissed', async () => {
    mockFetchOnce(true, [
      { id: 'keep', title: 'Keep', body: 'x' },
      { id: 'gone', title: 'Gone', body: 'x' },
    ]);
    const { getActiveMessages, dismissMessage } = await freshMessages();

    dismissMessage('gone');
    const active = await getActiveMessages(NOW);
    expect(active.map((m) => m.id)).toEqual(['keep']);
  });

  it('persists dismissal through storage.js under a dismissedMessages sub-key of remedi.v1', async () => {
    const { dismissMessage } = await freshMessages();

    dismissMessage('persisted-id');

    const root = JSON.parse(window.localStorage.getItem('remedi.v1'));
    expect(root.dismissedMessages).toContain('persisted-id');
  });

  it('a dismissal persisted by one module instance is honored by a later fresh instance (survives reload)', async () => {
    const first = await freshMessages();
    first.dismissMessage('sticky');

    mockFetchOnce(true, [{ id: 'sticky', title: 'Sticky', body: 'x' }]);
    const second = await freshMessages();
    const active = await second.getActiveMessages(NOW);

    expect(active).toEqual([]);
  });

  it('dismissing an id twice does not create duplicate storage entries', async () => {
    const { dismissMessage } = await freshMessages();

    dismissMessage('dupe');
    dismissMessage('dupe');

    const root = JSON.parse(window.localStorage.getItem('remedi.v1'));
    expect(root.dismissedMessages.filter((id) => id === 'dupe')).toHaveLength(1);
  });

  it('ignores a non-string/empty id rather than corrupting storage', async () => {
    const { dismissMessage } = await freshMessages();

    dismissMessage('');
    dismissMessage(undefined);
    dismissMessage(null);
    dismissMessage(42);

    const root = window.localStorage.getItem('remedi.v1');
    // Nothing valid was ever dismissed, so storage.js's write path may not
    // have run at all, or may hold an empty array — either is fine as long
    // as no bogus id landed in it.
    if (root) {
      const parsed = JSON.parse(root);
      expect(parsed.dismissedMessages ?? []).toEqual([]);
    }
  });
});

describe('getActiveMessages — fetch failure degrades silently to []', () => {
  it('resolves to [] when fetch rejects (network error)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const { getActiveMessages } = await freshMessages();

    await expect(getActiveMessages(NOW)).resolves.toEqual([]);
  });

  it('resolves to [] when the response is not ok (e.g. 404 for a missing file)', async () => {
    mockFetchOnce(false, null);
    const { getActiveMessages } = await freshMessages();

    await expect(getActiveMessages(NOW)).resolves.toEqual([]);
  });

  it('resolves to [] when res.json() throws (malformed JSON body)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token'); },
    });
    const { getActiveMessages } = await freshMessages();

    await expect(getActiveMessages(NOW)).resolves.toEqual([]);
  });

  it('resolves to [] when the parsed body is not an array (unexpected shape)', async () => {
    mockFetchOnce(true, { not: 'an array' });
    const { getActiveMessages } = await freshMessages();

    await expect(getActiveMessages(NOW)).resolves.toEqual([]);
  });
});

describe('getActiveMessages — malformed rows are dropped, not crashed on', () => {
  it('drops rows missing id, title, or body, keeping only well-formed ones', async () => {
    mockFetchOnce(true, [
      { id: 'ok', title: 'OK', body: 'well formed' },
      { title: 'No id', body: 'x' },
      { id: 'no-title', body: 'x' },
      { id: 'no-body', title: 'x' },
      { id: '', title: 'Empty id', body: 'x' },
      { id: 'empty-title', title: '', body: 'x' },
      { id: 'empty-body', title: 'x', body: '' },
    ]);
    const { getActiveMessages } = await freshMessages();

    const active = await getActiveMessages(NOW);
    expect(active.map((m) => m.id)).toEqual(['ok']);
  });

  it('drops non-object rows (null, string, number, array) without throwing', async () => {
    mockFetchOnce(true, [
      { id: 'ok', title: 'OK', body: 'well formed' },
      null,
      'a string row',
      42,
      ['nested', 'array'],
      undefined,
    ]);
    const { getActiveMessages } = await freshMessages();

    await expect(getActiveMessages(NOW)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'ok' })])
    );
    const active = await getActiveMessages(NOW);
    expect(active).toHaveLength(1);
  });

  it('drops rows where id/title/body are the wrong type (numbers instead of strings)', async () => {
    mockFetchOnce(true, [
      { id: 'ok', title: 'OK', body: 'well formed' },
      { id: 123, title: 'Numeric id', body: 'x' },
      { id: 'numeric-title', title: 456, body: 'x' },
      { id: 'numeric-body', title: 'x', body: 789 },
    ]);
    const { getActiveMessages } = await freshMessages();

    const active = await getActiveMessages(NOW);
    expect(active.map((m) => m.id)).toEqual(['ok']);
  });

  it('an unparsable startsAt/endsAt is treated as unbounded rather than dropping the row', async () => {
    mockFetchOnce(true, [
      { id: 'a', title: 'A', body: 'x', startsAt: 'not-a-date', endsAt: 'also-not-a-date' },
    ]);
    const { getActiveMessages } = await freshMessages();

    const active = await getActiveMessages(NOW);
    expect(active.map((m) => m.id)).toEqual(['a']);
  });
});
