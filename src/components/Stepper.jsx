/**
 * Stepper — increment / decrement control.
 *
 * Props (unchanged): value, min, max, onChange
 */
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
        <span className="material-symbols-rounded" style={{ fontSize: 20 }}>remove</span>
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
        <span className="material-symbols-rounded" style={{ fontSize: 20 }}>add</span>
      </button>
    </div>
  );
}
