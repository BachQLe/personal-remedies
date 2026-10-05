import { useEffect, useState, useCallback } from 'react';
import BottomSheet from '../../components/shared/BottomSheet.jsx';
import BackButton from '../../components/shared/BackButton.jsx';
import FoodRating from '../../components/shared/FoodRating.jsx';
import Skeleton from '../../components/shared/Skeleton.jsx';
import { getGoodForMe } from '../../api/api.js';
import { summarizeGoodForMe, unscoredRowText } from './goodForMe.js';

// Verdict panel colors, from the shared signal tokens (see tierConfig.js).
const VERDICT_STYLE = {
  good: 'bg-benefit-100 text-benefit-600',
  mixed: 'bg-paper-200 text-char-700',
  avoid: 'bg-avoid-100 text-avoid-600',
  neutral: 'bg-sand-100 text-char-500',
};
const DEFAULT_VERDICT_STYLE = 'bg-sand-100 text-char-700';

/**
 * "Check against my profile" bottom sheet. Fetches only when opened for a food
 * (getGoodForMe — cached 8h per food+condition), never on search keystrokes.
 * Props: food ({ id, name } | null), profile ({ conditions }), onClose.
 */
export default function GoodForMeSheet({ food, profile, onClose }) {
  const open = !!food;
  const [result, setResult] = useState({ key: null, status: 'loading', rows: [] });
  const [attempt, setAttempt] = useState(0);
  const foodId = food?.id;
  const requestKey = `${foodId}:${attempt}`;
  // Results are tagged with the request they answer; a stale/absent tag means loading.
  const state = result.key === requestKey ? result : { status: 'loading', rows: [] };

  useEffect(() => {
    if (foodId == null) return undefined;
    let cancelled = false;
    getGoodForMe(foodId, profile)
      .then((res) => { if (!cancelled) setResult({ key: requestKey, status: 'done', rows: res.rows }); })
      .catch(() => { if (!cancelled) setResult({ key: requestKey, status: 'failed', rows: [] }); });
    return () => { cancelled = true; };
    // profile is a stable ref from the caller; re-run only per food / retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foodId, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const summary = state.status === 'done'
    ? summarizeGoodForMe(state.rows)
    : state.status === 'failed'
      ? { kind: 'error', headline: "Couldn't check this right now", detail: 'Something went wrong loading the answer.', unscored: 0 }
      : null;

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Check against my profile" zClass="z-[70]">
      <div className="px-5 pb-6 font-sans" data-testid="good-for-me-sheet">
        <div className="flex items-center gap-3">
          <BackButton onClick={onClose} aria-label="Close" />
          <div className="min-w-0">
            <p className="font-label text-[11px] tracking-[0.14em] uppercase text-char-500">Check against my profile</p>
            <h2 className="font-display text-xl font-semibold text-char-900 leading-tight truncate">{food?.name}</h2>
          </div>
        </div>

        {state.status === 'loading' && (
          <div className="flex flex-col gap-3 mt-5" aria-busy="true">
            <Skeleton shape="block" className="h-16 w-full" />
            <Skeleton shape="text" className="w-3/4" />
            <Skeleton shape="text" className="w-2/3" />
          </div>
        )}

        {summary && (
          <div className="mt-5">
            <div
              data-testid="good-for-me-verdict"
              data-kind={summary.kind}
              className={`rounded-sm px-4 py-3 ${VERDICT_STYLE[summary.kind] || DEFAULT_VERDICT_STYLE}`}
            >
              <p className="font-semibold text-base leading-snug">{summary.headline}</p>
              <p className="text-sm mt-1 leading-snug">{summary.detail}</p>
            </div>

            {(summary.kind === 'error') && (
              <button
                type="button"
                onClick={retry}
                className="mt-3 px-5 py-2.5 rounded-xs bg-forest-700 text-white text-sm font-semibold
                  transition-all duration-fast ease-ds-out hover:bg-forest-800 active:scale-[0.98]"
              >
                Retry
              </button>
            )}

            {state.rows.length > 0 && (
              <ul className="mt-4" data-testid="good-for-me-rows">
                {state.rows.map((row) => {
                  const unscored = unscoredRowText(row);
                  return (
                    <li key={row.conditionId} className="py-3 border-b border-sand-100 last:border-b-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-char-900">{row.conditionName}</span>
                        {unscored ? (
                          <span className="text-xs text-char-400 italic">{unscored}</span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <FoodRating numericId={row.numericId} size={14} tone="light" />
                            <span className="text-xs text-char-700">{row.label}</span>
                          </span>
                        )}
                      </div>
                      {row.notes && (
                        <p className="mt-1 text-xs text-char-500 leading-snug">{row.notes}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
