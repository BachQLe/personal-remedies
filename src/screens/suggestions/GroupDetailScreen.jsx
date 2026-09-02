/**
 * GroupDetailScreen — route target for /app/suggestions/group/:groupId.
 *
 * Food Groups used to expand CategoryDetailPanel inline under the tapped
 * tile in GroupsTab; that panel now lives on its own route instead, so a
 * specific group is deep-linkable and gets a real back-navigable screen.
 * Mirrors SuggestionsScreen's page scaffolding (lavender background,
 * PageHeader "Guidance" label, GlassPanel content) so the two screens read
 * as the same surface — the header row here swaps the tab switcher for a
 * back button + the group's own title.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { getGroupLabel } from '../../api/api.js';
import { COARSE_GROUP_LABELS } from '../../api/config.js';
import FoodDetailCard from '../../components/FoodDetailCard.jsx';
import PageHeader from '../../components/shared/PageHeader.jsx';
import GlassPanel from '../../components/shared/GlassPanel.jsx';
import BackButton from '../../components/shared/BackButton.jsx';
import CategoryDetailPanel from './CategoryDetailPanel.jsx';
import { CATEGORY_GRID_GROUPS } from './GroupsTab.jsx';

export default function GroupDetailScreen() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [selectedFood, setSelectedFood] = useState(null);
  const [groupLabel, setGroupLabel] = useState(() => COARSE_GROUP_LABELS[groupId] ?? groupId);

  // Resolve the real group label (CATEGORY_GRID_GROUPS's coarse codes only
  // ever hit the `coarse` half of getGroupLabels, but go through the shared
  // getGroupLabel helper so this stays in sync with CategoryDetailPanel).
  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    getGroupLabel(groupId)
      .then((label) => { if (!cancelled) setGroupLabel(label); })
      .catch(() => { if (!cancelled) setGroupLabel(COARSE_GROUP_LABELS[groupId] ?? groupId); });
    return () => { cancelled = true; };
  }, [groupId]);

  // Invalid/unknown group id (typo'd deep link, retired code, etc.) — bounce
  // back to the grid rather than rendering a dead-end detail panel. Checked
  // after all hooks above so the hook call order never changes across
  // renders.
  if (!CATEGORY_GRID_GROUPS.includes(groupId)) {
    return <Navigate to="/app/suggestions?tab=groups" replace />;
  }

  return (
    // -mb-28 cancels the AppShell main's pb-28 navbar reserve so the
    // background reaches behind the floating TabBar (appshell-cream-fix
    // pattern); GlassPanel's own pb-28 keeps the last row clear of the bar.
    <div className="bg-forest-300 flex flex-col -mb-28" style={{ minHeight: '100dvh' }}>
      <PageHeader label="Best & Worst Choices" className="pb-3">
        <div className="flex items-center gap-3 mt-3">
          <BackButton onClick={() => navigate('/app/suggestions?tab=groups')} />
          <h1 className="font-display text-[24px] font-semibold text-blue-950 leading-tight truncate">
            {groupLabel}
          </h1>
        </div>
      </PageHeader>

      {/* Tab content — glass panel bleeds behind the navbar (appshell-cream-fix) */}
      <GlassPanel>
        <CategoryDetailPanel
          group={groupId}
          groupLabel={groupLabel}
          hideTitle
          onSelectFood={setSelectedFood}
        />
      </GlassPanel>

      {/* Food detail card (self-loads facts + assessment from the id/name) */}
      {selectedFood && (
        <FoodDetailCard
          item={{ foodId: selectedFood.id, name: selectedFood.name }}
          open={!!selectedFood}
          onClose={() => setSelectedFood(null)}
        />
      )}
    </div>
  );
}
