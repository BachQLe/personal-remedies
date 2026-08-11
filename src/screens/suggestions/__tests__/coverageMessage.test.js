import { describe, it, expect } from 'vitest';
import { joinNames, countUncovered, buildCoverageMessage } from '../coverageMessage.js';

describe('joinNames', () => {
  it('returns empty string for empty/nullish input', () => {
    expect(joinNames([])).toBe('');
    expect(joinNames(null)).toBe('');
    expect(joinNames(undefined)).toBe('');
  });

  it('returns the single name as-is', () => {
    expect(joinNames(['Aging'])).toBe('Aging');
  });

  it('joins two names with "and"', () => {
    expect(joinNames(['Aging', 'Pneumonia'])).toBe('Aging and Pneumonia');
  });

  it('joins three+ names with an Oxford comma', () => {
    expect(joinNames(['Aging', 'Pneumonia', 'Diabetes'])).toBe('Aging, Pneumonia, and Diabetes');
  });
});

describe('countUncovered', () => {
  it('counts requested ids absent from the covered set', () => {
    expect(countUncovered([203, 999], [203, 244])).toBe(1);
  });

  it('is 0 when every requested id is covered', () => {
    expect(countUncovered([203], [203, 244])).toBe(0);
  });

  it('is 0 when nothing was requested', () => {
    expect(countUncovered([], [203, 244])).toBe(0);
    expect(countUncovered(null, [203, 244])).toBe(0);
    expect(countUncovered(undefined, [203, 244])).toBe(0);
  });

  it('counts every requested id when none overlap the covered set', () => {
    expect(countUncovered([1, 2, 3], [203, 244])).toBe(3);
  });
});

describe('buildCoverageMessage', () => {
  it('returns null when no covered names are resolved yet', () => {
    expect(buildCoverageMessage(null, 0)).toBeNull();
    expect(buildCoverageMessage([], 1)).toBeNull();
  });

  it('names exactly which conditions the guidance covers, and flags uncovered ones', () => {
    const msg = buildCoverageMessage(['Aging', 'Pneumonia'], 1);
    expect(msg).toBe(
      "Showing demo guidance for Aging and Pneumonia only — 1 of your condition isn't covered by this data yet."
    );
  });

  it('pluralizes correctly for multiple uncovered conditions', () => {
    const msg = buildCoverageMessage(['Aging'], 2);
    expect(msg).toBe(
      "Showing demo guidance for Aging only — 2 of your conditions aren't covered by this data yet."
    );
  });

  it('never claims completeness even when every requested id happens to be covered', () => {
    const msg = buildCoverageMessage(['Aging', 'Pneumonia'], 0);
    expect(msg).toBe('Showing demo guidance for Aging and Pneumonia — a placeholder condition set, not your own profile.');
    // Still names it as a placeholder/demo set, never "personalized" or complete.
    expect(msg.toLowerCase()).not.toContain('personalized');
  });

  it('never fabricates a health claim — copy is data-coverage language only', () => {
    const msg = buildCoverageMessage(['Aging'], 1);
    for (const bannedWord of ['recommend', 'treat', 'cure', 'diagnos', 'should']) {
      expect(msg.toLowerCase()).not.toContain(bannedWord);
    }
  });
});
