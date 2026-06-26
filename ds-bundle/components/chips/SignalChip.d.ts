/**
 * Core food-guidance signal. Four variants correspond to the four signal colors.
 * Full or compact (icon-only) modes.
 */
export interface SignalChipProps {
  signal?: 'beneficial' | 'limit' | 'avoid' | 'info';
  /** Show icon only — no text label */
  compact?: boolean;
  size?: 'sm' | 'md';
}
export declare function SignalChip(props: SignalChipProps): JSX.Element;
