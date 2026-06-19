/**
 * SignalChip — brand-defining food-guidance signal.
 *
 * Props:
 *   signal   — "beneficial" | "limit" | "avoid" (canonical three only)
 *   compact  — boolean (smaller glyph, no pill bg)
 *   label    — false to hide text; string to override default
 *   className
 */

const CONFIG = {
  beneficial: {
    text: "Beneficial",
    bg: "bg-signal-beneficial-tint",
    fg: "text-signal-beneficial",
    dot: "bg-signal-beneficial",
  },
  limit: {
    text: "Limit",
    bg: "bg-signal-limit-tint",
    fg: "text-signal-limit",
    dot: "bg-signal-limit",
  },
  avoid: {
    text: "Avoid",
    bg: "bg-signal-avoid-tint",
    fg: "text-signal-avoid",
    dot: "bg-signal-avoid",
  },
};

const GLYPHS = {
  beneficial: "check",
  limit: "remove",
  avoid: "close",
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
          <span className="material-symbols-rounded" style={{ fontSize: 12 }}>
            {GLYPHS[signal]}
          </span>
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
        <span className="material-symbols-rounded" style={{ fontSize: 13 }}>
          {GLYPHS[signal]}
        </span>
      </span>
      {showLabel && <span>{labelText}</span>}
    </span>
  );
}
