import { createContext, useState, useContext, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { initProfileSync } from "../api/profileSync";

const AuthContext = createContext();

const CONFIG_ERROR =
  "Sign-in is unavailable: Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.";

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
      value={{ user, loading, signInWithEmail, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
