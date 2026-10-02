/**
 * scripts/lib/recipeRow.test.js — coverage for the shared row-level rules
 * (Track 1C content pipeline) used by both build-recipe-overlay.mjs and
 * validate-recipe-csv.mjs.
 */
import { describe, expect, it } from 'vitest';
import {
  CALORIE_RANGE,
  MEAL_TYPES,
  extractRow,
  isBlank,
  isFourDigitFI,
  isHttpsUrl,
  looksUnrelated,
  normalizeMealCode,
  normalizeMealType,
  parseCalories,
} from './recipeRow.mjs';

describe('MEAL_TYPES', () => {
  it('is the frozen six-value allowlist, including dessert', () => {
    expect(MEAL_TYPES).toEqual(['breakfast', 'lunch', 'dinner', 'snack', 'beverage', 'dessert']);
    expect(Object.isFrozen(MEAL_TYPES)).toBe(true);
  });
});

describe('normalizeMealType', () => {
  it('accepts the six canonical values case-insensitively', () => {
    expect(normalizeMealType('Breakfast')).toBe('breakfast');
    expect(normalizeMealType('LUNCH')).toBe('lunch');
    expect(normalizeMealType('dinner')).toBe('dinner');
    expect(normalizeMealType('Snack')).toBe('snack');
    expect(normalizeMealType('Beverage')).toBe('beverage');
    expect(normalizeMealType('Dessert')).toBe('dessert');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeMealType('  Dinner  ')).toBe('dinner');
  });

  it('accepts obvious plurals for snacks/beverages/desserts', () => {
    expect(normalizeMealType('Snacks')).toBe('snack');
    expect(normalizeMealType('Beverages')).toBe('beverage');
    expect(normalizeMealType('Breakfasts')).toBe('breakfast');
    expect(normalizeMealType('Lunches')).toBe('lunch');
    expect(normalizeMealType('Dinners')).toBe('dinner');
    expect(normalizeMealType('Desserts')).toBe('dessert');
  });

  it('accepts Drink/Drinks as beverage synonyms', () => {
    expect(normalizeMealType('Drink')).toBe('beverage');
    expect(normalizeMealType('Drinks')).toBe('beverage');
  });

  it('returns null for an unrecognized value rather than guessing', () => {
    expect(normalizeMealType('Brunch')).toBeNull();
    expect(normalizeMealType('Appetizer')).toBeNull();
    expect(normalizeMealType('')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(normalizeMealType(undefined)).toBeNull();
    expect(normalizeMealType(null)).toBeNull();
    expect(normalizeMealType(5)).toBeNull();
  });
});

