import { useLocation, useNavigate } from 'react-router-dom';
import FoodDetailCard from './FoodDetailCard.jsx';

/**
 * Reopens the food card a user left for another screen (FoodDetailCard's
 * leaveCardFor) when Back lands on the history entry that remembers it, so
 * Health Details -> Other options -> Back returns to those health details.
 * Mounted once in the app shell; each screen's own card state can't survive
 * the route change.
 */
export default function RestoredFoodCard() {
  const location = useLocation();
  const navigate = useNavigate();
  const item = location.state?.reopenCard ?? null;

  const handleClose = () => {
    const state = { ...location.state };
    delete state.reopenCard;
    const { pathname, search, hash } = location;
    navigate({ pathname, search, hash }, { replace: true, state });
  };

  return <FoodDetailCard item={item} open={!!item} onClose={handleClose} />;
}
