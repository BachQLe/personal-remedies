/**
 * PlanTabs - the My Favorites | My Meal Plan pair at the top of the plan screen:
 * favorites first, since they are picked before a plan is built. My Favorites is
 * its own screen, so a tap is a real navigation that its back button returns from.
 */
import { useNavigate } from 'react-router-dom';
import PillSwitcher from '../../components/shared/PillSwitcher.jsx';
import { COPY } from './plannerCopy.js';

const TABS = [
  { key: '/app/favorites', label: COPY.favoritesTitle },
  { key: '/app/plan', label: COPY.tabPlan },
];

export default function PlanTabs({ value }) {
  const navigate = useNavigate();
  return (
    <PillSwitcher
      options={TABS}
      value={value}
      onChange={(to) => { if (to !== value) navigate(to); }}
    />
  );
}
