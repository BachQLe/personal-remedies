/**
 * TopDosTab — ranked Top Dos & Don'ts list, rendered via RankedRow as its
 * own tab within Best & Worst Choices. Both directions share adapter.js's cached
 * /topdoordonts@50 call, so fetching them together here costs at most one
 * API request per direction across the whole app.
 *
 * Product rules honored here:
 * - NO tier badges: /topdoordonts carries no tier data — list membership +
 *   rank IS the verdict.
 * - "N studies" is cache-only (getCachedRefCount) — this tab NEVER warms
 *   /references (rate-limit safety); counts appear opportunistically when
 *   some other surface (FoodDetailCard, Food Groups) already cached them.
 * - Lifestyle items (Exercise, Smoking, …) stay inline in rank order,
 *   structurally identical to ordinary food rows — no chip, no icon, no
 *   separate notes/description text; nothing visually marks a row as
 *   lifestyle vs. food.
 * - RankedRow's `imageRight` image-card layout is enabled here (and only
 *   here — CategoryDetailPanel keeps the plain text row): each row shows
 *   the item's resolved photo over its right half, fading into the white
 *   row background via stacked bars (see RankedRow's header doc). This tab
 *   never surfaces a "showing demo/fallback condition data" notice either —
 *   CoverageNotice is intentionally not rendered here.
 *
 * State-matrix (T5B): both directions are fetched together through a single
 * useAsyncData call (src/hooks/useAsyncData.js) so loading/error/offline/
 * no-profile render via the shared DataState — a real Retry affordance
 * replaces the old silent "degrade to empty items on error" behavior.
 * Switching Do/Don't is a pure client-side selection over already-fetched
 * data, not a new fetch.
 */
import { useState } from 'react';
import { getTopDosAndDonts, getCachedRefCount } from '../../api/api.js';
import { MAX_RECOMMENDATIONS_PER_CATEGORY } from '../../api/config.js';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import PillSwitcher from '../../components/shared/PillSwitcher.jsx';
import RankedRow from '../../components/shared/RankedRow.jsx';
import DataState from '../../components/shared/DataState.jsx';
import ProfileSetupAction from './ProfileSetupAction.jsx';
import { resolveProfileWithConditions } from './profileFallback.js';

// ── Skeleton (card-shaped rows to match the button-card list; bespoke —
// kept for 'loading' per DataState's docblock rather than its generic one) ──

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="relative flex items-center gap-3 min-h-[68px] py-3 px-4 rounded-xl bg-white border border-sand-200 shadow-xs overflow-hidden">
          <div className="h-3.5 flex-1 rounded animate-pulse bg-sand-200" />
          <div className="absolute inset-y-0 right-0 w-1/2 animate-pulse bg-sand-200" />
        </div>
      ))}
    </div>
  );
}

// ── Fetch ────────────────────────────────────────────────────────────────────

async function fetchBothDirections() {
  const profile = await resolveProfileWithConditions();
  const [consume, avoid] = await Promise.all([
    getTopDosAndDonts(profile, 'consume'),
    getTopDosAndDonts(profile, 'avoid'),
  ]);
  return { consume, avoid, requestedConditionIds: profile.conditions };
}

// Genuinely empty only when BOTH directions came back with nothing — a
// single empty direction (e.g. nothing currently flagged to avoid) is a
// legitimate partial result rendered inline below, not a full empty state.
function isBothDirectionsEmpty(data) {
  return !(data?.consume?.items?.length) && !(data?.avoid?.items?.length);
}

// ── Tab ──────────────────────────────────────────────────────────────────────

export default function TopDosTab({ onSelectFood }) {
  const [direction, setDirection] = useState('consume');

  const { status, data, retry } = useAsyncData(fetchBothDirections, [], {
    isEmpty: isBothDirectionsEmpty,
    requiresProfile: true,
  });

  const activeResult = data?.[direction];
  const items = activeResult?.items ?? [];
  const visibleItems = items.slice(0, MAX_RECOMMENDATIONS_PER_CATEGORY);
  const firstConditionId = data?.requestedConditionIds?.[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      <PillSwitcher
        options={[
          { key: 'consume', label: 'Do', tone: 'neutral' },
          { key: 'avoid', label: "Don't", tone: 'neutral' },
        ]}
        value={direction}
        onChange={setDirection}
        size="sm"
      />

      {status === 'loading' ? (
        <SkeletonRows />
      ) : (
        <DataState
          status={status}
          onRetry={retry}
          screenName="Top Dos & Don'ts"
          emptyTitle="Nothing here yet"
          emptyBody="We don't have dos & don'ts for your conditions right now."
          emptyAction={status === 'empty-no-profile' ? <ProfileSetupAction /> : undefined}
        >
          <div className="flex flex-col gap-2">
            {visibleItems.length === 0 ? (
              <p className="text-sm text-char-500 font-sans text-center py-6">
                {direction === 'consume'
                  ? 'Nothing specific to add right now.'
                  : 'Nothing flagged to avoid right now.'}
              </p>
            ) : (
              visibleItems.map((food) => (
                <RankedRow
                  key={food.id}
                  food={food}
                  studyCount={
                    firstConditionId != null
                      ? getCachedRefCount(food.id, [firstConditionId])
                      : null
                  }
                  onSelect={onSelectFood}
                  imageRight
                />
              ))
            )}
          </div>
        </DataState>
      )}
    </div>
  );
}
