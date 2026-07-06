/**
 * TopDosScreen — the ranked "Top Dos & Don'ts" list for the user's profile.
 *
 * Data comes from adapter.getTopDosAndDonts, which shares its cached
 * /topdoordonts@50 call with Dietary Guidance — switching between this
 * screen and Suggestions costs zero extra API requests per direction.
 *
 * Product rules honored here:
 * - NO tier badges: /topdoordonts carries no tier data; list membership +
 *   rank IS the verdict.
 * - "N studies" is cache-only (getCachedRefCount) — this screen NEVER warms
 *   /references (rate-limit safety); counts appear opportunistically when
 *   some other surface (FoodDetail, Dietary Guidance) already cached them.
 * - Lifestyle items (Exercise, Smoking, …) stay inline in rank order with a
 *   "Lifestyle" chip and their cleaned advisory notes.
 */
import { useState, useEffect } from 'react';
import {
  getTopDosAndDonts, getConditionNames, getCachedRefCount,
} from '../../api/api.js';
import { api } from '../../api/api.js';
import { DEFAULT_DEV_CONDITIONS } from '../../api/config.js';
import { cleanNotes } from '../../api/recommendations.js';
import FoodDetail from '../../components/FoodDetail.jsx';
import DemoDataChip from '../../components/shared/DemoDataChip.jsx';

/** Rows shown before the "Show more" button reveals the rest. */
const INITIAL_ROW_COUNT = 15;

const DIRECTIONS = [
  { key: 'consume', label: 'Do' },
  { key: 'avoid', label: "Don't" },
];

// ── Row ──────────────────────────────────────────────────────────────────────

/**
 * One ranked row: rank number, name (+ "Lifestyle" chip), group label,
 * cache-only study count, and cleaned notes sub-line for lifestyle items.
 */
