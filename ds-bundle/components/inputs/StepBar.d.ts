/**
 * Multi-step progress bar used in onboarding flows.
 */
export interface StepBarProps {
  current: number;
  total: number;
  /** Custom label; false to hide; defaults to "Step N of M" */
  label?: string | false;
}
export declare function StepBar(props: StepBarProps): JSX.Element;
