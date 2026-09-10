/**
 * planDates.js — date helpers for the Plan screen's 7-day strip.
 *
 * All date keys are LOCAL 'YYYY-MM-DD', produced via
 * `toLocaleDateString('en-CA')` — NEVER `toISOString`, which rolls over at
 * UTC midnight and would put late-evening entries on the wrong day.
 *
 * NOTE (Task 10, 2026-09): "Day 1–7 mode" — of the two candidate approaches
 * weighed (display-only relative labels vs. a user-chosen "Day 1" start
 * date), this implements the DISPLAY-ONLY one: `getDayLabelMode`/
 * `setDayLabelMode` below toggle which of {weekday name, relative "Day N"}
 * is promoted to each day's PRIMARY `label` vs. its secondary `sublabel` —
 * the two were already computed side-by-side before this change (`sublabel`
 * has always been `Day N`), so this is a small, additive swap. The
 * underlying data model is completely untouched: `key` is still the real
 * LOCAL 'YYYY-MM-DD' calendar date (the `en-CA` trick, above) computed the
 * exact same way regardless of mode, so `plan.days[key]` indexing
 * (planBuilder.js, dailyPlan.js) and every other date-keyed read/write in
 * the app needs zero changes. This was chosen over letting the user pick an
 * arbitrary "Day 1" start date because that alternative would require
 * threading a start-date param through `nextSevenDays()` and updating every
 * caller that assumes "day 0 is today" (planBuilder.js's rolling-window
 * maintenance in particular) — a materially bigger change for the same
 * product ask. This is EXPECTED TO EVOLVE: if the product decision solidifies
 * into "let the user pick which real date is Day 1", replace this toggle
 * with an optional `startDate` param on `nextSevenDays()` instead (keeping
 * the 'YYYY-MM-DD' key convention exactly as-is either way).
 */

import { storage } from '../../api/storage.js';

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** storage.js key for the display-only day-label mode toggle — see NOTE above. */
const DAY_LABEL_MODE_KEY = 'planDayLabelMode';

/**
 * @typedef {Object} PlanDay
 * @property {string} key - LOCAL 'YYYY-MM-DD'
 * @property {string} label - PRIMARY label: 'Today'/'Tomorrow'/weekday name
 *   in 'calendar' mode (default), or 'Day N' in 'dayNumber' mode.
 * @property {string} sublabel - the OTHER one of the pair above — whichever
 *   `label` isn't showing this mode.
 */

/**
 * Current day-label display mode. 'calendar' (default) shows
 * Today/Tomorrow/weekday names as the primary label; 'dayNumber' shows
 * relative 'Day 1'..'Day 7' instead. Display-only — see NOTE above.
 * @returns {'calendar'|'dayNumber'}
 */
export function getDayLabelMode() {
  return storage.get(DAY_LABEL_MODE_KEY, 'calendar') === 'dayNumber' ? 'dayNumber' : 'calendar';
}

/**
 * Set the day-label display mode (see `getDayLabelMode`).
 * @param {'calendar'|'dayNumber'} mode
 */
export function setDayLabelMode(mode) {
  storage.set(DAY_LABEL_MODE_KEY, mode === 'dayNumber' ? 'dayNumber' : 'calendar');
}

/**
 * The next 7 days starting today, for the Plan screen's day strip. Which of
 * {weekday name, relative "Day N"} is the PRIMARY `label` vs. the secondary
 * `sublabel` follows the current `getDayLabelMode()` — see NOTE above; the
 * `key` (real LOCAL 'YYYY-MM-DD' calendar date) is unaffected by the mode.
 * @returns {PlanDay[]}
 */
export function nextSevenDays() {
  const dayNumberMode = getDayLabelMode() === 'dayNumber';
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const key = date.toLocaleDateString('en-CA');
    const weekdayLabel = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : WEEKDAY_LABELS[date.getDay()];
    const dayNumberLabel = `Day ${i + 1}`;
    const label = dayNumberMode ? dayNumberLabel : weekdayLabel;
    const sublabel = dayNumberMode ? weekdayLabel : dayNumberLabel;
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
