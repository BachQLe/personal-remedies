/**
 * @startingPoint section="Buttons" subtitle="Square CTA — forest green, corner accent" viewport="320x80"
 * Primary call-to-action. Square-ish (6px radius) with a corner bracket accent mark.
 * Always forest-700 background. Use for the main action on any screen.
 */
export interface PrimaryButtonProps {
  /** Button label */
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** sm | md | lg */
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}
export declare function PrimaryButton(props: PrimaryButtonProps): JSX.Element;
