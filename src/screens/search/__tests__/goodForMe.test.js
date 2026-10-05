import { describe, expect, it } from 'vitest';
import { summarizeGoodForMe, unscoredRowText } from '../goodForMe.js';

const ok = (name, numericId) => ({ conditionName: name, status: 'ok', numericId });
const bad = (name, status) => ({ conditionName: name, status, numericId: null });

describe('summarizeGoodForMe', () => {
  it('no conditions -> no-profile', () => {
    expect(summarizeGoodForMe([]).kind).toBe('no-profile');
  });
  it('all helpful -> good, names conditions', () => {
    const s = summarizeGoodForMe([ok('Aging', 1), ok('Pneumonia', 3)]);
    expect(s.kind).toBe('good');
    expect(s.detail).toContain('Aging, Pneumonia');
  });
  it('merges helpful + harmful into mixed', () => {
    const s = summarizeGoodForMe([ok('Aging', 2), ok('Pneumonia', 6)]);
    expect(s.kind).toBe('mixed');
    expect(s.detail).toContain('Ranked favorably for Aging');
    expect(s.detail).toContain('ranked lower for Pneumonia');
  });
  it('harmful only -> avoid; harmful beats neutral', () => {
    expect(summarizeGoodForMe([ok('A', 5), ok('B', 4)]).kind).toBe('avoid');
  });
  it('neutral only -> neutral, never claims a benefit', () => {
    const s = summarizeGoodForMe([ok('A', 4)]);
    expect(s.kind).toBe('neutral');
    expect(s.headline).not.toMatch(/good/i);
  });
  it('helpful + neutral -> good', () => {
    expect(summarizeGoodForMe([ok('A', 4), ok('B', 2)]).kind).toBe('good');
  });
  it('flags unscored conditions alongside a real verdict', () => {
    const s = summarizeGoodForMe([ok('A', 2), bad('B', 'unauthorized')]);
    expect(s.kind).toBe('good');
    expect(s.unscored).toBe(1);
    expect(s.detail).toContain("1 of your 2 conditions couldn't be scored");
  });
  it('all unauthorized -> unavailable (no fabricated verdict)', () => {
    expect(summarizeGoodForMe([bad('A', 'unauthorized'), bad('B', 'unauthorized')]).kind).toBe('unavailable');
  });
  it('any error with nothing scored -> error', () => {
    expect(summarizeGoodForMe([bad('A', 'error'), bad('B', 'unauthorized')]).kind).toBe('error');
  });
  it('all nodata -> unknown', () => {
    expect(summarizeGoodForMe([bad('A', 'nodata')]).kind).toBe('unknown');
  });
});

describe('unscoredRowText', () => {
  it('describes unscored statuses and returns null for ok', () => {
    expect(unscoredRowText({ status: 'unauthorized' })).toMatch(/can't be scored/i);
    expect(unscoredRowText({ status: 'nodata' })).toBe('No data');
    expect(unscoredRowText({ status: 'ok' })).toBeNull();
  });
});
