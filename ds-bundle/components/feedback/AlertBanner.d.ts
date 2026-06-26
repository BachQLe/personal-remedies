/**
 * Full-width dismissible alert strip. Used for profile completion nudges, new study alerts.
 */
export interface AlertBannerProps {
  type?: 'warning' | 'success' | 'info' | 'error';
  message: string;
  ctaLabel?: string;
  onCta?: () => void;
  onDismiss?: () => void;
}
export declare function AlertBanner(props: AlertBannerProps): JSX.Element;
