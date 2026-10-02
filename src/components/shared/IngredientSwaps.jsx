import { useCallback, useRef, useState } from 'react';
import { ArrowLeftRight, Check, ChevronDown, RotateCcw } from 'lucide-react';
import Skeleton from './Skeleton.jsx';
import FoodRating from './FoodRating.jsx';
import { getIngredientAlternatives } from '../../api/api.js';
import { getIngredientImage } from '../../api/ingredientImages.js';
import { getOverlayImageFile } from '../../api/localTables.js';

/**
 * IngredientSwaps — the back face's "Ingredients" block on FoodDetailCard,
 * with a per-ingredient swap affordance.
 *
 * Each row names one ingredient and opens (lazily, one /suggest call per
 * ingredient, cached by the adapter for 8h) a short list of alternatives the
 * Nutridigm API ranks as helpful-or-better for the profile's conditions
 * WITHIN that ingredient's own fine food group — see
 * `getIngredientAlternatives` in adapter.js for why swaps stay inside the
 * category rather than proposing a different food group entirely.
 *
 * Swaps are view-local on purpose: tapping an alternative rewrites the row in
 * place (with an Undo) so the user can see what the dish becomes, but nothing
 * is persisted, saved to the plan, or sent anywhere — this card is a reading
 * surface, and the recipe's real ingredient list is whatever its source says.
 *
 * Honest states, never collapsed into one: a per-ingredient fetch shows a
 * skeleton while loading, a retryable message on a real API failure, and a
 * plain "no alternatives" line only when the API genuinely returned nothing
 * usable for that group. An ingredient with no resolvable food group gets no
 * swap button at all rather than a button that can only disappoint.
 *
 * @param {Object} props
 * @param {Array<{name: string, foodItemID: number|null, group?: string, suggestGroup: string|null}>} props.ingredients
 * @param {boolean} props.derived - true when the list was read off the recipe
 *   name rather than transcribed from the source recipe (see
 *   ingredientDerivation.js) — drives the caption under the heading.
 * @param {Object} props.profile - `{ conditions: number[] }`
 */
