import { useId, useState } from 'react';
import BottomSheet from '../../components/shared/BottomSheet.jsx';
import { COPY, SHEET_Z } from './plannerCopy.js';

/**
 * Small "name this" sheet for Save day / Save week. A blank name is fine (the
 * save picks a default). When the live week traces back to a saved one,
 * `updateName` adds an "Update ..." action above the save-as-new form.
 *
 * @param {Object} props
 * @param {string} props.title
 * @param {string} props.placeholder - the default name a blank save would get
 * @param {(name: string) => void} props.onSubmit
 * @param {() => void} props.onClose
 * @param {string} [props.updateName] - name of the saved week the plan came from
 * @param {() => void} [props.onUpdate]
 */
export default function NameSheet({ title, placeholder, onSubmit, onClose, updateName, onUpdate }) {
  const [name, setName] = useState('');
  const inputId = useId();

  return (
    <BottomSheet open onClose={onClose} title={title} zClass={SHEET_Z}>
      {updateName && (
        <div className="mb-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={onUpdate}
            className="min-h-[44px] rounded-pill bg-blue-950 px-4 py-3 font-sans text-sm font-semibold text-white
              transition duration-fast hover:bg-blue-900 active:scale-[0.99]"
          >
            {COPY.update(updateName)}
          </button>
          <p className="font-sans text-xs text-char-500">{COPY.orSaveNew}</p>
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit(name); }}
        className="flex flex-col gap-2"
      >
        <label htmlFor={inputId} className="font-sans text-sm font-semibold text-blue-950">
          {COPY.nameLabel}
        </label>
        <div className="flex items-center gap-2">
          <input
            id={inputId}
            name="saved-name"
            type="text"
            autoComplete="off"
            enterKeyHint="done"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={placeholder}
            maxLength={40}
            className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-sand-200 bg-paper-100 px-3 py-2.5
              font-sans text-base text-blue-950 placeholder:text-char-400"
          />
          <button
            type="submit"
            className={`min-h-[44px] shrink-0 rounded-pill px-5 py-2.5 font-sans text-sm font-semibold
              transition duration-fast active:scale-[0.99]
              ${updateName ? 'border border-sand-200 bg-white text-blue-950 hover:bg-paper-200' : 'bg-blue-950 text-white hover:bg-blue-900'}`}
          >
            {updateName ? COPY.saveAsNew : COPY.save}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
