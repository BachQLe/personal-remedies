/**
 * localTables.getOverlayImageFile.test.js — regression guard for the
 * `itemImages.generated.json` layer (machine-picked per-item Unsplash
 * `imageFile`, added alongside the existing `itemOverlay.generated.json`
 * flags layer) being wired into `ITEM_OVERLAY_LAYERS` in the right ORDER:
 * [generatedOverlay, itemImages, manualOverlay] — later layers win, so a
 * hand-curated `itemOverlay.json` imageFile must always beat a
 * machine-generated one for the same foodItemID, and a machine-generated
 * image must still surface when no manual entry exists at all.
 *
 * Mocks all five static JSON imports localTables.js reads (items/conditions
 * /groups dictionaries + the three overlay layers), same convention as
 * localTables.getOverlayFlags.test.js, so this test controls the exact
 * overlay content instead of depending on the real, frequently regenerated
 * committed snapshots — this must pass identically whether
 * itemImages.generated.json is `{}` (not yet populated) or full.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../data/cache/items.json', () => ({ default: [] }));
vi.mock('../../data/cache/conditions.json', () => ({ default: [] }));
vi.mock('../../data/cache/groups.json', () => ({ default: [] }));
vi.mock('../../data/cache/itemOverlay.generated.json', () => ({ default: {} }));
vi.mock('../../data/cache/itemImages.generated.json', () => ({
  default: {
    '200': { imageFile: 'https://images.unsplash.com/photo-generated-200?w=600&q=80&auto=format&fit=crop' },
    '201': { imageFile: 'https://images.unsplash.com/photo-generated-201?w=600&q=80&auto=format&fit=crop' },
  },
}));
vi.mock('../../data/cache/itemOverlay.json', () => ({
  default: {
    // Manual override: itemImages says the generated-201 photo, Sunny says
    // a different, hand-curated one.
    '201': { imageFile: 'curated-201.jpg' },
  },
}));

import { getOverlayImageFile } from '../localTables.js';

describe('getOverlayImageFile: itemImages.generated.json layer', () => {
  it('returns the generated image when no manual entry exists for that id', () => {
    expect(getOverlayImageFile(200)).toBe(
      'https://images.unsplash.com/photo-generated-200?w=600&q=80&auto=format&fit=crop'
    );
  });

  it('lets the hand-curated manual layer override the generated imageFile for the same id', () => {
    expect(getOverlayImageFile(201)).toBe('curated-201.jpg');
  });

  it('returns undefined for an id with no overlay row in any layer', () => {
    expect(getOverlayImageFile(999)).toBeUndefined();
  });

  it('accepts a string foodItemID the same as a number (keys are stringified)', () => {
    expect(getOverlayImageFile('200')).toBe(
      'https://images.unsplash.com/photo-generated-200?w=600&q=80&auto=format&fit=crop'
    );
  });
});
