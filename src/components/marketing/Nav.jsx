import { useEffect, useState, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import logoMark from "../../assets/remedy-mark.svg";
import Icon from "../shared/Icon";
import { MARKETING_VISIBLE } from "./visibility";

const allMenus = [
  {
    label: "For providers",
    items: [
      { label: "Providers", to: "/providers", blurb: "For telehealth & clinical teams" },
      { label: "Developers / API", to: "/developers", blurb: "The Nutridigm API" },
      { label: "The science", to: "/science", blurb: "How the engine works" },
    ],
  },
  {
    label: "Company",
    items: [
      { label: "About & team", to: "/about", blurb: "Mission and the people" },
      { label: "News", to: "/news", blurb: "Press & recognition" },
    ],
  },
];

// Every entry points at a hidden marketing page, so with the site off the nav
// keeps only the logo and the sign-up / log-in actions.
const menus = MARKETING_VISIBLE ? allMenus : [];

function Dropdown({ menu }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button className="flex items-center gap-1 text-[14px] font-medium font-sans text-char hover:text-forest-700 transition-colors duration-[120ms]">
        {menu.label}
        <Icon name="chevron-down" size={18} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
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
            <div
              className="w-[260px] rounded-[28px] bg-paper-100 border border-sand-200 p-2"
              style={{ boxShadow: "0 1px 0 rgba(45,36,24,0.06), 0 8px 24px rgba(45,36,24,0.06)" }}
            >
              {menu.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="block rounded-[14px] px-3.5 py-2.5 hover:bg-paper-200 transition-colors duration-[120ms]"
                >
                  <span className="block text-[14px] font-medium font-sans text-char">{item.label}</span>
                  <span className="block text-[12px] text-char-500 mt-0.5">{item.blurb}</span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Mobile menu ── */
function MobileMenu({ open, onClose, user, signOut }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] bg-black/20"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-0 inset-x-0 z-[80] bg-paper-100 border-b border-sand-200 rounded-b-[28px] p-6 pt-16"
            style={{ boxShadow: "0 8px 24px rgba(45,36,24,0.1)" }}
          >
            <button
              onClick={onClose}
              aria-label="Close menu"
              className="absolute top-4 right-4 text-char-500 hover:text-char transition-colors duration-[120ms]"
            >
              <Icon name="x" size={24} />
            </button>

            <nav className="flex flex-col gap-1">
              {MARKETING_VISIBLE && (
                <Link to="/" onClick={onClose} className="text-[16px] font-medium font-sans text-char hover:text-forest-700 py-2 transition-colors duration-[120ms]">
                  For individuals
                </Link>
              )}
              {menus.map((m) => (
                <div key={m.label} className="py-2">
                  <span className="text-[12px] font-label uppercase tracking-[0.14em] font-medium text-char-500">{m.label}</span>
                  <div className="mt-2 flex flex-col gap-1 pl-2">
                    {m.items.map((item) => (
                      <Link key={item.to} to={item.to} onClick={onClose} className="text-[15px] font-sans text-char hover:text-forest-700 py-1.5 transition-colors duration-[120ms]">
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            <div className="mt-6 pt-4 border-t border-sand-200 flex flex-col gap-3">
              {user ? (
                <button onClick={() => { signOut(); onClose(); }} className="text-[14px] font-medium font-sans text-char hover:text-forest-700 transition-colors duration-[120ms]">
                  Log out
                </button>
              ) : (
                <>
                  <Link to="/onboarding" onClick={onClose} className="pill-forest text-center">
                    Get Remedy free
                  </Link>
                  <Link to="/login" onClick={onClose} className="text-[14px] font-medium font-sans text-char hover:text-forest-700 text-center py-2 transition-colors duration-[120ms]">
                    Log in
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function Nav({ offset = 0 }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef(null);
  const location = useLocation();
  const { user, signOut } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <>
      <motion.header
        ref={navRef}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{
          top: offset,
          boxShadow: scrolled
            ? "0 1px 0 rgba(45,36,24,0.06), 0 8px 24px rgba(45,36,24,0.06)"
            : "none",
        }}
        className="fixed inset-x-0 z-50 bg-paper-100 border-b border-sand-200 transition-shadow duration-300"
      >
        <div className="mx-auto max-w-7xl container-px h-14 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logoMark} alt="Remedy" className="h-8 w-8" />
            <span className="text-[20px] font-display font-semibold tracking-tight text-char">
              Personal Remedies
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8 ml-auto mr-8">
            {MARKETING_VISIBLE && (
              <Link to="/" className="text-[14px] font-medium font-sans text-char hover:text-forest-700 transition-colors duration-[120ms]">
                For individuals
              </Link>
            )}
            {menus.map((m) => (
              <Dropdown key={m.label} menu={m} />
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <button
                onClick={signOut}
                className="text-[14px] font-medium font-sans text-char hover:text-forest-700 transition-colors duration-[120ms]"
              >
                Log out
              </button>
            ) : (
              <>
                <Link to="/onboarding" className="pill-forest">
                  Get Remedy free
                </Link>
                <Link
                  to="/login"
                  className="text-[14px] font-medium font-sans text-char hover:text-forest-700 transition-colors duration-[120ms]"
                >
                  Log in
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="md:hidden text-char hover:text-forest-700 transition-colors duration-[120ms]"
          >
            <Icon name="menu" size={26} />
          </button>
        </div>
      </motion.header>

      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} user={user} signOut={signOut} />
    </>
  );
}