function RankedRow({ food, studyCount, onSelect }) {
  const notes = food.isLifestyle ? cleanNotes(food.notes) : '';

  return (
    <button
      onClick={() => onSelect(food)}
      className="w-full flex items-start gap-3 py-3 px-4 text-left
        transition-colors duration-fast hover:bg-paper-200 active:bg-paper-200"
    >
      {/* Rank */}
      <span className="flex-shrink-0 w-6 pt-0.5 font-mono text-sm text-char-400 text-right">
        {food.rank}
      </span>

      {/* Name + group + notes */}
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="font-sans text-sm font-semibold text-char-900">
            {food.name}
          </span>
          {food.isLifestyle && (
            <span className="inline-flex items-center h-[18px] px-2 rounded-pill
              bg-sand-100 border border-sand-200 text-[10px] font-semibold font-sans text-char-500">
              Lifestyle
            </span>
          )}
        </span>
        {food.groupLabel && (
          <span className="block text-[11px] text-char-400 font-sans mt-0.5 truncate">
            {food.groupLabel}
          </span>
        )}
        {notes && (
          <span className="block text-xs text-char-500 font-sans mt-1 leading-snug">
            {notes}
          </span>
        )}
      </span>

      {/* Cache-only study count — render only when a real number is known */}
      {typeof studyCount === 'number' && studyCount > 0 && (
        <span className="flex-shrink-0 pt-0.5 text-[11px] text-char-400 font-sans whitespace-nowrap">
          {studyCount} {studyCount === 1 ? 'study' : 'studies'}
        </span>
      )}
    </button>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div className="bg-white rounded-2xl border border-sand-200 divide-y divide-sand-100">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="flex items-center gap-3 py-3.5 px-4">
          <div className="w-5 h-3.5 rounded animate-pulse bg-sand-200 flex-shrink-0" />
          <div className="h-3.5 flex-1 rounded animate-pulse bg-sand-200" />
          <div className="h-3 w-12 rounded animate-pulse bg-sand-200 flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function TopDosScreen() {
  const [profile, setProfile] = useState(null);
  const [direction, setDirection] = useState('consume');
  // Per-direction results — fetched lazily on first activation of each side;
  // the shared adapter cache makes repeat switches free.
  const [results, setResults] = useState({ consume: null, avoid: null });
  const [expanded, setExpanded] = useState({ consume: false, avoid: false });
  const [conditionNames, setConditionNames] = useState([]);
  const [selectedFood, setSelectedFood] = useState(null);

  // Profile with the DEFAULT_DEV_CONDITIONS fallback (same pattern as
  // SuggestionsScreen) so an empty/legacy profile still gets demo data.
  useEffect(() => {
    api.getProfile().then((p) => {
      const conditions = p?.conditions?.length ? p.conditions : DEFAULT_DEV_CONDITIONS;
      setProfile({ ...(p ?? {}), conditions });
    });
  }, []);

  // One-line condition context under the title.
  useEffect(() => {
    if (!profile?.conditions?.length) { setConditionNames([]); return; }
    let cancelled = false;
    getConditionNames(profile.conditions)
      .then((names) => { if (!cancelled) setConditionNames(names ?? []); })
      .catch(() => { if (!cancelled) setConditionNames([]); });
    return () => { cancelled = true; };
  }, [profile]);

  // Lazy per-direction fetch — runs when a side is first activated, then the
  // guard short-circuits (data stays in memory for the session).
  useEffect(() => {
    if (!profile || results[direction]) return;
    let cancelled = false;
    getTopDosAndDonts(profile, direction)
      .then((res) => {
        if (!cancelled) setResults((prev) => ({ ...prev, [direction]: res }));
      })
      .catch((err) => {
        console.error('TopDosScreen: getTopDosAndDonts failed', err);
        if (!cancelled) {
          setResults((prev) => ({ ...prev, [direction]: { items: [], usedFallback: false } }));
        }
      });
    return () => { cancelled = true; };
  }, [profile, direction, results]);

  const current = results[direction];
  const loading = !current;
  const items = current?.items ?? [];
  const isExpanded = expanded[direction];
  const visibleItems = isExpanded ? items : items.slice(0, INITIAL_ROW_COUNT);
  const hiddenCount = items.length - visibleItems.length;
  const firstConditionId = profile?.conditions?.[0];

  return (
    <div className="flex flex-col gap-5 px-5 pt-6 pb-8 bg-paper-200 min-h-full">
      {/* Header */}
      <div>
        <p className="text-[12px] text-char-500 font-label tracking-[0.14em] uppercase">Personal Remedies</p>
        <h1 className="font-display text-2xl font-semibold text-blue-950 tracking-tightish">
          Top Dos &amp; Don&apos;ts
        </h1>
        {conditionNames.length > 0 && (
          <p className="text-sm text-char-500 mt-0.5 font-sans truncate">
            For: {conditionNames.slice(0, 2).join(', ')}
            {conditionNames.length > 2 ? ` +${conditionNames.length - 2}` : ''}
          </p>
        )}
        {!loading && current?.usedFallback && (
          <div className="mt-2">
            <DemoDataChip />
          </div>
        )}
      </div>

      {/* Do / Don't segmented control */}
      <div
        role="group"
        aria-label="Switch between dos and don'ts"
        className="flex bg-paper-100 border border-sand-200 rounded-pill p-1"
      >
        {DIRECTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setDirection(key)}
            aria-pressed={direction === key}
            className={`flex-1 py-2 rounded-pill text-sm font-semibold font-sans
              transition-colors duration-fast
              ${direction === key
                ? 'bg-white text-char-900 shadow-xs'
                : 'text-char-500 hover:text-char-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Ranked list */}
      {loading ? (
        <SkeletonRows />
      ) : items.length === 0 ? (
        <p className="text-sm text-char-500 font-sans text-center py-12">
          Nothing here yet. Set up your health profile first.
        </p>
      ) : (
        <div>
          <div className="bg-white rounded-2xl border border-sand-200 divide-y divide-sand-100 overflow-hidden">
            {visibleItems.map((food) => (
              <RankedRow
                key={food.id}
                food={food}
                studyCount={
                  firstConditionId != null
                    ? getCachedRefCount(food.id, [firstConditionId])
                    : null
                }
                onSelect={setSelectedFood}
              />
            ))}
          </div>

          {hiddenCount > 0 && (
            <button
              onClick={() => setExpanded((prev) => ({ ...prev, [direction]: true }))}
              className="w-full mt-3 py-3 rounded-pill border border-sand-200 bg-white
                text-sm font-semibold text-forest-700 font-sans
                transition-colors duration-fast hover:bg-forest-50 active:bg-forest-50"
            >
              Show {hiddenCount} more
            </button>
          )}
        </div>
      )}

      {/* Food detail bottom sheet — works for lifestyle items too */}
      {selectedFood && profile && (
        <FoodDetail
          food={{ id: selectedFood.id, name: selectedFood.name }}
          profile={profile}
          onClose={() => setSelectedFood(null)}
        />
      )}
    </div>
  );
}