export default function IngredientSwaps({ ingredients, derived, profile }) {
  const [openKey, setOpenKey] = useState(null);
  // key -> { status: 'loading'|'success'|'error', items: [] }
  const [altsByKey, setAltsByKey] = useState({});
  // key -> chosen alternative candidate
  const [swaps, setSwaps] = useState({});

  const keyOf = (ing, i) => `${ing.foodItemID ?? 'n'}:${i}`;

  const load = useCallback(async (key, ingredient) => {
    setAltsByKey((prev) => ({ ...prev, [key]: { status: 'loading', items: [] } }));
    try {
      const { alternatives } = await getIngredientAlternatives(profile, ingredient);
      setAltsByKey((prev) => ({ ...prev, [key]: { status: 'success', items: alternatives } }));
    } catch {
      setAltsByKey((prev) => ({ ...prev, [key]: { status: 'error', items: [] } }));
    }
  }, [profile]);

  // Which ingredients have already had their one fetch kicked off. A ref (not
  // derived from `altsByKey`) so the decision can't be made inside a state
  // updater, which React is free to call more than once.
  const requested = useRef(new Set());

  const toggle = useCallback((key, ingredient) => {
    setOpenKey((current) => (current === key ? null : key));
    // Fetch once per ingredient per card open — a previous error is retried
    // through the Retry button below, not by re-opening the row.
    if (!requested.current.has(key)) {
      requested.current.add(key);
      load(key, ingredient);
    }
  }, [load]);

  if (!ingredients?.length) return null;

  return (
    <div className="rounded-xl border border-neutral-300/50 shadow-xs bg-white p-4">
      <p className="text-[11px] font-label tracking-[0.14em] uppercase text-char-400">
        Ingredients
      </p>
      <p className="text-[11px] text-char-400 font-sans mt-1 mb-3 leading-snug">
        {derived
          ? 'Read from the recipe name — tap one to see healthier swaps for your conditions.'
          : 'From the source recipe — tap one to see healthier swaps for your conditions.'}
      </p>

      <ul className="flex flex-col divide-y divide-sand-100">
        {ingredients.map((ing, i) => {
          const key = keyOf(ing, i);
          const isOpen = openKey === key;
          const state = altsByKey[key];
          const swap = swaps[key];
          const canSwap = !!ing.suggestGroup;

          return (
            <li key={key} className="py-2 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-sans text-char-700 leading-snug truncate">
                    {swap ? swap.name : ing.name}
                  </p>
                  {swap && (
                    <button
                      type="button"
                      onClick={() => setSwaps((prev) => {
                        const next = { ...prev };
                        delete next[key];
                        return next;
                      })}
                      className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-sans text-char-400 hover:text-char-700 transition-colors duration-fast"
                    >
                      <RotateCcw size={11} aria-hidden="true" />
                      <span className="truncate">instead of {ing.name} — undo</span>
                    </button>
                  )}
                </div>

                {canSwap && (
                  <button
                    type="button"
                    onClick={() => toggle(key, ing)}
                    aria-expanded={isOpen}
                    className="tap-target flex-shrink-0 h-8 pl-2.5 pr-2 rounded-full bg-sand-50 border border-neutral-200
                      flex items-center gap-1 text-char-500 text-xs font-sans
                      hover:bg-sand-100 hover:text-char-700 transition-all duration-fast"
                  >
                    <ArrowLeftRight size={13} aria-hidden="true" />
                    <span>Swap</span>
                    <ChevronDown
                      size={13}
                      aria-hidden="true"
                      className="transition-transform duration-fast"
                      style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    />
                  </button>
                )}
              </div>

              {isOpen && (
                <div className="mt-2 rounded-lg bg-paper-100 p-2">
                  {(!state || state.status === 'loading') && (
                    <div className="flex flex-col gap-2 py-1">
                      <Skeleton shape="text" className="w-2/3" />
                      <Skeleton shape="text" className="w-1/2" />
                    </div>
                  )}

                  {state?.status === 'error' && (
                    <div className="flex items-center justify-between gap-2 py-1">
                      <p className="text-[11px] font-sans text-char-500">
                        Couldn&apos;t load alternatives.
                      </p>
                      <button
                        type="button"
                        onClick={() => load(key, ing)}
                        className="flex-shrink-0 px-3 py-1.5 rounded-xs bg-forest-700 text-white text-[11px] font-semibold font-sans
                          transition-all duration-fast ease-ds-out hover:bg-forest-800 active:scale-[0.98]"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {state?.status === 'success' && state.items.length === 0 && (
                    <p className="text-[11px] font-sans text-char-500 py-1">
                      No better-rated alternatives in this food group for your conditions.
                    </p>
                  )}

                  {state?.status === 'success' && state.items.length > 0 && (
                    <ul className="flex flex-col gap-1">
                      {state.items.map((alt) => {
                        const chosen = swap?.id === alt.id;
                        return (
                          <li key={alt.id}>
                            <button
                              type="button"
                              onClick={() => setSwaps((prev) => ({ ...prev, [key]: alt }))}
                              className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg text-left
                                transition-all duration-fast hover:bg-white active:scale-[0.99]
                                ${chosen ? 'bg-white shadow-xs' : ''}`}
                            >
                              <img
                                src={alt.image || getIngredientImage(alt.name, alt.group, getOverlayImageFile(alt.id))}
                                alt=""
                                className="w-9 h-9 rounded-lg object-cover object-center flex-shrink-0"
                                loading="lazy"
                              />
                              <span className="flex-1 min-w-0 text-[13px] font-sans text-char-700 truncate">
                                {alt.name}
                              </span>
                              <FoodRating numericId={alt.numericId} size={12} tone="light" className="flex-shrink-0" />
                              {chosen && <Check size={14} className="text-forest-700 flex-shrink-0" aria-hidden="true" />}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
