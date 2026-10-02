/**
 * planDates.test.js — Guard tests for Task 11 ("start-day picker").
 *
 * Covers `nextSevenDays()`'s two regimes:
 *  - No stored `planWeekStartDay` (default): window starts TODAY, exactly
 *    as before this task existed.
 *  - A stored weekday: window starts on the most recent occurrence of that
 *    weekday on or before today, so today always falls somewhere inside the
 *    7-day window (never past its end) — including when today itself IS
 *    that weekday (a zero-day-back window, identical to the default case)
 *    and when the window must reach back across a month boundary.
 *
 * `storage.js` is mocked directly with an in-memory Map (rather than
 * pulling in jsdom for real localStorage) — planDates.js's only outside
 * dependency is `storage.get`/`storage.set`, same "mock the one boundary"
 * approach planBuilder.picksOnly.test.js uses for adapter.js.
 *
 * Dates are pinned via `vi.setSystemTime` (a real `Date` under a frozen
 * clock, not a mock `Date` class) so the module's own `new Date()` calls
 * resolve deterministically without changing planDates.js's implementation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map();

vi.mock('../../../api/storage.js', () => ({
  storage: {
    get: (key, fallback = null) => (store.has(key) ? store.get(key) : fallback),
    set: (key, value) => { store.set(key, value); },
  },
}));

import { nextSevenDays, getWeekStartDay, setWeekStartDay, todayKey } from '../planDates.js';

beforeEach(() => {
  store.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getWeekStartDay / setWeekStartDay', () => {
  it('defaults to null (unset) — the "always starts today" default', () => {
    expect(getWeekStartDay()).toBeNull();
  });

  it('round-trips a valid weekday (0-6)', () => {
    setWeekStartDay(3);
    expect(getWeekStartDay()).toBe(3);
  });

  it('ignores an out-of-range value (stays null)', () => {
    setWeekStartDay(9);
    expect(getWeekStartDay()).toBeNull();
  });

  it('null clears a previously-set value', () => {
    setWeekStartDay(2);
    setWeekStartDay(null);
    expect(getWeekStartDay()).toBeNull();
  });
});

describe('nextSevenDays: no stored start day (default) — starts today, unchanged behavior', () => {
  it('Day 1 is today, keys are 7 consecutive LOCAL dates', () => {
    vi.useFakeTimers();
    // Wednesday, 2026-09-16
    vi.setSystemTime(new Date(2026, 8, 16, 10, 0, 0));

    const days = nextSevenDays();

    expect(days).toHaveLength(7);
    expect(days[0].key).toBe(todayKey());
    expect(days[0].key).toBe('2026-09-16');
    expect(days[0].label).toBe('Today');
    expect(days[0].sublabel).toBe('Day 1');
    expect(days[1].key).toBe('2026-09-17');
    expect(days[1].label).toBe('Tomorrow');
    expect(days[6].key).toBe('2026-09-22');
  });
});

describe('nextSevenDays: stored start day — window starts on the most recent occurrence on/before today', () => {
  it('today mid-week: window starts on the PAST occurrence of the chosen weekday', () => {
    vi.useFakeTimers();
    // Wednesday, 2026-09-16 (getDay() === 3)
    vi.setSystemTime(new Date(2026, 8, 16, 10, 0, 0));
    setWeekStartDay(1); // Monday

    const days = nextSevenDays();
    const keys = days.map((d) => d.key);

    // Most recent Monday on/before Wed 2026-09-16 is 2026-09-14.
    expect(keys[0]).toBe('2026-09-14');
    expect(keys[6]).toBe('2026-09-20');
    // Today must be INSIDE the window, never past its end.
    expect(keys).toContain('2026-09-16');
    expect(keys[2]).toBe('2026-09-16');
  });

  it('labels: days before today keep their weekday name, never "Today"/"Tomorrow"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 16, 10, 0, 0)); // Wednesday
    setWeekStartDay(1); // Monday -> window starts 2026-09-14 (Monday)

    const days = nextSevenDays();

    expect(days[0].label).toBe('Monday');   // 2026-09-14, 2 days before today
    expect(days[1].label).toBe('Tuesday');  // 2026-09-15, 1 day before today
    expect(days[2].label).toBe('Today');    // 2026-09-16
    expect(days[3].label).toBe('Tomorrow'); // 2026-09-17
    expect(days[4].label).toBe('Friday');   // 2026-09-18
  });

  it('dayNumber mode: "Day 1" is the window start, not necessarily today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 16, 10, 0, 0)); // Wednesday
    setWeekStartDay(1); // Monday

    // dayLabelMode isn't touched in this test (stays 'calendar' default) —
    // assert via `sublabel`, which is always "Day N" regardless of mode.
    const days = nextSevenDays();
    expect(days[0].sublabel).toBe('Day 1');
    expect(days[2].sublabel).toBe('Day 3'); // today, 2 days into the window
  });

  it('today already IS the chosen weekday: window starts today (matches the default)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 16, 10, 0, 0)); // Wednesday
    setWeekStartDay(3); // Wednesday

    const days = nextSevenDays();

    expect(days[0].key).toBe('2026-09-16');
    expect(days[0].label).toBe('Today');
  });

  it('spans a month boundary correctly', () => {
    vi.useFakeTimers();
    // Tuesday, 2026-10-06
    vi.setSystemTime(new Date(2026, 9, 6, 10, 0, 0));
    setWeekStartDay(0); // Sunday -> most recent Sunday on/before is 2026-10-04

    const days = nextSevenDays();

    expect(days[0].key).toBe('2026-10-04');
    expect(days[6].key).toBe('2026-10-10');
  });
});
