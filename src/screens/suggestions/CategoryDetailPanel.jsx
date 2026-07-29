/**
 * CategoryDetailPanel — category explorer drill-down for the Food Groups
 * tab. Backed by the Nutridigm /detailed endpoint (adapter.js
 * getCategoryDetail).
 *
 * Renders inline, directly below the food-group grid (GroupsTab mounts this
 * only while a group tile is "open" — see detailCategory there). A segmented
 * control lets the user flip between Eat / Avoid; only the ACTIVE listType is
 * ever fetched, on demand, the first time its tab is opened — repeat visits
 * to an already-fetched tab are free via adapter.js's cachedFetch (8h TTL).
 * Never prefetches both lists or other groups (daily API rate limit).
 *
 * Tapping a row hands the food up to the parent via onSelectFood, which
 * opens the existing FoodDetailCard (SuggestionsScreen already owns that
 * wiring) — this component does not render FoodDetailCard itself.
 *
 * Closing is owned entirely by the parent (re-tapping the same group tile
 * toggles it away) — this panel has no close affordance of its own.
 *
 * Props:
 *   profile     — Profile (passed through to getCategoryDetail)
 *   group       — coarse food group code (e.g. 'e')
 *   groupLabel  — pre-resolved label (falls back to fetching via getGroupLabel if absent)
 *   hideTitle   — when true, skip rendering the h2 group title (default false —
 *                 e.g. GroupDetailScreen already renders the group name in its
 *                 own header row)
 *   onSelectFood — callback(food) — tap a row → parent opens FoodDetailCard
 */
import { useState, useEffect } from 'react';
import { getCategoryDetail, getGroupLabel } from '../../api/api.js';
import PillSwitcher from '../../components/shared/PillSwitcher.jsx';
import RankedRow from '../../components/shared/RankedRow.jsx';

const LIST_TYPES = [
  { key: 'helpful', label: 'Eat', tone: 'positive' },
  { key: 'harmful', label: 'Avoid', tone: 'negative' },
];

// ── Skeleton row (card-shaped, matches the button-card result rows) ─────────

function SkeletonRow() {
  return <div className="h-[52px] rounded-xl animate-pulse bg-sand-200" />;
}

export default function CategoryDetailPanel({ profile, group, groupLabel: groupLabelProp, hideTitle = false, onSelectFood }) {
  const [listType, setListType] = useState('helpful');
  const [groupLabel, setGroupLabel] = useState(groupLabelProp || '');
  // Per-group cache of already-fetched tabs (state, not a ref, so switching
  // back to an already-fetched listType re-renders from cached data with no
  // network call) so re-opening this panel for the same group doesn't refetch.
  const [resultsByType, setResultsByType] = useState({}); // { [listType]: { items, usedFallback } }
  const [loading, setLoading] = useState(false);

  // Reset per-group state when the panel is pointed at a (possibly new)
  // group. Adjusted during render (React's documented escape hatch for
  // "resetting state when a prop changes" — see
  // https://react.dev/learn/you-might-not-need-an-effect) rather than in an
  // effect, so it takes effect in the same render instead of triggering an
  // extra cascading render.
  const [resetFor, setResetFor] = useState(group);
  if (group !== resetFor) {
    setResetFor(group);
    setResultsByType({});
    setListType('helpful');
    setGroupLabel(groupLabelProp || group || '');
  }

  // Resolve the real group label when the caller didn't already pass one.
  useEffect(() => {
    if (groupLabelProp || !group) return;
    let cancelled = false;
    getGroupLabel(group)
      .then((label) => { if (!cancelled) setGroupLabel(label); })
      .catch(() => { if (!cancelled) setGroupLabel(group); });
    return () => { cancelled = true; };
  }, [group, groupLabelProp]);

  // Fetch only the active listType, once per group+listType.
  useEffect(() => {
    if (!group || !profile) return;
    if (resultsByType[listType]) return; // already fetched (cache hit, no re-render needed)

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await getCategoryDetail(profile, group, listType);
        if (cancelled) return;
        setResultsByType((prev) => ({ ...prev, [listType]: res }));
      } catch {
        if (cancelled) return;
        setResultsByType((prev) => ({ ...prev, [listType]: { items: [], usedFallback: false } }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [group, profile, listType, resultsByType]);

  const active = resultsByType[listType];
  const items = active?.items ?? [];
  const showSkeleton = loading && !active;

  return (
    <div className="flex flex-col gap-3">
      {!hideTitle && (
        <h2 className="font-display text-base font-semibold text-char-900 truncate">
          {groupLabel || 'Category'}
        </h2>
      )}

      {/* Eat / Avoid pill switcher */}
      <PillSwitcher options={LIST_TYPES} value={listType} onChange={setListType} />

      {showSkeleton ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm font-sans text-center py-12 text-char-400">
          Nothing curated here yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((food) => (
            <RankedRow
              key={food.id}
              food={food}
              studyCount={food.referenceTotal}
              onSelect={onSelectFood}
            />
          ))}
        </div>
      )}
    </div>
  );
}
