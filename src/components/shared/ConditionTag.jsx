/**
 * ConditionTag — color-coded condition chip with dot indicator.
 *
 * Props:
 *   condition, onRemove (unchanged)
 *   solid — boolean, tinted background instead of outline (NEW)
 *   className (NEW)
 */
import Icon from "./Icon.jsx";

const CONDITION_DOT = {
  "type 2 diabetes": "bg-lavender-600",
  prediabetes: "bg-lavender-400",
  "hypertension (high blood pressure)": "bg-info-600",
  hypertension: "bg-info-600",
  "high cholesterol": "bg-yellow-700",
  "chronic kidney disease (ckd)": "bg-forest-500",
  ckd: "bg-forest-500",
  "kidney disease": "bg-forest-500",
  "heart failure": "bg-lavender-700",
  "heart disease": "bg-lavender-700",
  depression: "bg-info-600",
  osteoarthritis: "bg-yellow-400",
  hypothyroidism: "bg-forest-700",
  thyroid: "bg-forest-700",
  "irritable bowel syndrome (ibs)": "bg-lavender-400",
  ibs: "bg-lavender-400",
  asthma: "bg-info-600",
  "fatty liver": "bg-yellow-700",
  gout: "bg-yellow-400",
};

function dotCls(condition) {
  if (!condition) return "bg-char-400";
  return CONDITION_DOT[condition.toLowerCase().trim()] || "bg-char-400";
}

export default function ConditionTag({
  condition,
  onRemove,
  solid = false,
  compact = false,
  truncate = false,
  className = "",
}) {
  return (
    <span
      className={`inline-flex items-center rounded-pill font-sans font-medium
        ${compact ? "gap-1 h-[22px] px-2 text-[11px]" : "gap-2 h-[30px] px-3.5 text-sm"}
        ${solid ? "bg-forest-50 border border-transparent" : "bg-white border border-sand-200"}
        ${truncate ? "max-w-full" : ""}
        text-char-900 ${className}`}
    >
      <span className={`${compact ? "w-[6px] h-[6px]" : "w-[9px] h-[9px]"} rounded-full flex-none ${dotCls(condition)}`} />
      <span className={truncate ? "truncate" : ""}>{condition}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 opacity-60 hover:opacity-100 text-current"
          aria-label={`Remove ${condition}`}
        >
          <Icon name="x" size={14} />
        </button>
      )}
    </span>
  );
}
