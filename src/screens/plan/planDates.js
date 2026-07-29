/**
 * planDates.js — date helpers for the Plan screen's 7-day strip.
 *
 * All date keys are LOCAL 'YYYY-MM-DD', produced via
 * `toLocaleDateString('en-CA')` — NEVER `toISOString`, which rolls over at
 * UTC midnight and would put late-evening entries on the wrong day.
 */

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * @typedef {Object} PlanDay
 * @property {string} key - LOCAL 'YYYY-MM-DD'
 * @property {string} label - 'Today' | 'Tomorrow' | weekday name
 * @property {string} sublabel - e.g. 'Jul 16'
 */

/**
 * The next 7 days starting today, for the Plan screen's day strip.
 * @returns {PlanDay[]}
 */
export function nextSevenDays() {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const key = date.toLocaleDateString('en-CA');
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : WEEKDAY_LABELS[date.getDay()];
    const sublabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    days.push({ key, label, sublabel });
  }
  return days;
}

/**
 * Today's LOCAL date key.
 * @returns {string} 'YYYY-MM-DD'
 */
export function todayKey() {
  return new Date().toLocaleDateString('en-CA');
}
