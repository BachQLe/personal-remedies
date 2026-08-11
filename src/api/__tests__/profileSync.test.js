// @vitest-environment jsdom
/**
 * profileSync.test.js — Guard tests for docs/storage-map.md §6, gaps 1 and 2
 * (closed by task T5D):
 *
 *  - Gap 1: a profile write that changes `conditions` must purge the stored
 *    plan the INSTANT it's saved (`storage.onWrite('profile', ...)` hook in
 *    `initProfileSync`, calling `purgeDerivedDataForConditionsChange` from
 *    planBuilder.js) — not wait for `ensurePlanForWeek`'s next call. This
 *    must hold even signed-out / with Supabase unconfigured, since the guard
 *    is registered unconditionally (see `initProfileSync`'s doc).
 *  - Gap 2: `pullProfile` must not hydrate a remote `daily_plan` whose
 *    `conditionsKey` disagrees with that SAME row's `conditions` — profile
 *    and library still hydrate, the stale plan is dropped to the honest
 *    empty state instead.
 *
 * `src/lib/supabase.js` is mocked per test via `vi.doMock` + a fresh dynamic
 * `import()` (the pattern `src/context/__tests__/AuthContext.verifyOtp.test.js`
 * uses for the same reason: `isSupabaseConfigured`/`supabase` are read at
 * profileSync.js's call sites, and swapping them per test needs a fresh
 * module instance). storage.js/dailyPlan.js/library.js are ALSO re-imported
 * fresh alongside profileSync.js in every test (via `loadFresh()` below) so
 * they resolve to the exact same module instances profileSync.js itself
 * imports — `vi.resetModules()` between tests means a stale top-level import
 * of storage.js would silently desync from whatever instance a later test's
 * dynamically re-imported profileSync.js subscribes its onWrite hook to.
 *
 * jsdom needed for the same reason as the planBuilder guard tests:
 * src/state/dailyPlan.js / src/api/storage.js are real localStorage-backed
 * modules.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const SUPABASE_MODULE = '../../lib/supabase.js';

afterEach(() => {
  vi.doUnmock(SUPABASE_MODULE);
  vi.resetModules();
});

/**
 * Fresh, mutually-consistent instances of storage.js / dailyPlan.js /
 * profileSync.js for one test. MUST be called after `vi.doMock(SUPABASE_MODULE, ...)`
 * so profileSync.js's own import of `../lib/supabase.js` picks up the mock.
 */
async function loadFresh() {
  const { storage } = await import('../storage.js');
  const dailyPlan = await import('../../state/dailyPlan.js');
  const profileSync = await import('../profileSync.js');
  storage.clear();
  dailyPlan.reloadPlan();
  return { storage, ...dailyPlan, ...profileSync };
}

/** Minimal WeeklyPlan fixture, distinguishing conditionsKey only (days/picksBySlot unused by these tests). */
function planFixture(conditionsKey) {
  return {
    version: 2,
    conditionsKey,
    conditionNames: [`Condition ${conditionsKey}`],
    usedFallback: false,
    generation: 0,
    days: {},
  };
}

/** Chainable `supabase.from('profiles').select(...).eq(...).maybeSingle()` + auth stub. */
function makeSupabase(row) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn(() => ({ select, upsert }));
  return {
    from,
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  };
}

