/**
 * Centered empty state with emoji, title, description and optional CTA.
 */
export interface EmptyStateProps {
  emoji?: string;
  title: string;
  body?: string;
  ctaLabel?: string;
  onCta?: () => void;
}
export declare function EmptyState(props: EmptyStateProps): JSX.Element;
