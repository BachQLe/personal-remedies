import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BottomSheet from '../../components/shared/BottomSheet.jsx';
import BackButton from '../../components/shared/BackButton.jsx';
import SavedList from '../favorites/SavedList.jsx';
import { favoritesBySlot } from '../../api/api.js';
import { PLAN_SLOTS } from '../../api/config.js';
import { COPY, SHEET_Z } from './plannerCopy.js';

// Fewer than this many favorites per meal and the randomizer repeats itself.
const NUDGE_AT_OR_BELOW = 3;

function Choice({ title, hint, onClick, disabled, primary }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[64px] w-full flex-col items-start justify-center gap-0.5 rounded-xl px-5 py-3 text-left
        transition duration-fast active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50
        ${primary ? 'bg-blue-950 text-white hover:bg-blue-900' : 'border border-sand-200 bg-white text-blue-950 hover:bg-paper-200'}`}
    >
      <span className="font-sans text-base font-semibold">{title}</span>
      <span className={`font-sans text-xs ${primary ? 'text-white/70' : 'text-char-500'}`}>{hint}</span>
    </button>
  );
}

/**
 * The ONE "New meal plan" sheet: randomize a week from favorites, or load a
 * saved week (a second view of this same sheet). Carries the favorites-count
 * nudge. Generation still runs with whatever the user has.
 *
 * @param {Object} props
 * @param {Array<Object>} props.favorites - the library
 * @param {Array<Object>} props.weeks - saved weeks
 * @param {boolean} props.ready - profile loaded (generation needs it)
 * @param {boolean} props.generating
 * @param {() => void} props.onRandomize
 * @param {(id: string) => void} props.onLoadWeek
 * @param {() => void} props.onClose
 */
export default function NewPlanSheet({ favorites, weeks, ready, generating, onRandomize, onLoadWeek, onClose }) {
  const [view, setView] = useState('choices');
  const bySlot = useMemo(() => favoritesBySlot(favorites), [favorites]);
  const noneFit = PLAN_SLOTS.every((s) => bySlot[s.key].length === 0);
  const shortMeals = PLAN_SLOTS.filter((s) => bySlot[s.key].length <= NUDGE_AT_OR_BELOW).map((s) => s.label);

  return (
    <BottomSheet open onClose={onClose} title={view === 'weeks' ? COPY.loadWeekTitle : COPY.newPlanTitle} zClass={SHEET_Z}>
      {view === 'weeks' ? (
        <>
          <div className="mb-3">
            <BackButton onClick={() => setView('choices')} aria-label={COPY.backToOptions} />
          </div>
          <SavedList
            entries={weeks}
            onPick={(entry) => onLoadWeek(entry.id)}
            emptyText={COPY.noSavedWeeks}
            rowClassName="bg-paper-200"
          />
        </>
      ) : (
        <div className="flex flex-col gap-4">
          {(noneFit || shortMeals.length > 0) && (
            <div className="flex flex-col items-start gap-1.5 rounded-xl bg-paper-200 px-4 py-3">
              <p className="font-sans text-sm text-blue-950">{noneFit ? COPY.noFavorites : COPY.nudge}</p>
              {!noneFit && <p className="font-sans text-xs text-char-500">{COPY.nudgeShort(shortMeals)}</p>}
              <Link to="/app/favorites" className="inline-flex min-h-[44px] items-center font-sans text-sm font-semibold text-blue-950 underline underline-offset-2">
                {COPY.goToFavorites}
              </Link>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Choice
              primary
              title={generating ? COPY.building : COPY.randomize}
              hint={COPY.randomizeHint}
              onClick={onRandomize}
              disabled={!ready || generating || noneFit}
            />
            <Choice
              title={COPY.loadWeek}
              hint={weeks.length > 0 ? COPY.loadWeekHint(weeks.length) : COPY.loadWeekNone}
              onClick={() => setView('weeks')}
              disabled={weeks.length === 0}
            />
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
