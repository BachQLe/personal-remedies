// @vitest-environment jsdom
/**
 * cache.test.js — coverage for `cachedFetchWithMeta`'s provenance metadata
 * (fresh/stale/missing paths) plus a pin that `cachedFetch` still delegates
 * to it with zero behavior change (same data, same await timing, same
 * dedup'd background revalidation).
 *
 * Uses jsdom (real window.localStorage) since cache.js's persistence layer
 * only activates when `window` exists — under the default `node` test
 * environment it silently falls back to the in-memory Map only, which
 * wouldn't exercise the persisted-entry (fresh/stale) code paths at all.
 *
 * Every test uses a unique cache key (via a per-test counter) rather than
 * resetting the module between tests — cache.js's `_memory` Map and
 * `_revalidating` map are module-private with no reset hook, so unique
 * keys are the simplest way to keep tests independent within one file.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cachedFetch, cachedFetchWithMeta, peekCache, SCHEMA_VERSION } from './cache.js';

let keyCounter = 0;
function uniqueKey(label) {
  keyCounter += 1;
  return `test:${label}:${keyCounter}`;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('cachedFetchWithMeta — missing entry', () => {
  it('awaits the fetcher and reports fromCache:false, stale:false', async () => {
    const key = uniqueKey('missing');
    const fetcher = vi.fn().mockResolvedValue({ hello: 'world' });

    const result = await cachedFetchWithMeta(key, 10_000, fetcher);

    expect(result).toEqual({ data: { hello: 'world' }, fromCache: false, stale: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('persists the result to localStorage under the namespaced key', async () => {
    const key = uniqueKey('persist');
    await cachedFetchWithMeta(key, 10_000, async () => ({ x: 1 }));

    const raw = window.localStorage.getItem(`remedi.cache.v1.${key}`);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw);
    expect(parsed.v).toBe(SCHEMA_VERSION);
    expect(parsed.data).toEqual({ x: 1 });
    expect(typeof parsed.ts).toBe('number');
  });
});

describe('cachedFetchWithMeta — fresh entry', () => {
  it('returns cached data with fromCache:true, stale:false, and does NOT call the fetcher again', async () => {
    const key = uniqueKey('fresh');
    const fetcher = vi.fn().mockResolvedValue({ v: 1 });

    await cachedFetchWithMeta(key, 10_000, fetcher);
    const second = await cachedFetchWithMeta(key, 10_000, fetcher);

    expect(second).toEqual({ data: { v: 1 }, fromCache: true, stale: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('cachedFetchWithMeta — stale entry (stale-while-revalidate)', () => {
  it('returns the stale data immediately with fromCache:true, stale:true, then revalidates in the background', async () => {
    const key = uniqueKey('stale');
    let call = 0;
    const fetcher = vi.fn().mockImplementation(async () => {
      call += 1;
      return { v: call };
    });

    // Seed a fresh entry with a 1ms TTL so it's immediately stale afterward.
    await cachedFetchWithMeta(key, 1, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Let the 1ms TTL elapse.
    await new Promise((resolve) => setTimeout(resolve, 5));

    const staleResult = await cachedFetchWithMeta(key, 1, fetcher);
    expect(staleResult).toEqual({ data: { v: 1 }, fromCache: true, stale: true });

    // Background revalidation was kicked off — let its microtasks/timers flush.
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(fetcher).toHaveBeenCalledTimes(2);

    // The persisted entry now reflects the revalidated data.
    const raw = window.localStorage.getItem(`remedi.cache.v1.${key}`);
    expect(JSON.parse(raw).data).toEqual({ v: 2 });
  });

  it('de-dupes concurrent stale reads into a single background revalidation', async () => {
    const key = uniqueKey('stale-dedupe');
    const fetcher = vi.fn().mockResolvedValue({ v: 'refreshed' });

    await cachedFetchWithMeta(key, 1, fetcher);
    await new Promise((resolve) => setTimeout(resolve, 5));

    const [a, b] = await Promise.all([
      cachedFetchWithMeta(key, 1, fetcher),
      cachedFetchWithMeta(key, 1, fetcher),
    ]);
    expect(a.stale).toBe(true);
    expect(b.stale).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 5));
    // 1 initial fetch + exactly 1 de-duped background revalidation, not 2.
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps serving the stale entry if the background revalidation fails', async () => {
    const key = uniqueKey('stale-revalidate-fails');
    const fetcher = vi.fn().mockResolvedValueOnce({ v: 'first' }).mockRejectedValueOnce(new Error('boom'));

    await cachedFetchWithMeta(key, 1, fetcher);
    await new Promise((resolve) => setTimeout(resolve, 5));

    const result = await cachedFetchWithMeta(key, 1, fetcher);
    expect(result).toEqual({ data: { v: 'first' }, fromCache: true, stale: true });

    await new Promise((resolve) => setTimeout(resolve, 5));
    const raw = window.localStorage.getItem(`remedi.cache.v1.${key}`);
    // Still the original value — the failed revalidation never overwrote it.
    expect(JSON.parse(raw).data).toEqual({ v: 'first' });
  });
});

describe('cachedFetch — delegates to cachedFetchWithMeta with zero behavior change', () => {
  it('returns just the data (missing-entry path)', async () => {
    const key = uniqueKey('delegate-missing');
    await expect(cachedFetch(key, 10_000, async () => ({ ok: true }))).resolves.toEqual({ ok: true });
  });

  it('returns just the data (fresh-entry path), fetcher called once', async () => {
    const key = uniqueKey('delegate-fresh');
    const fetcher = vi.fn().mockResolvedValue([1, 2]);

    await cachedFetch(key, 10_000, fetcher);
    const second = await cachedFetch(key, 10_000, fetcher);

    expect(second).toEqual([1, 2]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('returns the stale data immediately (stale-entry path), same as before this change', async () => {
    const key = uniqueKey('delegate-stale');
    const fetcher = vi.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2');

    await cachedFetch(key, 1, fetcher);
    await new Promise((resolve) => setTimeout(resolve, 5));

    await expect(cachedFetch(key, 1, fetcher)).resolves.toBe('v1');
  });
});

describe('peekCache — unaffected by the cachedFetchWithMeta refactor', () => {
  it('returns undefined when nothing has been cached yet', () => {
    expect(peekCache(uniqueKey('peek-empty'))).toBeUndefined();
  });

  it('returns the cached data (fresh or stale) without triggering a fetch', async () => {
    const key = uniqueKey('peek-hit');
    await cachedFetchWithMeta(key, 10_000, async () => ({ peeked: true }));

    expect(peekCache(key)).toEqual({ peeked: true });
  });
});
