import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { storage } from "../../api/storage";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const onboarded = !!storage.get("profile", null);
        navigate(onboarded ? "/app/home" : "/onboarding", { replace: true });
      } else {
        navigate("/login", { replace: true });
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-paper-200 flex items-center justify-center">
      <p className="font-sans text-char-500">Signing you in...</p>
    </div>
  );
}
