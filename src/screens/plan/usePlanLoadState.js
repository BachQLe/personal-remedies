/**
 * usePlanLoadState — tiny helpers so the plan screens' hand-rolled fetches
 * (MealQueueScreen, MealPlannerPicker, SuggestionsSheet) feed the shared
 * state matrix (src/api/loadState.js → components/shared/DataState.jsx)
 * without being rewritten around `useAsyncData`. Those fetches are tied to
 * sheet open/close and per-slot state that `useAsyncData`'s "fetch on mount,
 * re-run on deps" contract doesn't model cleanly, so they keep their own
 * effects and only borrow connectivity + status derivation from here.
 */
import { useEffect, useState } from 'react';
import { isOnline, subscribeOnline } from '../../api/connectivity.js';
import { deriveState } from '../../api/loadState.js';

/** Live `isOnline()` — re-renders on online/offline transitions. */
export function useOnline() {
  const [online, setOnline] = useState(isOnline);
  useEffect(() => subscribeOnline(setOnline), []);
  return online;
}

/**
 * Derive the matrix status for one fetch. An error only wins when there is
 * nothing to show — stale data already on screen stays visible instead of
 * being replaced by an error panel.
 * @param {{ loading: boolean, hasData: boolean, error: * , online: boolean }} input
 * @returns {import('../../api/loadState.js').LoadState}
 */
export function planLoadState({ loading, hasData, error, online }) {
  return deriveState({
    loading,
    hasData,
    isEmpty: false,
    error: hasData ? null : error,
    online,
  });
}
