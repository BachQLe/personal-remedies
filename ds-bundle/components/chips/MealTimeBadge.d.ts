/**
 * Meal time badge — active/inactive states, unique color per meal.
 */
export interface MealTimeBadgeProps {
  meal?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  active?: boolean;
  onClick?: () => void;
}
export declare function MealTimeBadge(props: MealTimeBadgeProps): JSX.Element;
