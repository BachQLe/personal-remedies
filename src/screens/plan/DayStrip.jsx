import { motion } from 'framer-motion';

const calmSpring = { type: 'spring', stiffness: 300, damping: 30 };

/**
 * DayStrip — horizontally scrollable row of day chips (from `nextSevenDays`)
 * for the Plan screen's day pager. A single sliding highlight (framer-motion
 * `layoutId`) tracks the selected chip instead of each chip owning its own
 * background, so it glides between chips rather than popping. Edge fade uses
 * the repo's stacked-bars convention (see DESIGN_SYSTEM.md) — never a CSS
 * gradient — matched to `bgClassName` (the strip's own background).
 *
 * @param {import('./planDates.js').PlanDay[]} days
 * @param {string} selected - selected day's `key`
 * @param {(key: string) => void} onSelect
 * @param {string} [bgClassName] - Tailwind bg class the strip sits on, used
 *   for both the strip's own background and the edge-fade bar color.
 */
export default function DayStrip({ days, selected, onSelect, bgClassName = 'bg-forest-300' }) {
  return (
    <div className={`relative -mx-5 ${bgClassName}`}>
      <div className="flex gap-1.5 overflow-x-auto px-5 pb-1 hide-scrollbar">
        {days.map((day) => {
          const isSelected = day.key === selected;
          return (
            <button
              key={day.key}
              onClick={() => onSelect(day.key)}
              aria-pressed={isSelected}
              className="relative shrink-0 flex flex-col items-center gap-0.5 px-3.5 py-2.5
                rounded-xl overflow-hidden transition-colors duration-fast
                active:scale-[0.97]"
            >
              {isSelected && (
                <motion.div
                  layoutId="plan-day-chip-active"
                  className="absolute inset-0 rounded-xl bg-blue-950"
                  transition={calmSpring}
                />
              )}
              <span
                className={`relative z-10 text-[10px] font-semibold font-sans uppercase
                  tracking-eyebrow whitespace-nowrap
                  ${isSelected ? 'text-white/70' : 'text-blue-950/50'}`}
              >
                {day.label}
              </span>
              <span
                className={`relative z-10 text-sm font-bold font-sans whitespace-nowrap
                  ${isSelected ? 'text-white' : 'text-blue-950'}`}
              >
                {day.sublabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* Edge fade — stacked bars, never a gradient */}
      <div className="absolute inset-y-0 left-0 flex gap-[2px] items-stretch pointer-events-none z-10 -translate-x-[4px]">
        {[0.6, 0.38, 0.2, 0.09, 0.03].map((op, i) => (
          <div key={i} className={`w-[8px] ${bgClassName}`} style={{ opacity: op }} />
        ))}
      </div>
      <div className="absolute inset-y-0 right-0 flex flex-row-reverse gap-[2px] items-stretch pointer-events-none z-10 translate-x-[4px]">
        {[0.6, 0.38, 0.2, 0.09, 0.03].map((op, i) => (
          <div key={i} className={`w-[8px] ${bgClassName}`} style={{ opacity: op }} />
        ))}
      </div>
    </div>
  );
}
