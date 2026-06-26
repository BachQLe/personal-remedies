/**
 * Card — surface container.
 *
 * Props:
 *   children, className, onClick (unchanged)
 *   variant — "default" | "flat" | "raised" | "warm" | "forest" | "lavender" (NEW)
 *   padding — "sm" | "md" | "lg" (NEW, default "md")
 *   title, eyebrow, action — optional header slots (NEW)
 */

const VARIANT_CLS = {
  default: "bg-white border border-sand-200 shadow-card",
  flat: "bg-white border border-sand-200",
  raised: "bg-white shadow-md",
  warm: "bg-paper-100 border border-sand-200 shadow-card",
  forest: "bg-forest-700 border-transparent text-white",
  lavender: "bg-lavender-700 border-transparent text-white",
  /* legacy alias */
  plum: "bg-lavender-700 border-transparent text-white",
};

const PAD_CLS = {
  sm: "p-4",
  md: "p-[22px]",
  lg: "p-[30px]",
};

export default function Card({
  children,
  className = "",
  onClick,
  variant = "default",
  padding = "md",
  title,
  eyebrow,
  action,
}) {
  const interactive = !!onClick;
  const hasHeader = title || eyebrow || action;

  return (
    <div
      className={`rounded-[28px] overflow-hidden
        ${VARIANT_CLS[variant] || VARIANT_CLS.default}
        ${PAD_CLS[padding] || PAD_CLS.md}
        ${interactive ? "cursor-pointer transition-all duration-base ease-ds-out hover:-translate-y-[2px] hover:shadow-lg active:translate-y-[1px] active:scale-[0.99]" : ""}
        ${className}`}
      onClick={onClick}
    >
      {hasHeader && (
        <div className="flex items-start justify-between gap-3 mb-3.5">
          <div>
            {eyebrow && (
              <div className="text-[12px] font-label font-bold tracking-eyebrow uppercase text-char-500 mb-1">
                {eyebrow}
              </div>
            )}
            {title && (
              <div className="font-display text-lg font-semibold tracking-tightish text-blue-950">
                {title}
              </div>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
