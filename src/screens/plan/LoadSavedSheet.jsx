import BottomSheet from '../../components/shared/BottomSheet.jsx';
import SavedList from '../favorites/SavedList.jsx';
import { COPY, SHEET_Z } from './plannerCopy.js';

const KINDS = {
  day: { title: COPY.loadDayTitle, hint: COPY.loadDayHint, empty: COPY.noSavedDays },
  week: { title: COPY.loadWeekTitle, hint: COPY.loadWeekSheetHint, empty: COPY.noSavedWeeks },
};

/**
 * Saved days or weeks to load. kind="day" replaces the day being viewed;
 * kind="week" replaces the whole week. onPick receives the picked entry.
 */
export default function LoadSavedSheet({ kind = 'day', entries, onPick, onClose }) {
  const { title, hint, empty } = KINDS[kind];
  return (
    <BottomSheet open onClose={onClose} title={title} zClass={SHEET_Z}>
      <p className="mb-3 font-sans text-xs text-char-500">{hint}</p>
      <SavedList entries={entries} onPick={onPick} emptyText={empty} rowClassName="bg-paper-200" />
    </BottomSheet>
  );
}
