/**
 * SearchInput — text field with leading search icon.
 *
 * Props (unchanged): value, onChange, placeholder, autoFocus
 */
export default function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  autoFocus,
}) {
  return (
    <div className="relative">
      <span
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-char-400 material-symbols-rounded pointer-events-none"
        style={{ fontSize: 18 }}
      >
        search
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full pl-10 pr-4 py-5 rounded-lg border border-sand-200 bg-white
          text-char-900 placeholder:text-char-300 font-sans text-sm
          shadow-inset
          transition-all duration-fast ease-ds-out
          hover:border-forest-300
          focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-100"
      />
    </div>
  );
}
