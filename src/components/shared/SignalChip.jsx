/**
 * SignalChip — brand-defining food-guidance signal.
 *
 * Props:
 *   signal   — "beneficial" | "limit" | "avoid" (canonical three only)
 *   compact  — boolean (smaller glyph, no pill bg)
 *   label    — false to hide text; string to override default
 *   className
 */
import Icon from "./Icon.jsx";

const CONFIG = {
  beneficial: {
    text: "Beneficial",
    bg: "bg-benefit-100",
    fg: "text-benefit-600",
    dot: "bg-benefit-600",
  },
  limit: {
    text: "Limit",
    bg: "bg-caution-100",
    fg: "text-caution-600",
    dot: "bg-caution-600",
  },
  avoid: {
    text: "Avoid",
    bg: "bg-avoid-100",
    fg: "text-avoid-600",
    dot: "bg-avoid-600",
  },
};

const GLYPHS = {
  beneficial: "check",
  limit: "alert-triangle",
  avoid: "x",
};

export default function SignalChip({
  signal = "beneficial",
  compact = false,
  label,
  className = "",
}) {
  const c = CONFIG[signal] ?? CONFIG.beneficial;
  const showLabel = label !== false;
  const labelText = typeof label === "string" ? label : c.text;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-sans text-xs font-semibold ${c.fg} ${className}`}
      >
        <span
          className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-full ${c.dot} text-white`}
        >
          <Icon name={GLYPHS[signal]} size={12} />
        </span>
        {showLabel && <span>{labelText}</span>}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-[7px] h-[30px] px-3 pl-2.5 rounded-pill font-sans text-sm font-semibold ${c.bg} ${c.fg} ${className}`}
    >
      <span
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${c.dot} text-white flex-none`}
      >
        <Icon name={GLYPHS[signal]} size={13} />
      </span>
      {showLabel && <span>{labelText}</span>}
    </span>
  );
}
