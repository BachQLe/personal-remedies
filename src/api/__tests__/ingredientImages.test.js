/**
 * ingredientImages.test.js — Guards the non-food rendering rule (master
 * plan 1.10, decision j / Task T4B): items in coarse group 'k' (Key
 * Nutrients & Herbal) or fine group 'x'/'j1' (lifestyle) must never resolve
 * to a stock food photo — a category icon sentinel resolves instead.
 *
 * Also guards that `getIngredientImage` itself is UNCHANGED (always a plain
 * URL string, even for k/x/j1 inputs) — 8+ call sites outside this task's
 * ownership (MealprepCarousel, MealPlannerPicker, MealQueueScreen,
 * SlotSection, SchedulerView, recommendations.js, prefetch.js, adapter.js)
 * put its return value straight into an `<img src>`/`Image().src`, so a
 * behavior change there would silently break them. The sentinel is only
 * reachable through the new opt-in functions below.
 */
import { describe, expect, it } from 'vitest';
import {
  getIngredientImage,
  getIngredientImageOrIcon,
  getNonFoodIcon,
} from '../ingredientImages.js';

describe('getNonFoodIcon', () => {
  it('returns the nutrient icon for coarse group "k"', () => {
    expect(getNonFoodIcon('k', '')).toBe('flask-conical');
    expect(getNonFoodIcon('k', undefined)).toBe('flask-conical');
  });

  it('returns the lifestyle icon for fine group "x" or "j1"', () => {
    expect(getNonFoodIcon('j', 'x')).toBe('activity');
    expect(getNonFoodIcon('j', 'j1')).toBe('activity');
    // fine-group lifestyle check applies even if coarse group isn't 'j'
    expect(getNonFoodIcon(undefined, 'x')).toBe('activity');
  });

  it('prefers the lifestyle icon when both a lifestyle fine group and "k" coarse group are (implausibly) present', () => {
    expect(getNonFoodIcon('k', 'x')).toBe('activity');
  });

  it('returns null for ordinary food groups', () => {
    expect(getNonFoodIcon('b', 'b1')).toBeNull();
    expect(getNonFoodIcon('e', '')).toBeNull();
    expect(getNonFoodIcon(undefined, undefined)).toBeNull();
  });

  it('does not match coarse "j" alone (only fine x/j1) or unrelated codes', () => {
    expect(getNonFoodIcon('j', '')).toBeNull();
    expect(getNonFoodIcon('j', 'j2')).toBeNull();
  });
});

describe('getIngredientImage: unchanged for existing (unowned) call sites', () => {
  it('always returns a plain https URL string, even for a "k" nutrient item', () => {
    const result = getIngredientImage('Vitamin D', 'k');
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^https:\/\//);
  });

  it('always returns a plain https URL string, even for a lifestyle item', () => {
    const result = getIngredientImage('Exercise', 'j', undefined);
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^https:\/\//);
  });

  it('still honors a curation-overlay imageFile override regardless of group', () => {
    expect(getIngredientImage('Vitamin D', 'k', 'vitamin-d.jpg')).toBe('/images/vitamin-d.jpg');
  });

  it('resolves an ordinary food to a photo URL as before', () => {
    const result = getIngredientImage('Spinach', 'e');
    expect(result).toMatch(/^https:\/\/images\.unsplash\.com/);
  });
});

describe('getIngredientImageOrIcon: opt-in sentinel resolver', () => {
  it('returns an icon sentinel (never a photo) for a coarse-"k" item', () => {
    const result = getIngredientImageOrIcon('Turmeric Extract', 'k', '');
    expect(result).toEqual({ icon: 'flask-conical' });
    expect(result.photo).toBeUndefined();
  });

  it('returns an icon sentinel for a fine-"x"/"j1" lifestyle item', () => {
    expect(getIngredientImageOrIcon('Exercise', 'j', 'x')).toEqual({ icon: 'activity' });
    expect(getIngredientImageOrIcon('Smoking', 'j', 'j1')).toEqual({ icon: 'activity' });
  });

  it('returns a photo for an ordinary food (normal food -> photo path)', () => {
    const result = getIngredientImageOrIcon('Salmon', 'b', 'b1');
    expect(result.icon).toBeUndefined();
    expect(typeof result.photo).toBe('string');
    expect(result.photo).toMatch(/^https:\/\//);
  });

  it('a curated overlay imageFile still wins over the icon sentinel for a non-food category', () => {
    const result = getIngredientImageOrIcon('Vitamin D', 'k', '', 'vitamin-d.jpg');
    expect(result).toEqual({ photo: '/images/vitamin-d.jpg' });
  });
});
