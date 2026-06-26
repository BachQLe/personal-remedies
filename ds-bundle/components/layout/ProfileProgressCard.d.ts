/**
 * Onboarding progress tracker card with step list and CTA.
 */
export interface ProfileProgressCardProps {
  steps: string[];
  currentStep: number;
  totalSteps: number;
  onContinue?: () => void;
}
export declare function ProfileProgressCard(props: ProfileProgressCardProps): JSX.Element;
