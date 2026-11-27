/**
 * PlanTabs - the My Meal Plan | My Favorites pair at the top of the plan screen.
 * My Favorites is its own route, but these are true tabs: a tap REPLACES the
 * history entry (like the Best & Worst tabs), so there is no back stack per tab.
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
