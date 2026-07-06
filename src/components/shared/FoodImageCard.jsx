/**
 * FoodImageCard — full-screen, image-driven food card with universal layout.
 *
 * Design system component for displaying foods, recipes, and ingredients as image cards
 * with a consistent structure: full-frame image + gradient, badge at top-left, name at
 * bottom, lead ingredients/description in smaller text below.
 *
 * Props:
 *   id              — unique identifier
 *   image           — image URL or React component
 *   imageAlt        — alt text for image (optional)
 *   badge           — { label: string, variant?: 'primary' | 'success' | 'info' } or string
 *   title           — card heading (displayed at bottom)
 *   subtitle        — smaller text below title (lead ingredients, description, etc.)
 *   aspectRatio     — aspect ratio string, default '4/5' (full-screen mobile)
 *   onClick         — callback on card tap
 *   onBadgeClick    — callback on badge click (optional)
 *   className       — additional classes
 *   gradient        — optional gradient direction, default 'from-char-900/85 via-char-900/20 to-transparent'
 *   action          — optional action element (renders in top-right overlay)
 *   actionOnClick   — callback for action button
 *   loading         — 'lazy' | 'eager', default 'lazy'
 *
 * Styling:
 *   - Uses Tailwind with preset colors (char-900, forest-700, etc.)
 *   - Rounded corners with shadow
 *   - Hover: slight lift (-translate-y), enhanced shadow
 *   - Active: press-down (translate-y), slight scale
 */

/**
 * @param {Object} props
 * @param {string} props.id
 * @param {string} props.image
 * @param {string} [props.imageAlt]
 * @param {string | {label: string, variant?: string}} [props.badge]
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {string} [props.aspectRatio]
 * @param {(id: string) => void} [props.onClick]
 * @param {() => void} [props.onBadgeClick]
 * @param {string} [props.className]
 * @param {string} [props.gradient]
 * @param {React.ReactNode} [props.action]
 * @param {() => void} [props.actionOnClick]
 * @param {'lazy' | 'eager'} [props.loading]
 */
export default function FoodImageCard({
  id,
  image,
  imageAlt = '',
  badge,
  title,
  subtitle,
  aspectRatio = '4/5',
  onClick,
  onBadgeClick,
  className = '',
  gradient = 'from-char-900/85 via-char-900/20 to-transparent',
  action,
  actionOnClick,
  loading = 'lazy',
}) {
  const badgeLabel = typeof badge === 'string' ? badge : badge?.label;
  const badgeVariant = badge && typeof badge === 'object' ? badge.variant : 'primary';

  const badgeVariantClasses = {
    primary: 'bg-white/90 text-char-900',
    success: 'bg-benefit-500/90 text-white',
    info: 'bg-blue-500/90 text-white',
  };

  const handleCardClick = () => {
    if (onClick) onClick(id);
  };

  const handleBadgeClick = (e) => {
    e.stopPropagation();
    if (onBadgeClick) onBadgeClick();
  };

  const handleActionClick = (e) => {
    e.stopPropagation();
    if (actionOnClick) actionOnClick();
  };

  return (
    <button
      onClick={handleCardClick}
      className={`relative overflow-hidden rounded-xl text-left
        transition-all duration-base ease-ds-out
        hover:-translate-y-[2px] hover:shadow-lg
        active:translate-y-[1px] active:scale-[0.99]
        ${className}`}
      style={{ aspectRatio: aspectRatio }}
    >
      {/* Image background */}
      {typeof image === 'string' ? (
        <img
          src={image}
          alt={imageAlt}
          className="absolute inset-0 w-full h-full object-cover"
          loading={loading}
        />
      ) : (
        <div className="absolute inset-0">{image}</div>
      )}

      {/* Gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-t ${gradient}`} />

      {/* Badge at top-left */}
      {badgeLabel && (
        <button
          onClick={handleBadgeClick}
          className={`absolute top-3 left-3 inline-flex items-center rounded-full
            px-2.5 py-1 text-[11px] font-semibold font-sans
            transition-all duration-fast hover:scale-105 active:scale-95
            ${badgeVariantClasses[badgeVariant] || badgeVariantClasses.primary}`}
        >
          {badgeLabel}
        </button>
      )}

      {/* Action button at top-right (optional) */}
      {action && (
        <div className="absolute top-3 right-3 z-10">
          {typeof action === 'function' ? (
            action()
          ) : (
            <button
              onClick={handleActionClick}
              className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm
                flex items-center justify-center shadow-sm
                transition-all duration-fast
                hover:bg-white hover:shadow-md active:scale-95"
            >
              {action}
            </button>
          )}
        </div>
      )}

      {/* Content at bottom */}
      <div className="absolute inset-x-0 bottom-0 p-4 flex flex-col gap-1">
        <span className="font-display text-base font-semibold text-white leading-snug">
          {title}
        </span>
        {subtitle && (
          <span className="text-xs font-sans text-white/75 leading-snug">
            {subtitle}
          </span>
        )}
      </div>
    </button>
  );
}