describe('initProfileSync: conditions-change purge guard (gap 1)', () => {
  it('purges the stored plan the instant a `profile` write changes conditions, even with Supabase unconfigured', async () => {
    vi.doMock(SUPABASE_MODULE, () => ({ supabase: null, isSupabaseConfigured: false }));
    const { storage, setPlan, getPlan, initProfileSync } = await loadFresh();

    setPlan(planFixture('203'));
    const teardown = initProfileSync();

    storage.set('profile', { firstName: 'Amy', conditions: [244] });

    expect(getPlan()).toBeNull();
    expect(storage.get('dailyPlan')).toBeNull();

    teardown();
  });

  it('does not purge when a `profile` write leaves conditions unchanged', async () => {
    vi.doMock(SUPABASE_MODULE, () => ({ supabase: null, isSupabaseConfigured: false }));
    const { storage, setPlan, getPlan, initProfileSync } = await loadFresh();

    const seeded = planFixture('203');
    setPlan(seeded);
    const teardown = initProfileSync();

    // Different field (firstName), SAME conditions — must be a no-op purge-wise.
    storage.set('profile', { firstName: 'Ben', conditions: [203] });

    expect(getPlan()).toEqual(seeded);
    expect(storage.get('dailyPlan')).toEqual(seeded);

    teardown();
  });

  it('purges even when Supabase IS configured but no one is signed in', async () => {
    vi.doMock(SUPABASE_MODULE, () => ({ supabase: makeSupabase(null), isSupabaseConfigured: true }));
    const { storage, setPlan, getPlan, initProfileSync } = await loadFresh();

    setPlan(planFixture('203'));
    const teardown = initProfileSync();

    storage.set('profile', { conditions: [999] });

    expect(getPlan()).toBeNull();

    teardown();
  });

  it('stops purging once the returned teardown has run', async () => {
    vi.doMock(SUPABASE_MODULE, () => ({ supabase: null, isSupabaseConfigured: false }));
    const { storage, setPlan, getPlan, initProfileSync } = await loadFresh();

    setPlan(planFixture('203'));
    const teardown = initProfileSync();
    teardown();

    storage.set('profile', { conditions: [244] });

    // No listener left to react — the plan survives untouched.
    expect(getPlan()).not.toBeNull();
    expect(getPlan().conditionsKey).toBe('203');
  });
});

describe('pullProfile: remote daily_plan/conditions consistency check (gap 2)', () => {
  it('hydrates profile, library, and dailyPlan when the remote row is internally consistent', async () => {
    const row = {
      conditions: [203],
      preferences: { firstName: 'Amy' },
      library: [{ id: 1, name: 'Saved Food' }],
      daily_plan: planFixture('203'),
      updated_at: '2026-08-10T00:00:00.000Z',
    };
    vi.doMock(SUPABASE_MODULE, () => ({ supabase: makeSupabase(row), isSupabaseConfigured: true }));
    const { storage, getPlan, pullProfile } = await loadFresh();

    await pullProfile({ id: 'user-1' });

    expect(storage.get('profile')).toEqual({ firstName: 'Amy', conditions: [203] });
    expect(storage.get('library')).toEqual([{ id: 1, name: 'Saved Food' }]);
    expect(storage.get('dailyPlan')).toEqual(row.daily_plan);
    expect(getPlan()).toEqual(row.daily_plan);
  });

  it('hydrates profile/library but DROPS an inconsistent daily_plan (conditionsKey disagrees with the row conditions)', async () => {
    const row = {
      conditions: [244], // row says "244" ...
      preferences: { firstName: 'Ben' },
      library: [{ id: 2, name: 'Other Food' }],
      daily_plan: planFixture('203'), // ... but the plan on the SAME row was built for "203"
      updated_at: '2026-08-10T00:00:00.000Z',
    };
    vi.doMock(SUPABASE_MODULE, () => ({ supabase: makeSupabase(row), isSupabaseConfigured: true }));
    const { storage, getPlan, pullProfile } = await loadFresh();

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await pullProfile({ id: 'user-2' });

    // Profile/library hydrate unconditionally...
    expect(storage.get('profile')).toEqual({ firstName: 'Ben', conditions: [244] });
    expect(storage.get('library')).toEqual([{ id: 2, name: 'Other Food' }]);
    // ...but the mismatched plan is dropped, not imported.
    expect(storage.get('dailyPlan')).toBeNull();
    expect(getPlan()).toBeNull();

    // Never a raw/unhandled error — at most a dev console.warn.
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('treats a null remote daily_plan as trivially consistent (nothing to hydrate, nothing to drop)', async () => {
    const row = {
      conditions: [203],
      preferences: { firstName: 'Cam' },
      library: [],
      daily_plan: null,
      updated_at: '2026-08-10T00:00:00.000Z',
    };
    vi.doMock(SUPABASE_MODULE, () => ({ supabase: makeSupabase(row), isSupabaseConfigured: true }));
    const { storage, getPlan, pullProfile } = await loadFresh();

    await pullProfile({ id: 'user-3' });

    expect(storage.get('profile')).toEqual({ firstName: 'Cam', conditions: [203] });
    expect(storage.get('dailyPlan')).toBeNull();
    expect(getPlan()).toBeNull();
  });
});
