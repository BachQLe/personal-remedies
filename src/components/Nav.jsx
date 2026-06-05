import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const links = [
  { label: "For Individuals", href: "#individuals" },
  { label: "For Businesses", href: "#businesses" },
];

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
      className="fixed inset-x-0 z-50 transition-all duration-300"
    >
      <div className="mx-auto max-w-7xl container-px h-16 flex items-center justify-between">
        <a href="#" style={{ fontFamily: "'Raleway', sans-serif", fontWeight: 900 }} className="text-[22px] tracking-tight text-ink">
          personalRemedies
        </a>

        <nav className="hidden md:flex items-center gap-9 ml-auto mr-10">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[14px] font-semibold text-ink/85 hover:text-ink transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <Link to="/survey" className="bg-[#3c7235] text-white text-[14px] font-semibold px-5 py-2.5 rounded-sm">
          Get Remedy free
        </Link>
      </div>
    </motion.header>
  );
}
