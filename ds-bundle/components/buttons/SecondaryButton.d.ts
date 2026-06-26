/**
 * Secondary ghost button — pill-shaped, white bg, subtle border.
 * Use for optional/escape actions alongside a PrimaryButton.
 */
export interface SecondaryButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}
export declare function SecondaryButton(props: SecondaryButtonProps): JSX.Element;
