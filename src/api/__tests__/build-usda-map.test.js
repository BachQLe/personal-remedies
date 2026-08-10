/**
 * build-usda-map.test.js — Guard tests for the pure matching/merging logic
 * in scripts/build-usda-map.mjs (the USDA FoodData Central mapping
 * pipeline, Task T2D).
 *
 * The build script is a hand-run Node script, not part of the Vite app,
 * but its pure functions (normalization, scoring, subset selection,
 * nutrient extraction, incremental merge) are exported specifically so
 * they're testable here with fixtures — no real network calls anywhere in
 * this file. The only entrypoint side effect (`main()`) is guarded behind
 * an `import.meta.url === process.argv[1]` check in the script, so
 * importing it in a test never triggers a live run.
 */
import { describe, expect, it } from 'vitest';
import {
  normalizeFoodName,
  tokenizeName,
  scoreCandidate,
  DEFAULT_MATCH_THRESHOLD,
  DATA_TYPE_PRIORITY,
  isAllowedDataType,
  pickBestMatch,
  computeTargetSubset,
  PLAN_SLOT_FINE_GROUPS,
  RECIPE_FINE_GROUP,
  extractPer100g,
  pickServingPortion,
  scaleToServing,
  mergeMapEntries,
} from '../../../scripts/build-usda-map.mjs';

// ── Name normalization ──────────────────────────────────────────────────────

describe('normalizeFoodName', () => {
  it('lowercases', () => {
    expect(normalizeFoodName('PEACHES')).toBe('peaches');
  });

  it('strips parentheticals entirely (including the parens)', () => {
    expect(normalizeFoodName('Fennel (Bulb)')).toBe('fennel');
    expect(normalizeFoodName('Beans (winged)')).toBe('beans');
  });

  it('strips punctuation', () => {
    expect(normalizeFoodName('Peaches, yellow, raw.')).toBe('peaches yellow raw');
    expect(normalizeFoodName("Lady's fingers")).toBe('lady s fingers');
  });

  it('collapses whitespace and trims', () => {
    expect(normalizeFoodName('  Malted   drinks  (nonalcoholic) ')).toBe('malted drinks');
  });

  it('handles empty/nullish input', () => {
    expect(normalizeFoodName('')).toBe('');
    expect(normalizeFoodName(undefined)).toBe('');
    expect(normalizeFoodName(null)).toBe('');
  });
});

describe('tokenizeName', () => {
  it('splits a normalized name on whitespace', () => {
    expect(tokenizeName('chicken breast')).toEqual(['chicken', 'breast']);
  });

  it('returns an empty array for an empty string', () => {
    expect(tokenizeName('')).toEqual([]);
  });
});

// ── Candidate scoring / threshold ───────────────────────────────────────────

describe('scoreCandidate', () => {
  it('scores an exact normalized match as 1.0 / "exact"', () => {
    expect(scoreCandidate('peaches', 'Peaches')).toEqual({ score: 1, method: 'exact' });
  });

  it('scores a token-boundary prefix match as 0.85 / "startsWith"', () => {
    expect(scoreCandidate('peaches', 'Peaches, yellow, raw')).toEqual({ score: 0.85, method: 'startsWith' });
  });

  it('does NOT treat a bare substring (no word boundary) as startsWith', () => {
    // "pea" is a substring of "peaches" but not a token-boundary prefix —
    // must fall through to token overlap (score 0, no shared tokens).
    const result = scoreCandidate('pea', 'peaches raw');
    expect(result.method).not.toBe('startsWith');
  });

  it('scores partial token overlap proportionally to the TARGET word count (recall)', () => {
    // 1 of 2 target words present.
    expect(scoreCandidate('chicken soup', 'chicken breast, raw')).toEqual({ score: 0.5, method: 'tokenOverlap' });
  });

  it('scores full token overlap (all target words present, different order/extra words) near 1.0 but not "exact"/"startsWith"', () => {
    const result = scoreCandidate('chicken breast', 'breast of chicken, raw');
    expect(result.method).toBe('tokenOverlap');
    expect(result.score).toBe(1);
  });

  it('scores completely unrelated names as 0', () => {
    expect(scoreCandidate('peaches', 'beef liver, cooked')).toEqual({ score: 0, method: 'tokenOverlap' });
  });

  it('DEFAULT_MATCH_THRESHOLD is conservative (well above a single-word overlap on a 2+ word target)', () => {
    expect(DEFAULT_MATCH_THRESHOLD).toBeGreaterThanOrEqual(0.75);
    expect(scoreCandidate('chicken soup', 'chicken breast, raw').score).toBeLessThan(DEFAULT_MATCH_THRESHOLD);
  });
});

