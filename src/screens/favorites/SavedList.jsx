import { ChevronRight } from 'lucide-react';
import { COPY } from '../plan/plannerCopy.js';

/**
 * Rows of saved days / saved weeks: name + saved date. Tapping a row calls
 * `onPick(entry)` (peek on My Favorites, load in the Load sheets).
 * @param {Object} props
 * @param {Array<{id: string, name: string, savedAt: string}>} props.entries
 * @param {(entry: Object) => void} props.onPick
 * @param {string} props.emptyText
 * @param {string} [props.rowClassName] - background of a row (white on paper, paper-200 in a sheet)
 */
export default function SavedList({ entries, onPick, emptyText, rowClassName = 'bg-white' }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-blue-950/30 px-4 py-4 font-sans text-sm text-blue-950">
        {emptyText}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => (
        <li key={entry.id}>
          <button
            type="button"
            onClick={() => onPick(entry)}
            className={`flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left
              transition duration-fast active:scale-[0.99] ${rowClassName}`}
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-sans text-sm font-semibold text-blue-950">{entry.name}</span>
              <span className="font-sans text-xs text-char-500">
                {COPY.savedOn(new Date(entry.savedAt).toLocaleDateString())}
              </span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-blue-950/50" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
