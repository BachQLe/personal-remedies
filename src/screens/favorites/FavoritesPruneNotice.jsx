import { useCallback, useEffect, useRef, useState } from 'react';
import BottomSheet from '../../components/shared/BottomSheet.jsx';
import { storage } from '../../api/storage.js';
import { subscribeOnline } from '../../api/connectivity.js';
import { getProfile, isFavoritesPrunePending, findRecipesToPrune, applyFavoritesPrune } from '../../api/api.js';
import { COPY } from '../plan/plannerCopy.js';

/**
 * Global condition-change notice (checklist 1.26). While a profile change is
 * waiting on `applyFavoritesPrune`, re-score the stored recipes: nothing low
 * ranked -> apply silently; otherwise show a notice listing what will be
 * removed, then apply when it is acknowledged or dismissed (a notice, not a
 * choice). Scoring unreachable -> do nothing and retry on the next trigger
 * (mount, the flag being written, coming back online).
 */
export default function FavoritesPruneNotice() {
  const [notice, setNotice] = useState(null);
  const busy = useRef(false);

  const check = useCallback(async () => {
    if (busy.current || !isFavoritesPrunePending()) return;
    busy.current = true;
    let showing = false;
    try {
      const profile = (await getProfile()) ?? { conditions: [] };
      const result = await findRecipesToPrune(profile);
      if (!result.ok) return;
      if (result.recipes.length === 0) {
        await applyFavoritesPrune(result, profile);
        return;
      }
      setNotice({ result, profile });
      showing = true;
    } catch (err) {
      console.error('FavoritesPruneNotice: check failed', err);
    } finally {
      if (!showing) busy.current = false;
    }
  }, []);

  useEffect(() => {
    queueMicrotask(check); // not inline: check() ends in setState
    const offWrite = storage.onWrite((key) => { if (key === 'favoritesPrunePending') check(); });
    const offOnline = subscribeOnline((online) => { if (online) check(); });
    return () => { offWrite(); offOnline(); };
  }, [check]);

  const acknowledge = useCallback(async () => {
    if (!notice) return;
    setNotice(null);
    try {
      await applyFavoritesPrune(notice.result, notice.profile);
    } catch (err) {
      console.error('FavoritesPruneNotice: apply failed', err);
    } finally {
      busy.current = false;
    }
  }, [notice]);

  if (!notice) return null;

  return (
    <BottomSheet open onClose={acknowledge} title={COPY.noticeTitle} zClass="z-[80]">
      <p className="mb-3 font-sans text-sm text-char-500">{COPY.noticeBody}</p>
      <ul className="mb-5 flex flex-col gap-1.5">
        {notice.result.recipes.map((recipe) => (
          <li key={recipe.id} className="rounded-xl bg-paper-200 px-4 py-2.5 font-sans text-sm font-semibold text-blue-950">
            {recipe.name}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={acknowledge}
        className="min-h-[48px] w-full rounded-pill bg-blue-950 px-4 py-3 font-sans text-sm font-semibold text-white
          transition duration-fast hover:bg-blue-900 active:scale-[0.99]"
      >
        {COPY.noticeOk}
      </button>
    </BottomSheet>
  );
}
