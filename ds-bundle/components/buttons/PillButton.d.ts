/**
 * Versatile pill-shaped button. Four variants cover most inline actions.
 */
export interface PillButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** forest (default) | accent | ghost | ghost-dark */
  variant?: 'forest' | 'accent' | 'ghost' | 'ghost-dark';
  size?: 'sm' | 'md' | 'lg';
}
export declare function PillButton(props: PillButtonProps): JSX.Element;
