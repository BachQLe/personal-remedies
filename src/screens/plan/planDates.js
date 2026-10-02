/**
 * planDates.js — date helpers for the Plan screen's 7-day strip.
 *
 * All date keys are LOCAL 'YYYY-MM-DD', produced via
 * `toLocaleDateString('en-CA')` — NEVER `toISOString`, which rolls over at
 * UTC midnight and would put late-evening entries on the wrong day.
 *
 * NOTE (Task 10, 2026-09 — "Day 1–7 mode"): `getDayLabelMode`/
 * `setDayLabelMode` below toggle which of {weekday name, relative "Day N"}
 * is promoted to each day's PRIMARY `label` vs. its secondary `sublabel` —
 * the two are always computed side-by-side (`sublabel` is always the OTHER
 * one), so this is a small, additive swap. Purely display: it never changes
 * which real calendar date backs any `key`.
 *
 * NOTE (Task 11, 2026-09 — "start-day picker"): `getWeekStartDay`/
 * `setWeekStartDay` below let the user pin the 7-day window to a specific
 * weekday (0=Sunday..6=Saturday) instead of always starting today.
 * `nextSevenDays()` resolves the window's start date as the most recent
 * occurrence of that weekday ON OR BEFORE today — so today always falls
 * somewhere inside the window (never past it) — and "Day 1" (dayNumber
 * mode) is that window start, not necessarily today. With no stored value
 * (the default), the window behaves EXACTLY as before this task: it starts
 * today, every time it's computed (so it keeps rolling forward with today
 * rather than pinning to a fixed weekday). Either way `key` stays the real
 * LOCAL 'YYYY-MM-DD' calendar date, so `plan.days[key]` indexing
 * (planBuilder.js, dailyPlan.js) and every other date-keyed read/write in
 * the app needs zero changes — callers that need "the day list" (rather
 * than just today) import `nextSevenDays()` from here rather than
 * re-deriving their own day-0-is-today assumption.
 */

import { storage } from '../../api/storage.js';

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** storage.js key for the display-only day-label mode toggle — see NOTE above. */
const DAY_LABEL_MODE_KEY = 'planDayLabelMode';

/** storage.js key for the user-chosen week-start weekday — see Task 11 NOTE above. */
const WEEK_START_DAY_KEY = 'planWeekStartDay';

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
 * The user's chosen week-start weekday (see Task 11 NOTE above), or `null`
 * when unset — the default, which makes `nextSevenDays()` behave exactly as
 * it did before this setting existed (window always starts today).
 * @returns {number|null} 0 (Sunday) .. 6 (Saturday), or null
 */
export function getWeekStartDay() {
  const stored = storage.get(WEEK_START_DAY_KEY, null);
  return Number.isInteger(stored) && stored >= 0 && stored <= 6 ? stored : null;
}

/**
 * Set the user's chosen week-start weekday (see `getWeekStartDay`). Passing
 * `null` clears it, restoring the "always starts today" default.
 * @param {number|null} day - 0 (Sunday) .. 6 (Saturday), or null to clear
 */
export function setWeekStartDay(day) {
  if (day === null) {
    storage.set(WEEK_START_DAY_KEY, null);
    return;
  }
  if (Number.isInteger(day) && day >= 0 && day <= 6) {
    storage.set(WEEK_START_DAY_KEY, day);
  }
}

/**
 * The 7-day window for the Plan screen's day strip. With no stored
 * `getWeekStartDay()` value (the default), this starts TODAY, exactly as
 * before Task 11. With one set, the window instead starts on the most
 * recent occurrence of that weekday on or before today — so today always
 * falls somewhere inside the 7-day window, never past its end — and "Day 1"
 * (dayNumber mode) is that window start rather than always today.
 *
 * Which of {weekday name, relative "Day N"} is the PRIMARY `label` vs. the
 * secondary `sublabel` follows the current `getDayLabelMode()` — see that
 * NOTE above. The weekday-name label is always relative to the REAL today
 * (`'Today'`/`'Tomorrow'` for those two dates, the plain weekday name for
 * everything else, including days in the window that fall BEFORE today);
 * the `key` (real LOCAL 'YYYY-MM-DD' calendar date) is unaffected by either
 * setting.
 * @returns {PlanDay[]}
 */
export function nextSevenDays() {
  const dayNumberMode = getDayLabelMode() === 'dayNumber';
  const startDay = getWeekStartDay();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // How many days before today the window's Day 1 sits — 0 when no start
  // day is set (window starts today, same as before this task) or when
  // today itself is the chosen weekday.
  const daysBeforeToday = startDay === null ? 0 : (today.getDay() - startDay + 7) % 7;

  const windowStart = new Date(today);
  windowStart.setDate(today.getDate() - daysBeforeToday);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(windowStart);
    date.setDate(windowStart.getDate() + i);
    const key = date.toLocaleDateString('en-CA');

    // Integer day-offset from the REAL today — derived from the loop index
    // and `daysBeforeToday` rather than a ms-based `Date` subtraction, which
    // can be thrown off by a DST transition landing between the two dates.
    const diffFromToday = i - daysBeforeToday;
    const weekdayLabel =
      diffFromToday === 0 ? 'Today' : diffFromToday === 1 ? 'Tomorrow' : WEEKDAY_LABELS[date.getDay()];
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
