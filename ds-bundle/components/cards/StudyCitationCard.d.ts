/**
 * Research citation card with quality badge. Used in food detail evidence panels.
 */
export interface StudyCitationCardProps {
  journal: string;
  year: number | string;
  title: string;
  quality?: 'strong' | 'moderate' | 'limited' | 'weak';
  onRead?: () => void;
}
export declare function StudyCitationCard(props: StudyCitationCardProps): JSX.Element;
