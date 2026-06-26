import { useState, useEffect } from "react";
import Icon from "../shared/Icon";

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
      <span className="font-mono font-bold text-[15px] tabular-nums text-white transition-all duration-300 ease-out">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[9px] font-medium tracking-[0.14em] uppercase text-[#BFC9BD] mt-0.5">
        {label}
      </span>
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
    <div
      className={`fixed top-0 inset-x-0 z-[60] bg-forest-700 text-white px-4 py-2 flex items-center justify-center gap-4 flex-wrap text-center transition-transform duration-300 ease-in-out will-change-transform ${scrollHidden ? "-translate-y-full" : "translate-y-0"}`}
      style={{ backfaceVisibility: "hidden" }}
    >
      <p className="text-xs sm:text-[13px] font-sans font-medium tracking-tight hidden md:block text-[#F3EFE6]">
        Get one{" "}
        <span className="font-bold uppercase tracking-wide text-yellow-400">free</span>{" "}
        diet consulting on us with our top model
      </p>

      <div className="flex items-center gap-2">
        <Segment value={time.d} label="days" />
        <span className="text-[#BFC9BD] font-bold text-[14px] mb-2">:</span>
        <Segment value={time.h} label="hrs" />
        <span className="text-[#BFC9BD] font-bold text-[14px] mb-2">:</span>
        <Segment value={time.m} label="min" />
        <span className="text-[#BFC9BD] font-bold text-[14px] mb-2">:</span>
        <Segment value={time.s} label="sec" />
      </div>

      <a
        href="#"
        className="text-[12px] font-sans font-semibold underline underline-offset-2 text-yellow-400 hover:text-yellow-300 transition-colors duration-[120ms] whitespace-nowrap"
      >
        Claim offer
        <Icon name="arrow-right" size={14} className="inline align-middle ml-0.5" />
      </a>

      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#BFC9BD] hover:text-white transition-colors duration-[120ms]"
      >
        <Icon name="x" size={18} />
      </button>
    </div>
  );
}
