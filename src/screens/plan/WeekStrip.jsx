/**
 * WeekStrip — 7 day-pills (Mon–Sun) with selected state and week navigation.
 *
 * Props:
 *   weekOffset   — which week relative to the current week (0 = this week)
 *   selectedDay  — 0-6 index within the week (0 = Mon)
 *   onSelectDay  — callback(dayIndex)
 *   onPrevWeek   — callback to navigate to previous week
 *   onNextWeek   — callback to navigate to next week
 */
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Get the Monday of the week offset from the current week.
 * @param {number} weekOffset
 * @returns {Date}
 */
function getWeekMonday(weekOffset) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Get ISO date string for a day within a week.
 * @param {number} weekOffset
 * @param {number} dayIndex - 0=Mon ... 6=Sun
 * @returns {string}
 */
export function getDateForDay(weekOffset, dayIndex) {
  const monday = getWeekMonday(weekOffset);
  const d = new Date(monday);
  d.setDate(monday.getDate() + dayIndex);
  return d.toISOString().split('T')[0];
}

/**
 * Get today's day index (Mon=0 ... Sun=6).
 * @returns {number}
 */
export function getTodayIndex() {
  const day = new Date().getDay(); // 0=Sun, 1=Mon, ...
  return day === 0 ? 6 : day - 1;
}

/**
 * Format a week range label (e.g. "Jun 23 - Jun 29").
 * @param {number} weekOffset
 * @returns {string}
 */
function getWeekLabel(weekOffset) {
  const monday = getWeekMonday(weekOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(monday)} - ${fmt(sunday)}`;
}

export default function WeekStrip({
  weekOffset,
  selectedDay,
  onSelectDay,
  onPrevWeek,
  onNextWeek,
}) {
  const todayIndex = getTodayIndex();
  const isCurrentWeek = weekOffset === 0;

  return (
    <div className="flex flex-col gap-2">
      {/* Week navigation header */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={onPrevWeek}
          className="p-1.5 rounded-lg hover:bg-sand-100 transition-colors duration-fast active:scale-95"
          aria-label="Previous week"
        >
          <ChevronLeft size={18} className="text-char-600" />
        </button>
        <span className="text-xs font-semibold text-char-700 font-sans">
          {isCurrentWeek ? 'This week' : getWeekLabel(weekOffset)}
        </span>
        <button
          onClick={onNextWeek}
          className="p-1.5 rounded-lg hover:bg-sand-100 transition-colors duration-fast active:scale-95"
          aria-label="Next week"
        >
          <ChevronRight size={18} className="text-char-600" />
        </button>
      </div>

      {/* Day pills */}
      <div className="flex items-center justify-between gap-1 px-1">
        {DAY_LABELS.map((label, idx) => {
          const isSelected = idx === selectedDay;
          const isToday = isCurrentWeek && idx === todayIndex;
          const monday = getWeekMonday(weekOffset);
          const date = new Date(monday);
          date.setDate(monday.getDate() + idx);
          const dayNum = date.getDate();

          return (
            <button
              key={idx}
              onClick={() => onSelectDay(idx)}
              className={`relative flex flex-col items-center gap-0.5 py-2 px-2 rounded-xl min-w-[40px]
                transition-all duration-fast ease-ds-out
                ${isSelected
                  ? 'bg-forest-700 shadow-sm'
                  : isToday
                    ? 'bg-forest-50 hover:bg-forest-100'
                    : 'hover:bg-sand-100'
                }`}
            >
              <span
                className={`text-[10px] font-medium uppercase tracking-wider
                  ${isSelected ? 'text-white/70' : 'text-char-400'}`}
              >
                {label}
              </span>
              <span
                className={`text-sm font-bold font-mono tabular-nums
                  ${isSelected
                    ? 'text-white'
                    : isToday
                      ? 'text-forest-700'
                      : 'text-char-900'
                  }`}
              >
                {dayNum}
              </span>
              {isToday && !isSelected && (
                <motion.div
                  layoutId="today-dot"
                  className="absolute bottom-1 w-1 h-1 rounded-full bg-forest-600"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
