/**
 * entitlements.test.js — Guard tests for Task T5C Part A (REMEDI_MASTER_PLAN.md
 * §6.1: "hasEntitlement(feature) gate. Everything unlocked initially; the
 * free/paid split becomes a config change.").
 *
 * Covers:
 *  - Default-unlocked behavior: every registered feature, and any unknown
 *    key, resolves `true` under today's shipped config.
 *  - `listFeatures()` renders purely from `ENTITLEMENT_CONFIG` (no
 *    hardcoded feature list anywhere else) and reports `unlocked` per entry.
 *  - A fixture config with a `{ tier: 'plus' }` feature proves the gate
 *    flips to `false` for that feature ONLY, without touching call sites —
 *    this is done by mutating `ENTITLEMENT_CONFIG.features` directly since
 *    it's the one exported, mutable object `hasEntitlement` reads from, and
 *    restored afterward so it can't leak into other tests in this file.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { ENTITLEMENT_CONFIG, hasEntitlement, listFeatures } from '../entitlements.js';

// Snapshot so any fixture mutation below (JSON round-trip = safe deep clone
// for this plain-data config) can be restored after each test.
const ORIGINAL_CONFIG = JSON.parse(JSON.stringify(ENTITLEMENT_CONFIG));

afterEach(() => {
  ENTITLEMENT_CONFIG.defaultUnlocked = ORIGINAL_CONFIG.defaultUnlocked;
  ENTITLEMENT_CONFIG.features = JSON.parse(JSON.stringify(ORIGINAL_CONFIG.features));
});

describe('ENTITLEMENT_CONFIG — shipped defaults', () => {
  it('defaults to fully unlocked', () => {
    expect(ENTITLEMENT_CONFIG.defaultUnlocked).toBe(true);
  });

  it('registers at least one feature (for the paywall list to render)', () => {
    expect(Object.keys(ENTITLEMENT_CONFIG.features).length).toBeGreaterThan(0);
  });

  it('no shipped feature carries a tier yet — nothing is actually gated today', () => {
    for (const feature of Object.values(ENTITLEMENT_CONFIG.features)) {
      expect(feature.tier).toBeUndefined();
    }
  });
});

describe('hasEntitlement — default-unlocked behavior', () => {
  it('returns true for every registered feature key', () => {
    for (const key of Object.keys(ENTITLEMENT_CONFIG.features)) {
      expect(hasEntitlement(key)).toBe(true);
    }
  });

  it('returns true for an unknown feature key (falls through to defaultUnlocked)', () => {
    expect(hasEntitlement('totally_made_up_feature_xyz')).toBe(true);
    expect(hasEntitlement('')).toBe(true);
  });

  it('returns true for a nullish/undefined key without throwing', () => {
    expect(() => hasEntitlement(undefined)).not.toThrow();
    expect(hasEntitlement(undefined)).toBe(true);
  });
});

describe('listFeatures — introspection for the paywall screen', () => {
  it('returns one entry per registered feature, each reporting unlocked:true today', () => {
    const listed = listFeatures();
    const registeredKeys = Object.keys(ENTITLEMENT_CONFIG.features);

    expect(listed).toHaveLength(registeredKeys.length);
    for (const entry of listed) {
      expect(registeredKeys).toContain(entry.key);
      expect(entry.unlocked).toBe(true);
      expect(typeof entry.label).toBe('string');
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it('is driven by config — adding a feature to ENTITLEMENT_CONFIG.features changes the output with no code change', () => {
    ENTITLEMENT_CONFIG.features.__test_feature__ = {
      key: '__test_feature__',
      label: 'Test-only feature',
      description: 'Exists only for this test.',
    };

    const listed = listFeatures();
    expect(listed.some((f) => f.key === '__test_feature__')).toBe(true);
  });
});

describe('fixture: a locked feature flips hasEntitlement to false', () => {
  it('a feature registered with { tier: "plus" } is locked even though defaultUnlocked stays true', () => {
    ENTITLEMENT_CONFIG.features.locked_fixture_feature = {
      key: 'locked_fixture_feature',
      label: 'Locked fixture feature',
      tier: 'plus',
    };

    expect(ENTITLEMENT_CONFIG.defaultUnlocked).toBe(true); // unrelated features stay unlocked
    expect(hasEntitlement('locked_fixture_feature')).toBe(false);
    // Sibling registered (untiered) features are unaffected by the one lock.
    const [someOtherKey] = Object.keys(ORIGINAL_CONFIG.features);
    expect(hasEntitlement(someOtherKey)).toBe(true);
  });

  it('listFeatures() reflects the locked fixture as unlocked:false', () => {
    ENTITLEMENT_CONFIG.features.locked_fixture_feature = {
      key: 'locked_fixture_feature',
      label: 'Locked fixture feature',
      tier: 'plus',
    };

    const entry = listFeatures().find((f) => f.key === 'locked_fixture_feature');
    expect(entry).toBeDefined();
    expect(entry.unlocked).toBe(false);
  });

  it('flipping defaultUnlocked to false locks every untiered feature too (allowlist-model fixture)', () => {
    ENTITLEMENT_CONFIG.defaultUnlocked = false;

    for (const key of Object.keys(ORIGINAL_CONFIG.features)) {
      expect(hasEntitlement(key)).toBe(false);
    }
    // Unknown keys also flip, since they fall through to defaultUnlocked.
    expect(hasEntitlement('still_unknown')).toBe(false);
  });
});
