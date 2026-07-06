/**
 * CategoryDetailSheet — category explorer drill-down for the Best & Worst
 * tab. Backed by the Nutridigm /detailed endpoint (adapter.js
 * getCategoryDetail), previously unused.
 *
 * Opens as a dark drag-to-dismiss bottom sheet (matches ListViewSheet in
 * SuggestionsScreen.jsx — same screen, same visual language), titled with
 * the category's real group label. A segmented control lets the user flip
 * between Helpful / Neutral / Harmful; only the ACTIVE listType is ever
 * fetched, on demand, the first time its tab is opened — repeat visits to
 * an already-fetched tab are free via adapter.js's cachedFetch (8h TTL).
 * Never prefetches all three lists or other groups (daily API rate limit).
 *
 * Tapping a row hands the food up to the parent via onSelectFood, which
 * opens the existing FoodDetail sheet (SuggestionsScreen already owns that
 * wiring) — this component does not render FoodDetail itself.
 *
 * Props:
 *   open        — boolean
 *   onClose     — callback to dismiss
 *   profile     — Profile (passed through to getCategoryDetail)
 *   group       — coarse food group code (e.g. 'e')
 *   groupLabel  — pre-resolved label (falls back to fetching via getGroupLabel if absent)
 *   onSelectFood — callback(food) — tap a row → parent opens FoodDetail
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { getCategoryDetail, getGroupLabel } from '../../api/api.js';
import { addToLibrary } from '../../state/library.js';
import IngredientCard from '../../components/IngredientCard.jsx';
import DemoDataChip from '../../components/shared/DemoDataChip.jsx';

const DISMISS_THRESHOLD = 100;

const LIST_TYPES = [
  { key: 'helpful', label: 'Helpful' },
  { key: 'neutral', label: 'Neutral' },
  { key: 'harmful', label: 'Harmful' },
];

// ── Skeleton row (matches dark skeleton language elsewhere in this screen) ──

function SkeletonRow() {
  return (
    <div className="flex items-center gap-2.5 py-2 px-3">
      <div className="h-3.5 flex-1 rounded animate-pulse bg-sand-200" />
      <div className="h-3 w-14 rounded animate-pulse bg-sand-200" />
    </div>
  );
}

export default function CategoryDetailSheet({ open, onClose, profile, group, groupLabel: groupLabelProp, onSelectFood }) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragOriginY = useRef(0);

  const [listType, setListType] = useState('helpful');
  const [groupLabel, setGroupLabel] = useState(groupLabelProp || '');
  // Per-group cache of already-fetched tabs (state, not a ref, so switching
  // back to an already-fetched listType re-renders from cached data with no
  // network call) so re-opening this sheet for the same group doesn't refetch.
  const [resultsByType, setResultsByType] = useState({}); // { [listType]: { items, usedFallback } }
  const [loading, setLoading] = useState(false);

  // Reset per-group state when the sheet is opened for a (possibly new) group.
  // Adjusted during render (React's documented escape hatch for "resetting
  // state when a prop changes" — see https://react.dev/learn/you-might-not-need-an-effect)
  // rather than in an effect, so it takes effect in the same render instead
  // of triggering an extra cascading render.
  const resetKey = `${open ? '1' : '0'}:${group ?? ''}`;
  const [openedFor, setOpenedFor] = useState(null); // last resetKey we've reset for
  if (open && openedFor !== resetKey) {
    setOpenedFor(resetKey);
    setResultsByType({});
    setListType('helpful');
    setDragY(0);
    setIsDragging(false);
    setGroupLabel(groupLabelProp || group || '');
  }

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Resolve the real group label when the caller didn't already pass one.
  useEffect(() => {
    if (!open || groupLabelProp || !group) return;
    let cancelled = false;
    getGroupLabel(group)
      .then((label) => { if (!cancelled) setGroupLabel(label); })
      .catch(() => { if (!cancelled) setGroupLabel(group); });
    return () => { cancelled = true; };
  }, [open, group, groupLabelProp]);

  // Fetch only the active listType, once per group+listType.
  useEffect(() => {
    if (!open || !group || !profile) return;
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
  }, [open, group, profile, listType, resultsByType]);

  const handleClose = useCallback(() => { setDragY(0); onClose(); }, [onClose]);

  const onHandleDown = (e) => {
    setIsDragging(true);
    dragOriginY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e) => {
    if (!isDragging) return;
    setDragY(Math.max(0, e.clientY - dragOriginY.current));
  };
  const onHandleUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragY >= DISMISS_THRESHOLD) handleClose(); else setDragY(0);
  };

  if (!open) return null;

  const dismissProgress = Math.min(1, dragY / DISMISS_THRESHOLD);
  const active = resultsByType[listType];
  const items = active?.items ?? [];
  const usedFallback = !!active?.usedFallback;
  const showSkeleton = loading && !active;

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div
        className="absolute inset-0 bg-char-900/50 backdrop-blur-[3px]"
        style={{ opacity: 1 - dismissProgress * 0.6 }}
        onClick={handleClose}
      />
      <div
        className="relative z-10 bg-paper-100 rounded-t-2xl shadow-lg flex flex-col overflow-hidden"
        style={{
          maxHeight: '85dvh',
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.22,0.61,0.36,1)',
        }}
        onPointerDown={onHandleDown}
        onPointerMove={onHandleMove}
        onPointerUp={onHandleUp}
        onPointerCancel={onHandleUp}
      >
        <div className="flex-shrink-0 flex items-center justify-center pt-3 pb-1">
          <div className="w-14 h-1.5 rounded-full bg-char-300/60" />
        </div>
        <div className="flex-shrink-0 flex items-center justify-between px-5 pt-2 pb-3">
          <h2 className="font-display text-lg font-semibold text-char-900 truncate pr-3">
            {groupLabel || 'Category'}
          </h2>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-sand-100 flex items-center justify-center text-char-500 hover:text-char-900 transition-colors duration-fast flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Segmented control */}
        <div
          className="flex-shrink-0 px-5 pb-3"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex bg-sand-100 rounded-lg p-1 gap-1">
            {LIST_TYPES.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setListType(key)}
                className={`flex-1 py-1.5 rounded-md text-sm font-sans font-semibold transition-colors duration-fast
                  ${listType === key ? 'bg-white text-char-900 shadow-xs' : 'text-char-500 hover:text-char-700'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {!showSkeleton && usedFallback && (
          <div className="flex-shrink-0 px-5 pb-2">
            <DemoDataChip />
          </div>
        )}

        <div
          className="flex-1 overflow-y-auto px-4 pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {showSkeleton ? (
            <div className="flex flex-col gap-1">
              {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm font-sans text-center py-12 text-char-400">
              Nothing curated here yet.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {items.map((food) => (
                <IngredientCard
                  key={food.id}
                  food={food}
                  onAddToLibrary={addToLibrary}
                  onSelect={onSelectFood}
                  compact
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
