import { useEffect, useState, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";

const menus = [
  {
    label: "For Providers",
    items: [
      { label: "Providers", to: "/providers", blurb: "For telehealth & clinical teams" },
      { label: "Developers / API", to: "/developers", blurb: "The Nutridigm API" },
      { label: "The Science", to: "/science", blurb: "How the engine works" },
    ],
  },
  {
    label: "Company",
    items: [
      { label: "About & Team", to: "/about", blurb: "Mission and the people" },
      { label: "News", to: "/news", blurb: "Press & recognition" },
    ],
  },
];

function Dropdown({ menu, textColor, textColorHover }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button className={`flex items-center gap-1 text-[14px] font-semibold ${textColor} ${textColorHover} transition-colors`}>
        {menu.label}
        <svg
          width="11"
          height="11"
          viewBox="0 0 12 12"
          fill="none"
          className={`mt-px transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-1/2 -translate-x-1/2 top-full pt-3"
          >
            <div className="w-[260px] rounded-2xl bg-white border border-ink/[0.08] shadow-lift p-2">
              {menu.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="block rounded-xl px-3.5 py-2.5 hover:bg-sage-soft transition-colors"
                >
                  <span className="block text-[14px] font-semibold text-ink">{item.label}</span>
                  <span className="block text-[12px] text-ink/50 mt-0.5">{item.blurb}</span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Nav({ offset = 0 }) {
  const [scrolled, setScrolled] = useState(false);
  const [isDarkBehind, setIsDarkBehind] = useState(false);
  const navRef = useRef(null);
  const location = useLocation();
  const { user, signOut } = useAuth();

  const checkBackgroundBrightness = () => {
    // On landing page, check if past hero section
    if (location.pathname === "/") {
      const hero = document.querySelector("section");
      if (hero) {
        const heroRect = hero.getBoundingClientRect();
        const heroHeight = heroRect.height;
        if (window.scrollY > heroHeight / 2) {
          setIsDarkBehind(false);
          return;
        }
      }
    }

    if (!navRef.current) return;
    const rect = navRef.current.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.bottom + 10;

    // Temporarily hide navbar to detect element behind it
    navRef.current.style.pointerEvents = "none";
    const element = document.elementFromPoint(x, y);
    navRef.current.style.pointerEvents = "auto";

    if (!element) return;

    const bgColor = window.getComputedStyle(element).backgroundColor;
    const rgb = bgColor.match(/\d+/g);
    if (!rgb || rgb.length < 3) return;

    const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
    setIsDarkBehind(luminance < 0.5);
  };

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 60);
      checkBackgroundBrightness();
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const textColor = isDarkBehind ? "text-white" : "text-ink/85";
  const textColorHover = isDarkBehind ? "hover:text-white" : "hover:text-ink";

  return (
    <motion.header
      ref={navRef}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      style={{
        top: offset,
        background: scrolled
          ? "rgba(255, 253, 245, 0.1)"
          : "rgba(255, 253, 245, 0.1)",
        backdropFilter: "blur(24px) saturate(180%) brightness(1.00)",
        WebkitBackdropFilter: "blur(24px) saturate(110%) brightness(1.00)",
        boxShadow: scrolled
          ? "0 1px 0 rgba(0,0,0,0.06), 0 4px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.7)"
          : "inset 0 1px 0 rgba(255,255,255,0.5)",
        borderBottom: "1px solid rgba(255,255,255,0.45)",
      }}
      className="fixed inset-x-20 mt-2 z-50 transition-all duration-300 rounded-3xl"
    >
      <div className="mx-auto max-w-7xl container-px h-12 flex items-center justify-between">
        <Link to="/" style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 900 }} className={`text-[22px] tracking-tight ${textColor}`}>
          personalRemedies
        </Link>

        <nav className="hidden md:flex items-center gap-9 ml-auto mr-10">
          <Link to="/" className={`text-[14px] font-semibold ${textColor} ${textColorHover} transition-colors`}>
            For Individuals
          </Link>
          {menus.map((m) => (
            <Dropdown key={m.label} menu={m} textColor={textColor} textColorHover={textColorHover} />
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <button
              onClick={signOut}
              className={`text-[14px] font-semibold ${textColor} ${textColorHover} transition-colors`}
            >
              Log out
            </button>
          ) : (
            <>
              <Link to="/survey" className="bg-[#1B3A2D] text-white text-[14px] font-semibold px-2 py-2 rounded-md">
                Get Remedy free
              </Link>
              <Link
                to="/login"
                className={`text-[14px] font-semibold ${textColor} ${textColorHover} transition-colors`}
              >
                Log in
              </Link>
            </>
          )}
        </div>
      </div>
    </motion.header>
  );
}
