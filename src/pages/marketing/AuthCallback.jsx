import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { storage } from "../../api/storage";

const TIMEOUT_MS = 8000;

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isSupabaseConfigured) {
      navigate("/login", { replace: true });
      return;
    }

    let settled = false;

    const finish = (session) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      subscription.unsubscribe();

      if (session) {
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
