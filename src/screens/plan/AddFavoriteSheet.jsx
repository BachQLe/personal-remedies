import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import BottomSheet from '../../components/shared/BottomSheet.jsx';
import { getIngredientImage } from '../../api/ingredientImages.js';
import { getOverlayImageFile } from '../../api/localTables.js';
import { COPY, SHEET_Z } from './plannerCopy.js';

/**
 * The + tile's sheet: the user's favorites for ONE meal, minus what is already
 * in the day. Tapping one adds it. When nothing is left to add it says why and
 * links to My Favorites.
 *
 * @param {Object} props
 * @param {{key: string, label: string}} props.slot
 * @param {Array<Object>} props.options - favorites for this meal not yet in the day
 * @param {boolean} props.hasAny - whether the meal has any favorites at all
 * @param {(item: Object) => void} props.onAdd
 * @param {() => void} props.onClose
 */
export default function AddFavoriteSheet({ slot, options, hasAny, onAdd, onClose }) {
  return (
    <BottomSheet open onClose={onClose} title={COPY.addTitle(slot.label)} zClass={SHEET_Z}>
      {options.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {options.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onAdd(item)}
                className="flex min-h-[64px] w-full items-center gap-3 rounded-xl bg-paper-200 p-2 pr-4 text-left
                  transition duration-fast active:scale-[0.99]"
              >
                <img
                  src={item.image || getIngredientImage(item.name, item.group, getOverlayImageFile(item.id))}
                  alt=""
                  width={48}
                  height={48}
                  loading="lazy"
                  className="h-12 w-12 shrink-0 rounded-lg object-cover"
                />
                <span className="min-w-0 flex-1 font-sans text-sm font-semibold leading-snug text-blue-950">
                  {item.name}
                </span>
                <Plus size={18} className="shrink-0 text-blue-950/60" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="font-sans text-sm text-blue-950">
            {hasAny ? COPY.addAllUsed(slot.label) : COPY.addNone(slot.label)}
          </p>
          <Link
            to="/app/favorites"
            className="inline-flex min-h-[44px] items-center rounded-pill bg-blue-950 px-5 font-sans text-sm font-semibold text-white
              transition duration-fast hover:bg-blue-900 active:scale-[0.99]"
          >
            {COPY.goToFavorites}
          </Link>
        </div>
      )}
    </BottomSheet>
  );
}
