/**
 * Pill — selectable chip / filter toggle.
 *
 * Props (unchanged): children, selected, onClick
 * Removed: color (deprecated, use variant buttons instead)
 */
export default function Pill({ children, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!selected}
      className={`tap-target inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-[11px] font-medium
        transition-all duration-fast ease-ds-out min-h-[26px]
        active:translate-y-[1px] active:scale-[0.99]
        ${
          selected
            ? "bg-forest-700 text-white hover:bg-forest-800"
            : "bg-white text-char-900 border border-sand-200 shadow-xs hover:border-forest-300 hover:bg-forest-50"
        }`}
    >
      {children}
    </button>
  );
}
