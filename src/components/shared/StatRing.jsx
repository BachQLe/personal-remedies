/**
 * StatRing — circular progress ring with centered value.
 *
 * Props:
 *   value, max, label (unchanged)
 *   size (unchanged, default 96)
 *   tone — "forest"|"yellow"|"lavender"|"beneficial"|"limit"|"avoid" (NEW, replaces color)
 *   sublabel — secondary text below value (NEW)
 *   showValue — boolean (NEW, default true)
 *   className (NEW)
 */

const TONES = {
  forest: "var(--forest-600)",
  yellow: "var(--yellow-400)",
  lavender: "var(--lavender-600)",
  beneficial: "var(--benefit-600)",
  limit: "var(--caution-600)",
  avoid: "var(--avoid-600)",
  /* legacy aliases */
  honey: "var(--yellow-400)",
  plum: "var(--lavender-600)",
};

export default function StatRing({
  value = 0,
  max = 100,
  label,
  sublabel,
  tone = "forest",
  size = 96,
  thickness = 9,
  showValue = true,
  className = "",
}) {
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(1, max > 0 ? value / max : 0);
  const offset = circ * (1 - pct);
  const stroke = TONES[tone] || TONES.forest;

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            className="stroke-sand-200"
            strokeWidth={thickness}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 320ms cubic-bezier(0.22,0.61,0.36,1)" }}
          />
        </svg>
        {showValue && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
            <span
              className="font-display font-semibold text-blue-950"
              style={{ fontSize: size * 0.27 }}
            >
              {label != null ? label : `${Math.round(pct * 100)}%`}
            </span>
            {sublabel && (
              <span
                className="text-char-400 font-medium mt-0.5"
                style={{ fontSize: size * 0.12 }}
              >
                {sublabel}
              </span>
            )}
          </div>
        )}
      </div>
      {label != null && sublabel == null && (
        <span className="text-xs text-char-500 font-medium text-center font-sans">
          {label}
        </span>
      )}
    </div>
  );
}