// ── dataType priority (Foundation > SR Legacy, NEVER Branded) ──────────────

describe('isAllowedDataType / DATA_TYPE_PRIORITY', () => {
  it('allows Foundation and SR Legacy', () => {
    expect(isAllowedDataType('Foundation')).toBe(true);
    expect(isAllowedDataType('SR Legacy')).toBe(true);
  });

  it('never allows Branded (or anything else)', () => {
    expect(isAllowedDataType('Branded')).toBe(false);
    expect(isAllowedDataType('Survey (FNDDS)')).toBe(false);
    expect(isAllowedDataType(undefined)).toBe(false);
  });

  it('Foundation is prioritized ahead of SR Legacy', () => {
    expect(DATA_TYPE_PRIORITY.indexOf('Foundation')).toBeLessThan(DATA_TYPE_PRIORITY.indexOf('SR Legacy'));
  });
});

describe('pickBestMatch', () => {
  it('picks the exact match over a weaker candidate', () => {
    const candidates = [
      { fdcId: 1, description: 'Peaches, canned, in syrup', dataType: 'SR Legacy' },
      { fdcId: 2, description: 'Peaches', dataType: 'SR Legacy' },
    ];
    const result = pickBestMatch('peaches', candidates);
    expect(result.fdcId).toBe(2);
    expect(result.matchScore).toBe(1);
  });

  it('never selects a Branded candidate even when it scores a perfect exact match', () => {
    const candidates = [
      { fdcId: 99, description: 'Peaches', dataType: 'Branded' },
      { fdcId: 2, description: 'Peaches, yellow, raw', dataType: 'SR Legacy' },
    ];
    const result = pickBestMatch('peaches', candidates);
    expect(result.fdcId).toBe(2);
    expect(result.dataType).not.toBe('Branded');
  });

  it('returns null when every candidate is Branded', () => {
    const candidates = [{ fdcId: 1, description: 'Peaches', dataType: 'Branded' }];
    expect(pickBestMatch('peaches', candidates)).toBeNull();
  });

  it('prefers Foundation over SR Legacy on an equal score tie', () => {
    const candidates = [
      { fdcId: 10, description: 'Peaches, yellow, raw', dataType: 'SR Legacy' },
      { fdcId: 20, description: 'Peaches, yellow, raw', dataType: 'Foundation' },
    ];
    const result = pickBestMatch('peaches', candidates);
    expect(result.fdcId).toBe(20);
    expect(result.dataType).toBe('Foundation');
  });

  it('returns null (unmatched) when nothing clears the threshold — never picks a weak fallback', () => {
    const candidates = [
      { fdcId: 1, description: 'Beef liver, cooked', dataType: 'Foundation' },
      { fdcId: 2, description: 'Chicken breast, raw', dataType: 'SR Legacy' },
    ];
    expect(pickBestMatch('peaches', candidates)).toBeNull();
  });

  it('respects a custom threshold', () => {
    const candidates = [{ fdcId: 1, description: 'chicken breast, raw', dataType: 'Foundation' }];
    // "chicken soup" vs "chicken breast raw" -> 1 of 2 target words -> score 0.5
    expect(pickBestMatch('chicken soup', candidates, { threshold: 0.9 })).toBeNull();
    expect(pickBestMatch('chicken soup', candidates, { threshold: 0.4 })).not.toBeNull();
  });
});

// ── Target subset (union of plan-slot fine groups + overlay, minus recipes) ─

