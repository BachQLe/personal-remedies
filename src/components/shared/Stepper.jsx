/**
 * Stepper — increment / decrement control.
 *
 * Props (unchanged): value, min, max, onChange
 */
import Icon from "./Icon.jsx";

export default function Stepper({ value, min = 0, max = 99, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-10 h-10 rounded-full border border-sand-200 bg-white
          flex items-center justify-center text-char-900
          disabled:opacity-30
          transition-all duration-fast ease-ds-out
          hover:border-forest-300 hover:bg-forest-50
          active:translate-y-[1px] active:scale-[0.99]"
        aria-label="Decrease"
      >
        {/* Inline minus SVG since lucide Minus is not in Icon map */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <span className="w-8 text-center font-mono font-bold text-char-900 text-lg tabular-nums">
        {value}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-10 h-10 rounded-full bg-forest-700
          flex items-center justify-center text-white
          disabled:opacity-30
          transition-all duration-fast ease-ds-out
          hover:bg-forest-800
          active:translate-y-[1px] active:scale-[0.99]"
        aria-label="Increase"
      >
        <Icon name="plus" size={20} />
      </button>
    </div>
  );
}
