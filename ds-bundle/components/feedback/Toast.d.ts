/**
 * Signal-colored snackbar for transient feedback.
 */
export interface ToastProps {
  type?: 'beneficial' | 'limit' | 'avoid' | 'info';
  title: string;
  message?: string;
  onDismiss?: () => void;
}
export declare function Toast(props: ToastProps): JSX.Element;
