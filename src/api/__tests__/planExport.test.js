/**
 * planExport.test.js — Guard tests for T4C ("Print & share the meal plan",
 * REMEDI_MASTER_PLAN.md §1.9).
 *
 * Pure module (no DOM, no localStorage) — plain `node` environment is fine,
 * unlike the sibling planBuilder.*.test.js files which need jsdom for
 * src/state/dailyPlan.js's storage.js dependency.
 *
 * Date-key strategy: the "full week" fixture below deliberately uses FIXED
 * ISO date keys from a past, arbitrary week (2025-03-10 etc.) rather than
 * `todayKey()`/`nextSevenDays()` — this keeps the suite deterministic
 * regardless of the real clock AND exercises `dayMeta`'s "date key outside
 * the current rolling window" fallback branch (see planExport.js), which a
 * `todayKey()`-anchored fixture would never reach. A separate small test
 * below covers the "inside the rolling window" (Today-labeled) branch using
 * `todayKey()`, matching the pattern used by planBuilder.*.test.js.
 */
import { describe, expect, it } from 'vitest';
import { formatWeekPlanText, buildPrintModel, PRINT_FOOTER_LINE } from '../planExport.js';
import { todayKey } from '../../screens/plan/planDates.js';

const D0 = '2025-03-10'; // Monday — fully populated, all 5 slots incl. beverages
const D1 = '2025-03-11'; // Tuesday — legacy day: NO `beverages` key at all, every other slot empty
const D2 = '2025-03-12'; // Wednesday — partially populated (lunch + dinner only)

function expectedDayMeta(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return {
    label: date.toLocaleDateString('en-US', { weekday: 'long' }),
    dateLabel: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  };
}

function fullWeekPlan() {
  return {
    version: 2,
    conditionsKey: '203,244',
    conditionNames: ['Diabetes', 'High Blood Pressure'],
    usedFallback: false,
    generation: 0,
    days: {
      [D0]: {
        generation: 0,
        offsets: {},
        eaten: [],
        pinned: [],
        slots: {
          breakfast: [{ id: 1, name: 'Oatmeal' }, { id: 2, name: 'Greek Yogurt' }],
          lunch: [{ id: 3, name: 'Turkey Sandwich' }],
          dinner: [],
          snacks: [{ id: 4, name: 'Apple Slices' }],
          beverages: [{ id: 5, name: 'Green Tea' }],
        },
      },
      [D1]: {
        generation: 0,
        offsets: {},
        eaten: [],
        pinned: [],
        slots: {
          // No `beverages` key at all — pre-Beverages-restore ("4-slot era")
          // legacy day shape (see config.js PLAN_SLOTS doc).
          breakfast: [],
          lunch: [],
          dinner: [],
          snacks: [],
        },
      },
      [D2]: {
        generation: 0,
        offsets: {},
        eaten: [],
        pinned: [],
        slots: {
          breakfast: [],
          lunch: [{ id: 6, name: 'Caesar Salad' }],
          dinner: [{ id: 7, name: 'Grilled Salmon' }],
          snacks: [],
          beverages: [],
        },
      },
    },
  };
}

describe('formatWeekPlanText', () => {
  it('null/empty plan yields an empty string', () => {
    expect(formatWeekPlanText(null)).toBe('');
    expect(formatWeekPlanText(undefined)).toBe('');
    expect(formatWeekPlanText({ version: 2, days: {} })).toBe('');
  });

  it('builds the header line with a date range and condition names', () => {
    const plan = fullWeekPlan();
    const text = formatWeekPlanText(plan, { conditionNames: plan.conditionNames });
    const d0 = expectedDayMeta(D0);
    const d2 = expectedDayMeta(D2);
    expect(text.split('\n')[0]).toBe(
      `My Personal Remedies meal plan · ${d0.dateLabel} – ${d2.dateLabel} · for: Diabetes, High Blood Pressure`
    );
  });

  it('omits the "for:" clause entirely when there are no condition names', () => {
    const plan = fullWeekPlan();
    const text = formatWeekPlanText(plan, { conditionNames: [] });
    expect(text.split('\n')[0]).not.toContain('for:');
  });

  it('filters falsy/non-string entries out of conditionNames before joining', () => {
    const plan = fullWeekPlan();
    const text = formatWeekPlanText(plan, { conditionNames: ['Diabetes', null, undefined, '', 'High Blood Pressure'] });
    expect(text.split('\n')[0]).toContain('for: Diabetes, High Blood Pressure');
  });

  it('lists every non-empty slot as "Label: item, item" in PLAN_SLOTS order', () => {
    const plan = fullWeekPlan();
    const text = formatWeekPlanText(plan, { conditionNames: plan.conditionNames });
    const d0 = expectedDayMeta(D0);
    const d0HeaderIdx = text.indexOf(`${d0.label} · ${d0.dateLabel}`);
    const d1 = expectedDayMeta(D1);
    const d1HeaderIdx = text.indexOf(`${d1.label} · ${d1.dateLabel}`);
    const day0Block = text.slice(d0HeaderIdx, d1HeaderIdx);

    expect(day0Block).toContain('Breakfast: Oatmeal, Greek Yogurt');
    expect(day0Block).toContain('Lunch: Turkey Sandwich');
    expect(day0Block).toContain('Snacks & Desserts: Apple Slices');
    expect(day0Block).toContain('Beverages: Green Tea');
    // Dinner was empty for this day — never rendered, not even as "Dinner: —".
    expect(day0Block).not.toContain('Dinner:');
  });

  it('shows an honest "Nothing planned" line for a day with every slot empty (incl. a missing beverages key)', () => {
    const plan = fullWeekPlan();
    const text = formatWeekPlanText(plan, { conditionNames: plan.conditionNames });
    const d1 = expectedDayMeta(D1);
    const d2 = expectedDayMeta(D2);
    const d1HeaderIdx = text.indexOf(`${d1.label} · ${d1.dateLabel}`);
    const d2HeaderIdx = text.indexOf(`${d2.label} · ${d2.dateLabel}`);
    const day1Block = text.slice(d1HeaderIdx, d2HeaderIdx);

    expect(day1Block).toContain('Nothing planned');
    expect(day1Block).not.toContain(':');
  });

  it('never emits the literal strings "undefined" or "null" anywhere in the output', () => {
    const plan = fullWeekPlan();
    const text = formatWeekPlanText(plan, { conditionNames: [null, 'Diabetes', undefined] });
    expect(text).not.toMatch(/undefined/i);
    expect(text).not.toMatch(/\bnull\b/i);
  });

  it('ends with the exact, unexpanded footer disclaimer line', () => {
    const plan = fullWeekPlan();
    const text = formatWeekPlanText(plan, { conditionNames: plan.conditionNames });
    expect(text.trimEnd().endsWith(PRINT_FOOTER_LINE)).toBe(true);
    expect(PRINT_FOOTER_LINE).toBe('Generated by Personal Remedies — not medical advice');
  });

  it('never prints a calorie number anywhere', () => {
    const plan = fullWeekPlan();
    const text = formatWeekPlanText(plan, { conditionNames: plan.conditionNames });
    expect(text).not.toMatch(/\bcal(orie)?s?\b/i);
  });

  it('labels a day inside the current rolling window as "Today"', () => {
    const key = todayKey();
    const plan = {
      version: 2,
      days: {
        [key]: {
          generation: 0, offsets: {}, eaten: [], pinned: [],
          slots: { breakfast: [{ id: 1, name: 'Oatmeal' }], lunch: [], dinner: [], snacks: [], beverages: [] },
        },
      },
    };
    const text = formatWeekPlanText(plan, { conditionNames: [] });
    expect(text).toContain('Today ·');
  });
});

