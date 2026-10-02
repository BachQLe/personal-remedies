/**
 * scripts/validate-recipe-csv.test.js — coverage for
 * scripts/validate-recipe-csv.mjs's pure functions (Track 1C). Small
 * synthetic item fixtures, no file I/O, no real network calls (`checkUrl`
 * is exercised with an injected fake `fetchImpl`) — same house pattern as
 * scripts/audit-overlay.test.js.
 */
import { describe, expect, it } from 'vitest';
import { checkUrl, summarizeResults, validateCsvRows } from './validate-recipe-csv.mjs';

const ITEMS = [
  { foodItemID: 5000, description: 'Lemon-Garlic Shrimp and Grits', fineFoodGroup: 'l' },
  { foodItemID: 5002, description: 'Cinn Spiced Swt Potato..', fineFoodGroup: 'l' },
  { foodItemID: 1000, description: 'Unpasteurized products', fineFoodGroup: 'x' },
];

function row(overrides = {}) {
  return {
    FI: '5000',
    FI_TEXT: 'Lemon-Garlic Shrimp and Grits',
    Meal: 'D',
    URL: 'https://medlineplus.gov/x',
    ...overrides,
  };
}

describe('validateCsvRows', () => {
  it('produces no errors or warnings for a fully valid row with no Calorie Count (the real source has none)', () => {
    const [result] = validateCsvRows([row()], ITEMS);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.rowNumber).toBe(2); // header is row 1
    expect(result.mealType).toBe('dinner');
    expect(result.alsoFits).toEqual([]);
  });

  it('parses a multi-token Meal code into mealType + alsoFits', () => {
    const [result] = validateCsvRows([row({ Meal: 'L/D' })], ITEMS);
    expect(result.errors).toEqual([]);
    expect(result.mealType).toBe('lunch');
    expect(result.alsoFits).toEqual(['dinner']);
  });

  it('distinguishes D (dinner) from Ds (dessert)', () => {
    const [dinner] = validateCsvRows([row({ Meal: 'D' })], ITEMS);
    const [dessert] = validateCsvRows([row({ Meal: 'Ds' })], ITEMS);
    expect(dinner.mealType).toBe('dinner');
    expect(dessert.mealType).toBe('dessert');
  });

  it('errors when FI is not a 4-digit id', () => {
    const [result] = validateCsvRows([row({ FI: '500' })], ITEMS);
    expect(result.errors.some((e) => /4-digit/.test(e))).toBe(true);
  });

  it('WARNS (not errors) when FI is not found in items.json', () => {
    const [result] = validateCsvRows([row({ FI: '9999' })], ITEMS);
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => /FI 9999 not found in items\.json/.test(w))).toBe(true);
  });

  it('errors when the item is not fineFoodGroup l, and includes the item description', () => {
    const [result] = validateCsvRows([row({ FI: '1000', FI_TEXT: 'Whatever' })], ITEMS);
    expect(result.errors.some((e) => /fineFoodGroup 'x'/.test(e) && /Unpasteurized products/.test(e))).toBe(true);
  });

  it('errors on a duplicate FI and cites the first row number', () => {
    const results = validateCsvRows([row(), row({ FI_TEXT: 'Second' })], ITEMS);
    expect(results[0].errors).toEqual([]);
    expect(results[1].errors.some((e) => /duplicate FI 5000 \(first seen at row 2\)/.test(e))).toBe(true);
  });

  it('errors when FI_TEXT is empty', () => {
    const [result] = validateCsvRows([row({ FI_TEXT: '   ' })], ITEMS);
    expect(result.errors.some((e) => /FI_TEXT \(name\) is empty/.test(e))).toBe(true);
  });

  it('errors when Meal is not a recognized code', () => {
    const [result] = validateCsvRows([row({ Meal: 'Brunch' })], ITEMS);
    expect(result.errors.some((e) => /Meal "Brunch"/.test(e))).toBe(true);
    expect(result.mealType).toBeNull();
  });

  it('errors when one token of a multi-token Meal code is unrecognized', () => {
    const [result] = validateCsvRows([row({ Meal: 'L/Brunch' })], ITEMS);
    expect(result.errors.some((e) => /Meal "L\/Brunch"/.test(e))).toBe(true);
  });

  it('does not error when Calorie Count is absent (optional column — the real source has none)', () => {
    const [result] = validateCsvRows([row()], ITEMS);
    expect(result.errors).toEqual([]);
  });

  it('errors when Calorie Count is present but not numeric', () => {
    const [result] = validateCsvRows([row({ 'Calorie Count': 'lots' })], ITEMS);
    expect(result.errors.some((e) => /is not numeric/.test(e))).toBe(true);
  });

  it('errors when Calorie Count is present but below the sane range', () => {
    const [result] = validateCsvRows([row({ 'Calorie Count': '5' })], ITEMS);
    expect(result.errors.some((e) => /outside the 10-2500 kcal/.test(e))).toBe(true);
  });

  it('errors when Calorie Count is present but above the sane range', () => {
    const [result] = validateCsvRows([row({ 'Calorie Count': '3000' })], ITEMS);
    expect(result.errors.some((e) => /outside the 10-2500 kcal/.test(e))).toBe(true);
  });

  it('accepts a present, in-range, numeric Calorie Count with no error', () => {
    const [result] = validateCsvRows([row({ 'Calorie Count': '420' })], ITEMS);
    expect(result.errors).toEqual([]);
  });

  it('errors when URL is not https', () => {
    const [result] = validateCsvRows([row({ URL: 'http://medlineplus.gov/x' })], ITEMS);
    expect(result.errors.some((e) => /must be https/.test(e))).toBe(true);
  });

  it('warns (does not error) when FI_TEXT shares no token with the item description', () => {
    const [result] = validateCsvRows([row({ FI: '5002', FI_TEXT: 'Blueberry Pancakes' })], ITEMS);
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => /possible wrong FI/.test(w))).toBe(true);
  });
});

