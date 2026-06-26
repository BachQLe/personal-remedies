/**
 * Horizontal scrollable filter strip. Active tab uses forest-700 fill.
 */
export interface FilterTab {
  key: string;
  label: string;
  color?: string;
}
export interface FilterTabsProps {
  tabs: FilterTab[];
  value?: string;
  onChange?: (key: string) => void;
}
export declare function FilterTabs(props: FilterTabsProps): JSX.Element;
