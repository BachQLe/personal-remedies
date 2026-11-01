import { Link } from 'react-router-dom';
import { COPY, mealsShortOnFavorites } from './plannerCopy.js';

/**
 * Favorites-count nudge (checklist 1.25): with 3 or fewer favorites for a meal,
 * every day of the plan gets the same recipes. Renders nothing once each meal has more.
 *
 * @param {Object} props
 * @param {Object<string, Array>} props.bySlot - favoritesBySlot's result
 */
export default function FavoritesNudge({ bySlot }) {
  const shortMeals = mealsShortOnFavorites(bySlot);
  if (shortMeals.length === 0) return null;
  return (
    <div className="flex flex-col items-start gap-1.5 rounded-xl bg-paper-200 px-4 py-3">
      <p className="font-sans text-sm text-blue-950">{COPY.nudge}</p>
      <p className="font-sans text-xs text-char-500">{COPY.nudgeShort(shortMeals)}</p>
      <Link to="/app/favorites" className="inline-flex min-h-[44px] items-center font-sans text-sm font-semibold text-blue-950 underline underline-offset-2">
        {COPY.goToFavorites}
      </Link>
    </div>
  );
}
