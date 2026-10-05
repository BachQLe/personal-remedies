/**
 * GroupsTab — food-group picker list (all 10 coarse food groups). Moved out
 * of SuggestionsScreen.jsx so it can live as its own tab alongside Top Dos &
 * Don'ts and Best Recipes.
 *
 * Rendered as a single-column list of full-width rows, one per line rather
 * than a 2-column grid — per product direction (older-adult users), each row
 * leads with a real stock photo (COARSE_GROUP_IMAGES, src/assets/food-groups)
 * instead of a lucide icon, sized for a bigger, easier tap target.
 *
 * Tiles carry no per-profile data — labels come from adapter.js's
 * getGroupLabels/getFineGroupLabelsByCoarse (coarse group name plus a
 * preview line of its fine-group names, cached and profile-independent), so
 * this tab needs no profile fetch of its own; labels aren't
 * condition-scored.
 *
 * On failure the list still renders using COARSE_GROUP_LABELS with no
 * fine-group preview line — a deliberate graceful degrade (T5B: KEPT as-is,
 * not routed through the shared error/Retry state-matrix, since the list
 * stays fully usable without the preview line and forcing a Retry panel here
 * would be a strictly worse experience for a cosmetic-only failure).
 *
 * Tapping a row navigates to that group's own detail route
 * (GroupDetailScreen) rather than expanding a panel inline.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { getGroupLabels, getFineGroupLabelsByCoarse } from '../../api/api.js';
import { COARSE_GROUP_LABELS } from '../../api/config.js';
import { COARSE_GROUP_IMAGES } from '../../assets/food-groups/index.js';

// ── CategoryGrid ─────────────────────────────────────────────────────────────
// All 10 coarse food groups as a single-column list of rows — tapping a row
// navigates to /app/suggestions/group/:groupId.

// Shared with GroupDetailScreen for its route-param validation.
// eslint-disable-next-line react-refresh/only-export-components
export const CATEGORY_GRID_GROUPS = ['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'];

// Bespoke skeleton list — same row shape as CategoryGrid, so the
// loading→loaded swap doesn't jump.
function SkeletonGrid() {
  return (
    <div className="flex flex-col gap-2.5">
      {CATEGORY_GRID_GROUPS.map((group) => (
        <div
          key={group}
          className="flex items-center gap-3 px-4 py-3 rounded-sm bg-white border border-sand-200 shadow-xs"
        >
          <div className="w-16 h-16 rounded-lg bg-sand-200 animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <div className="h-4 w-1/2 rounded bg-sand-200 animate-pulse" />
            <div className="h-3 w-3/4 rounded bg-sand-200 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CategoryGrid({ coarseLabels, fineLabelsByGroup, onOpen }) {
  return (
    <div className="flex flex-col gap-2.5">
      {CATEGORY_GRID_GROUPS.map((group) => {
        const label = coarseLabels[group] ?? COARSE_GROUP_LABELS[group] ?? group;
        const fineLine = (fineLabelsByGroup[group] ?? []).join(' · ');
        return (
          <button
            key={group}
            onClick={() => onOpen(group)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-sm bg-white border border-sand-200 shadow-xs text-left
              transition-all duration-fast hover:border-forest-300 hover:shadow-card active:scale-[0.99]"
          >
            <img
              src={COARSE_GROUP_IMAGES[group]}
              alt=""
              className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="font-sans text-base font-semibold text-char-900 leading-snug">{label}</p>
              {fineLine && (
                <p className="text-xs font-sans font-semibold uppercase tracking-wide text-char-700 mt-0.5 line-clamp-2">{fineLine}</p>
              )}
            </div>
            <ChevronRight size={16} className="text-char-400 shrink-0" aria-hidden="true" />
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
