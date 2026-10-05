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
    text: "Ranked higher",
    bg: "bg-benefit-100",
    fg: "text-benefit-700",
    dot: "bg-benefit-700",
  },
  limit: {
    text: "Ranked lower",
    bg: "bg-caution-100",
    fg: "text-caution-700",
    dot: "bg-caution-700",
  },
  avoid: {
    text: "Ranked lower",
    bg: "bg-avoid-100",
    fg: "text-avoid-700",
    dot: "bg-avoid-700",
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

  // The icon shape (check/triangle/x) already carries the beneficial/limit/
  // avoid meaning independent of color (T6A: no color-only signals). But
  // when the text label is hidden (`label={false}`), nothing in the DOM
  // names that meaning for screen readers, since the icon itself is
  // decorative markup — so keep a visually-hidden label as the chip's
  // accessible name in that case, and mark the icon `aria-hidden` either
  // way (it's redundant with the label text when visible).
  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-sans text-xs font-semibold ${c.fg} ${className}`}
      >
        <span
          className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-full ${c.dot} text-white`}
        >
          <Icon name={GLYPHS[signal]} size={12} aria-hidden="true" />
        </span>
        {showLabel ? <span>{labelText}</span> : <span className="sr-only">{labelText}</span>}
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
        <Icon name={GLYPHS[signal]} size={13} aria-hidden="true" />
      </span>
      {showLabel ? <span>{labelText}</span> : <span className="sr-only">{labelText}</span>}
    </span>
  );
}
