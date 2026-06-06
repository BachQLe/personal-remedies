import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";

export default function Login() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email");
      return;
    }
    signIn(email);
    navigate("/");
  };

  const HalftonePattern = () => {
    const dots = [];
    const spacing = 20;
    const cols = Math.ceil(1200 / spacing);
    const rows = Math.ceil(800 / spacing);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * spacing + spacing / 2;
        const y = row * spacing + spacing / 2;
        const distanceFromCenter = Math.sqrt(
          Math.pow(x - 600, 2) + Math.pow(y - 400, 2)
        );
        const maxDistance = 800;
        const intensity = Math.max(
          0,
          1 - (distanceFromCenter / maxDistance) * 0.8
        );
        const size = intensity * 7;

        if (size > 0.5) {
          dots.push(
            <circle
              key={`${row}-${col}`}
              cx={x}
              cy={y}
              r={size}
              fill="#636363ff"
              opacity="0.00"
            />
          );
        }
      }
    }
    return dots;
  };

  return (
    <div className="min-h-screen bg-cream text-ink flex items-center justify-center p-4 relative overflow-hidden">
      {/* Comic book halftone dots background */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
      >
        <HalftonePattern />
      </svg>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <Link
          to="/"
          style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 900 }}
          className="text-[22px] tracking-tight text-ink block text-center mb-8"
        >
          personalRemedies
        </Link>

        <h1 className="text-[24px] font-bold text-ink mb-0 text-center">Your personal Dietician</h1>
        <p className="text-ink/60 text-[24px] mb-4 text-center font-bold">
          Log in to Remedy
        </p>

        <form onSubmit={handleSubmit} className="space-y-5 flex flex-col items-center">
          <div className="w-full max-w-sm">
            <label className="block text-[14px] font-semibold text-ink mb-2">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              className="w-full px-4 py-3 border border-ink/20 rounded-lg focus:outline-none focus:border-ink/50 focus:ring-1 focus:ring-ink/20 transition-colors"
              placeholder="you@example.com"
              autoFocus
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-600 text-[14px]"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            className="w-full max-w-sm bg-[#1B3A2F] text-white font-semibold py-3 rounded-lg hover:bg-[#2d5a27] transition-colors"
          >
            Log in
          </button>
        </form>

        {/* Divider */}
        <div className="mt-8 mb-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-ink/20"></div>
          <span className="text-ink/60 text-[14px] font-medium">or continue with</span>
          <div className="flex-1 h-px bg-ink/20"></div>
        </div>

        {/* Social sign-in buttons */}
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            className="flex items-center justify-center gap-2 py-3 px-4 border border-ink/20 rounded-lg hover:bg-ink/5 transition-colors w-[120px]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span className="text-[14px] font-semibold text-ink">Google</span>
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-2 py-3 px-4 border border-ink/20 rounded-lg hover:bg-ink/5 transition-colors w-[110px]"
          >
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg"
              alt="Apple logo"
              width="20"
              height="20"
            />
            <span className="text-[14px] font-semibold text-ink">Apple</span>
          </button>
        </div>

        <div className="mt-8 pt-8">
          <p className="text-ink/60 text-[14px] text-center">
            No account yet?{" "}
            <Link to="/survey" className="text-[#3c7235] font-semibold hover:underline">
              Sign up
            </Link>
          </p>
        </div>

        {/* Legal text */}
        <p className="mt-8 text-ink/40 text-[12px] text-center leading-relaxed">
          By continuing, you acknowledge that you understand and agree to the{" "}
          <a href="/terms" className="hover:underline">
            Terms & Conditions
          </a>
          {" "}and{" "}
          <a href="/privacy" className="hover:underline">
            Privacy Policy
          </a>
        </p>
      </motion.div>
    </div>
  );
}
