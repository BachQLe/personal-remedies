import { motion } from 'framer-motion';
import { todayKey } from './planDates.js';

const calmSpring = { type: 'spring', stiffness: 300, damping: 30 };

const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Split a LOCAL 'YYYY-MM-DD' key into its display parts. Parsed from the
 * parts rather than `new Date(key)`, which treats a bare date string as UTC
 * and would render the previous day west of Greenwich.
 * @param {string} key
 * @returns {{abbr: string, dayOfMonth: number}}
 */
function chipParts(key) {
  const [y, m, d] = key.split('-').map(Number);
  return { abbr: WEEKDAY_ABBR[new Date(y, m - 1, d).getDay()], dayOfMonth: d };
}

/**
 * DayStrip — the Plan screen's day pager: all 7 days of the window visible at
 * once in an equal-width grid (no horizontal scroll, so no edge fade), each
 * chip an abbreviated weekday over a large day-of-month number.
 *
 * A single sliding highlight (framer-motion `layoutId`) tracks the selected
 * chip instead of each chip owning its own background, so it glides between
 * chips rather than popping. The highlight is the app's navy (blue-950), the
 * same fill as every other selected pill on this screen. Today, when it ISN'T
 * the selected day, keeps a brighter blue-500 number plus a dot — vivid enough
 * to stand out from the navy of the ordinary days, so the real date stays
 * findable after paging away from it.
 *
 * This deliberately renders from each day's `key` rather than its
 * `label`/`sublabel`: the strip is always weekday + date now, independent of
 * `getDayLabelMode()` (which still drives SchedulerView's week view).
 *
 * @param {import('./planDates.js').PlanDay[]} days
 * @param {string} selected - selected day's `key`
 * @param {(key: string) => void} onSelect
 * @param {string} [bgClassName] - Tailwind bg class the strip sits on.
 */
export default function DayStrip({ days, selected, onSelect, bgClassName = 'bg-forest-300' }) {
  const today = todayKey();

  return (
    <div className={`flex gap-1 ${bgClassName}`}>
      {days.map((day) => {
        const isSelected = day.key === selected;
        const isToday = day.key === today;
        const { abbr, dayOfMonth } = chipParts(day.key);
        return (
          <button
            key={day.key}
            onClick={() => onSelect(day.key)}
            aria-pressed={isSelected}
            aria-label={`${abbr} ${dayOfMonth}${isToday ? ' (today)' : ''}`}
            className="relative flex flex-col items-center flex-1 min-w-0 gap-0.5 py-2
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
                tracking-eyebrow
                ${isSelected ? 'text-white/70' : isToday ? 'text-blue-500' : 'text-blue-950/50'}`}
            >
              {abbr}
            </span>
            <span
              className={`relative z-10 text-lg font-bold font-sans leading-none
                ${isSelected ? 'text-white' : isToday ? 'text-blue-500' : 'text-blue-950'}`}
            >
              {dayOfMonth}
            </span>
            {/* Today marker — only when today isn't already the filled chip. */}
            <span
              className={`relative z-10 w-1 h-1 rounded-full
                ${isToday && !isSelected ? 'bg-blue-500' : 'bg-transparent'}`}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}
