import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

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

function Dropdown({ menu }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button className="flex items-center gap-1 text-[14px] font-semibold text-ink/85 hover:text-ink transition-colors">
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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      style={{
        top: offset,
        background: scrolled
          ? "rgba(255, 253, 245, 0.55)"
          : "rgba(255, 253, 245, 0.35)",
        backdropFilter: "blur(24px) saturate(180%) brightness(1.08)",
        WebkitBackdropFilter: "blur(24px) saturate(180%) brightness(1.08)",
        boxShadow: scrolled
          ? "0 1px 0 rgba(0,0,0,0.06), 0 4px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.7)"
          : "inset 0 1px 0 rgba(255,255,255,0.5)",
        borderBottom: "1px solid rgba(255,255,255,0.45)",
      }}
      className="fixed inset-x-10 z-50 transition-all duration-300 rounded-lg"
    >
      <div className="mx-auto max-w-7xl container-px h-16 flex items-center justify-between">
        <Link to="/" style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 900 }} className="text-[22px] tracking-tight text-ink">
          personalRemedies
        </Link>

        <nav className="hidden md:flex items-center gap-9 ml-auto mr-10">
          <Link to="/" className="text-[14px] font-semibold text-ink/85 hover:text-ink transition-colors">
            For Individuals
          </Link>
          {menus.map((m) => (
            <Dropdown key={m.label} menu={m} />
          ))}
        </nav>

        <Link to="/survey" className="bg-[#3c7235] text-white text-[14px] font-semibold px-5 py-2.5 rounded-sm">
          Get Remedy free
        </Link>
      </div>
    </motion.header>
  );
}
