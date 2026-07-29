/**
 * GlassPanel — translucent "glass" container that sits below a screen header.
 *
 * Extracted from MealQueueScreen's glass panel. Must sit on a colored page
 * background (e.g. `bg-forest-300`) for the translucency to read — it has no
 * bottom border by design, so it bleeds off the bottom edge of the screen.
 * Inset from the screen's left/right edges (so the page background shows on
 * both sides all the way down) but not the bottom — the top corners are
 * rounded and the panel still bleeds off the bottom edge. Typically paired
 * with the `-mb-28` (root) / `pb-28` (this panel) navbar clearance pattern so
 * the panel's own background paints behind the navbar.
 *
 * @param {React.ReactNode} children
 * @param {string} [className] - Extra classes (e.g. layout/padding overrides)
 * @param {React.CSSProperties} [style] - Extra inline styles, merged after the glass defaults
 */
export default function GlassPanel({ children, className = '', style = {} }) {
  return (
    <div
      className={`flex-1 mx-4 px-4 pt-5 pb-28 flex flex-col gap-8 ${className}`}
      style={{
        backgroundColor: 'rgba(255,255,255,0.22)',
        borderTop: '1px solid rgba(255,255,255,0.45)',
        borderLeft: '1px solid rgba(255,255,255,0.45)',
        borderRight: '1px solid rgba(255,255,255,0.45)',
        borderRadius: '24px 24px 0 0',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
