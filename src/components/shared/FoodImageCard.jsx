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
 *   mealTag         — meal-type corner chip, top-left: a PLAN_SLOT_KEYS
 *                     string (rendered via MealTypeTag) or a React node
 *                     rendered as-is. Independent of `badge`/`action`.
 *   numericId       — Nutridigm verdict ladder id (1-7); renders a 3-star /
 *                     3-skull row above the title. Null/undefined renders
 *                     nothing (never show a fake rating); 4 (neutral)
 *                     renders a single outline star (temporary placeholder).
 *   title           — card heading (displayed at bottom)
 *   subtitle        — smaller text below title (lead ingredients, description, etc.)
 *   aspectRatio     — aspect ratio string, default '4/5' (full-screen mobile)
 *   onClick         — callback on card tap
 *   onBadgeClick    — callback on badge click (optional)
 *   className       — additional classes
 *   gradient        — optional gradient direction, default 'from-char-900/85 via-char-900/20 to-transparent'
 *   action          — optional action element (renders in top-right overlay)
 *   actionOnClick   — callback for action button
 *   actionLabel     — accessible name for the action button, used only when
 *                     `action` is a plain node (not a function) — a
 *                     function-valued `action` is expected to be a
 *                     self-contained, already-labeled element (same
 *                     convention as `saveAction`), so this is ignored then.
 *   saveActionPosition — 'bottom' (default) or 'top': which corner the
 *                     `saveAction` overlay sits in. 'top' puts it top-right,
 *                     the MealprepCarousel/home-screen placement, which keeps
 *                     the bottom of the card clear for the title block.
 *                     Callers that also pass `action` (its own top-right
 *                     overlay) should leave this at 'bottom'.
 *   dimImage        — darken the photo (brightness 0.75, same as the home
 *                     screen's carousel cards) so overlaid white text stays
 *                     legible against bright food photography. Off by
 *                     default; the gradient alone is enough on small cards.
 *   saveAction      — optional save-button element (renders in bottom-right
 *                     overlay; independent of `action`/`badge`). Supports a
 *                     plain node or a function (same convention as `action`),
 *                     but — unlike `action` — is rendered as-is with no extra
 *                     click wrapper, since a `saveAction` node (e.g.
 *                     SaveButton) is expected to be self-contained and handle
 *                     its own click/keyboard/stopPropagation.
 *   loading         — 'lazy' | 'eager', default 'lazy'
 *   nonFoodIcon     — lucide icon name (see Icon.jsx's ICON_MAP), optional.
 *                     When set, renders a category-icon tile INSTEAD of
 *                     `image` — the non-food rendering rule (master plan
 *                     1.10, decision j: coarse group 'k' / fine group
 *                     'x'/'j1' items never get a stock food photo). Resolve
 *                     it via `getNonFoodIcon(group, fineGroup)` from
 *                     ../../api/ingredientImages.js and pass the result
 *                     here; `undefined`/`null` (the default) renders `image`
 *                     exactly as before, so every existing caller is
 *                     unaffected until it opts in. No current caller passes
 *                     this yet — wiring it into SlotSection/MealQueueScreen/
 *                     etc. call sites is a follow-up (those files sit
 *                     outside this task's ownership), same pattern as
 *                     recipeDetail.js's `sourceUrl`/`realIngredients` gap.
 *
 * Styling:
 *   - Uses Tailwind with preset colors (char-900, forest-700, etc.)
 *   - Rounded corners with shadow
 *   - Hover: slight lift (-translate-y), enhanced shadow
 *   - Active: press-down (translate-y), slight scale
 */

import FoodRating from './FoodRating.jsx';
import MealTypeTag from './mealTypeMeta.jsx';
import Icon from './Icon.jsx';

/**
 * @param {Object} props
 * @param {string} props.id
 * @param {string} props.image
 * @param {string} [props.imageAlt]
 * @param {string | {label: string, variant?: string}} [props.badge]
 * @param {string | React.ReactNode} [props.mealTag]
 * @param {number | null} [props.numericId]
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {string} [props.aspectRatio]
 * @param {(id: string) => void} [props.onClick]
 * @param {() => void} [props.onBadgeClick]
 * @param {string} [props.className]
 * @param {string} [props.gradient]
 * @param {React.ReactNode} [props.action]
 * @param {() => void} [props.actionOnClick]
 * @param {string} [props.actionLabel]
 * @param {React.ReactNode | (() => React.ReactNode)} [props.saveAction]
 * @param {'top' | 'bottom'} [props.saveActionPosition]
 * @param {boolean} [props.dimImage]
 * @param {'lazy' | 'eager'} [props.loading]
 * @param {string} [props.nonFoodIcon] - lucide icon name; renders instead of `image` (see prop doc above)
 */
export default function FoodImageCard({
  id,
  image,
  imageAlt = '',
  badge,
  mealTag,
  numericId,
  title,
  subtitle,
  aspectRatio = '4/5',
  onClick,
  onBadgeClick,
  className = '',
  gradient = 'from-char-900/85 via-char-900/20 to-transparent',
  action,
  actionOnClick,
  actionLabel,
  saveAction,
  saveActionPosition = 'bottom',
  dimImage = false,
  loading = 'lazy',
  nonFoodIcon = null,
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
      {/* Image background — `nonFoodIcon` (non-food rendering rule, master
          plan 1.10) always wins over `image`: a category icon tile instead
          of a photo for coarse group 'k' / fine group 'x'/'j1' items. */}
      {nonFoodIcon ? (
        <div className="absolute inset-0 flex items-center justify-center bg-sand-100">
          <Icon name={nonFoodIcon} size={40} className="text-char-400" aria-hidden="true" />
        </div>
      ) : typeof image === 'string' ? (
        <img
          src={image}
          alt={imageAlt}
          className={`absolute inset-0 w-full h-full object-cover ${dimImage ? 'brightness-[0.75]' : ''}`}
          loading={loading}
        />
      ) : (
        <div className="absolute inset-0">{image}</div>
      )}

      {/* Gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-t ${gradient}`} />

      {/* Badge at top-left */}
      {badgeLabel && (
        <span
          role="button"
          tabIndex={0}
          onClick={handleBadgeClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleBadgeClick(e);
            }
          }}
          className={`tap-target absolute top-3 left-3 inline-flex items-center rounded-full
            px-2.5 py-1 text-[11px] font-semibold font-sans cursor-pointer
            transition-all duration-fast hover:scale-105 active:scale-95
            ${badgeVariantClasses[badgeVariant] || badgeVariantClasses.primary}`}
        >
          {badgeLabel}
        </span>
      )}

      {/* Meal-type tag at top-left (optional; independent of badge) */}
      {mealTag && (
        <div className="absolute top-3 left-3 z-10">
          {typeof mealTag === 'string' ? <MealTypeTag mealKey={mealTag} /> : mealTag}
        </div>
      )}

      {/* Action button at top-right (optional) */}
      {action && (
        <div className="absolute top-3 right-3 z-10">
          {typeof action === 'function' ? (
            action()
          ) : (
            <span
              role="button"
              tabIndex={0}
              onClick={handleActionClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleActionClick(e);
                }
              }}
              aria-label={actionLabel}
              className="tap-target w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm
                flex items-center justify-center shadow-sm cursor-pointer
                transition-all duration-fast
                hover:bg-white hover:shadow-md active:scale-95"
            >
              {action}
            </span>
          )}
        </div>
      )}

      {/* Save button at bottom-right (optional; independent of action/badge).
          Rendered as-is (no extra click wrapper) — the node is expected to
          be self-contained (e.g. SaveButton), handling its own
          click/keyboard/stopPropagation. */}
      {saveAction && (
        <div className={`absolute right-3 z-10 ${saveActionPosition === 'top' ? 'top-3' : 'bottom-3'}`}>
          {typeof saveAction === 'function' ? saveAction() : saveAction}
        </div>
      )}

      {/* Content at bottom */}
      <div className="absolute inset-x-0 bottom-0 p-4 flex flex-col gap-1">
        <FoodRating numericId={numericId} size={14} className="mb-1" />
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
