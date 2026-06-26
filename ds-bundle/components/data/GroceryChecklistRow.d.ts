/**
 * Grocery list row with check state and signal chip.
 */
export interface GroceryChecklistRowProps {
  name: string;
  signal?: 'beneficial' | 'limit' | 'avoid' | 'info';
  checked?: boolean;
  onToggle?: () => void;
}
export declare function GroceryChecklistRow(props: GroceryChecklistRowProps): JSX.Element;
