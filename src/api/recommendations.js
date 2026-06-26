/**
 * recommendations — the mock boundary for the Daily Picks screen.
 *
 * Swap the body for the real ranking API later; keep these signatures.
 * Everything returned here is already allergen-filtered and ranked.
 */

import { recommendationsBySlot } from '../data/recommendationsMock';
import { storage } from './storage';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Return the ranked slice for a slot.
 * @param {'breakfast'|'lunch'|'dinner'|'snack'} slot
 * @param {number} offset  0-based start index within the slot's ranking
 * @param {number} [limit] how many to return (default 3)
 * @returns {Promise<import('../types/recommendations').Recommendation[]>}
 */
export async function getRecommendations(slot, offset, limit = 3) {
  await delay(180);
  const all = recommendationsBySlot[slot] ?? [];
  return all.slice(offset, offset + limit);
}

/** How many ranked options exist for a slot (so the UI can hide "+ more"). */
export function getSlotCount(slot) {
  return (recommendationsBySlot[slot] ?? []).length;
}

const PLAN_KEY = 'dailyPlan';

/** Persist the user's accepted picks (the recap) to the browser. */
export async function saveDailyPlan(selections) {
  await delay(120);
  const plan = { date: new Date().toISOString().split('T')[0], selections };
  storage.set(PLAN_KEY, plan);
  return plan;
}

/** Load a previously saved Daily Picks plan, if any. */
export async function getDailyPlan() {
  await delay(120);
  return storage.get(PLAN_KEY, null);
}
