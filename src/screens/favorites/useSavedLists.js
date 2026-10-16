import { useEffect, useState } from 'react';
import { storage } from '../../api/storage.js';
import { getSavedDays, getSavedPlans, getActiveSavedPlan } from '../../api/api.js';
import { SAVED_DAYS_KEY, SAVED_PLANS_KEY } from '../../api/config.js';

// planBuilder.js keeps its active-pointer key private; same literal.
const WATCHED = new Set([SAVED_DAYS_KEY, SAVED_PLANS_KEY, 'activeSavedPlan']);

const read = () => ({ days: getSavedDays(), weeks: getSavedPlans(), active: getActiveSavedPlan() });

/**
 * Saved days, saved weeks and the active-saved-week pointer, kept in sync with
 * storage so any save/delete/load/prune (from any screen) shows up here.
 * @returns {{ days: Array, weeks: Array, active: {id: string, fingerprint: string}|null }}
 */
export function useSavedLists() {
  const [lists, setLists] = useState(read);
  useEffect(
    () => storage.onWrite((key) => { if (WATCHED.has(key)) setLists(read()); }),
    []
  );
  return lists;
}
