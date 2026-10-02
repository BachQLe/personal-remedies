/**
 * scripts/build-recipe-overlay.test.js — row-mapping coverage for
 * scripts/build-recipe-overlay.mjs (Track 1C). Exercises the exported pure
 * functions (`buildOverlayRow`, `buildOverlay`) against small synthetic
 * item fixtures — NOT the real src/data/cache/items.json — same house
 * pattern as scripts/audit-overlay.test.js. Never touches
 * src/data/recipeOverlay.json.
 */
import { describe, expect, it } from 'vitest';
import { buildOverlay, buildOverlayRow } from './build-recipe-overlay.mjs';

/**
 * 4 synthetic recipe items (fineFoodGroup 'l') plus one non-recipe item
 * (fineFoodGroup 'b1') to exercise the group-mismatch drop reason. FI 9999
 * is deliberately NOT in this list — it exercises the "not found in
 * items.json" WARNING path (Sept 2026 change: no longer a drop).
 */
const ITEMS = [
  { foodItemID: 5000, description: 'Lemon-Garlic Shrimp and Grits', fineFoodGroup: 'l' },
  { foodItemID: 5001, description: 'Low-Cal Fettuccine Alfredo', fineFoodGroup: 'l' },
  { foodItemID: 5002, description: 'Cinn Spiced Swt Potato..', fineFoodGroup: 'l' },
  { foodItemID: 5003, description: 'American Macaroni Salald', fineFoodGroup: 'l' },
  { foodItemID: 1, description: 'Abalone', fineFoodGroup: 'b1' },
];

function ctx(seenIds = []) {
  return { itemsById: new Map(ITEMS.map((it) => [it.foodItemID, it])), seenFoodItemIds: new Set(seenIds) };
}

describe('buildOverlayRow', () => {
  it('maps a valid row with a single-token Meal code, omitting nutritionPerServing entirely', () => {
    const record = { FI: '5000', FI_TEXT: 'Lemon-Garlic Shrimp and Grits', Meal: 'D', URL: 'https://medlineplus.gov/x' };
    const result = buildOverlayRow(record, ctx());
    expect(result.ok).toBe(true);
    expect(result.warning).toBeNull();
    expect(result.row).toEqual({
      foodItemID: 5000,
      name: 'Lemon-Garlic Shrimp and Grits',
      mealType: 'dinner',
      fineFoodGroup: 'l',
      sourceUrl: 'https://medlineplus.gov/x',
    });
    expect('nutritionPerServing' in result.row).toBe(false);
    expect('alsoFits' in result.row).toBe(false);
  });

  it('maps a multi-token Meal code to mealType + alsoFits', () => {
    const record = { FI: '5000', FI_TEXT: 'X', Meal: 'L/D', URL: 'https://x' };
    const result = buildOverlayRow(record, ctx());
    expect(result.ok).toBe(true);
    expect(result.row.mealType).toBe('lunch');
    expect(result.row.alsoFits).toEqual(['dinner']);
  });

  it('distinguishes D (dinner) from Ds (dessert)', () => {
    const dinner = buildOverlayRow({ FI: '5000', FI_TEXT: 'X', Meal: 'D', URL: 'https://x' }, ctx());
    const dessert = buildOverlayRow({ FI: '5001', FI_TEXT: 'X', Meal: 'Ds', URL: 'https://x' }, ctx());
    expect(dinner.row.mealType).toBe('dinner');
    expect(dessert.row.mealType).toBe('dessert');
  });

  it('includes nutritionPerServing.calories when Calorie Count is present and numeric', () => {
    const record = { FI: '5000', FI_TEXT: 'X', Meal: 'D', 'Calorie Count': '420', URL: 'https://x' };
    const result = buildOverlayRow(record, ctx());
    expect(result.ok).toBe(true);
    expect(result.row.nutritionPerServing).toEqual({ calories: 420 });
  });

  it('drops a row whose FI is not a 4-digit id', () => {
    const record = { FI: '500', FI_TEXT: 'X', Meal: 'S', URL: 'https://x' };
    const result = buildOverlayRow(record, ctx());
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/4-digit/);
  });

  it('WARNS (does not drop) a row whose FI is not in items.json, still building the row', () => {
    const record = { FI: '9999', FI_TEXT: 'Ghost', Meal: 'D', URL: 'https://x' };
    const result = buildOverlayRow(record, ctx());
    expect(result.ok).toBe(true);
    expect(result.warning).toMatch(/not found in items\.json/);
    expect(result.row.foodItemID).toBe(9999);
  });

  it('drops a row whose FI is not fineFoodGroup l', () => {
    // "0001" passes the 4-digit FI check (\d{4}); Number("0001") === 1, which
    // is the synthetic b1 (non-recipe) item in ITEMS — exercises the group check.
    const record = { FI: '0001', FI_TEXT: 'Abalone Thing', Meal: 'D', URL: 'https://x' };
    const result = buildOverlayRow(record, ctx());
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/fineFoodGroup is 'b1'/);
  });

  it('drops a duplicate FI (second occurrence, first already accepted)', () => {
    const record = { FI: '5000', FI_TEXT: 'Dup', Meal: 'D', URL: 'https://x' };
    const result = buildOverlayRow(record, ctx([5000]));
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/duplicate/);
  });

  it('drops a row with an empty FI_TEXT', () => {
    const record = { FI: '5000', FI_TEXT: '   ', Meal: 'D', URL: 'https://x' };
    const result = buildOverlayRow(record, ctx());
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/FI_TEXT is empty/);
  });

  it('drops a row with an unrecognized Meal code', () => {
    const record = { FI: '5003', FI_TEXT: 'American Macaroni Salad', Meal: 'Brunch', URL: 'https://x' };
    const result = buildOverlayRow(record, ctx());
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/unrecognized Meal code "Brunch"/);
  });

  it('drops a row with a present-but-non-numeric Calorie Count', () => {
    const record = { FI: '5000', FI_TEXT: 'X', Meal: 'D', 'Calorie Count': 'lots', URL: 'https://x' };
    const result = buildOverlayRow(record, ctx());
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/is not numeric/);
  });

  it('does not drop a row with a blank/absent Calorie Count (optional column)', () => {
    const record = { FI: '5000', FI_TEXT: 'X', Meal: 'D', 'Calorie Count': '', URL: 'https://x' };
    const result = buildOverlayRow(record, ctx());
    expect(result.ok).toBe(true);
    expect('nutritionPerServing' in result.row).toBe(false);
  });

  it('drops a row with a non-https URL', () => {
    const record = { FI: '5001', FI_TEXT: 'X', Meal: 'L', URL: 'http://x' };
    const result = buildOverlayRow(record, ctx());
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/is not https/);
  });
});

