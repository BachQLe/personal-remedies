/* eslint-disable react-refresh/only-export-components --
 * This provider file also exports the `useAuth()` hook (pre-existing) and,
 * as of Task T4D, the pure `verifyOtpRequest`/`classifyOtpError` helpers —
 * exported standalone specifically so verifyOtp's error-normalization logic
 * is unit-testable via a mocked src/lib/supabase.js without mounting a React
 * tree (@testing-library/react is not a project dependency; see
 * src/context/__tests__/AuthContext.verifyOtp.test.js). Splitting these into
 * a separate file would satisfy Fast Refresh but isn't worth fragmenting a
 * ~150-line context module over a dev-only HMR nicety.
 */
import { createContext, useState, useContext, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { initProfileSync } from "../api/profileSync.js";

const AuthContext = createContext();

const CONFIG_ERROR =
  "Sign-in is unavailable: Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.";

/**
 * Classify a supabase.auth.verifyOtp() error/exception into one of three
 * honest, user-facing reasons.
 *
 * Supabase's GoTrue API does not reliably distinguish "wrong code" from
 * "right code, too late" at the message level — both commonly surface as
 * some variant of "Token has expired or is invalid" — so `expired` is only
 * reported when the error says so explicitly (a `code` of `otp_expired`, or
 * a message containing "expired"). Anything else that isn't a network
 * failure is reported as `invalid`, the safer default since it doesn't
 * assert a code was ever legitimate in the first place.
 * @param {unknown} error
 * @returns {'network' | 'expired' | 'invalid'}
 */
export function classifyOtpError(error) {
  const name = error?.name || '';
  const message = typeof error?.message === 'string' ? error.message : '';
  const lower = message.toLowerCase();

  // supabase-js wraps fetch-level failures (offline, DNS, CORS, ...) in
  // AuthRetryableFetchError; a raw TypeError can also surface if fetch
  // itself throws before supabase-js gets a chance to wrap it.
  if (
    name === 'AuthRetryableFetchError' ||
    name === 'TypeError' ||
    lower.includes('network') ||
    lower.includes('fetch')
  ) {
    return 'network';
  }
  if (error?.code === 'otp_expired' || lower.includes('expired')) {
    return 'expired';
  }
  return 'invalid';
}

/**
 * The pure async request behind `useAuth().verifyOtp` — kept as a
 * standalone export (rather than only a closure inside AuthProvider) so it
 * can be unit tested directly against a mocked src/lib/supabase.js without
 * mounting a React tree (@testing-library/react is not a project
 * dependency — see src/context/__tests__/AuthContext.verifyOtp.test.js).
 *
 * Never throws: Supabase errors and network exceptions are both normalized
 * into `{ ok: false, reason, message }` so callers can render an honest,
 * distinct message per failure mode instead of a raw exception.
 * @param {string} email
 * @param {string} token - the 6-digit code
 * @returns {Promise<
 *   | { ok: true, session: import('@supabase/supabase-js').Session | null }
 *   | { ok: false, reason: 'unconfigured' | 'network' | 'expired' | 'invalid', message: string }
 * >}
 */
export async function verifyOtpRequest(email, token) {
  if (!isSupabaseConfigured) {
    return { ok: false, reason: 'unconfigured', message: CONFIG_ERROR };
  }
  try {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) {
      return {
        ok: false,
        reason: classifyOtpError(error),
        message: error.message || "That code didn't work. Please try again.",
      };
    }
    return { ok: true, session: data?.session ?? null };
  } catch (err) {
    return {
      ok: false,
      reason: 'network',
      message: err?.message || 'Could not reach the server. Check your connection and try again.',
    };
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // App-level hook-in for remote profile sync (src/api/profileSync.js): pulls
  // + reconciles on sign-in, and pushes local profile/library/dailyPlan
  // writes while signed in. No-ops entirely when Supabase isn't configured.
  useEffect(() => {
    const teardown = initProfileSync();
    return teardown;
  }, []);

  const signInWithEmail = async (email) => {
    if (!isSupabaseConfigured) throw new Error(CONFIG_ERROR);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) throw error;
  };

  const verifyOtp = (email, token) => verifyOtpRequest(email, token);

  const signInWithGoogle = async () => {
    if (!isSupabaseConfigured) throw new Error(CONFIG_ERROR);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) throw new Error(CONFIG_ERROR);
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isSupabaseConfigured,
        signInWithEmail,
        verifyOtp,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