describe('buildPrintModel', () => {
  it('returns null for a null/undefined plan', () => {
    expect(buildPrintModel(null)).toBeNull();
    expect(buildPrintModel(undefined)).toBeNull();
  });

  it('returns an honest empty shape for a plan with no days', () => {
    expect(buildPrintModel({ version: 2, days: {} }, { conditionNames: [] })).toEqual({
      rangeLabel: '',
      conditionLine: '',
      days: [],
    });
  });

  it('omits empty slots, keeps non-empty ones in PLAN_SLOTS order', () => {
    const model = buildPrintModel(fullWeekPlan(), { conditionNames: [] });
    const day0 = model.days.find((d) => d.dateLabel === expectedDayMeta(D0).dateLabel);
    expect(day0.slots.map((s) => s.label)).toEqual(['Breakfast', 'Lunch', 'Snacks & Desserts', 'Beverages']);
    expect(day0.slots.find((s) => s.label === 'Breakfast').items).toEqual(['Oatmeal', 'Greek Yogurt']);
  });

  it('gives a day with nothing planned an empty (not fabricated) slots array', () => {
    const model = buildPrintModel(fullWeekPlan(), { conditionNames: [] });
    const day1 = model.days.find((d) => d.dateLabel === expectedDayMeta(D1).dateLabel);
    expect(day1.slots).toEqual([]);
  });

  it('tolerates a day missing the beverages key entirely without crashing', () => {
    expect(() => buildPrintModel(fullWeekPlan(), { conditionNames: [] })).not.toThrow();
  });

  it('computes correct label/dateLabel for a date key outside the rolling window', () => {
    const model = buildPrintModel(fullWeekPlan(), { conditionNames: [] });
    const expected = expectedDayMeta(D2);
    const day2 = model.days.find((d) => d.dateLabel === expected.dateLabel);
    expect(day2.label).toBe(expected.label);
  });

  it('builds a "For: …" condition line only when names are present, never fabricating one', () => {
    const withNames = buildPrintModel(fullWeekPlan(), { conditionNames: ['Diabetes', 'High Blood Pressure'] });
    expect(withNames.conditionLine).toBe('For: Diabetes, High Blood Pressure');

    const withoutNames = buildPrintModel(fullWeekPlan(), { conditionNames: [] });
    expect(withoutNames.conditionLine).toBe('');

    const allFalsy = buildPrintModel(fullWeekPlan(), { conditionNames: [null, undefined, ''] });
    expect(allFalsy.conditionLine).toBe('');
  });

  it('single-day plans collapse the range label to one date (no dangling dash)', () => {
    const plan = fullWeekPlan();
    delete plan.days[D1];
    delete plan.days[D2];
    const model = buildPrintModel(plan, { conditionNames: [] });
    expect(model.rangeLabel).toBe(expectedDayMeta(D0).dateLabel);
    expect(model.rangeLabel).not.toContain('–');
  });

  it('drops items with a missing/non-string name rather than rendering "undefined"', () => {
    const plan = fullWeekPlan();
    plan.days[D0].slots.breakfast.push({ id: 99, name: undefined });
    const model = buildPrintModel(plan, { conditionNames: [] });
    const day0 = model.days.find((d) => d.dateLabel === expectedDayMeta(D0).dateLabel);
    expect(day0.slots.find((s) => s.label === 'Breakfast').items).toEqual(['Oatmeal', 'Greek Yogurt']);
  });
});
