/**
 * mealTypeMeta.jsx — shared meal-type tag foundation (b/l/d/s/b).
 *
 * The five plan slots (`PLAN_SLOTS` in `src/api/config.js`) are Breakfast,
 * Lunch, Dinner, Snacks, Beverages — two of which start with "B". Rather than
 * inventing a second letter (which would break the "one-letter corner tag"
 * idea the rest of the app leans on), Breakfast and Beverages are
 * disambiguated by ICON instead: Breakfast uses a sunrise glyph, Beverages a
 * cup glyph. Both still render the letter "B"; the icon carries the
 * distinction. Keep that pairing in mind if new slot types are ever added.
 */

import { Sunrise, Sandwich, UtensilsCrossed, Cookie, CupSoda } from 'lucide-react';
import { inferSlotKey } from '../../api/planBuilder.js';
import { PLAN_SLOT_KEYS } from '../../api/config.js';

/**
 * Meal-type metadata keyed by plan slot key. Each entry drives `MealTypeTag`
 * (letter + icon) and can be reused anywhere a slot needs a label/icon pair.
 * @type {Record<string, { letter: string, label: string, Icon: React.ComponentType, toneClass: string }>}
 */
// eslint-disable-next-line react-refresh/only-export-components
export const MEAL_TYPE_META = {
  breakfast: {
    letter: 'B',
    label: 'Breakfast',
    Icon: Sunrise,
    toneClass: 'bg-honey-100/95 text-honey-700',
  },
  lunch: {
    letter: 'L',
    label: 'Lunch',
    Icon: Sandwich,
    toneClass: 'bg-forest-100/95 text-forest-800',
  },
  dinner: {
    letter: 'D',
    label: 'Dinner',
    Icon: UtensilsCrossed,
    toneClass: 'bg-blue-100/95 text-blue-800',
  },
  snacks: {
    letter: 'S',
    label: 'Snack',
    Icon: Cookie,
    toneClass: 'bg-yellow-100/95 text-yellow-800',
  },
  beverages: {
    letter: 'B',
    label: 'Beverage',
    Icon: CupSoda,
    toneClass: 'bg-lavender-100/95 text-lavender-800',
  },
};

const isValidSlotKey = (key) => typeof key === 'string' && PLAN_SLOT_KEYS.includes(key);

/**
 * Resolve the plan slot key ('breakfast' | 'lunch' | 'dinner' | 'snacks' |
 * 'beverages') that best represents an item, for meal-type tagging.
 *
 * Resolution order: an explicit `fromSlot`/`slotKey` the item already carries
 * (e.g. plan/queue items placed by the user) wins over derived data; next,
 * a recipe's `mealType` (mapping the legacy singular 'snack' → 'snacks');
 * finally `inferSlotKey`, which buckets by food group for anything else.
 *
 * @param {Object} item
 * @returns {string} one of PLAN_SLOT_KEYS
 */
// eslint-disable-next-line react-refresh/only-export-components
export function mealTypeForItem(item) {
  if (isValidSlotKey(item?.fromSlot)) return item.fromSlot;
  if (isValidSlotKey(item?.slotKey)) return item.slotKey;

  const mealType = item?.mealType;
  if (mealType === 'snack') return 'snacks';
  if (mealType === 'breakfast' || mealType === 'lunch' || mealType === 'dinner') {
    return mealType;
  }

  return inferSlotKey(item);
}

/**
 * Small corner-chip pill showing a meal type's icon + letter (e.g. a sunrise
 * icon + "B" for Breakfast). Meant to read clearly over a photo — pair with
 * `FoodImageCard`'s `mealTag` prop, which positions it top-left.
 *
 * @param {Object} props
 * @param {string} props.mealKey — a PLAN_SLOT_KEYS value; unknown keys render nothing
 * @param {number} [props.size] — icon size in px
 * @param {string} [props.className] — additional classes
 */
export default function MealTypeTag({ mealKey, size = 12, className = '' }) {
  const meta = MEAL_TYPE_META[mealKey];
  if (!meta) return null;

  const { letter, label, Icon, toneClass } = meta;

  return (
    <span
      aria-label={label}
      title={label}
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5
        text-[10px] font-semibold font-sans shadow-sm ${toneClass} ${className}`}
    >
      <Icon size={size} strokeWidth={2} />
      {letter}
    </span>
  );
}
