/**
 * PillSwitcher — full-width segmented pill tab switcher with a sliding thumb.
 *
 * Shared across Do/Don't and Eat/Avoid style toggles (e.g. TopDosTab,
 * CategoryDetailPanel, MealQueueScreen, MealPlannerPicker, SuggestionsScreen)
 * so the segmented-control look stays consistent instead of each screen
 * hand-rolling its own. The selected state
 * is drawn as a single absolutely-positioned thumb that slides + recolors
 * behind the buttons, rather than each button toggling its own background.
 *
 * @param {{key: string, label: string, tone?: 'positive'|'negative'|'neutral'}[]} options
 * @param {string} value - Currently selected option key
 * @param {(key: string) => void} onChange
 * @param {string} [className] - Extra classes on the container
 * @param {'sm'|'md'} [size] - Button vertical padding; 'md' (default, py-3) or 'sm' (py-2)
 * @param {string} [trackClassName] - Background class for the unselected track (default 'bg-white')
 */
export default function PillSwitcher({ options, value, onChange, className = '', size = 'md', trackClassName = 'bg-white' }) {
  const count = options.length;
  const padY = size === 'sm' ? 'py-2' : 'py-3';
  let selectedIndex = options.findIndex((o) => o.key === value);
  if (selectedIndex === -1) selectedIndex = 0;
  const selectedTone = options[selectedIndex]?.tone;

  // Neutral thumb is the app's navy (blue-950) — the same fill as the Plan
  // day strip's selected chip and every primary pill, so a selected segment
  // reads as selected on paper instead of as a faint white-on-sand card.
  // Positive/negative keep green/red: there the color IS the Eat/Avoid signal.
  const thumbClasses =
    selectedTone === 'positive'
      ? 'bg-forest-700'
      : selectedTone === 'negative'
      ? 'bg-red-600'
      : 'bg-blue-950 shadow-xs';

  return (
    <div className={`relative flex ${trackClassName} rounded-pill p-1 w-full ${className}`}>
      {/* Sliding thumb */}
      <div
        className={`absolute rounded-pill transition-transform duration-base ease-ds-out transition-colors ${thumbClasses}`}
        style={{
          width: `calc((100% - 8px) / ${count})`,
          left: '4px',
          top: '4px',
          bottom: '4px',
          transform: `translateX(${selectedIndex * 100}%)`,
        }}
      />

      {options.map(({ key, label }, index) => {
        const isSelected = index === selectedIndex;

        return (
          <button
            key={key}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(key)}
            className={`relative z-10 flex-1 ${padY} rounded-pill text-base font-sans font-semibold transition-colors duration-fast active:scale-[0.99]
              ${isSelected ? 'text-white' : 'text-char-500 hover:text-char-700'}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
