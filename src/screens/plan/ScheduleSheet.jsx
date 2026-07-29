import BottomSheet from '../../components/shared/BottomSheet.jsx';
import { nextSevenDays } from './planDates.js';

/**
 * ScheduleSheet — pick a day (of the next 7) to schedule a queue item onto,
 * or short-circuit straight to "cooked today". Opened from SlotSection's
 * Schedule action; MealQueueScreen owns the item-move + Undo logic.
 */
export default function ScheduleSheet({ open, item, onClose, onSchedule, onCookToday }) {
  if (!item) return null;

  return (
    <BottomSheet open={open} onClose={onClose} title="Schedule">
      <div className="flex items-center gap-3 mb-4">
        {item.image && (
          <img
            src={item.image}
            alt=""
            className="w-10 h-10 rounded-lg object-cover shrink-0"
          />
        )}
        <span className="font-sans text-sm font-semibold text-blue-950 truncate">
          {item.name}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {nextSevenDays().map((day) => (
          <button
            key={day.key}
            onClick={() => onSchedule(day.key, day.label)}
            className="w-full flex items-center justify-between rounded-xl bg-paper-200 hover:bg-sand-200
              py-3 px-4 transition-colors duration-fast"
          >
            <span className="font-sans text-sm font-semibold text-blue-950">{day.label}</span>
            <span className="font-sans text-sm text-char-500">{day.sublabel}</span>
          </button>
        ))}
      </div>

      <button
        onClick={onCookToday}
        className="mt-4 w-full bg-blue-950 text-white rounded-pill py-3.5 font-semibold text-sm
          transition-transform duration-fast active:scale-[0.98]"
      >
        Mark as cooked for today
      </button>
    </BottomSheet>
  );
}