describe('buildOverlay', () => {
  it('builds only the valid rows, sorted ascending by foodItemID', () => {
    const records = [
      { FI: '5003', FI_TEXT: 'American Macaroni Salad', Meal: 'L', URL: 'https://x' },
      { FI: '5000', FI_TEXT: 'Lemon-Garlic Shrimp and Grits', Meal: 'D', URL: 'https://x' },
      { FI: '500', FI_TEXT: 'Bad FI', Meal: 'D', URL: 'https://x' }, // dropped: not 4-digit
      { FI: '5001', FI_TEXT: 'Low-Cal Fettuccine Alfredo', Meal: 'L', URL: 'https://x' },
    ];
    const { rows, dropped } = buildOverlay(records, ITEMS);
    expect(rows.map((r) => r.foodItemID)).toEqual([5000, 5001, 5003]);
    expect(dropped).toHaveLength(1);
    expect(dropped[0]).toMatch(/4-digit/);
  });

  it('includes a row whose FI is missing from items.json, reporting a warning instead of dropping it', () => {
    const records = [
      { FI: '5000', FI_TEXT: 'Real Recipe', Meal: 'D', URL: 'https://x' },
      { FI: '9999', FI_TEXT: 'Pending Nutridigm Load', Meal: 'D', URL: 'https://x' },
    ];
    const { rows, dropped, warnings } = buildOverlay(records, ITEMS);
    expect(rows.map((r) => r.foodItemID)).toEqual([5000, 9999]);
    expect(dropped).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/9999.*not found in items\.json/);
  });

  it('still hard-drops an FI that exists in items.json but is the wrong fineFoodGroup', () => {
    const records = [{ FI: '0001', FI_TEXT: 'Abalone Thing', Meal: 'D', URL: 'https://x' }];
    const { rows, dropped, warnings } = buildOverlay(records, ITEMS);
    expect(rows).toHaveLength(0);
    expect(warnings).toHaveLength(0);
    expect(dropped[0]).toMatch(/fineFoodGroup is 'b1'/);
  });

  it('keeps the first occurrence of a duplicate FI and reports the rest', () => {
    const records = [
      { FI: '5000', FI_TEXT: 'First', Meal: 'D', URL: 'https://x' },
      { FI: '5000', FI_TEXT: 'Second', Meal: 'D', URL: 'https://x' },
    ];
    const { rows, dropped } = buildOverlay(records, ITEMS);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('First');
    expect(dropped).toHaveLength(1);
    expect(dropped[0]).toMatch(/duplicate/);
  });

  it('produces no rows for an all-bad input, with every row reported as dropped', () => {
    const records = [
      { FI: '500', FI_TEXT: 'X', Meal: 'D', URL: 'https://x' },
      { FI: '0001', FI_TEXT: 'X', Meal: 'D', URL: 'https://x' }, // wrong fineFoodGroup
    ];
    const { rows, dropped } = buildOverlay(records, ITEMS);
    expect(rows).toEqual([]);
    expect(dropped).toHaveLength(2);
  });
});