describe('normalizeMealCode', () => {
  it('parses a single-token code', () => {
    expect(normalizeMealCode('B')).toEqual({ mealType: 'breakfast', alsoFits: [] });
    expect(normalizeMealCode('D')).toEqual({ mealType: 'dinner', alsoFits: [] });
    expect(normalizeMealCode('Ds')).toEqual({ mealType: 'dessert', alsoFits: [] });
  });

  it('is case-insensitive per token', () => {
    expect(normalizeMealCode('ds')).toEqual({ mealType: 'dessert', alsoFits: [] });
    expect(normalizeMealCode('DS')).toEqual({ mealType: 'dessert', alsoFits: [] });
    expect(normalizeMealCode('bV')).toEqual({ mealType: 'beverage', alsoFits: [] });
  });

  it('distinguishes D (dinner) from Ds (dessert) — never a prefix match', () => {
    expect(normalizeMealCode('D').mealType).toBe('dinner');
    expect(normalizeMealCode('Ds').mealType).toBe('dessert');
    // A slash-joined code exercising both in one cell, in each order.
    expect(normalizeMealCode('D/Ds')).toEqual({ mealType: 'dinner', alsoFits: ['dessert'] });
    expect(normalizeMealCode('Ds/D')).toEqual({ mealType: 'dessert', alsoFits: ['dinner'] });
  });

  it('parses the real vocabulary values observed in Mory\'s spreadsheet', () => {
    expect(normalizeMealCode('L/D')).toEqual({ mealType: 'lunch', alsoFits: ['dinner'] });
    expect(normalizeMealCode('B/Ds')).toEqual({ mealType: 'breakfast', alsoFits: ['dessert'] });
    expect(normalizeMealCode('B/Bv')).toEqual({ mealType: 'breakfast', alsoFits: ['beverage'] });
    expect(normalizeMealCode('L/D/S')).toEqual({ mealType: 'lunch', alsoFits: ['dinner', 'snack'] });
    expect(normalizeMealCode('B/L/D')).toEqual({ mealType: 'breakfast', alsoFits: ['lunch', 'dinner'] });
  });

  it('trims whitespace around tokens', () => {
    expect(normalizeMealCode(' L / D ')).toEqual({ mealType: 'lunch', alsoFits: ['dinner'] });
  });

  it('dedupes repeated tokens in alsoFits, preserving order', () => {
    expect(normalizeMealCode('L/D/D')).toEqual({ mealType: 'lunch', alsoFits: ['dinner'] });
  });

  it('excludes the primary mealType from alsoFits even if repeated', () => {
    expect(normalizeMealCode('L/L/D')).toEqual({ mealType: 'lunch', alsoFits: ['dinner'] });
  });

  it('returns null for an unrecognized token, dropping the whole row rather than guessing', () => {
    expect(normalizeMealCode('Brunch')).toBeNull();
    expect(normalizeMealCode('L/Brunch')).toBeNull();
    expect(normalizeMealCode('X')).toBeNull();
  });

  it('returns null for empty, malformed, or non-string input', () => {
    expect(normalizeMealCode('')).toBeNull();
    expect(normalizeMealCode('   ')).toBeNull();
    expect(normalizeMealCode('L//D')).toBeNull();
    expect(normalizeMealCode('L/')).toBeNull();
    expect(normalizeMealCode(undefined)).toBeNull();
    expect(normalizeMealCode(null)).toBeNull();
  });
});

describe('isFourDigitFI', () => {
  it('accepts a plain 4-digit string', () => {
    expect(isFourDigitFI('5000')).toBe(true);
  });

  it('trims surrounding whitespace before checking', () => {
    expect(isFourDigitFI(' 5000 ')).toBe(true);
  });

  it('rejects fewer or more than 4 digits', () => {
    expect(isFourDigitFI('500')).toBe(false);
    expect(isFourDigitFI('50000')).toBe(false);
  });

  it('rejects non-digit characters', () => {
    expect(isFourDigitFI('50a0')).toBe(false);
    expect(isFourDigitFI('-500')).toBe(false);
    expect(isFourDigitFI('50.0')).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isFourDigitFI(5000)).toBe(false);
    expect(isFourDigitFI(undefined)).toBe(false);
    expect(isFourDigitFI(null)).toBe(false);
  });
});

describe('isHttpsUrl', () => {
  it('accepts an https URL', () => {
    expect(isHttpsUrl('https://medlineplus.gov/recipes/x.html')).toBe(true);
  });

  it('rejects an http URL', () => {
    expect(isHttpsUrl('http://medlineplus.gov/recipes/x.html')).toBe(false);
  });

  it('rejects an empty or blank string', () => {
    expect(isHttpsUrl('')).toBe(false);
    expect(isHttpsUrl('   ')).toBe(false);
  });

  it('rejects a malformed URL', () => {
    expect(isHttpsUrl('not a url')).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isHttpsUrl(undefined)).toBe(false);
    expect(isHttpsUrl(null)).toBe(false);
  });
});

