import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.error(
    "[supabase] Missing VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY. " +
      "Auth and database features are disabled. Set both in your .env file " +
      "(see .env.example) — you can find them in Supabase → Project Settings → API."
  );
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
