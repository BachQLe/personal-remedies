/**
 * EmptyState — centered zero-data placeholder.
 *
 * Props:
 *   icon  — lucide icon name (kebab-case, e.g. "search")
 *   title — sentence-case heading
 *   body  — supporting copy
 *   action — optional CTA element
 */
import Icon from "./Icon.jsx";

export default function EmptyState({
  icon = "search",
  title,
  body,
  action,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-7 text-center gap-1.5">
      <div className="w-16 h-16 rounded-full bg-forest-50 flex items-center justify-center mb-2.5">
        <Icon name={icon} size={28} className="text-forest-600" />
      </div>
      {title && (
        <p className="font-display font-semibold text-blue-950 text-lg leading-snug">
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
