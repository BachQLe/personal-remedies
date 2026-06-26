/**
 * CategoryCard — food category tile with icon + label.
 *
 * Props (unchanged): category, count, onClick
 * Icons now use lucide Icon component.
 */
import Icon from "./Icon.jsx";

const CATEGORY_CONFIG = {
  Vegetables: { icon: "leaf", bg: "bg-forest-50", fg: "text-forest-600" },
  Fruits: { icon: "leaf", bg: "bg-yellow-50", fg: "text-yellow-600" },
  "Nuts & Seeds": { icon: "leaf", bg: "bg-yellow-50", fg: "text-yellow-700" },
  Fish: { icon: "utensils", bg: "bg-info-100", fg: "text-info-600" },
  Legumes: { icon: "leaf", bg: "bg-forest-50", fg: "text-forest-600" },
  Grains: { icon: "utensils", bg: "bg-yellow-50", fg: "text-yellow-600" },
  Dairy: { icon: "utensils", bg: "bg-info-100", fg: "text-info-600" },
  Antioxidants: { icon: "zap", bg: "bg-yellow-50", fg: "text-yellow-700" },
  "Spices & Herbs": { icon: "leaf", bg: "bg-forest-50", fg: "text-forest-600" },
  Processed: { icon: "alert-triangle", bg: "bg-avoid-100", fg: "text-avoid-600" },
};

const DEFAULT_CONFIG = { icon: "utensils", bg: "bg-sand-100", fg: "text-char-500" };

export default function CategoryCard({ category, count, onClick }) {
  const { icon, bg, fg } = CATEGORY_CONFIG[category] ?? DEFAULT_CONFIG;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 rounded-[28px] bg-white
        border border-sand-200 shadow-card min-w-[80px]
        transition-all duration-base ease-ds-out
        hover:-translate-y-[2px] hover:shadow-lg
        active:translate-y-[1px] active:scale-[0.99]"
    >
      <div
        className={`w-12 h-12 rounded-[14px] flex items-center justify-center ${bg} ${fg}`}
      >
        <Icon name={icon} size={24} />
      </div>
      <span className="text-xs font-semibold text-blue-950 text-center leading-tight font-sans">
        {category}
      </span>
      {count !== undefined && (
        <span className="text-xs text-char-400 font-label uppercase tracking-[.14em]">{count}</span>
      )}
    </button>
  );
}
