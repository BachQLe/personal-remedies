/**
 * Labeled macro/nutrient progress bar. Color-coded by nutrient type.
 */
export interface NutrientBarProps {
  label: string;
  value: number;
  max: number;
  unit?: string;
  nutrient?: 'protein' | 'carbs' | 'fat' | 'fiber' | 'default';
}
export declare function NutrientBar(props: NutrientBarProps): JSX.Element;