describe('computeTargetSubset', () => {
  const items = [
    { foodItemID: 1, fineFoodGroup: 'f' }, // in plan-slot groups
    { foodItemID: 2, fineFoodGroup: 'x' }, // not in plan-slot groups, not overlay-flagged
    { foodItemID: 3, fineFoodGroup: 'x' }, // not in plan-slot groups, but overlay-flagged -> included
    { foodItemID: 4, fineFoodGroup: 'l' }, // recipe -> always excluded
    { foodItemID: 5, fineFoodGroup: 'l' }, // recipe, ALSO overlay-flagged -> still excluded
  ];
  const overlay = { 3: { isSnack: true }, 5: { isSnack: true } };

  it('includes items whose fineFoodGroup is a plan-slot group', () => {
    const subset = computeTargetSubset(items, overlay);
    expect(subset.map((i) => i.foodItemID)).toContain(1);
  });

  it('includes overlay-flagged items even outside plan-slot groups', () => {
    const subset = computeTargetSubset(items, overlay);
    expect(subset.map((i) => i.foodItemID)).toContain(3);
  });

  it('excludes items neither in a plan-slot group nor overlay-flagged', () => {
    const subset = computeTargetSubset(items, overlay);
    expect(subset.map((i) => i.foodItemID)).not.toContain(2);
  });

  it('NEVER includes recipes (fineFoodGroup "l"), even if overlay-flagged', () => {
    const subset = computeTargetSubset(items, overlay);
    const ids = subset.map((i) => i.foodItemID);
    expect(ids).not.toContain(4);
    expect(ids).not.toContain(5);
  });

  it('PLAN_SLOT_FINE_GROUPS / RECIPE_FINE_GROUP match the documented app groups', () => {
    expect(PLAN_SLOT_FINE_GROUPS).toEqual(
      expect.arrayContaining(['f', 'd', 'g1', 'c2', 'e', 'b1', 'b3', 'h1', 'c3', 'h2'])
    );
    expect(RECIPE_FINE_GROUP).toBe('l');
  });
});

// ── Nutrient extraction ──────────────────────────────────────────────────────

describe('extractPer100g', () => {
  it('extracts calories/protein/carbs/fat by USDA nutrient number ("full" format shape)', () => {
    const foodNutrients = [
      { nutrient: { number: '208', name: 'Energy', unitName: 'KCAL' }, amount: 52 },
      { nutrient: { number: '203', name: 'Protein', unitName: 'G' }, amount: 0.3 },
      { nutrient: { number: '205', name: 'Carbohydrate, by difference', unitName: 'G' }, amount: 14 },
      { nutrient: { number: '204', name: 'Total lipid (fat)', unitName: 'G' }, amount: 0.2 },
    ];
    expect(extractPer100g(foodNutrients)).toEqual({ calories: 52, protein: 0.3, carbs: 14, fat: 0.2 });
  });

  it('also handles the /foods/search ("abridged"-style) shape', () => {
    const foodNutrients = [
      { nutrientNumber: '208', nutrientName: 'Energy', unitName: 'KCAL', value: 42 },
      { nutrientNumber: '203', nutrientName: 'Protein', unitName: 'G', value: 1.1 },
    ];
    const result = extractPer100g(foodNutrients);
    expect(result.calories).toBe(42);
    expect(result.protein).toBe(1.1);
  });

  it('falls back to Atwater factor energy (957/958) when standard Energy (208) is absent — real USDA values, not a guess', () => {
    const foodNutrients = [
      { nutrient: { number: '957', name: 'Energy (Atwater General Factors)', unitName: 'kcal' }, amount: 64.66 },
    ];
    expect(extractPer100g(foodNutrients).calories).toBe(64.66);
  });

  it('never fabricates a missing macro — returns null instead of 0 or a guess', () => {
    const foodNutrients = [{ nutrient: { number: '203', name: 'Protein', unitName: 'G' }, amount: 1 }];
    const result = extractPer100g(foodNutrients);
    expect(result.protein).toBe(1);
    expect(result.calories).toBeNull();
    expect(result.carbs).toBeNull();
    expect(result.fat).toBeNull();
  });

  it('handles a missing/empty foodNutrients array without throwing', () => {
    expect(extractPer100g(undefined)).toEqual({ calories: null, protein: null, carbs: null, fat: null });
    expect(extractPer100g([])).toEqual({ calories: null, protein: null, carbs: null, fat: null });
  });
});

