/**
 * SecondaryButton — pill-shaped outline button on card surfaces.
 *
 * Props (unchanged): children, onClick, disabled, className, type
 */
export default function SecondaryButton({
  children,
  onClick,
  disabled,
  className = "",
  type = "button",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`w-full min-h-[52px] rounded-pill border border-sand-200 bg-white
        text-char-900 font-sans font-semibold text-base tracking-tight
        flex items-center justify-center gap-2 shadow-card
        transition-all duration-fast ease-ds-out
        hover:border-forest-300 hover:bg-forest-50
        active:translate-y-[1px] active:scale-[0.99]
        disabled:opacity-[0.38] disabled:cursor-not-allowed
        ${className}`}
    >
      {children}
    </button>
  );
}
