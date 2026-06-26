/**
 * Colored pill tag for a health condition. Each condition family has a color assignment.
 */
export interface ConditionTagProps {
  label: string;
  /** Color key maps to condition family */
  colorKey?: 'diabetes' | 'hypertension' | 'cholesterol' | 'kidney' | 'heart' | 'default';
  size?: 'sm' | 'md';
}
export declare function ConditionTag(props: ConditionTagProps): JSX.Element;
