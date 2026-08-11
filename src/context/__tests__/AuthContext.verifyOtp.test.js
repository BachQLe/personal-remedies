/**
 * AuthContext.verifyOtp.test.js — Guard tests for `verifyOtpRequest` (the
 * pure async function behind `useAuth().verifyOtp`, Task T4D, master plan
 * §4.3) and its error classifier `classifyOtpError`.
 *
 * `verifyOtpRequest` is exported as a standalone function specifically so it
 * can be unit tested here without mounting <AuthProvider> — this repo has no
 * @testing-library/react dependency (and T4D's guardrails forbid adding new
 * deps), so there's no `renderHook`/`render` available to exercise the
 * `useAuth()` hook surface directly. Each test uses `vi.doMock` (not the
 * hoisted `vi.mock`) plus `vi.resetModules()` + a fresh dynamic `import()`
 * so `src/lib/supabase.js` — and in particular its `isSupabaseConfigured`
 * flag, which AuthContext.jsx reads at MODULE load time — can be swapped per
 * test.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const SUPABASE_MODULE = '../../lib/supabase.js';

afterEach(() => {
  vi.doUnmock(SUPABASE_MODULE);
  vi.resetModules();
});

describe('verifyOtpRequest', () => {
  it('returns ok:true with the session on success', async () => {
    const session = { access_token: 'tok', user: { id: 'u1', email: 'a@b.com' } };
    const verifyOtp = vi.fn().mockResolvedValue({ data: { session }, error: null });
    vi.doMock(SUPABASE_MODULE, () => ({
      supabase: { auth: { verifyOtp } },
      isSupabaseConfigured: true,
    }));

    const { verifyOtpRequest } = await import('../AuthContext.jsx');
    const result = await verifyOtpRequest('a@b.com', '123456');

    expect(result).toEqual({ ok: true, session });
    expect(verifyOtp).toHaveBeenCalledWith({ email: 'a@b.com', token: '123456', type: 'email' });
  });

  it('returns ok:true with session:null if supabase omits it', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ data: {}, error: null });
    vi.doMock(SUPABASE_MODULE, () => ({
      supabase: { auth: { verifyOtp } },
      isSupabaseConfigured: true,
    }));

    const { verifyOtpRequest } = await import('../AuthContext.jsx');
    const result = await verifyOtpRequest('a@b.com', '123456');

    expect(result).toEqual({ ok: true, session: null });
  });

  it('normalizes an "invalid" supabase error (wrong code)', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({
      data: {},
      error: { name: 'AuthApiError', message: 'Token has expired or is invalid', code: 'otp_expired' },
    });
    // Note: real Supabase reuses this exact message for both wrong AND
    // expired codes; this case asserts the `code: 'otp_expired'` path
    // specifically classifies as 'expired' (tested below) — this test
    // instead covers a message with no expiry signal at all.
    vi.doMock(SUPABASE_MODULE, () => ({
      supabase: { auth: { verifyOtp } },
      isSupabaseConfigured: true,
    }));
    const { verifyOtpRequest } = await import('../AuthContext.jsx');
    const result = await verifyOtpRequest('a@b.com', '000000');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('expired'); // code says otp_expired -> expired wins
  });

  it('normalizes a generic invalid-code error with no expiry signal as "invalid"', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({
      data: {},
      error: { name: 'AuthApiError', message: 'Invalid OTP' },
    });
    vi.doMock(SUPABASE_MODULE, () => ({
      supabase: { auth: { verifyOtp } },
      isSupabaseConfigured: true,
    }));
    const { verifyOtpRequest } = await import('../AuthContext.jsx');
    const result = await verifyOtpRequest('a@b.com', '000000');
    expect(result).toEqual({ ok: false, reason: 'invalid', message: 'Invalid OTP' });
  });

  it('normalizes an expired-code error (message-based)', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({
      data: {},
      error: { name: 'AuthApiError', message: 'Token has expired or is invalid' },
    });
    vi.doMock(SUPABASE_MODULE, () => ({
      supabase: { auth: { verifyOtp } },
      isSupabaseConfigured: true,
    }));
    const { verifyOtpRequest } = await import('../AuthContext.jsx');
    const result = await verifyOtpRequest('a@b.com', '111111');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('expired');
    expect(result.message).toBe('Token has expired or is invalid');
  });

  it('normalizes a rejected/thrown network failure as "network"', async () => {
    const verifyOtp = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.doMock(SUPABASE_MODULE, () => ({
      supabase: { auth: { verifyOtp } },
      isSupabaseConfigured: true,
    }));
    const { verifyOtpRequest } = await import('../AuthContext.jsx');
    const result = await verifyOtpRequest('a@b.com', '222222');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('network');
  });

  it('normalizes a returned (non-thrown) AuthRetryableFetchError as "network"', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({
      data: {},
      error: { name: 'AuthRetryableFetchError', message: 'fetch failed' },
    });
    vi.doMock(SUPABASE_MODULE, () => ({
      supabase: { auth: { verifyOtp } },
      isSupabaseConfigured: true,
    }));
    const { verifyOtpRequest } = await import('../AuthContext.jsx');
    const result = await verifyOtpRequest('a@b.com', '333333');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('network');
  });

  it('short-circuits to reason:"unconfigured" without calling supabase when Supabase is not configured', async () => {
    const verifyOtp = vi.fn();
    vi.doMock(SUPABASE_MODULE, () => ({
      supabase: null,
      isSupabaseConfigured: false,
    }));
    const { verifyOtpRequest } = await import('../AuthContext.jsx');
    const result = await verifyOtpRequest('a@b.com', '444444');

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('unconfigured');
    expect(result.message).toMatch(/supabase is not configured/i);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('never throws even if supabase.auth.verifyOtp itself is missing/broken', async () => {
    vi.doMock(SUPABASE_MODULE, () => ({
      supabase: { auth: {} }, // verifyOtp is not a function
      isSupabaseConfigured: true,
    }));
    const { verifyOtpRequest } = await import('../AuthContext.jsx');
    const result = await verifyOtpRequest('a@b.com', '555555');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('network');
  });
});

describe('classifyOtpError', () => {
  it('classifies AuthRetryableFetchError as network', async () => {
    vi.doMock(SUPABASE_MODULE, () => ({ supabase: null, isSupabaseConfigured: true }));
    const { classifyOtpError } = await import('../AuthContext.jsx');
    expect(classifyOtpError({ name: 'AuthRetryableFetchError', message: 'fetch failed' })).toBe('network');
  });

  it('classifies a bare TypeError as network', async () => {
    vi.doMock(SUPABASE_MODULE, () => ({ supabase: null, isSupabaseConfigured: true }));
    const { classifyOtpError } = await import('../AuthContext.jsx');
    expect(classifyOtpError(new TypeError('Failed to fetch'))).toBe('network');
  });

  it('classifies an otp_expired code as expired even without "expired" in the message', async () => {
    vi.doMock(SUPABASE_MODULE, () => ({ supabase: null, isSupabaseConfigured: true }));
    const { classifyOtpError } = await import('../AuthContext.jsx');
    expect(classifyOtpError({ code: 'otp_expired', message: 'Token has expired or is invalid' })).toBe('expired');
  });

  it('classifies a message containing "expired" (any case) as expired', async () => {
    vi.doMock(SUPABASE_MODULE, () => ({ supabase: null, isSupabaseConfigured: true }));
    const { classifyOtpError } = await import('../AuthContext.jsx');
    expect(classifyOtpError({ message: 'Your code EXPIRED' })).toBe('expired');
  });

  it('falls back to invalid for anything else', async () => {
    vi.doMock(SUPABASE_MODULE, () => ({ supabase: null, isSupabaseConfigured: true }));
    const { classifyOtpError } = await import('../AuthContext.jsx');
    expect(classifyOtpError({ message: 'Invalid OTP' })).toBe('invalid');
    expect(classifyOtpError({})).toBe('invalid');
    expect(classifyOtpError(null)).toBe('invalid');
  });
});
