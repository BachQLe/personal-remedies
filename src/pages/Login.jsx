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
              fill="#3c7235"
              opacity="0.05"
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
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-ink/[0.08]">
          <Link
            to="/"
            style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 900 }}
            className="text-[22px] tracking-tight text-ink block text-center mb-8"
          >
            personalRemedies
          </Link>

          <h1 className="text-3xl font-bold text-ink mb-2">Log in</h1>
          <p className="text-ink/60 text-[14px] mb-8">
            Access your personalized remedy recommendations
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
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
              className="w-full bg-[#3c7235] text-white font-semibold py-3 rounded-lg hover:bg-[#2d5a27] transition-colors"
            >
              Log in
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-ink/[0.08]">
            <p className="text-ink/60 text-[14px] text-center">
              No account yet?{" "}
              <Link to="/survey" className="text-[#3c7235] font-semibold hover:underline">
                Get Remedy free
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
