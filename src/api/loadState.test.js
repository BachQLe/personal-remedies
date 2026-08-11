/**
 * loadState.test.js — exhaustive coverage of the state-matrix machine
 * (REMEDI_MASTER_PLAN.md §4.1). Pure-function tests, no DOM needed.
 */
import { describe, it, expect } from 'vitest';
import {
  deriveState,
  isApiError,
  isNetworkError,
  defaultIsEmpty,
  unwrapFetchResult,
} from './loadState.js';

describe('deriveState — the 8-state matrix', () => {
  it('requiresProfile + no profile → empty-no-profile, regardless of everything else', () => {
    expect(deriveState({ requiresProfile: true, hasProfile: false })).toBe('empty-no-profile');
    expect(
      deriveState({ requiresProfile: true, hasProfile: false, loading: true })
    ).toBe('empty-no-profile');
    expect(
      deriveState({ requiresProfile: true, hasProfile: false, error: new Error('boom') })
    ).toBe('empty-no-profile');
    expect(
      deriveState({ requiresProfile: true, hasProfile: false, online: false, hasData: true })
    ).toBe('empty-no-profile');
    expect(
      deriveState({ requiresProfile: true, hasProfile: false, hasData: true, isEmpty: false })
    ).toBe('empty-no-profile');
  });

  it('requiresProfile + has profile falls through to normal rules', () => {
    expect(deriveState({ requiresProfile: true, hasProfile: true, loading: true })).toBe('loading');
    expect(
      deriveState({ requiresProfile: true, hasProfile: true, hasData: true, isEmpty: false })
    ).toBe('success');
  });

  it('offline + has data → offline-cached (checked before loading/error)', () => {
    expect(deriveState({ online: false, hasData: true })).toBe('offline-cached');
    expect(deriveState({ online: false, hasData: true, loading: true })).toBe('offline-cached');
    expect(
      deriveState({ online: false, hasData: true, error: new Error('stale background refetch failed') })
    ).toBe('offline-cached');
  });

  it('offline + no data → offline-no-cache', () => {
    expect(deriveState({ online: false, hasData: false })).toBe('offline-no-cache');
    expect(deriveState({ online: false, hasData: false, loading: true })).toBe('offline-no-cache');
    expect(
      deriveState({ online: false, hasData: false, error: new TypeError('Failed to fetch') })
    ).toBe('offline-no-cache');
  });

  it('online + loading + no settled data → loading', () => {
    expect(deriveState({ online: true, loading: true, hasData: false })).toBe('loading');
  });

  it('online + loading is NOT reported once data exists (SWR revalidation should pass loading:false)', () => {
    // loadState.js takes `loading` as given — the hook is responsible for
    // only setting it true pre-first-resolution. This test pins the
    // contract: if the caller still passes loading:true, it still wins
    // here (deriveState doesn't second-guess based on hasData).
    expect(deriveState({ online: true, loading: true, hasData: true, isEmpty: false })).toBe(
      'loading'
    );
  });

  it('online + api-shaped error → error-api', () => {
    const authError = Object.assign(new Error('Unauthorized'), {
      name: 'NutridigmAuthError',
      code: 'NOTAUTHORIZEDHEALTHID',
    });
    expect(deriveState({ online: true, error: authError })).toBe('error-api');
  });

  it('online + network-shaped error → error-network', () => {
    expect(deriveState({ online: true, error: new TypeError('Failed to fetch') })).toBe(
      'error-network'
    );
  });

  it('online + hasData + not empty → success', () => {
    expect(deriveState({ online: true, hasData: true, isEmpty: false })).toBe('success');
  });

  it('online + hasData + isEmpty → empty', () => {
    expect(deriveState({ online: true, hasData: true, isEmpty: true })).toBe('empty');
  });

  it('online + no data + no error + not loading → empty (fallback)', () => {
    expect(deriveState({ online: true, hasData: false, loading: false, error: null })).toBe(
      'empty'
    );
  });

  it('defaults: called with no input at all resolves to empty (online, no data, not loading)', () => {
    expect(deriveState()).toBe('empty');
    expect(deriveState({})).toBe('empty');
  });

  it('error takes priority over hasData/isEmpty when online (a failed background revalidation with no prior data)', () => {
    expect(
      deriveState({ online: true, hasData: false, error: new Error('[nutridigm] HTTP 500: fail') })
    ).toBe('error-api');
  });
});

