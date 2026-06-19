/**
 * PrimaryButton — full-width forest CTA.
 *
 * Props (unchanged): children, onClick, disabled, loading, className, type
 */
export default function PrimaryButton({
  children,
  onClick,
  disabled,
  loading,
  className = "",
  type = "button",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full min-h-[52px] rounded-pill bg-forest-700 text-white font-sans font-semibold
        text-base tracking-tight flex items-center justify-center gap-2
        transition-all duration-fast ease-ds-out
        hover:bg-forest-800
        active:translate-y-[1px] active:scale-[0.99]
        disabled:opacity-45 disabled:cursor-not-allowed disabled:transform-none
        ${className}`}
    >
      {loading ? (
        <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      ) : (
        children
      )}
    </button>
  );
}
