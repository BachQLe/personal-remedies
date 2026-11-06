/**
 * PageHeader — shared screen-header block: optional eyebrow, then the title
 * with any trailing controls on the same row, so a header costs as little of
 * the screen as it can.
 *
 * Renders no background — the calling screen owns its own colored header
 * background; this component only supplies the inner padding + typography.
 *
 * @param {string} [label] - Uppercase eyebrow (a section name). Omit when it would only repeat the title.
 * @param {string} [title] - Display title
 * @param {string} [description] - Optional supporting copy under the title
 * @param {React.ReactNode} [right] - Optional trailing element in the title row (e.g. profile button)
 * @param {React.ReactNode} [children] - Rendered after label/title/description, for custom/animated title blocks
 * @param {string} [className] - Extra classes on the root
 */
export default function PageHeader({ label, title, description, right, children, className = '' }) {
  return (
    <div className={`px-5 pt-[max(1rem,var(--safe-top))] ${className}`}>
      {label && (
        <p className="font-label text-xs tracking-widest uppercase text-blue-950/60">
          {label}
        </p>
      )}

      {(title || right) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="min-w-0 flex-auto font-display text-title font-semibold text-blue-950 leading-tight">
            {title}
          </h1>
          {right}
        </div>
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
