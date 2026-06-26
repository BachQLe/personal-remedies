/**
 * Small square-ish card for food category browsing. Color-coded by category type.
 */
export interface CategoryCardProps {
  emoji: string;
  label: string;
  count?: number;
  colorKey?: 'vegetables' | 'fruits' | 'nuts' | 'fish' | 'grains' | 'default';
  onClick?: () => void;
}
export declare function CategoryCard(props: CategoryCardProps): JSX.Element;
