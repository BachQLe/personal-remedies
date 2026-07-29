/**
 * PageHeader — shared screen-header block (uppercase label + 32px title).
 *
 * Unifies the label/title markup duplicated across HomeScreen and
 * MealQueueScreen so the label + title always land in the same position.
 * Renders no background — the calling screen owns its own colored header
 * background (e.g. `bg-forest-300 px-5 pt-10 pb-4`); this component only
 * supplies the inner padding + typography.
 *
 * @param {string} label - Uppercase eyebrow label (e.g. "Home", "Plan")
 * @param {string} [title] - 32px display title
 * @param {string} [description] - Optional supporting copy under the title
 * @param {React.ReactNode} [right] - Optional trailing element in the label row (e.g. profile button)
 * @param {React.ReactNode} [children] - Rendered after label/title/description, for custom/animated title blocks
 * @param {string} [className] - Extra classes on the root
 */
export default function PageHeader({ label, title, description, right, children, className = '' }) {
  return (
    <div className={`px-5 pt-10 ${className}`}>
      <div className="flex items-start justify-between">
        <p className="font-label text-xs tracking-widest uppercase text-blue-950/60">
          {label}
        </p>
        {right}
      </div>

      {title && (
        <h1 className="font-display text-[32px] font-semibold text-blue-950 leading-tight mt-2">
          {title}
        </h1>
      )}

      {description && (
        <p className="text-sm text-blue-950/70 font-sans mt-1">
          {description}
        </p>
      )}

      {children}
    </div>
  );
}
