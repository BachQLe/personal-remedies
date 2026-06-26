/**
 * Serving size counter with minus/plus. Used in food logging flow.
 */
export interface ServingSizeStepperProps {
  name: string;
  calories?: number;
  value: number;
  unit?: string;
  onIncrement?: () => void;
  onDecrement?: () => void;
}
export declare function ServingSizeStepper(props: ServingSizeStepperProps): JSX.Element;
