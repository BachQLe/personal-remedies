/**
 * SearchInput — text field with leading search icon.
 *
 * Props (unchanged): value, onChange, placeholder, autoFocus
 */
import Icon from "./Icon.jsx";

export default function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  autoFocus,
}) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-char-400 pointer-events-none"
      >
        <Icon name="search" size={18} />
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        className="w-full pl-10 pr-4 py-5 rounded-lg border border-sand-200 bg-white
          text-char-900 placeholder:text-char-500 font-sans text-sm
          shadow-inset
          transition-all duration-fast ease-ds-out
          hover:border-forest-300
          focus:outline-none focus:border-forest-500
          focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest-600 focus-visible:outline-offset-2"
      />
    </div>
  );
}
