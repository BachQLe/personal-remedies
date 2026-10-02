/**
 * EmptyState — centered zero-data placeholder.
 *
 * Props:
 *   icon  — lucide icon name (kebab-case, e.g. "search")
 *   title — sentence-case heading
 *   body  — supporting copy
 *   action — optional CTA element
 *   size  — "md" (default) or "lg". "lg" scales the icon + title up for
 *           first-run empty states that ARE the whole screen (e.g. Meal
 *           Queue with no plan yet), where the default reads too timid.
 *           Scoped as a prop rather than bumped globally so the many
 *           in-list/in-sheet empty states keep their current proportions.
 *   iconBgClassName / iconClassName — override the icon circle's fill/icon
 *           color (default forest green) for screens where that reads wrong,
 *           e.g. the Plan screen's navy-themed empty state.
 */
import Icon from "./Icon.jsx";

export default function EmptyState({
  icon = "search",
  title,
  body,
  action,
  size = "md",
  iconBgClassName = "bg-forest-50",
  iconClassName = "text-forest-700",
}) {
  const lg = size === "lg";
  return (
    <div className="flex flex-col items-center justify-center py-16 px-7 text-center gap-1.5">
      <div
        className={`${lg ? 'w-20 h-20 mb-4' : 'w-16 h-16 mb-2.5'} rounded-full ${iconBgClassName}
          flex items-center justify-center`}
        aria-hidden="true"
      >
        <Icon name={icon} size={lg ? 36 : 28} className={iconClassName} />
      </div>
      {title && (
        <p
          className={`font-display font-semibold text-blue-950 leading-snug ${
            lg ? 'text-2xl' : 'text-lg'
          }`}
        >
          {title}
        </p>
      )}
      {body && (
        <p className="text-char-500 text-sm max-w-[300px] leading-normal">
          {body}
        </p>
      )}
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  );
}
