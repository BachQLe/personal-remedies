/**
 * FineGroupDetailScreen — route target for /app/suggestions/fine/:fineGroupId,
 * the Wave 2 "Suggest" browse surface's detail screen.
 *
 * Screen chrome mirrors GroupDetailScreen.jsx (the coarse-group equivalent):
 * lavender page background, PageHeader "Best & Worst Choices" label, a back
 * button + the group's own title in place of the tab switcher, and a
 * GlassPanel content area that bleeds behind the floating TabBar
 * (appshell-cream-fix). Copies the PATTERN, not the component — this screen
 * and GroupDetailScreen are never meant to converge, because coarse (Food
 * Groups) and fine (Suggest) are deliberately separate surfaces serving
 * different jobs (see SuggestTab.jsx's docblock for the full reasoning).
 *
 * Data/state pattern mirrors CategoryDetailPanel.jsx (the coarse group's
 * data panel), inlined here rather than split into its own file since a
 * fine group has no Eat/Avoid split to toggle between — getFineGroupSuggestions
 * returns ONE condition-ranked list spanning the full 1-7 tier spread, and
 * that full spread (Top/Strong/Good matches AND the Avoid end, 5-7) is
 * rendered honestly in a single list. This is the whole point of a browse
 * surface: someone scanning "Fish & Seafood" at a restaurant should see
 * which fish to avoid too, not have the harmful end silently filtered out
 * (contrast the Plan screen's pool, which deliberately filters Plan slots to
 * numericId 1-4 only — a Plan-safety rule that does NOT apply here).
 *   - resolves the profile via resolveProfileWithConditions()
 *   - fetches through useAsyncData with requiresProfile: true
 *   - real error/offline/no-profile states via the shared DataState, with
 *     ProfileSetupAction as the empty-no-profile CTA
 *   - a bespoke skeleton for the loading state (per DataState's own
 *     docblock — screens with their own loading UI should never pass
 *     'loading' through DataState)
 *   - CoverageNotice rendered from usedFallback + requestedConditionIds —
 *     the app's honesty guarantee that a user whose conditions aren't
 *     scored is told so rather than shown fabricated-looking data.
 *
 * Route-param validation: the 17 valid fine-group codes come from
 * getFineFoodGroups() — an async, cached, local-table read, unlike
 * GroupDetailScreen's CATEGORY_GRID_GROUPS (a synchronous hardcoded
 * constant), so this can't check validity on first render the way
 * GroupDetailScreen does. Instead `validCodes` starts `null`
 * ("not yet resolved") and the redirect check only fires once it resolves to
 * a real array that doesn't contain the param — so an invalid code still
 * redirects, but the resolution window never flashes a redirect for a code
 * that simply hasn't been checked yet.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { getFineFoodGroups, getFineGroupSuggestions, getGroupLabel } from '../../api/api.js';
import { MAX_RECOMMENDATIONS_PER_CATEGORY } from '../../api/config.js';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import FoodDetailCard from '../../components/FoodDetailCard.jsx';
import PageHeader from '../../components/shared/PageHeader.jsx';
import GlassPanel from '../../components/shared/GlassPanel.jsx';
import BackButton from '../../components/shared/BackButton.jsx';
import RankedRow from '../../components/shared/RankedRow.jsx';
import DataState from '../../components/shared/DataState.jsx';
import CoverageNotice from './CoverageNotice.jsx';
import ProfileSetupAction from './ProfileSetupAction.jsx';
import { resolveProfileWithConditions } from './profileFallback.js';

// ── Skeleton row (same card shape RankedRow renders, so load→loaded doesn't jump) ─

function SkeletonRow() {
  return <div className="h-[52px] rounded-xl animate-pulse bg-sand-200" />;
}

function isItemsEmpty(data) {
  return !(data?.items?.length);
}

async function fetchFineGroupDetail(fineGroupCode) {
  const profile = await resolveProfileWithConditions();
  const res = await getFineGroupSuggestions(profile, fineGroupCode);
  return { ...res, requestedConditionIds: profile.conditions };
}

export default function FineGroupDetailScreen() {
  const { fineGroupId } = useParams();
  const navigate = useNavigate();
  const [selectedFood, setSelectedFood] = useState(null);
  const [selectedListType, setSelectedListType] = useState(undefined);
  const [groupLabel, setGroupLabel] = useState(fineGroupId);

  // The real 17-code menu, resolved once on mount. `null` means "not yet
  // resolved" (see docblock) — only a real array gates the redirect check
  // below. A failed resolution degrades to an empty array, which (correctly)
  // redirects, since there is then no known-valid code to render against.
  const [validCodes, setValidCodes] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getFineFoodGroups()
      .then((groups) => { if (!cancelled) setValidCodes(groups.map((g) => g.code)); })
      .catch(() => { if (!cancelled) setValidCodes([]); });
    return () => { cancelled = true; };
  }, []);

  // Resolve the real group label (getGroupLabel checks fine groups first —
  // see adapter.js), falling back to the raw code on failure.
  useEffect(() => {
    if (!fineGroupId) return;
    let cancelled = false;
    getGroupLabel(fineGroupId)
      .then((label) => { if (!cancelled) setGroupLabel(label); })
      .catch(() => { if (!cancelled) setGroupLabel(fineGroupId); });
    return () => { cancelled = true; };
  }, [fineGroupId]);

  const { status, data, retry } = useAsyncData(
    () => fetchFineGroupDetail(fineGroupId),
    [fineGroupId],
    { isEmpty: isItemsEmpty, requiresProfile: true }
  );

  // Invalid/unknown fine-group id — bounce back to the Suggest tab rather
  // than rendering a dead-end detail panel. Checked after all hooks above
  // (including useAsyncData's) so the hook call order never changes across
  // renders. Gated on `validCodes` being resolved (see docblock) so an
  // in-flight resolution never flashes a redirect.
  if (validCodes && !validCodes.includes(fineGroupId)) {
    return <Navigate to="/app/suggestions?tab=groups&mode=fine" replace />;
  }

  const items = (data?.items ?? []).slice(0, MAX_RECOMMENDATIONS_PER_CATEGORY);

  function handleSelectFood(food) {
    // No Eat/Avoid tab to forward here (unlike CategoryDetailPanel) — this
    // screen shows one unified ranked list across the full 1-7 spread, so
    // the front-face ordering hint is derived from the tapped item's own
    // numericId instead: 5-7 is the Avoid end (see getFineGroupSuggestions's
    // docblock on why that end is deliberately included, unlike the Plan
    // screen's pool).
    const listType = typeof food.numericId === 'number' && food.numericId >= 5 ? 'harmful' : 'helpful';
    setSelectedFood(food);
    setSelectedListType(listType);
  }

  return (
    // -mb-28 cancels the AppShell main's pb-28 navbar reserve so the
    // background reaches behind the floating TabBar (appshell-cream-fix
    // pattern); GlassPanel's own pb-28 keeps the last row clear of the bar.
    <div className="bg-forest-300 flex flex-col -mb-28" style={{ minHeight: '100dvh' }}>
      <PageHeader label="Best & Worst Choices" className="pb-3">
        <div className="flex items-center gap-3 mt-3">
          {/* Canonical URL, same as the invalid-param redirect above — the
              retired ?tab=suggest still aliases here, but nothing new should
              be written against it. */}
          <BackButton onClick={() => navigate('/app/suggestions?tab=groups&mode=fine')} />
          <h1 className="font-display text-[24px] font-semibold text-blue-950 leading-tight truncate">
            {groupLabel}
          </h1>
        </div>
      </PageHeader>

      {/* Tab content — glass panel bleeds behind the navbar (appshell-cream-fix) */}
      <GlassPanel>
        <div className="flex flex-col gap-3">
          {status === 'loading' ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}
            </div>
          ) : (
            <DataState
              status={status}
              onRetry={retry}
              screenName={`${groupLabel || 'food group'} — Suggest`}
              emptyTitle={status === 'empty' ? null : undefined}
              emptyBody={
                status === 'empty'
                  ? 'There are no common food items within this food group ranked for your health profile.'
                  : undefined
              }
              emptyAction={status === 'empty-no-profile' ? <ProfileSetupAction /> : undefined}
            >
              <div className="flex flex-col gap-2">
                <CoverageNotice usedFallback={!!data?.usedFallback} requestedConditionIds={data?.requestedConditionIds} />
                {items.map((food) => (
                  <RankedRow
                    key={food.id}
                    food={food}
                    studyCount={food.referenceTotal}
                    onSelect={handleSelectFood}
                  />
                ))}
              </div>
            </DataState>
          )}
        </div>
      </GlassPanel>

      {/* Food detail card (self-loads facts + assessment from the id/name).
          group/fineGroup are passed through from the tapped row's own data
          (real values injected by adapter.js's suggestItemToCandidate) as a
          fallback source for FoodDetailCard's non-food icon rule — same
          convention as GroupDetailScreen. listType is derived above from the
          tapped item's own numericId (no Eat/Avoid tab here to forward).
          Rendered unconditionally (not gated behind `{selectedFood && ...}`)
          so FoodDetailCard stays mounted through its own close animation —
          a gating wrapper here would unmount it the instant `onClose` fires,
          before it gets a chance to animate out. */}
      <FoodDetailCard
        item={selectedFood ? {
          foodId: selectedFood.id,
          name: selectedFood.name,
          group: selectedFood.group,
          fineGroup: selectedFood.fineGroup,
        } : null}
        listType={selectedListType}
        open={!!selectedFood}
        onClose={() => {
          setSelectedFood(null);
          setSelectedListType(undefined);
        }}
      />
    </div>
  );
}
