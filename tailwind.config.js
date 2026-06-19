/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: "#1E4736",
          50: "#EDF3EE",
          100: "#DCE9DF",
          300: "#A7C0AC",
          500: "#3A7058",
          600: "#2A5A45",
          700: "#1E4736",
          800: "#143628",
          900: "#0F2A21",
        },
        plum: {
          DEFAULT: "#5C2A47",
          50: "#F4ECF0",
          100: "#EBDDE6",
          400: "#A86C8E",
          600: "#743A5C",
          700: "#5C2A47",
          800: "#401F33",
          900: "#2E1626",
        },
        honey: {
          DEFAULT: "#D6A642",
          50: "#FAF3E2",
          100: "#F3E6C7",
          500: "#D6A642",
          600: "#C2902F",
          700: "#9C6F1E",
        },
        char: {
          DEFAULT: "#211E1B",
          300: "#B7AF9F",
          400: "#8A8377",
          500: "#6B645A",
          700: "#423D36",
          900: "#211E1B",
        },
        sand: {
          100: "#EEEEE9",
          200: "#E6E6E0",
        },
        paper: {
          100: "#FAFAF8",
          200: "#F5F5F0",
        },
        signal: {
          beneficial: { DEFAULT: "#2F8C5A", tint: "#DCEDE2" },
          limit: { DEFAULT: "#C98A2E", tint: "#F6E8CB" },
          avoid: { DEFAULT: "#C04A2F", tint: "#F6DED5" },
          info: { DEFAULT: "#3F6E86", tint: "#DDE8ED" },
        },
      },
      fontFamily: {
        display: ['"Newsreader"', "ui-serif", "Georgia", "serif"],
        sans: ['"Hanken Grotesk"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: {
        xs: "6px",
        sm: "10px",
        md: "14px",
        lg: "20px",
        xl: "28px",
        "2xl": "36px",
        pill: "999px",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(45, 36, 24, 0.06)",
        sm: "0 2px 8px rgba(45, 36, 24, 0.06)",
        card: "0 3px 16px rgba(45, 36, 24, 0.07)",
        md: "0 8px 24px rgba(45, 36, 24, 0.10)",
        lg: "0 14px 40px rgba(45, 36, 24, 0.14), 0 4px 12px rgba(45, 36, 24, 0.06)",
        sheet: "0 -8px 32px rgba(45, 36, 24, 0.12)",
        nav: "0 1px 0 rgba(45, 36, 24, 0.06), 0 8px 24px rgba(45, 36, 24, 0.06)",
        fab: "0 6px 20px rgba(30, 71, 54, 0.28)",
        inset: "inset 0 1px 2px rgba(45, 36, 24, 0.06)",
      },
      letterSpacing: {
        eyebrow: "0.14em",
        tightish: "-0.02em",
      },
      transitionTimingFunction: {
        "ds-out": "cubic-bezier(0.22, 0.61, 0.36, 1)",
        "ds-spring": "cubic-bezier(0.34, 1.4, 0.64, 1)",
      },
      transitionDuration: {
        fast: "120ms",
        base: "200ms",
        slow: "320ms",
      },
      maxWidth: {
        prose: "60ch",
      },
    },
  },
  plugins: [],
};
