import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { storage } from "../../api/storage.js";
import { pullProfile } from "../../api/profileSync.js";

const TIMEOUT_MS = 8000;

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isSupabaseConfigured) {
      navigate("/login", { replace: true });
      return;
    }

    let settled = false;

    // First-time vs returning (REMEDI_MASTER_PLAN.md §4.5), keyed off
    // profile presence + session only — same rule src/pages/marketing/
    // Login.jsx's email+OTP path uses. `pullProfile` is the existing
    // profileSync reconciliation (also triggered by AuthContext's own
    // auth-listener on SIGNED_IN); awaiting it explicitly here — rather
    // than relying on that listener's un-awaited background call racing
    // against the `storage.get` read below — is what makes "onboarded"
    // reflect a returning user's just-hydrated remote profile instead of
    // whatever (possibly nothing) storage.js happened to hold before the
    // pull settled.
    const finish = async (session) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      subscription.unsubscribe();

      if (session) {
        if (session.user) {
          try {
            await pullProfile(session.user);
          } catch {
            /* best-effort — profileSync already logs/swallows its own errors */
          }
        }
        const onboarded = !!storage.get("profile", null);
        navigate(onboarded ? "/app/home" : "/onboarding", { replace: true });
      } else {
        navigate("/login", { replace: true });
      }
    };

    // The OAuth redirect exchange (detectSessionInUrl) happens asynchronously,
    // so a single getSession() call on mount can race it and return null even
    // after a successful Google sign-in. Listen for the SIGNED_IN event AND
    // poll getSession in case a session already exists, then bail to /login
    // if neither fires within TIMEOUT_MS.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session || event === "SIGNED_OUT") {
        finish(session);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) finish(session);
    });

    const timeoutId = setTimeout(() => finish(null), TIMEOUT_MS);

    return () => {
      settled = true;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-paper-200 flex items-center justify-center">
      <p className="font-sans text-char-500">Signing you in...</p>
    </div>
  );
}
