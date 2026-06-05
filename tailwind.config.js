/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: "#1F4A3A",
          deep: "#163528",
        },
        cream: {
          DEFAULT: "#F5F2EA",
          warm: "#ECE6D8",
        },
        sage: {
          DEFAULT: "#CFE0D4",
          soft: "#E4EDE5",
        },
        ink: {
          DEFAULT: "#1B2A23",
          soft: "#4C5C53",
        },
        amber: {
          DEFAULT: "#D98A4A",
        },
      },
      fontFamily: {
        display: ['"Fraunces"', "ui-serif", "Georgia", "serif"],
        sans: ['"Satoshi"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        tightish: "-0.01em",
        tighter2: "-0.02em",
      },
      maxWidth: {
        prose: "60ch",
      },
      boxShadow: {
        card: "0 1px 2px rgba(22,53,40,0.04), 0 8px 24px rgba(22,53,40,0.06)",
        lift: "0 8px 20px rgba(22,53,40,0.08), 0 24px 60px rgba(22,53,40,0.10)",
        nav: "0 1px 0 rgba(22,53,40,0.06), 0 8px 24px rgba(22,53,40,0.06)",
      },
      animation: {
        "slow-pulse": "slowPulse 6s ease-in-out infinite",
      },
      keyframes: {
        slowPulse: {
          "0%, 100%": { opacity: 0.6 },
          "50%": { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};
