/**
 * Floating Action Button — circular or extended pill. Primary way to log a food.
 */
export interface FABProps {
  onClick?: () => void;
  /** When set, renders extended pill with text */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Custom icon node; defaults to + */
  icon?: React.ReactNode;
}
export declare function FAB(props: FABProps): JSX.Element;