describe('isBlank', () => {
  it('is true for undefined, non-string, and whitespace-only values', () => {
    expect(isBlank(undefined)).toBe(true);
    expect(isBlank(null)).toBe(true);
    expect(isBlank(5)).toBe(true);
    expect(isBlank('')).toBe(true);
    expect(isBlank('   ')).toBe(true);
  });

  it('is false for a non-empty string, even with surrounding whitespace', () => {
    expect(isBlank('420')).toBe(false);
    expect(isBlank('  420  ')).toBe(false);
  });
});

describe('parseCalories', () => {
  it('parses a plain integer string', () => {
    expect(parseCalories('420')).toBe(420);
  });

  it('parses a decimal string', () => {
    expect(parseCalories('420.5')).toBe(420.5);
  });

  it('trims surrounding whitespace', () => {
    expect(parseCalories(' 420 ')).toBe(420);
  });

  it('returns null for an empty or blank string (does not silently coerce to 0)', () => {
    expect(parseCalories('')).toBeNull();
    expect(parseCalories('   ')).toBeNull();
  });

  it('returns null for non-numeric text', () => {
    expect(parseCalories('lots')).toBeNull();
    expect(parseCalories('420kcal')).toBeNull();
    expect(parseCalories('12abc')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(parseCalories(undefined)).toBeNull();
    expect(parseCalories(null)).toBeNull();
  });

  it('is within CALORIE_RANGE for a typical serving (sanity check on the constant, not the function)', () => {
    expect(parseCalories('420')).toBeGreaterThanOrEqual(CALORIE_RANGE.min);
    expect(parseCalories('420')).toBeLessThanOrEqual(CALORIE_RANGE.max);
  });
});

describe('extractRow', () => {
  it('reads all six columns tolerant of header case/spacing', () => {
    const record = {
      ' FI ': '5000',
      'FI_TEXT': 'Lemon-Garlic Shrimp and Grits',
      'LONG_DESC': 'FN Kitchen',
      'meal': 'L/D',
      'Calorie Count': '420',
      'URL': 'https://medlineplus.gov/x',
    };
    expect(extractRow(record)).toEqual({
      fi: '5000',
      fiText: 'Lemon-Garlic Shrimp and Grits',
      longDesc: 'FN Kitchen',
      meal: 'L/D',
      calorieCount: '420',
      url: 'https://medlineplus.gov/x',
    });
  });

  it('reads a differently-cased header variant identically', () => {
    const record = { fi: '5000', fi_text: 'X', long_desc: 'Y', MEAL: 'S', 'calorie count': '150', url: 'https://x' };
    expect(extractRow(record)).toEqual({
      fi: '5000',
      fiText: 'X',
      longDesc: 'Y',
      meal: 'S',
      calorieCount: '150',
      url: 'https://x',
    });
  });

  it('returns undefined for a missing column (Calorie Count and LONG_DESC are both optional in the real source)', () => {
    expect(extractRow({ fi: '5000' }).calorieCount).toBeUndefined();
    expect(extractRow({ fi: '5000' }).longDesc).toBeUndefined();
  });
});

describe('looksUnrelated', () => {
  it('returns false when the two strings share a token', () => {
    expect(looksUnrelated('Cinnamon Spiced Sweet Potatoes', 'Cinn Spiced Swt Potato..')).toBe(false);
  });

  it('returns true when the two strings share no token', () => {
    expect(looksUnrelated('Blueberry Pancakes', 'Spicy Cauliflower Stir-Fry')).toBe(true);
  });

  it('returns false (not enough signal) when either side is empty', () => {
    expect(looksUnrelated('', 'Spicy Cauliflower Stir-Fry')).toBe(false);
    expect(looksUnrelated('Blueberry Pancakes', '')).toBe(false);
    expect(looksUnrelated(undefined, undefined)).toBe(false);
  });

  it('ignores stopwords when checking overlap', () => {
    // "with" is a stopword; the two titles otherwise share no other token.
    expect(looksUnrelated('Soup with Rice', 'Stew with Beans')).toBe(true);
  });
});
