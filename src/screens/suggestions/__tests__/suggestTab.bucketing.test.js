// @vitest-environment jsdom
/**
 * suggestTab.bucketing.test.js — guards SuggestTab.jsx's `bucketFineGroups`,
 * the pure function that buckets the flat 17-entry getFineFoodGroups() menu
 * into coarse-family groups for rendering (see SuggestTab.jsx's docblock for
 * why the 17 fine groups are grouped under coarse headers rather than shown
 * as one flat list).
 */
import { describe, it, expect } from 'vitest';
import { bucketFineGroups } from '../SuggestTab.jsx';

// Mirrors the real 17-entry getFineFoodGroups() menu shape/order (ascending
// by code, so each coarse family's entries are contiguous).
const FINE_GROUPS = [
  { code: 'b1', label: 'Fish & Seafood', coarse: 'b' },
  { code: 'b2', label: 'Meat, Red Meat & Organ Meats', coarse: 'b' },
  { code: 'b3', label: 'Poultry', coarse: 'b' },
  { code: 'c1', label: 'Eggs & Preparations', coarse: 'c' },
  { code: 'c2', label: 'Beans & Legumes', coarse: 'c' },
  { code: 'c3', label: 'Nuts & Seeds', coarse: 'c' },
  { code: 'd', label: 'Fruits & Juices', coarse: 'd' },
  { code: 'e', label: 'Vegetables', coarse: 'e' },
  { code: 'f', label: 'Breads, Grains, Cereals, Pasta', coarse: 'f' },
  { code: 'g1', label: 'Dairy Products', coarse: 'g' },
  { code: 'g2', label: 'Fats & Oils', coarse: 'g' },
  { code: 'h1', label: 'Sweets & Snacks', coarse: 'h' },
  { code: 'h2', label: 'Beverages', coarse: 'h' },
  { code: 'i1', label: 'Herbs, Spices & Sauces', coarse: 'i' },
  { code: 'i2', label: 'Fast & Prepared Foods', coarse: 'i' },
  { code: 'k1', label: 'Vitamins, Minerals & Other', coarse: 'k' },
  { code: 'k2', label: 'Herbal Supplements', coarse: 'k' },
];

describe('bucketFineGroups', () => {
  it('buckets all 17 fine groups into exactly 9 coarse families, in order', () => {
    const buckets = bucketFineGroups(FINE_GROUPS);
    expect(buckets).toHaveLength(9);
    expect(buckets.map((b) => b.coarse)).toEqual(['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'k']);
    const total = buckets.reduce((n, b) => n + b.groups.length, 0);
    expect(total).toBe(17);
  });

  it('keeps multi-group families (b, c) together with all their fine groups, in order', () => {
    const buckets = bucketFineGroups(FINE_GROUPS);
    const b = buckets.find((bucket) => bucket.coarse === 'b');
    expect(b.groups.map((g) => g.code)).toEqual(['b1', 'b2', 'b3']);
    const c = buckets.find((bucket) => bucket.coarse === 'c');
    expect(c.groups.map((g) => g.code)).toEqual(['c1', 'c2', 'c3']);
  });

  it('buckets the singleton families (d, e, f) as single-entry groups', () => {
    const buckets = bucketFineGroups(FINE_GROUPS);
    for (const coarse of ['d', 'e', 'f']) {
      const bucket = buckets.find((b) => b.coarse === coarse);
      expect(bucket.groups).toHaveLength(1);
      expect(bucket.groups[0].code).toBe(coarse);
    }
  });

  it('returns an empty array for no input', () => {
    expect(bucketFineGroups([])).toEqual([]);
    expect(bucketFineGroups(undefined)).toEqual([]);
  });
});
