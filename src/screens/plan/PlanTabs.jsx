/**
 * PlanTabs - the My Meal Plan | My Favorites switch at the top of the plan and
 * favorites screens. Route-based: each tab is its own screen, so a tap navigates
 * (replace, so Back doesn't ping-pong between the two tabs).
 */
import { useNavigate } from 'react-router-dom';
import PillSwitcher from '../../components/shared/PillSwitcher.jsx';
import { COPY } from './plannerCopy.js';

const TABS = [
  { key: '/app/plan', label: COPY.tabPlan },
  { key: '/app/favorites', label: COPY.favoritesTitle },
];

export default function PlanTabs({ value }) {
  const navigate = useNavigate();
  return (
    <PillSwitcher
      options={TABS}
      value={value}
      onChange={(to) => { if (to !== value) navigate(to, { replace: true }); }}
    />
  );
}
