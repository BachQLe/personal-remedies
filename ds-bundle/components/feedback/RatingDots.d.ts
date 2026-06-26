/**
 * 5-dot evidence quality rating. Color shifts green→yellow→red with score.
 */
export interface RatingDotsProps {
  value?: number;
  max?: number;
  label?: string;
  showValue?: boolean;
}
export declare function RatingDots(props: RatingDotsProps): JSX.Element;
