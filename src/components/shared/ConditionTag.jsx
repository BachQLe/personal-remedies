/**
 * ConditionTag — condition chip with category icon (emergency / medical_services / health_and_safety).
 *
 * Props:
 *   condition, onRemove (unchanged)
 *   solid — boolean, tinted background instead of outline
 *   className
 */
import Icon from "./Icon.jsx";
import { getConditionMeta } from "../../utils/conditionMeta.js";

export default function ConditionTag({
  condition,
  onRemove,
  solid = false,
  compact = false,
  truncate = false,
  className = "",
}) {
  const meta = condition ? getConditionMeta(condition) : { icon: 'health_and_safety', color: '#172554' };

  return (
    <span
      className={`inline-flex items-center rounded-pill font-sans font-medium
        ${compact ? "gap-1 h-[22px] px-2 text-[11px]" : "gap-2 h-[30px] px-3.5 text-sm"}
        ${solid ? "bg-forest-50 border border-transparent" : "bg-white border border-sand-200"}
        ${truncate ? "max-w-full" : ""}
        text-char-900 ${className}`}
    >
      <span
        className={`material-symbols-rounded flex-none ${compact ? "text-[13px]" : "text-[16px]"}`}
        style={{ color: meta.color }}
      >
        {meta.icon}
      </span>
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
