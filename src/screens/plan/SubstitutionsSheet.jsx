import { useEffect, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import BottomSheet from '../../components/shared/BottomSheet.jsx';
import FoodImageCard from '../../components/shared/FoodImageCard.jsx';
import { getSlotSubstitutes } from '../../api/api.js';
import { getIngredientImage } from '../../api/ingredientImages.js';

function cardImage(item) {
  return item.image || getIngredientImage(item.name, item.group);
}

/**
 * SubstitutionsSheet — the Plan screen's per-SLOT "Substitutions" affordance
 * (see SlotSection's pill, next to Shuffle): ONE sheet covers every item
 * currently in the slot, grouped by which original item each substitute is
 * for ("Instead of {name}") — a slot with 3 lunch recipes gets one sheet
 * covering all 3, not one trigger per card.
 *
 * This is deliberately structurally distinct from the deleted SwapSheet (see
 * REMEDI_MASTER_PLAN.md:194 — "SwapSheet — already deleted ... don't
 * reintroduce it"): SwapSheet was a single-food, per-card trigger with an
 * `onSwap(alternative)` callback that mutated ingredients directly. Here the
 * trigger is per-slot, and swapping is composed from the existing
 * `removeFromSlot`/`insertIntoSlot` primitives by the caller (see
 * MealQueueScreen.jsx's `handleSwapSubstitute`) — this component never
 * mutates plan state itself, it only calls the `onSwap` callback it's given.
 *
 * Data: fetches via `getSlotSubstitutes` (src/api/adapter.js) in a plain
 * effect keyed on `open`, with local loading/error state — no custom data
 * hook, matching the convention already used by MealQueueScreen/
 * RecipesScreen. Every candidate arrives already filtered through the same
 * safety gate as the rest of the Plan screen (numericId 1-4 only).
 *
 * Interaction: tapping a substitute row opens its existing read-only detail
 * card via `onSelect` (the caller's `handleSelect`, passed straight through —
 * this component never owns FoodDetailCard state). The "Swap in" corner
 * action (FoodImageCard's `action` slot, same pattern SlotSection uses for
 * its Remove/X icon) is a SEPARATE tap target that calls
 * `onSwap(sourceItem, substitute)` — opening detail and swapping in are never
 * the same click handler.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.slotLabel
 * @param {import('../../state/dailyPlan.js').PlanItem[]} props.sourceItems - the slot's current items
 * @param {import('../../api/types.js').Profile} props.profile
 * @param {(substitute: Object) => void} props.onSelect - opens the substitute's read-only detail card
 * @param {(sourceItem: Object, substitute: Object) => void} props.onSwap - swap a substitute into the plan in place of sourceItem
 */
export default function SubstitutionsSheet({
  open,
  onClose,
  slotLabel,
  sourceItems,
  profile,
  onSelect,
  onSwap,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bySourceItem, setBySourceItem] = useState([]);
  const [retryToken, setRetryToken] = useState(0);

  // Reset transient fetch state each time the sheet OPENS (guarded
  // render-time state adjustment — same escape hatch MealPlannerPicker.jsx
  // uses for its own open-reset, rather than an effect, since synchronous
  // setState in an effect body trips react-hooks/set-state-in-effect).
  const [sessionOpen, setSessionOpen] = useState(false);
  if (open && !sessionOpen) {
    setSessionOpen(true);
    setLoading(true);
    setError(null);
  } else if (!open && sessionOpen) {
    setSessionOpen(false);
  }

  // Fetch substitutes whenever the sheet opens (or the slot's items / a
  // Retry tap changes). `loading`/`error` are flipped by the render-time
  // reset above (or by `handleRetry`) — this effect only ever fills the
  // result or reports a failure, never sets state synchronously in its own
  // body.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    getSlotSubstitutes(profile, sourceItems)
      .then((result) => {
        if (cancelled) return;
        setBySourceItem(result.bySourceItem);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('SubstitutionsSheet: getSlotSubstitutes failed', err);
        setError(err);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, sourceItems, profile, retryToken]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setRetryToken((t) => t + 1);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Substitutions">
      <p className="text-xs text-char-500 mb-4">
        Acceptable substitutes for {slotLabel}, scored against your conditions.
      </p>

      {loading && (
        <p className="text-sm text-blue-950/60 py-6 text-center">Finding substitutes…</p>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center gap-3 py-6">
          <p className="text-sm text-blue-950/70 text-center">
            Could not load substitutions — try again.
          </p>
          <button
            onClick={handleRetry}
            className="rounded-pill bg-blue-950 text-white text-sm font-semibold font-sans px-4 py-2
              hover:bg-blue-900 active:scale-[0.99] transition-all duration-fast"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="flex flex-col gap-6">
          {bySourceItem.map(({ sourceItem, substitutes }) => (
            <div key={sourceItem.id}>
              <p className="font-label text-xs tracking-widest uppercase text-blue-950/50 mb-2">
                Instead of {sourceItem.name}
              </p>

              {substitutes.length === 0 ? (
                <p className="text-sm text-blue-950/50 py-1">
                  No confident substitutes yet for this one.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {substitutes.map((substitute) => (
                    <FoodImageCard
                      key={substitute.id}
                      id={substitute.id}
                      image={cardImage(substitute)}
                      numericId={substitute.numericId}
                      title={substitute.name}
                      subtitle={substitute.kind === 'recipe' ? substitute.sourceName : undefined}
                      aspectRatio="4/5"
                      onClick={() => onSelect(substitute)}
                      action={() => (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); onSwap(sourceItem, substitute); }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              onSwap(sourceItem, substitute);
                            }
                          }}
                          aria-label={`Swap in ${substitute.name}`}
                          className="tap-target w-8 h-8 rounded-full flex items-center justify-center shadow-sm
                            transition-all duration-fast active:scale-95 cursor-pointer
                            bg-white/90 hover:bg-white hover:shadow-md"
                        >
                          <ArrowLeftRight size={14} className="text-char-500" aria-hidden="true" />
                        </span>
                      )}
                      className="w-full"
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
