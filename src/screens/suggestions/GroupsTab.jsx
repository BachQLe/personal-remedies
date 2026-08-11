/**
 * GroupsTab — food-group picker grid (all 9 coarse food groups). Moved out
 * of SuggestionsScreen.jsx so it can live as its own tab alongside Top Dos &
 * Don'ts and Best Recipes.
 *
 * Tiles carry no per-profile data — labels come from adapter.js's
 * getGroupLabels/getFineGroupLabelsByCoarse (coarse group name plus a
 * preview line of its fine-group names, cached and profile-independent), so
 * this tab needs no profile fetch of its own and no partial-data ("demo
 * guidance") notice — labels aren't condition-scored, so
 * withConditionFallback never applies here.
 *
 * On failure the grid still renders using COARSE_GROUP_LABELS with no
 * fine-group preview line — a deliberate graceful degrade (T5B: KEPT as-is,
 * not routed through the shared error/Retry state-matrix, since the tile
 * grid stays fully usable without the preview line and forcing a Retry
 * panel here would be a strictly worse experience for a cosmetic-only
 * failure).
 *
 * Tapping a tile navigates to that group's own detail route
 * (GroupDetailScreen) rather than expanding a panel inline.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Fish, Egg, Apple, Carrot, Wheat, Milk, Cookie, Soup, Pill,
} from 'lucide-react';
import { getGroupLabels, getFineGroupLabelsByCoarse } from '../../api/api.js';
import { COARSE_GROUP_LABELS } from '../../api/config.js';

// ── CategoryGrid ─────────────────────────────────────────────────────────────
// All 9 coarse food groups as a 2-column grid of tiles — tapping a tile
// navigates to /app/suggestions/group/:groupId.

// Shared with GroupDetailScreen for its route-param validation.
// eslint-disable-next-line react-refresh/only-export-components
export const CATEGORY_GRID_GROUPS = ['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'k'];

const CATEGORY_GRID_ICONS = {
  b: Fish, c: Egg, d: Apple, e: Carrot, f: Wheat, g: Milk, h: Cookie, i: Soup, k: Pill,
};

// Bespoke skeleton grid — same 2-col tile shape as CategoryGrid, so the
// loading→loaded swap doesn't jump.
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {CATEGORY_GRID_GROUPS.map((group) => (
        <div
          key={group}
          className="flex flex-col items-start gap-2 px-3 py-4 rounded-sm bg-white border border-sand-200"
        >
          <div className="w-11 h-11 rounded-lg bg-sand-200 animate-pulse" />
          <div className="h-3.5 w-3/4 rounded bg-sand-200 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function CategoryGrid({ coarseLabels, fineLabelsByGroup, onOpen }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {CATEGORY_GRID_GROUPS.map((group) => {
        const Icon = CATEGORY_GRID_ICONS[group];
        const label = coarseLabels[group] ?? COARSE_GROUP_LABELS[group] ?? group;
        const fineLine = (fineLabelsByGroup[group] ?? []).join(' · ');
        return (
          <button
            key={group}
            onClick={() => onOpen(group)}
            className="flex flex-col items-start gap-2 px-3 py-4 rounded-sm bg-white border border-sand-200 text-left
              transition-colors duration-fast hover:border-forest-300 active:scale-[0.99]"
          >
            <div className="w-11 h-11 rounded-lg bg-forest-50 flex items-center justify-center flex-shrink-0">
              <Icon size={20} className="text-forest-700" />
            </div>
            <div className="min-w-0 w-full">
              <p className="font-sans text-sm font-semibold text-char-900 leading-snug line-clamp-2 min-h-[2.75em]">{label}</p>
              {fineLine && (
                <p className="text-[11px] text-char-400 font-sans mt-0.5 line-clamp-2">{fineLine}</p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Tab ──────────────────────────────────────────────────────────────────────

export default function GroupsTab() {
  const navigate = useNavigate();
  const [coarseLabels, setCoarseLabels] = useState({});
  const [fineLabelsByGroup, setFineLabelsByGroup] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getGroupLabels(), getFineGroupLabelsByCoarse()])
      .then(([{ coarse }, fineByCoarse]) => {
        if (cancelled) return;
        setCoarseLabels(Object.fromEntries(coarse));
        setFineLabelsByGroup(Object.fromEntries(fineByCoarse));
      })
      .catch((err) => {
        console.error('GroupsTab: failed to load group labels', err);
        // Graceful fallback — CategoryGrid already falls back to
        // COARSE_GROUP_LABELS and an empty fine-group line per tile.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-blue-950/70 font-sans">
        Click to see best and worst items from food groups.
      </p>

      {loading ? (
        <SkeletonGrid />
      ) : (
        <CategoryGrid
          coarseLabels={coarseLabels}
          fineLabelsByGroup={fineLabelsByGroup}
          onOpen={(group) => navigate(`/app/suggestions/group/${group}`)}
        />
      )}
    </div>
  );
}
