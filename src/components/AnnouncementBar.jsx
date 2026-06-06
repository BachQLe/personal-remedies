import { useState, useEffect } from "react";

const TARGET = new Date("2026-06-10T23:59:59");

function getTimeLeft() {
  const diff = TARGET - Date.now();
  if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0 };
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
  };
}

function Segment({ value, label }) {
  return (
    <span className="inline-flex flex-col items-center leading-none">
      <span className="font-black text-[15px] tabular-nums transition-all duration-300 ease-out">{String(value).padStart(2, "0")}</span>
      <span className="text-[9px] font-medium tracking-[0.14em] uppercase text-white/50 mt-0.5">{label}</span>
    </span>
  );
}

export default function AnnouncementBar({ onDismiss, scrollHidden }) {
  const [time, setTime] = useState(getTimeLeft);

  useEffect(() => {
    const id = setInterval(() => setTime(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={`fixed top-0 rounded-lg inset-x-10 z-[60] bg-slate-900 text-white px-4 py-2 flex items-center justify-center gap-4 flex-wrap text-center transition-transform duration-300 ease-in-out will-change-transform ${scrollHidden ? "-translate-y-full" : "translate-y-0"}`} style={{ backfaceVisibility: "hidden" }}>
      <p className="text-[13px] font-medium tracking-tight">
        Get one{" "}
        <span className="font-black uppercase tracking-wide">free</span>{" "}
        diet consulting on us with our top model
      </p>

      <div className="flex items-center gap-2">
        <Segment value={time.d} label="days" />
        <span className="text-white/30 font-bold text-[14px] mb-2">:</span>
        <Segment value={time.h} label="hrs" />
        <span className="text-white/30 font-bold text-[14px] mb-2">:</span>
        <Segment value={time.m} label="min" />
        <span className="text-white/30 font-bold text-[14px] mb-2">:</span>
        <Segment value={time.s} label="sec" />
      </div>

      <a
        href="#"
        className="text-[12px] font-semibold underline underline-offset-2 text-white/70 hover:text-white transition-colors whitespace-nowrap"
      >
        Claim offer →
      </a>

      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
