/**
 * CategoryCard — food category tile with icon + label.
 *
 * Props (unchanged): category, count, onClick
 * Icons now use Material Symbols Rounded instead of emoji.
 */

const CATEGORY_CONFIG = {
  Vegetables: { icon: "nutrition", bg: "bg-forest-50", fg: "text-forest-600" },
  Fruits: { icon: "nutrition", bg: "bg-honey-50", fg: "text-honey-600" },
  "Nuts & Seeds": { icon: "spa", bg: "bg-honey-50", fg: "text-honey-700" },
  Fish: { icon: "set_meal", bg: "bg-signal-info-tint", fg: "text-signal-info" },
  Legumes: { icon: "grass", bg: "bg-forest-50", fg: "text-forest-600" },
  Grains: { icon: "grain", bg: "bg-honey-50", fg: "text-honey-600" },
  Dairy: { icon: "water_drop", bg: "bg-signal-info-tint", fg: "text-signal-info" },
  Antioxidants: { icon: "local_cafe", bg: "bg-honey-50", fg: "text-honey-700" },
  "Spices & Herbs": { icon: "eco", bg: "bg-forest-50", fg: "text-forest-600" },
  Processed: { icon: "warning", bg: "bg-signal-avoid-tint", fg: "text-signal-avoid" },
};

const DEFAULT_CONFIG = { icon: "restaurant", bg: "bg-sand-100", fg: "text-char-500" };

export default function CategoryCard({ category, count, onClick }) {
  const { icon, bg, fg } = CATEGORY_CONFIG[category] ?? DEFAULT_CONFIG;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white
        border border-sand-200 shadow-card min-w-[80px]
        transition-all duration-base ease-ds-out
        hover:-translate-y-[2px] hover:shadow-lg
        active:translate-y-[1px] active:scale-[0.99]"
    >
      <div
        className={`w-12 h-12 rounded-lg flex items-center justify-center ${bg} ${fg}`}
      >
        <span className="material-symbols-rounded" style={{ fontSize: 24 }}>
          {icon}
        </span>
      </div>
      <span className="text-xs font-semibold text-char-900 text-center leading-tight font-sans">
        {category}
      </span>
      {count !== undefined && (
        <span className="text-xs text-char-400 font-mono">{count}</span>
      )}
    </button>
  );
}
