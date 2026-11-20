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
        transition-[transform,background-color,border-color,box-shadow] duration-press ease-ux-out
        shadow-xs mouse:hover:shadow-sm active:scale-[0.97] active:shadow-none
        disabled:transform-none
        ${className}`}
    >
      {children}
    </button>
  );
}
