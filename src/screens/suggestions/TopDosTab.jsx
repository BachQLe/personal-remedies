/**
 * TopDosTab — ranked Top Dos & Don'ts list, rendered via RankedRow as its
 * own tab within Dietary Guidance. Both directions share adapter.js's cached
 * /topdoordonts@50 call, so fetching them together here costs at most one
 * API request per direction across the whole app.
 *
 * Product rules honored here:
 * - NO tier badges: /topdoordonts carries no tier data; list membership +
 *   rank IS the verdict.
 * - "N studies" is cache-only (getCachedRefCount) — this tab NEVER warms
 *   /references (rate-limit safety); counts appear opportunistically when
 *   some other surface (FoodDetailCard, Food Groups) already cached them.
 * - Lifestyle items (Exercise, Smoking, …) stay inline in rank order with a
 *   "Lifestyle" chip and their cleaned advisory notes.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { getTopDosAndDonts, getCachedRefCount } from '../../api/api.js';
import PillSwitcher from '../../components/shared/PillSwitcher.jsx';
import RankedRow from '../../components/shared/RankedRow.jsx';
import Snackbar from '../../components/shared/Snackbar.jsx';

/** Max rows shown per direction. */
const MAX_ROWS = 20;

// ── Skeleton (card-shaped rows to match the button-card list) ───────────────

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="flex items-center gap-3 py-3.5 px-4 rounded-xl bg-white border border-sand-200">
          <div className="h-3.5 flex-1 rounded animate-pulse bg-sand-200" />
          <div className="h-3 w-12 rounded animate-pulse bg-sand-200 flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ── Tab ──────────────────────────────────────────────────────────────────────

export default function TopDosTab({ profile, onSelectFood }) {
  const [results, setResults] = useState({ consume: null, avoid: null });
  const [direction, setDirection] = useState('consume');

  // Snackbar wiring (see Snackbar.jsx's 3-piece pattern) — used here only for
  // SaveButton's onBlocked toast; no undo action on this screen.
  const [snackbar, setSnackbar] = useState(null);
  const snackbarIdRef = useRef(0);
  const undoFnRef = useRef(null);
  const showSnackbar = useCallback((message, canUndo = false, undoFn = null) => {
    snackbarIdRef.current += 1;
    undoFnRef.current = undoFn;
    setSnackbar({ id: snackbarIdRef.current, message, canUndo });
  }, []);
  const handleUndo = useCallback(() => {
    undoFnRef.current?.();
    setSnackbar(null);
  }, []);

  // Fetch both directions in parallel once profile is ready — cheap, shares
  // the cached /topdoordonts call with the rest of the app.
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    for (const dir of ['consume', 'avoid']) {
      getTopDosAndDonts(profile, dir)
        .then((res) => {
          if (!cancelled) setResults((prev) => ({ ...prev, [dir]: res }));
        })
        .catch((err) => {
          console.error('TopDosTab: getTopDosAndDonts failed', err);
          if (!cancelled) {
            setResults((prev) => ({ ...prev, [dir]: { items: [], usedFallback: false } }));
          }
        });
    }

    return () => { cancelled = true; };
  }, [profile]);

  const loading = !results.consume && !results.avoid;
  const firstConditionId = profile?.conditions?.[0] ?? null;

  const activeResult = results[direction];
  const items = activeResult?.items ?? [];
  const visibleItems = items.slice(0, MAX_ROWS);

  return (
    <div className="flex flex-col gap-4">
      <PillSwitcher
        options={[
          { key: 'consume', label: 'Do', tone: 'positive' },
          { key: 'avoid', label: "Don't", tone: 'negative' },
        ]}
        value={direction}
        onChange={setDirection}
        size="sm"
      />

      {loading ? (
        <SkeletonRows />
      ) : items.length === 0 ? (
        <p className="text-sm text-char-500 font-sans text-center py-6">
          Nothing here yet. Set up your health profile first.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleItems.map((food) => (
            <RankedRow
              key={food.id}
              food={food}
              studyCount={
                firstConditionId != null
                  ? getCachedRefCount(food.id, [firstConditionId])
                  : null
              }
              onSelect={onSelectFood}
              onSaveBlocked={showSnackbar}
            />
          ))}
        </div>
      )}

      <Snackbar snackbar={snackbar} onUndo={handleUndo} onDismiss={() => setSnackbar(null)} />
    </div>
  );
}
