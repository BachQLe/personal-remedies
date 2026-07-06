/**
 * DemoDataChip — subtle "Demo data" pill shown when a result came from
 * the DEFAULT_DEV_CONDITIONS fallback (adapter.js withConditionFallback)
 * instead of the user's actual profile conditions.
 *
 * Muted, small, rounded-full — matches the Pill/ConditionTag chip language
 * in DESIGN_SYSTEM.md. Renders nothing when `show` is false, so callers can
 * mount it unconditionally with `show={usedFallback}`.
 *
 * Props:
 *   show      — boolean, whether to render (default true)
 *   dark      — boolean, use light-on-dark styling for dark screen backgrounds
 *               (e.g. SuggestionsScreen's #111E58) instead of the default
 *               light-surface styling
 *   className
 */
export default function DemoDataChip({ show = true, dark = false, className = '' }) {
  if (!show) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 h-[22px] px-2.5 rounded-pill
        font-sans text-[11px] font-medium
        ${dark
          ? 'bg-white/10 text-white/60 border border-white/10'
          : 'bg-sand-100 text-char-500 border border-sand-200'}
        ${className}`}
    >
      <span className={`w-[6px] h-[6px] rounded-full ${dark ? 'bg-white/40' : 'bg-char-400'}`} />
      Demo data
    </span>
  );
}
