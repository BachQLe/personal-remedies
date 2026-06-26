/**
 * SVG donut ring showing a stat value. Used in the food profile summary card.
 */
export interface StatRingProps {
  value: number;
  max?: number;
  label?: string;
  color?: string;
  size?: number;
}
export declare function StatRing(props: StatRingProps): JSX.Element;
