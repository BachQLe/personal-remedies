/**
 * @startingPoint section="Cards" subtitle="Food item with signal + condition tags" viewport="360x100"
 * Primary food listing card. Background tints to match the signal color.
 */
export interface FoodCardCondition { label: string; colorKey?: string; }
export interface FoodCardProps {
  emoji?: string;
  name: string;
  signal?: 'beneficial' | 'limit' | 'avoid' | 'info';
  conditions?: FoodCardCondition[];
  studyCount?: number;
  onClick?: () => void;
}
export declare function FoodCard(props: FoodCardProps): JSX.Element;
