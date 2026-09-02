import { Plus, Bookmark, Shuffle, RefreshCw, Printer } from 'lucide-react';
import BottomSheet from '../../components/shared/BottomSheet.jsx';

/**
 * HowToUseSheet — short "what does this button do" reference for the Meal
 * Queue screen, opened from the header's help icon (next to Print/Share).
 *
 * Plain BottomSheet content, no fetched data — a static, scannable list
 * (icon + one-line description each), matching this screen's existing
 * short-copy tone (see EmptyState/NutritionFactsSheet captions) rather than
 * paragraphs of explanation.
 */
const HELP_ITEMS = [
  {
    icon: Plus,
    title: 'Add (+)',
    body: "Adds a saved recipe from your Cookbook into today's plan, in its matching meal slot.",
  },
  {
    icon: Bookmark,
    title: 'Save',
    body: 'Bookmarks a recipe to your Saved recipes tab so you can add it to a plan later.',
  },
  {
    icon: Shuffle,
    title: 'Shuffle',
    body: 'Swaps just that one slot for another option — the rest of the day stays put.',
  },
  {
    icon: RefreshCw,
    title: 'Regenerate',
    body: '"Regenerate day" rebuilds one day; "Regenerate whole week" rebuilds all seven. Pinned items always stay.',
  },
  {
    icon: Printer,
    title: 'Print & Share',
    body: 'The icons in the top-right corner print or share a plain, ink-friendly summary of your week.',
  },
];

export default function HowToUseSheet({ open, onClose }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="How to Use">
      <p className="text-xs text-char-500 mb-4">
        What each control on this screen does.
      </p>

      <div className="flex flex-col gap-4">
        {HELP_ITEMS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-sand-100 flex items-center justify-center shrink-0 text-blue-950/70">
              <Icon size={16} aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold font-sans text-blue-950">{title}</span>
              <span className="text-xs font-sans text-char-500 leading-snug">{body}</span>
            </div>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}
