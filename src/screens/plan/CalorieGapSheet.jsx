import { Link } from 'react-router-dom';
import BottomSheet from '../../components/shared/BottomSheet.jsx';
import { formatCalories } from '../../api/calorieNeeds.js';
import { COPY, SHEET_Z } from './plannerCopy.js';

/**
 * CalorieGapSheet - shown ONCE, right after "Randomize from my favorites"
 * builds a week whose today lands well under the calorie target (only when
 * every item today has a sourced calorie number). It only makes
 * the shortfall visible and offers two ways on: accept it, or add more
 * favorites. Dismissing it is the same as continuing. Never a running tally.
 *
 * @param {Object} props
 * @param {number} props.need - calorie target (profile target, else the default)
 * @param {number} props.total - today's planned total
 * @param {() => void} props.onClose - dismiss (same as Continue)
 * @param {() => void} props.onAddMore - called as the user follows the link to My Favorites
 */
export default function CalorieGapSheet({ need, total, onClose, onAddMore }) {
  const shortfall = Math.max(0, Math.round(need - total));

  return (
    <BottomSheet open onClose={onClose} zClass={SHEET_Z}>
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="font-display text-lg font-semibold leading-snug tracking-tightish text-blue-950">
          {COPY.gapTitle}
        </h2>
        <p className="font-sans text-sm text-char-500">{COPY.gapQuestion}</p>
      </div>

      <div className="mb-2 rounded-xl bg-paper-200 px-4 py-3">
        <p className="font-sans text-sm text-blue-950">
          {COPY.gapPlanned(formatCalories(total), need.toLocaleString())}
        </p>
        {shortfall > 0 && (
          <p className="mt-0.5 font-sans text-xs text-char-500">{COPY.gapShort(shortfall.toLocaleString())}</p>
        )}
      </div>

      <div className="sticky bottom-0 -mx-5 mt-4 flex items-center gap-3 bg-white px-5 pb-1 pt-3">
        <Link
          to="/app/favorites"
          onClick={onAddMore}
          className="btn btn-secondary flex-1 active:scale-[0.99]"
        >
          {COPY.gapAddMore}
        </Link>
        <button
          onClick={onClose}
          className="btn btn-primary flex-1 active:scale-[0.99]"
        >
          {COPY.gapContinue}
        </button>
      </div>
    </BottomSheet>
  );
}
