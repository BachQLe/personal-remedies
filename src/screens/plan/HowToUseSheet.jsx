import { Plus, X, CalendarPlus, CalendarDays, CalendarRange, Bookmark, Printer } from 'lucide-react';
import BottomSheet from '../../components/shared/BottomSheet.jsx';
import { HELP_ITEMS, SHEET_Z } from './plannerCopy.js';

/**
 * HowToUseSheet - short "what does this button do" reference for the plan
 * screen, opened from the header's help icon. Copy lives in plannerCopy.js;
 * this only maps each entry to its icon.
 */
const ICONS = {
  add: Plus,
  remove: X,
  day: CalendarDays,
  week: CalendarRange,
  new: CalendarPlus,
  favorites: Bookmark,
  print: Printer,
};

export default function HowToUseSheet({ open, onClose }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="How to Use" zClass={SHEET_Z}>
      <p className="mb-4 text-xs text-char-500">What each control on this screen does.</p>

      <div className="flex flex-col gap-4">
        {HELP_ITEMS.map(({ key, title, body }) => {
          const Icon = ICONS[key];
          return (
            <div key={key} className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-blue-950/70">
                <Icon size={16} aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-sans text-sm font-semibold text-blue-950">{title}</span>
                <span className="font-sans text-xs leading-snug text-char-500">{body}</span>
              </div>
            </div>
          );
        })}
      </div>
    </BottomSheet>
  );
}
