import { useState } from 'react';
import { Bookmark, Trash2 } from 'lucide-react';
import BottomSheet from '../../components/shared/BottomSheet.jsx';
import { MAX_SAVED_PLANS } from '../../api/config.js';

/**
 * SavedPlansSheet — Task 8: save the currently active weekly plan (capped at
 * MAX_SAVED_PLANS, config.js) and view/load/delete previous saves. This is
 * separate from saving an individual recipe (SaveButton/library.js) — it
 * snapshots the whole 7-day plan.
 *
 * Mirrors `ScheduleSheet.jsx`'s plain BottomSheet-plus-list pattern rather
 * than introducing a new sheet abstraction. All persistence lives in
 * planBuilder.js's `saveCurrentPlan`/`getSavedPlans`/`loadSavedPlan`/
 * `deleteSavedPlan`, which go through storage.js's namespaced persistence
 * wrapper under the 'savedPlans' key — this component only renders state
 * and forwards taps.
 *
 * Capping policy: BLOCKS a new save at the cap (disables the Save button,
 * shows a message) rather than silently evicting the oldest save.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {boolean} props.hasActivePlan - whether there's a current plan to save
 * @param {Array<import('../../api/planBuilder.js').SavedPlanEntry>} props.savedPlans
 * @param {(name: string) => void} props.onSave
 * @param {(id: string) => void} props.onLoad
 * @param {(id: string) => void} props.onDelete
 */
export default function SavedPlansSheet({
  open,
  onClose,
  hasActivePlan,
  savedPlans,
  onSave,
  onLoad,
  onDelete,
}) {
  const [name, setName] = useState('');
  const atCap = savedPlans.length >= MAX_SAVED_PLANS;

  const handleSave = () => {
    onSave(name);
    setName('');
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Saved plans">
      {hasActivePlan && (
        <div className="mb-5 flex flex-col gap-2">
          <label htmlFor="save-plan-name" className="font-label text-xs tracking-widest uppercase text-blue-950/50">
            Save current plan
          </label>
          <div className="flex items-center gap-2">
            <input
              id="save-plan-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Plan ${savedPlans.length + 1}`}
              disabled={atCap}
              className="flex-1 min-w-0 rounded-xl border border-sand-200 bg-paper-100 px-3 py-2.5
                font-sans text-sm text-blue-950 placeholder:text-char-400
                disabled:opacity-50"
            />
            <button
              onClick={handleSave}
              disabled={atCap}
              className="shrink-0 rounded-pill bg-blue-950 text-white text-sm font-semibold font-sans px-4 py-2.5
                hover:bg-blue-900 active:scale-[0.99] transition-all duration-fast
                disabled:opacity-50 disabled:pointer-events-none"
            >
              Save
            </button>
          </div>
          {atCap && (
            <p className="text-xs text-char-500 font-sans">
              You've saved {MAX_SAVED_PLANS} plans, the most allowed — delete one below to save a new one.
            </p>
          )}
        </div>
      )}

      {savedPlans.length === 0 ? (
        <p className="font-sans text-sm text-char-500 py-4">
          No saved plans yet — save your current plan to come back to it later.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {savedPlans.map((entry) => (
            <div
              key={entry.id}
              className="w-full flex items-center justify-between gap-3 rounded-xl bg-paper-200 py-3 px-4"
            >
              <button
                onClick={() => onLoad(entry.id)}
                className="flex-1 min-w-0 text-left flex items-center gap-2"
              >
                <Bookmark size={15} className="text-blue-950/50 shrink-0" aria-hidden="true" />
                <span className="flex flex-col min-w-0">
                  <span className="font-sans text-sm font-semibold text-blue-950 truncate">{entry.name}</span>
                  <span className="font-sans text-xs text-char-500">
                    Saved {new Date(entry.savedAt).toLocaleDateString()}
                  </span>
                </span>
              </button>
              <button
                onClick={() => onDelete(entry.id)}
                aria-label={`Delete ${entry.name}`}
                className="tap-target w-8 h-8 shrink-0 rounded-full flex items-center justify-center
                  text-char-500 hover:bg-sand-200 transition-colors duration-fast"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
