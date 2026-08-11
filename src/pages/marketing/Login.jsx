import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { motion } from "framer-motion";
import remedyMark from "../../assets/remedy-mark.svg";
import OtpCodeEntry from "../../components/auth/OtpCodeEntry.jsx";
import { pullProfile } from "../../api/profileSync.js";
import { storage } from "../../api/storage.js";

export default function Login() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [stage, setStage] = useState("email"); // 'email' | 'code'
  const [sentAt, setSentAt] = useState(null);
  const [sending, setSending] = useState(false);
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email");
      return;
    }
    setSending(true);
    setError("");
    try {
      await signInWithEmail(email);
      setSentAt(Date.now());
      setStage("code");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleGoogle = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message);
    }
  };

  // First-time vs returning (REMEDI_MASTER_PLAN.md §4.5), keyed off profile
  // presence + session only: trigger the existing profileSync reconciliation
  // (pullProfile — the same function AuthContext's auth-listener already
  // calls on SIGNED_IN; calling it again here just lets us deterministically
  // await it instead of racing that listener) before checking local storage,
  // mirroring AuthCallback.jsx's post-auth routing exactly.
  const handleVerified = async (session) => {
    if (session?.user) {
      try {
        await pullProfile(session.user);
      } catch {
        /* best-effort — profileSync already logs/swallows its own errors */
      }
    }
    const onboarded = !!storage.get("profile", null);
    navigate(onboarded ? "/app/home" : "/onboarding", { replace: true });
  };

  return (
    <div className="min-h-screen bg-paper-200 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-white rounded-[28px] shadow-card border border-sand-200 px-8 py-10">
          {/* Logo mark */}
          <Link to="/" className="flex justify-center mb-8">
            <img src={remedyMark} alt="Remedy" className="h-10 w-auto" />
          </Link>

          <h1 className="font-display font-semibold tracking-[-0.02em] text-[24px] text-blue-950 text-center mb-1">
            Welcome back
          </h1>
          <p className="font-sans text-[16px] text-char-500 text-center mb-8">
            Log in to your account
          </p>

          {stage === "code" ? (
            <OtpCodeEntry
              email={email}
              sentAt={sentAt}
              onVerified={handleVerified}
              onCancel={() => {
                setStage("email");
                setError("");
              }}
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block font-sans text-[14px] font-medium text-char-900 mb-2">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  className="w-full font-sans text-[16px] px-4 py-3 bg-white border border-sand-200 rounded-md text-char-900 placeholder:text-char-400 focus:outline-none focus:border-forest-600 focus:shadow-[0_0_0_3px_rgba(30,71,54,0.22)] transition-[border-color,box-shadow] duration-[120ms]"
                  placeholder="you@example.com"
                  autoComplete="email"
                  autoFocus
                />
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.12 }}
                  className="font-sans text-[14px] text-signal-avoid"
                >
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={sending}
                className="w-full bg-forest-700 text-[#F3EFE6] font-sans font-semibold text-[16px] py-3 rounded-[6px] hover:bg-forest-800 disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px active:scale-[0.98] transition-all duration-[120ms]"
              >
                {sending ? "Sending…" : "Continue with email"}
              </button>
            </form>
          )}

          {stage === "email" && (
            <>
              {/* Divider */}
              <div className="mt-8 mb-6 flex items-center gap-3">
                <div className="flex-1 h-px bg-sand-200" />
                <span className="font-sans text-[13px] text-char-500">or continue with</span>
                <div className="flex-1 h-px bg-sand-200" />
              </div>

              {/* Social sign-in buttons */}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleGoogle}
                  className="flex items-center justify-center gap-2 py-3 px-6 border border-sand-200 rounded-[6px] hover:bg-paper-100 active:translate-y-px active:scale-[0.98] transition-all duration-[120ms]"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  <span className="font-sans text-[14px] font-semibold text-char-900">Google</span>
                </button>
              </div>
            </>
          )}

          {/* Sign up link */}
          <div className="mt-8 pt-6 border-t border-sand-200">
            <p className="font-sans text-[14px] text-char-500 text-center">
              No account yet?{" "}
              <Link to="/onboarding" className="text-forest-700 font-semibold hover:text-forest-800 transition-colors duration-[120ms]">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        {/* Legal text outside card */}
        <p className="mt-6 font-sans text-[12px] text-char-400 text-center leading-relaxed max-w-sm mx-auto">
          By continuing, you acknowledge that you understand and agree to the{" "}
          <Link to="/terms" className="text-char-500 hover:text-forest-700 transition-colors duration-[120ms]">
            Terms &amp; Conditions
          </Link>
          {" "}and{" "}
          <Link to="/privacy" className="text-char-500 hover:text-forest-700 transition-colors duration-[120ms]">
            Privacy Policy
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
