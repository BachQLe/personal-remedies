import BottomSheet from '../../components/shared/BottomSheet.jsx';
import SavedList from '../favorites/SavedList.jsx';
import { COPY, SHEET_Z } from './plannerCopy.js';

/** Saved days to load onto the day being viewed (replaces that day's meals). */
export default function LoadDaySheet({ entries, onPick, onClose }) {
  return (
    <BottomSheet open onClose={onClose} title={COPY.loadDayTitle} zClass={SHEET_Z}>
      <p className="mb-3 font-sans text-xs text-char-500">{COPY.loadDayHint}</p>
      <SavedList entries={entries} onPick={onPick} emptyText={COPY.noSavedDays} rowClassName="bg-paper-200" />
    </BottomSheet>
  );
}
