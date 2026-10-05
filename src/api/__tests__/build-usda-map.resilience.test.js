import { describe, it, expect, vi } from 'vitest';
import { stripOrganicQualifiers, sanitizeSearchQuery, callWithRetry, stemToken, pickBestMatch } from '../../../scripts/build-usda-map.mjs';
import { FdcApiError } from '../usda.js';

describe('sanitizeSearchQuery', () => {
  it('replaces slashes and punctuation with spaces', () => {
    expect(sanitizeSearchQuery('Sugar/snap peas non-org')).toBe('Sugar snap peas non org');
    expect(sanitizeSearchQuery('Peas (sugar/snap) & more!')).toBe('Peas more');
  });
});

describe('stemToken / plural matching', () => {
  it('singularizes simple plurals', () => {
    expect(stemToken('clams')).toBe('clam');
    expect(stemToken('berries')).toBe('berry');
    expect(stemToken('peaches')).toBe('peach');
  });
  it('matches plural target to singular FDC name and rejects derived products', () => {
    const best = pickBestMatch('clams', [
      { fdcId: 1, description: 'Soup, clam chowder, canned', dataType: 'SR Legacy' },
      { fdcId: 2, description: 'Mollusks, clam, mixed species, raw', dataType: 'SR Legacy' },
    ]);
    expect(best.fdcId).toBe(2);
  });
});

describe('callWithRetry', () => {
  it('waits and retries on 429', async () => {
    const sleepFn = vi.fn().mockResolvedValue();
    const fn = vi.fn().mockRejectedValueOnce(new FdcApiError('x', 429)).mockResolvedValue('ok');
    await expect(callWithRetry(fn, 't', sleepFn)).resolves.toBe('ok');
    expect(sleepFn).toHaveBeenCalledTimes(1);
  });
  it('does not retry a 400', async () => {
    const fn = vi.fn().mockRejectedValue(new FdcApiError('bad', 400));
    await expect(callWithRetry(fn, 't', vi.fn())).rejects.toThrow('bad');
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('retries 5xx a limited number of times', async () => {
    const fn = vi.fn().mockRejectedValue(new FdcApiError('boom', 503));
    await expect(callWithRetry(fn, 't', vi.fn().mockResolvedValue())).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(4);
  });
});

describe('ranking and qualifiers', () => {
  it('prefers a leading-name match over a full token overlap elsewhere', () => {
    const best = pickBestMatch('goose', [
      { fdcId: 1, description: 'Egg, goose, whole, fresh, raw', dataType: 'SR Legacy' },
      { fdcId: 2, description: 'Goose, domesticated, meat only, raw', dataType: 'SR Legacy' },
    ]);
    expect(best.fdcId).toBe(2);
  });
  it('rejects ALL-CAPS restaurant records', () => {
    expect(pickBestMatch('onions', [{ fdcId: 1, description: "DENNY'S, onion rings", dataType: 'SR Legacy' }])).toBeNull();
  });
  it('strips organic qualifiers', () => {
    expect(stripOrganicQualifiers('Apples non-organic')).toBe('Apples');
    expect(stripOrganicQualifiers('Organic sugar/snap peas')).toBe('sugar/snap peas');
  });
});
