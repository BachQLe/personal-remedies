/**
 * Recommendations — the typed contract for the Daily Picks screen.
 *
 * Allergen exclusion happens upstream (engine / mock), so anything that reaches
 * the client is already safe to render. The client never invents scores — it
 * shows tier labels + reference counts only (survives medical review).
 */

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type MatchTier = 'top' | 'strong' | 'good';

export interface Recommendation {
  id: string;
  name: string; // recipe / food name
  slot: MealSlot;
  tier: MatchTier;
  referenceCount: number; // credibility signal — never a 0–100 score
  rank: number; // 1-based within the slot
  /** Optional supporting detail rendered under the name. */
  blurb?: string;
  /** Conditions this pick supports, for the tag row. */
  matchedConditions?: string[];
  /** Hero image URL for the card. */
  image?: string;
}

/** A saved Daily Picks plan: the recap the user accumulated. */
export interface DailyPlan {
  date: string; // ISO yyyy-mm-dd
  selections: Recommendation[];
}

export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** rank → tier: 1 = top, 2–3 = strong, 4+ = good. */
export function tierForRank(rank: number): MatchTier {
  if (rank === 1) return 'top';
  if (rank <= 3) return 'strong';
  return 'good';
}
