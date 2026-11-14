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
      className={`btn btn-secondary w-full
        active:translate-y-[1px] active:scale-[0.99]
        ${className}`}
    >
      {children}
    </button>
  );
}
