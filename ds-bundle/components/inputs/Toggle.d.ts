/**
 * On/off toggle switch. Active state uses --forest-700 with lime glow.
 */
export interface ToggleProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}
export declare function Toggle(props: ToggleProps): JSX.Element;
