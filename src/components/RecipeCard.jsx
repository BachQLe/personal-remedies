/**
 * RecipeCard — universal recipe card with location-driven variant.
 *
 * Props:
 *   recipe        — Recipe from api (has id, title, photo, matchedConditions, ingredients)
 *   context       — 'browse' | 'planner' — determines which actions show
 *   onViewRecipe  — callback(recipe) — always present
 *   onAddToPlanner — callback(recipe) — browse context: calendar-plus icon
 *   onFavorite    — callback(recipe) — planner context: heart icon
 *
 * Save-verb semantics:
 *   - BookmarkPlus = ingredients (IngredientCard only)
 *   - Heart = recipes/meals (this component, planner context)
 *   - Calendar = add to planner (this component, browse context)
 *   Icons are NEVER shared across ingredient/recipe boundaries.
 */
import { Calendar, Heart, ExternalLink } from 'lucide-react';

/**
 * @param {Object} props
 * @param {import('../api/types.js').Recipe} props.recipe
 * @param {'browse' | 'planner'} [props.context]
 * @param {(recipe: import('../api/types.js').Recipe) => void} [props.onViewRecipe]
 * @param {(recipe: import('../api/types.js').Recipe) => void} [props.onAddToPlanner]
 * @param {(recipe: import('../api/types.js').Recipe) => void} [props.onFavorite]
 */
export default function RecipeCard({
  recipe,
  context = 'browse',
  onViewRecipe,
  onAddToPlanner,
  onFavorite,
}) {
  const handleView = () => {
    if (onViewRecipe) onViewRecipe(recipe);
  };

  const handleCornerAction = (e) => {
    e.stopPropagation();
    if (context === 'browse' && onAddToPlanner) {
      onAddToPlanner(recipe);
    } else if (context === 'planner' && onFavorite) {
      onFavorite(recipe);
    }
  };

  return (
    <div
      className="relative w-full bg-white rounded-xl border border-sand-200
        shadow-xs
        transition-all duration-base ease-ds-out
        hover:border-forest-300 hover:shadow-card hover:-translate-y-[1px]
        active:translate-y-[1px] active:scale-[0.99]"
    >
      {/* Photo area */}
      <div className="relative w-full h-36 bg-paper-200 rounded-xl overflow-hidden">
        {recipe.photo ? (
          <img
            src={recipe.photo}
            alt={recipe.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-forest-50">
            <span className="font-display text-3xl font-semibold text-forest-300">
              {recipe.title?.[0] || ''}
            </span>
          </div>
        )}

        {/* Corner action icon */}
        <button
          onClick={handleCornerAction}
          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm
            flex items-center justify-center shadow-sm
            transition-all duration-fast
            hover:bg-white hover:shadow-md active:scale-95"
          aria-label={
            context === 'browse'
              ? `Add ${recipe.title} to planner`
              : `Favorite ${recipe.title}`
          }
        >
          {context === 'browse' ? (
            <Calendar size={16} className="text-forest-700" />
          ) : (
            <Heart size={16} className="text-lavender-600" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="-mt-14 relative z-20 bg-white rounded-t-2xl p-3.5 flex flex-col gap-2">
        <p className="font-sans font-semibold text-char-900 text-sm leading-snug line-clamp-2">
          {recipe.title}
        </p>

        {recipe.sourceName && (
          <p className="text-xs text-char-500">{recipe.sourceName}</p>
        )}

        {/* Bottom row: view recipe + planner "add to menu" */}
        <div className="flex items-center justify-between mt-1">
          <button
            onClick={handleView}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-forest-700
              hover:text-forest-900 transition-colors duration-fast"
          >
            <ExternalLink size={13} />
            View recipe
          </button>

          {context === 'planner' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onAddToPlanner) onAddToPlanner(recipe);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill
                text-[11px] font-semibold bg-forest-700 text-white
                hover:bg-forest-800 transition-colors duration-fast
                active:scale-[0.97]"
            >
              <Calendar size={12} />
              Add to menu
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
