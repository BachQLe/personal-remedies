/**
 * CategoryDetailPanel — category explorer drill-down for the Food Groups
 * tab. Backed by the Nutridigm /detailed endpoint (adapter.js
 * getCategoryDetail).
 *
 * Renders inline, directly below the group header (its sole caller,
 * GroupDetailScreen, mounts this once for the routed group). A segmented
 * control lets the user flip between Eat / Avoid; only the ACTIVE listType is
 * ever fetched, on demand, the first time its tab is opened. Repeat visits to
 * an already-fetched tab cost no network call either way — adapter.js's own
 * cachedFetch (8h TTL) already makes a re-fetch of the same
 * {conditions, group, listType} a cache hit, so useAsyncData re-running its
 * fetcher on tab-switch-back is free, not a wasted request.
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
 *   group       — coarse food group code (e.g. 'e')
 *   groupLabel  — pre-resolved label (falls back to fetching via getGroupLabel if absent)
 *   hideTitle   — when true, skip rendering the h2 group title (default false —
 *                 e.g. GroupDetailScreen already renders the group name in its
 *                 own header row)
 *   onSelectFood — callback(food) — tap a row → parent opens FoodDetailCard
 *
 * State-matrix (T5B): resolves its own profile (see profileFallback.js) and
 * fetches through useAsyncData, keyed on [group, listType] — real error/
 * offline/no-profile states via the shared DataState, loading keeps this
 * screen's own bespoke SkeletonRow (per DataState's docblock).
 */
import { useState, useEffect } from 'react';
import { getCategoryDetail, getGroupLabel } from '../../api/api.js';
import { MAX_RECOMMENDATIONS_PER_CATEGORY } from '../../api/config.js';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import PillSwitcher from '../../components/shared/PillSwitcher.jsx';
import RankedRow from '../../components/shared/RankedRow.jsx';
import DataState from '../../components/shared/DataState.jsx';
import CoverageNotice from './CoverageNotice.jsx';
import ProfileSetupAction from './ProfileSetupAction.jsx';
import { resolveProfileWithConditions } from './profileFallback.js';

const LIST_TYPES = [
  { key: 'helpful', label: 'Eat', tone: 'positive' },
  { key: 'harmful', label: 'Avoid', tone: 'negative' },
];

// ── Skeleton row (card-shaped, matches the button-card result rows) ─────────

function SkeletonRow() {
  return <div className="h-[52px] rounded-xl animate-pulse bg-sand-200" />;
}

function isItemsEmpty(data) {
  return !(data?.items?.length);
}

export default function CategoryDetailPanel({ group, groupLabel: groupLabelProp, hideTitle = false, onSelectFood }) {
  const [listType, setListType] = useState('helpful');
  const [groupLabel, setGroupLabel] = useState(groupLabelProp || '');

  // Reset per-group UI state when the panel is pointed at a (possibly new)
  // group. Adjusted during render (React's documented escape hatch for
  // "resetting state when a prop changes" — see
  // https://react.dev/learn/you-might-not-need-an-effect) rather than in an
  // effect, so it takes effect in the same render instead of triggering an
  // extra cascading render.
  const [resetFor, setResetFor] = useState(group);
  if (group !== resetFor) {
    setResetFor(group);
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

  async function fetchDetail() {
    const profile = await resolveProfileWithConditions();
    const res = await getCategoryDetail(profile, group, listType);
    return { ...res, requestedConditionIds: profile.conditions };
  }

  const { status, data, retry } = useAsyncData(fetchDetail, [group, listType], {
    isEmpty: isItemsEmpty,
    requiresProfile: true,
  });

  const items = (data?.items ?? []).slice(0, MAX_RECOMMENDATIONS_PER_CATEGORY);

  return (
    <div className="flex flex-col gap-3">
      {!hideTitle && (
        <h2 className="font-display text-base font-semibold text-char-900 truncate">
          {groupLabel || 'Category'}
        </h2>
      )}

      {/* Eat / Avoid pill switcher */}
      <PillSwitcher options={LIST_TYPES} value={listType} onChange={setListType} />

      {status === 'loading' ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}
        </div>
      ) : (
        <DataState
          status={status}
          onRetry={retry}
          screenName={`${groupLabel || 'category'} — ${LIST_TYPES.find((t) => t.key === listType)?.label}`}
          emptyTitle="Nothing curated here yet"
          emptyBody="We don't have items for this group and your conditions right now."
          emptyAction={status === 'empty-no-profile' ? <ProfileSetupAction /> : undefined}
        >
          <div className="flex flex-col gap-2">
            <CoverageNotice usedFallback={!!data?.usedFallback} requestedConditionIds={data?.requestedConditionIds} />
            {items.map((food) => (
              <RankedRow
                key={food.id}
                food={food}
                studyCount={food.referenceTotal}
                onSelect={onSelectFood}
              />
            ))}
          </div>
        </DataState>
      )}
    </div>
  );
}
