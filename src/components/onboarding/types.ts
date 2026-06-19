/**
 * Onboarding profile — the typed output of the onboarding flow.
 * Downstream screens (plan, lookup, recipes) consume this shape.
 *
 * TODO: reconcile field names with existing prototype if needed.
 */
export interface UserProfile {
  conditions: string[];
  medications: string[];
  allergies: string[];
  dietaryPattern: string;
  religiousRestriction: string;
}

export interface Swipe {
  probeId: string;
  liked: boolean;
}

export type Cuisine =
  | 'american' | 'italian' | 'mexican' | 'east_asian'
  | 'se_asian' | 'south_asian' | 'mediterranean' | 'middle_eastern';

export interface TasteProfile {
  spiceTolerance: number;
  plantForward: number;
  sweetTooth: number;
  cuisineAffinity: { cuisine: Cuisine; score: number }[];
  seafoodOk: number;
  confidence: Record<keyof Omit<TasteProfile, 'confidence'>, 'high' | 'med' | 'low'>;
}
