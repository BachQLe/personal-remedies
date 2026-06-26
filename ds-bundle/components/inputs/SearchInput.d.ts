/**
 * Search field with magnifying glass icon, focus ring, and clear button.
 */
export interface SearchInputProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onClear?: () => void;
}
export declare function SearchInput(props: SearchInputProps): JSX.Element;