describe('pickServingPortion', () => {
  it('picks the lowest-sequenceNumber portion with a valid gramWeight', () => {
    const portions = [
      { sequenceNumber: 2, gramWeight: 200, amount: 1, measureUnit: { name: 'cup' } },
      { sequenceNumber: 1, gramWeight: 140, amount: 1, measureUnit: { name: 'RACC' } },
    ];
    expect(pickServingPortion(portions)).toEqual({ gramWeight: 140, label: '1 RACC' });
  });

  it('ignores portions with no positive gramWeight', () => {
    const portions = [{ sequenceNumber: 1, gramWeight: 0, amount: 1, measureUnit: { name: 'cup' } }];
    expect(pickServingPortion(portions)).toBeNull();
  });

  it('returns null for an empty/missing foodPortions array', () => {
    expect(pickServingPortion([])).toBeNull();
    expect(pickServingPortion(undefined)).toBeNull();
  });

  it('prefers portionDescription, then modifier, then measureUnit.name for the label', () => {
    expect(
      pickServingPortion([{ gramWeight: 150, amount: 1, portionDescription: '1 cup, chopped' }])
    ).toEqual({ gramWeight: 150, label: '1 1 cup, chopped' });
    expect(pickServingPortion([{ gramWeight: 150, amount: 1, modifier: 'cup' }])).toEqual({
      gramWeight: 150,
      label: '1 cup',
    });
  });
});

describe('scaleToServing', () => {
  it('scales per-100g values proportionally to the given gram weight', () => {
    const per100g = { calories: 52, protein: 0.3, carbs: 14, fat: 0.2 };
    expect(scaleToServing(per100g, 150)).toEqual({
      amount: 150,
      unit: 'g',
      calories: 78,
      protein: 0.45,
      carbs: 21,
      fat: 0.3,
    });
  });

  it('preserves null for any macro FDC did not report, rather than scaling null into a fabricated 0', () => {
    const per100g = { calories: 52, protein: null, carbs: 14, fat: null };
    const result = scaleToServing(per100g, 100);
    expect(result.protein).toBeNull();
    expect(result.fat).toBeNull();
  });
});

// ── Incremental merge / manualOverride preservation ─────────────────────────

describe('mergeMapEntries', () => {
  it('adds new entries for foodItemIDs not already present', () => {
    const merged = mergeMapEntries({}, { 1: { fdcId: 100, manualOverride: false } });
    expect(merged['1']).toEqual({ fdcId: 100, manualOverride: false });
  });

  it('overwrites an existing NON-manual entry with a fresh one', () => {
    const existing = { 1: { fdcId: 100, matchScore: 0.8, manualOverride: false } };
    const merged = mergeMapEntries(existing, { 1: { fdcId: 200, matchScore: 1, manualOverride: false } });
    expect(merged['1'].fdcId).toBe(200);
  });

  it('NEVER overwrites a manualOverride:true row, even if new results target the same key', () => {
    const existing = { 1: { fdcId: 999, matchedName: 'Hand-fixed match', manualOverride: true } };
    const merged = mergeMapEntries(existing, { 1: { fdcId: 200, matchedName: 'Auto match', manualOverride: false } });
    expect(merged['1']).toEqual(existing['1']);
  });

  it('leaves untouched entries (neither in newEntries) exactly as they were', () => {
    const existing = { 1: { fdcId: 100, manualOverride: false }, 2: { fdcId: 200, manualOverride: true } };
    const merged = mergeMapEntries(existing, { 3: { fdcId: 300, manualOverride: false } });
    expect(merged['1']).toEqual(existing['1']);
    expect(merged['2']).toEqual(existing['2']);
    expect(merged['3']).toEqual({ fdcId: 300, manualOverride: false });
  });
});

// ── Unmatched items stay absent from the map (never a placeholder) ─────────

describe('unmatched items stay absent (never guess)', () => {
  it('pickBestMatch returning null means no entry is ever constructed for that item', () => {
    const candidates = [{ fdcId: 1, description: 'Completely unrelated food', dataType: 'Foundation' }];
    const best = pickBestMatch(normalizeFoodName('Dragonfruit'), candidates);
    expect(best).toBeNull();
    // Simulates the build script's loop: only a truthy `best` ever produces
    // a map entry — an unmatched item contributes nothing to newEntries.
    const newEntries = {};
    if (best) newEntries['42'] = { fdcId: best.fdcId, manualOverride: false };
    expect(newEntries).toEqual({});
    expect(mergeMapEntries({}, newEntries)).toEqual({});
  });
});
