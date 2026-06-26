import { useRef, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

function getWeek(centerDate) {
  const d = new Date(centerDate);
  const day = d.getDay();
  const week = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(d);
    date.setDate(d.getDate() - day + i);
    week.push(date);
  }
  return week;
}

function toISO(date) {
  return date.toISOString().split("T")[0];
}

export default function DayStrip({ selected, onSelect, hasplan = {} }) {
  const containerRef = useRef(null);
  const buttonRefs = useRef({});
  const [indicator, setIndicator] = useState(null);
  const [hasMounted, setHasMounted] = useState(false);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const btn = buttonRefs.current[selected];
    if (!container || !btn) return;
    const cRect = container.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    setIndicator({
      x: bRect.left - cRect.left,
      y: bRect.top - cRect.top,
      width: bRect.width,
      height: bRect.height,
    });
  }, [selected]);

  useEffect(() => {
    measure();
    const id = requestAnimationFrame(() => setHasMounted(true));
    return () => cancelAnimationFrame(id);
  }, [measure]);

  const today = new Date();
  const week = getWeek(selected ? new Date(selected) : today);

  return (
    <div ref={containerRef} className="relative flex items-center justify-between px-1 gap-1">
      {indicator && (
        <motion.div
          className="absolute top-0 left-0 bg-forest-700 rounded-lg z-0 pointer-events-none"
          animate={{
            x: indicator.x,
            y: indicator.y,
            width: indicator.width,
            height: indicator.height,
          }}
          transition={
            hasMounted
              ? { type: "spring", stiffness: 500, damping: 35 }
              : { duration: 0 }
          }
        />
      )}
      {week.map((date) => {
        const iso = toISO(date);
        const isSelected = iso === selected;
        const isToday = iso === toISO(today);
        const hasDot = hasplan[iso];
        const dayIdx = date.getDay();

        return (
          <button
            key={iso}
            ref={(el) => { buttonRefs.current[iso] = el; }}
            onClick={() => onSelect(iso)}
            data-ghost-shimmer
            className={`relative flex flex-col items-center gap-1 py-2 px-2.5 rounded-lg min-w-[40px]
              transition-colors duration-fast ease-ds-out
              ${isSelected ? "z-[1]" : "z-[1] hover:bg-forest-50/30"}`}
          >
            <span
              className={`text-[10px] font-medium uppercase tracking-eyebrow ${
                isSelected ? "text-white/70" : "text-char-400"
              }`}
            >
              {DAYS[dayIdx]}
            </span>
            <span
              className={`text-sm font-bold font-mono tabular-nums ${
                isSelected
                  ? "text-white"
                  : isToday
                    ? "text-forest-700"
                    : "text-char-900"
              }`}
            >
              {date.getDate()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