describe('summarizeResults', () => {
  it('totals rows/errors/warnings and buckets Meal counts, including an (invalid) bucket', () => {
    const records = [
      row(),
      row({ FI: '5002', FI_TEXT: 'Cinnamon Spiced Sweet Potatoes', Meal: 'S' }),
      row({ FI: '1000', Meal: 'Brunch' }), // errors: bad group + bad meal
    ];
    const results = validateCsvRows(records, ITEMS);
    const summary = summarizeResults(results);
    expect(summary.totals.rows).toBe(3);
    expect(summary.totals.rowsWithErrors).toBe(1);
    expect(summary.byMeal.dinner).toBe(1);
    expect(summary.byMeal.snack).toBe(1);
    expect(summary.byMeal['(invalid)']).toBe(1);
  });
});

describe('checkUrl', () => {
  it('reports ok:true for a 2xx HEAD response', async () => {
    const fetchImpl = async () => ({ status: 200 });
    const result = await checkUrl('https://x', { fetchImpl });
    expect(result).toEqual({ ok: true, status: 200 });
  });

  it('falls back to GET when HEAD returns 405', async () => {
    const calls = [];
    const fetchImpl = async (url, { method }) => {
      calls.push(method);
      return method === 'HEAD' ? { status: 405 } : { status: 200 };
    };
    const result = await checkUrl('https://x', { fetchImpl });
    expect(calls).toEqual(['HEAD', 'GET']);
    expect(result.ok).toBe(true);
  });

  it('reports ok:false for a non-2xx status', async () => {
    const fetchImpl = async () => ({ status: 404 });
    const result = await checkUrl('https://x', { fetchImpl });
    expect(result).toEqual({ ok: false, status: 404 });
  });

  it('reports ok:false with an error message when the fetch throws', async () => {
    const fetchImpl = async () => {
      throw new Error('network down');
    };
    const result = await checkUrl('https://x', { fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.status).toBeNull();
    expect(result.error).toBe('network down');
  });
});
