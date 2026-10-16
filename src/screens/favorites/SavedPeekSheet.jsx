import { useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import BottomSheet from '../../components/shared/BottomSheet.jsx';
import SchedulerView from '../plan/SchedulerView.jsx';
import { COPY, SHEET_Z } from '../plan/plannerCopy.js';

/**
 * Read-only peek at a saved day or saved week, in the list view. A saved week
 * has no real dates to show, so its days read "Day 1" ... "Day 7". Loading
 * does not happen here (days load from the plan, weeks from New meal plan);
 * the only action is Delete.
 *
 * @param {Object} props
 * @param {'day'|'week'} props.kind
 * @param {Object} props.entry - the saved day / saved week entry
 * @param {boolean} [props.hidden] - sheet temporarily closed (a recipe card is open on top)
 * @param {(item: Object) => void} props.onSelectItem
 * @param {() => void} props.onDelete
 * @param {() => void} props.onClose
 */
export default function SavedPeekSheet({ kind, entry, hidden = false, onSelectItem, onDelete, onClose }) {
  const days = useMemo(() => {
    if (kind === 'day') return [{ key: entry.id, label: COPY.meals, slots: entry.slots }];
    const planDays = entry.plan?.days ?? {};
    return Object.keys(planDays).sort().map((key, i) => ({ key, label: COPY.dayN(i + 1), slots: planDays[key].slots }));
  }, [kind, entry]);

  return (
    <BottomSheet open={!hidden} onClose={onClose} title={entry.name} zClass={SHEET_Z}>
      <SchedulerView days={days} onSelectItem={onSelectItem} />
      <p className="mt-4 font-sans text-xs text-char-500">{COPY.peekHint}</p>
      <button
        type="button"
        onClick={onDelete}
        className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-pill border border-sand-200
          bg-white px-4 py-3 font-sans text-sm font-semibold text-avoid-700 transition duration-fast
          hover:bg-paper-200 active:scale-[0.99]"
      >
        <Trash2 size={16} aria-hidden="true" />
        {COPY.delete}
      </button>
    </BottomSheet>
  );
}
