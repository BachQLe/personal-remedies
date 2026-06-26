/**
 * PrimaryButton — full-width forest CTA with corner-tick accent.
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
      className={`relative overflow-hidden w-full min-h-[52px] rounded-[6px] bg-forest-700 font-sans font-semibold
        text-base tracking-tight flex items-center justify-center gap-2 shadow-md
        transition-all duration-fast ease-ds-out
        hover:bg-forest-800
        active:translate-y-[1px] active:scale-[0.99]
        disabled:opacity-[0.38] disabled:cursor-not-allowed disabled:transform-none
        ${className}`}
      style={{ color: '#F3EFE6' }}
    >
      {loading ? (
        <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      ) : (
        children
      )}
      {/* Corner-tick accent */}
      <span className="absolute top-[6px] right-[6px] w-[11px] h-[11px] border-t-2 border-r-2 border-white/60 block pointer-events-none" />
    </button>
  );
}
