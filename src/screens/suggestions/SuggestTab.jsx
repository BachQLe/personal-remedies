/**
 * SuggestTab — the 17 Nutridigm FINE food groups as tappable photo rows,
 * bucketed under their coarse-family headers. This is the Wave 2 "Suggest"
 * browse surface.
 *
 * Why this is a SEPARATE surface from Food Groups (GroupsTab, the 10 COARSE
 * groups), not a variant of it: Food Groups is the existing "choose this,
 * not that" picker for common food items — coarse, broad buckets like "Meat,
 * Fish & Poultry". Suggest is, in the product's own words, "built for people
 * who are in a restaurant and looking for different food groups" — someone
 * scanning a menu wants "Fish & Seafood" specifically, not all of "Meat,
 * Fish & Poultry". The two food-group taxonomies serve different jobs and
 * must stay visually and navigationally distinct: this tab and its detail
 * route (FineGroupDetailScreen, /app/suggestions/fine/:fineGroupId) never
 * reuse GroupsTab/GroupDetailScreen's components, only their layout PATTERN.
 *
 * Follows GroupsTab.jsx closely:
 *   - Same CategoryGrid-style single-column, full-width photo rows (bigger
 *     tap targets for this app's older-adult users, not a 2-column grid).
 *   - Same bespoke skeleton, shaped like the loaded rows, so the
 *     loading→loaded swap doesn't jump.
 *   - Same graceful-degrade philosophy: this tab carries no per-profile data
 *     (fine-group names aren't condition-scored — getFineFoodGroups() is
 *     cached and profile-independent, same as getGroupLabels()), so there's
 *     no profile fetch here. A failure resolving the
 *     coarse-family HEADER label is cosmetic and falls back to the static
 *     COARSE_GROUP_LABELS map rather than routing through the shared
 *     error/Retry state-matrix — exactly GroupsTab's reasoning for its own
 *     fine-group preview line.
 *
 * Grouping: the 17 rows are bucketed by their `coarse` field (the leading
 * letter of the fine code) rather than rendered as one flat 17-row list — a
 * product call for this app's older-adult users, since 17 undifferentiated
 * rows is too much scrolling. A coarse family with exactly one fine group
 * under it (d "Fruits & Juices", e "Vegetables", f "Breads, Grains, Cereals,
 * Pasta" as of this writing — each flagged BOTH isCoarseFoodGroup and
 * isFineFoodGroup on the very same /foodgroups record, with no real
 * subdivision underneath) never gets its own header: that header's label
 * would be near-identical to the single row's own label, so it would just
 * repeat the row beneath it. This is computed generically off the live
 * bucket size (`bucketFineGroups`), not a hardcoded list of letters, so it
 * stays correct if the API's taxonomy ever changes.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { getGroupLabels, getFineFoodGroups } from '../../api/api.js';
import { COARSE_GROUP_LABELS } from '../../api/config.js';
import { FINE_GROUP_IMAGES } from '../../assets/food-groups/index.js';

// ── Bucketing ────────────────────────────────────────────────────────────────

/**
 * Buckets a flat `getFineFoodGroups()` menu into coarse-family groups,
 * preserving the input's order (ascending by code, so each coarse family's
 * entries are already contiguous — see getFineFoodGroups's own docblock).
 * Exported for the "coarse-family bucketing" unit test.
 * @param {Array<{code: string, label: string, coarse: string}>} fineGroups
 * @returns {Array<{coarse: string, groups: Array<{code: string, label: string, coarse: string}>}>}
 */
// eslint-disable-next-line react-refresh/only-export-components
export function bucketFineGroups(fineGroups) {
  const buckets = [];
  const byCoarse = new Map();
  for (const fg of fineGroups ?? []) {
    let bucket = byCoarse.get(fg.coarse);
    if (!bucket) {
      bucket = { coarse: fg.coarse, groups: [] };
      byCoarse.set(fg.coarse, bucket);
      buckets.push(bucket);
    }
    bucket.groups.push(fg);
  }
  return buckets;
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

// Static shape used ONLY to size/shape the loading skeleton so it roughly
// matches the loaded layout and the swap doesn't jump. The real bucketing
// rendered once loaded always comes from the live getFineFoodGroups()
// result via bucketFineGroups — never this constant.
const SKELETON_BUCKETS = [
  ['b1', 'b2', 'b3'],
  ['c1', 'c2', 'c3'],
  ['d'],
  ['e'],
  ['f'],
  ['g1', 'g2'],
  ['h1', 'h2'],
  ['i1', 'i2'],
  ['k1', 'k2'],
];

function SkeletonTile() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-sm bg-white border border-sand-200 shadow-xs">
      <div className="w-16 h-16 rounded-lg bg-sand-200 animate-pulse flex-shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="h-4 w-1/2 rounded bg-sand-200 animate-pulse" />
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="flex flex-col gap-4">
      {SKELETON_BUCKETS.map((codes, i) => (
        <div key={i} className="flex flex-col gap-2.5">
          {codes.length > 1 && (
            <div className="h-3 w-28 rounded bg-sand-200 animate-pulse mb-0.5 ml-1" />
          )}
          {codes.map((code) => <SkeletonTile key={code} />)}
        </div>
      ))}
    </div>
  );
}

// ── FineGroupList ────────────────────────────────────────────────────────────

function FineGroupList({ fineGroups, coarseLabels, onOpen }) {
  const buckets = bucketFineGroups(fineGroups);
  return (
    <div className="flex flex-col gap-4">
      {buckets.map((bucket) => (
        <div key={bucket.coarse} className="flex flex-col gap-2.5">
          {/* Single-fine-group families (d/e/f today) skip the header — see
              docblock above. */}
          {bucket.groups.length > 1 && (
            <h2 className="text-xs font-sans font-semibold uppercase tracking-wide text-char-700 px-1">
              {coarseLabels[bucket.coarse] ?? COARSE_GROUP_LABELS[bucket.coarse] ?? bucket.coarse}
            </h2>
          )}
          {bucket.groups.map((fg) => (
            <button
              key={fg.code}
              onClick={() => onOpen(fg.code)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-sm bg-white border border-sand-200 shadow-xs text-left
                transition-all duration-fast hover:border-forest-300 hover:shadow-card active:scale-[0.99]"
            >
              <img
                src={FINE_GROUP_IMAGES[fg.code]}
                alt=""
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="font-sans text-base font-semibold text-char-900 leading-snug">{fg.label}</p>
              </div>
              <ChevronRight size={16} className="text-char-400 shrink-0" aria-hidden="true" />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Tab ──────────────────────────────────────────────────────────────────────

export default function SuggestTab() {
  const navigate = useNavigate();
  const [fineGroups, setFineGroups] = useState([]);
  const [coarseLabels, setCoarseLabels] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getFineFoodGroups(), getGroupLabels()])
      .then(([groups, { coarse }]) => {
        if (cancelled) return;
        setFineGroups(groups);
        setCoarseLabels(Object.fromEntries(coarse));
      })
      .catch((err) => {
        console.error('SuggestTab: failed to load fine food groups', err);
        // Graceful fallback — same reasoning as GroupsTab: no profile/health
        // data is at stake here, so a failed label fetch degrades to an
        // empty list rather than a hard error/Retry panel. getFineFoodGroups
        // reads a bundled local table (no network round trip), so this path
        // is expected to be effectively unreachable in practice.
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
        <FineGroupList
          fineGroups={fineGroups}
          coarseLabels={coarseLabels}
          onOpen={(code) => navigate('/app/suggestions/fine/' + code)}
        />
      )}
    </div>
  );
}