describe('isApiError — Nutridigm-shaped error duck-typing', () => {
  it('recognizes NutridigmAuthError by name', () => {
    const err = Object.assign(new Error('Unauthorized'), { name: 'NutridigmAuthError', code: 'NOTAUTHORIZEDHEALTHID' });
    expect(isApiError(err)).toBe(true);
  });

  it('recognizes NutridigmConfigError by name (no code)', () => {
    const err = Object.assign(new Error('missing subscription id'), { name: 'NutridigmConfigError' });
    expect(isApiError(err)).toBe(true);
  });

  it('recognizes a numeric .status field', () => {
    const err = Object.assign(new Error('bad'), { status: 500 });
    expect(isApiError(err)).toBe(true);
  });

  it('recognizes a non-empty .code string', () => {
    const err = Object.assign(new Error('bad'), { code: 'IVHEALTHCONDITIONID' });
    expect(isApiError(err)).toBe(true);
  });

  it('recognizes nutridigm.js\'s plain-Error bad-request/HTTP-status shape via message prefix', () => {
    expect(isApiError(new Error('[nutridigm] Bad request: IVHEALTHCONDITIONID'))).toBe(true);
    expect(isApiError(new Error('[nutridigm] HTTP 500: Internal Server Error'))).toBe(true);
  });

  it('does not misclassify a plain TypeError as an API error', () => {
    expect(isApiError(new TypeError('Failed to fetch'))).toBe(false);
  });

  it('does not misclassify an unrelated generic Error', () => {
    expect(isApiError(new Error('something else broke'))).toBe(false);
  });

  it('returns false for null/undefined/non-object', () => {
    expect(isApiError(null)).toBe(false);
    expect(isApiError(undefined)).toBe(false);
    expect(isApiError('a string')).toBe(false);
  });
});

describe('isNetworkError — transport-failure duck-typing', () => {
  it('recognizes a TypeError (fetch() rejection shape across browsers)', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(true);
    expect(isNetworkError(new TypeError('Load failed'))).toBe(true);
  });

  it('is mutually exclusive with isApiError for the same error', () => {
    const apiErr = Object.assign(new Error('[nutridigm] HTTP 401'), { code: 'X' });
    expect(isApiError(apiErr)).toBe(true);
    expect(isNetworkError(apiErr)).toBe(false);

    const netErr = new TypeError('Failed to fetch');
    expect(isNetworkError(netErr)).toBe(true);
    expect(isApiError(netErr)).toBe(false);
  });

  it('falls back to true for an unrecognized generic error (never a third category)', () => {
    expect(isNetworkError(new Error('mystery failure'))).toBe(true);
  });

  it('returns false for a falsy error', () => {
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
  });
});

describe('defaultIsEmpty', () => {
  it('treats null/undefined as empty', () => {
    expect(defaultIsEmpty(null)).toBe(true);
    expect(defaultIsEmpty(undefined)).toBe(true);
  });

  it('treats an empty array as empty, a non-empty array as not', () => {
    expect(defaultIsEmpty([])).toBe(true);
    expect(defaultIsEmpty([1])).toBe(false);
  });

  it('treats an empty plain object as empty, a populated one as not', () => {
    expect(defaultIsEmpty({})).toBe(true);
    expect(defaultIsEmpty({ a: 1 })).toBe(false);
  });

  it('treats non-empty primitives as not empty', () => {
    expect(defaultIsEmpty('hello')).toBe(false);
    expect(defaultIsEmpty(0)).toBe(false);
    expect(defaultIsEmpty(false)).toBe(false);
  });
});

describe('unwrapFetchResult', () => {
  it('passes a plain value through as data, fromCache/stale false', () => {
    expect(unwrapFetchResult([1, 2, 3])).toEqual({ data: [1, 2, 3], fromCache: false, stale: false });
    expect(unwrapFetchResult(null)).toEqual({ data: null, fromCache: false, stale: false });
  });

  it('unwraps a cachedFetchWithMeta-shaped envelope', () => {
    expect(unwrapFetchResult({ data: { a: 1 }, fromCache: true, stale: false })).toEqual({
      data: { a: 1 },
      fromCache: true,
      stale: false,
    });
    expect(unwrapFetchResult({ data: [], fromCache: true, stale: true })).toEqual({
      data: [],
      fromCache: true,
      stale: true,
    });
  });

  it('does not mistake an unrelated object (no boolean fromCache) for the envelope', () => {
    expect(unwrapFetchResult({ data: 'oops', fromCache: 'yes' })).toEqual({
      data: { data: 'oops', fromCache: 'yes' },
      fromCache: false,
      stale: false,
    });
  });

  it('defaults stale to false when the envelope omits it', () => {
    expect(unwrapFetchResult({ data: 'x', fromCache: false })).toEqual({
      data: 'x',
      fromCache: false,
      stale: false,
    });
  });
});
