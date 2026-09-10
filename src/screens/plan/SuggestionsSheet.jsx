import { useEffect, useState } from 'react';
import { ArrowLeftRight, ChevronLeft } from 'lucide-react';
import { Fish, Egg, Apple, Carrot, Wheat, Milk, Cookie, Soup, Sparkles, Pill } from 'lucide-react';
import BottomSheet from '../../components/shared/BottomSheet.jsx';
import FoodImageCard from '../../components/shared/FoodImageCard.jsx';
import { getSlotSubstitutes, getGroupLabel } from '../../api/api.js';
import { getIngredientImage } from '../../api/ingredientImages.js';

function cardImage(item) {
  return item.image || getIngredientImage(item.name, item.group);
}

// Coarse-letter icon lookup, keyed the same way GroupsTab.jsx's
// CATEGORY_GRID_ICONS is (that map isn't exported — src/screens/suggestions/
// is owned by another agent, so this is a small, deliberate local duplicate
// rather than reaching into that file). A fine group code's first character
// is always its coarse group letter (e.g. 'b1' -> 'b', 'c2' -> 'c').
const GROUP_TILE_ICONS = {
  b: Fish, c: Egg, d: Apple, e: Carrot, f: Wheat, g: Milk, h: Cookie, i: Soup, j: Sparkles, k: Pill,
};

/**
 * The fine food group a Plan item's substitutes are scoped by — mirrors
 * adapter.js's private `scopingGroupsForItem` (same fields, kept in sync
 * deliberately: a food-kind item scopes by its own `fineGroup`; a
 * recipe-kind item's own `fineGroup` is always the hardcoded recipe group
 * 'l', so it uses `substituteFineGroup` instead). Used here purely to bucket
 * the already-fetched `bySourceItem` results under the matching group tile —
 * never to refetch or rescope anything (`getSlotSubstitutes` already did
 * that fetch-side scoping).
 * @param {import('../../state/dailyPlan.js').PlanItem} item
 * @returns {string|null}
 */
function scopingGroupFor(item) {
  return item.kind === 'recipe' ? item.substituteFineGroup ?? null : item.fineGroup || null;
}

/**
 * SuggestionsSheet — the Plan screen's per-SLOT "Suggestions" affordance
 * (Task 11; renamed + re-skinned from the former "Substitutions" icon+sheet —
 * see SlotSection.jsx's trigger, now a plain text link instead of an icon
 * button). ONE sheet still covers every item currently in the slot — a slot
 * with 3 lunch recipes needs only one trigger, not one per card (unchanged
 * from before; see the file this replaced, SubstitutionsSheet.jsx, for the
 * fuller "why this must stay distinct from the deleted SwapSheet" history).
 *
 * What changed (Task 11, per explicit product direction): the picker's
 * SHAPE now matches the website's Suggest screen (`src/screens/suggestions/
 * GroupsTab.jsx`'s `CategoryGrid` tile-grid pattern) instead of a flat
 * "Instead of {name}" card list. Concretely, this is a two-level view:
 *   - Level 1 (default): a grid of tiles, one per fine food group relevant
 *     to this slot (`PLAN_SLOTS[slotKey].fineGroups`, config.js) — same
 *     visual/interaction pattern as GroupsTab's CategoryGrid (tap a tile to
 *     drill in), scoped down from GroupsTab's full 10-coarse-group grid to
 *     just this slot's few fine groups.
 *   - Level 2 (a tile tapped): the substitute cards for that ONE group,
 *     still grouped "Instead of {name}" per current slot item scoped to it.
 * `GroupsTab.jsx`/`GroupDetailScreen.jsx` themselves are NOT reused directly
 * (they're wired to route navigation, not a sheet, and live in
 * src/screens/suggestions/, owned by another agent) — this adapts the same
 * pattern inline instead, per the task's own "your call, adapt inline"
 * option.
 *
 * Data/swap flow is UNCHANGED: still `getSlotSubstitutes` (adapter.js) for
 * data and the caller's `onSwap` (MealQueueScreen's `handleSwapSubstitute`,
 * composed from the existing removeFromSlot/insertIntoSlot primitives) for
 * swapping — this component only reshapes how the SAME `bySourceItem`
 * result is grouped/displayed (by fine group, in two steps) and never
 * invents a new fetch or a new mutation path.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {import('../../api/config.js').PLAN_SLOTS[number]|null} props.slot - the slot this sheet is open for (label + fineGroups)
 * @param {import('../../state/dailyPlan.js').PlanItem[]} props.sourceItems - the slot's current items
 * @param {import('../../api/types.js').Profile} props.profile
 * @param {(substitute: Object) => void} props.onSelect - opens the substitute's read-only detail card
 * @param {(sourceItem: Object, substitute: Object) => void} props.onSwap - swap a substitute into the plan in place of sourceItem
 */
export default function SuggestionsSheet({
  open,
  onClose,
  slot,
  sourceItems,
  profile,
  onSelect,
  onSwap,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bySourceItem, setBySourceItem] = useState([]);
  const [retryToken, setRetryToken] = useState(0);
  const [groupLabels, setGroupLabels] = useState({});
  const [activeGroup, setActiveGroup] = useState(null);

  // Reset transient fetch state (and the drill-down level) each time the
  // sheet OPENS — guarded render-time state adjustment, same escape hatch
  // MealPlannerPicker.jsx/the former SubstitutionsSheet used, rather than an
  // effect, since synchronous setState in an effect body trips
  // react-hooks/set-state-in-effect.
  const [sessionOpen, setSessionOpen] = useState(false);
  if (open && !sessionOpen) {
    setSessionOpen(true);
    setLoading(true);
    setError(null);
    setActiveGroup(null);
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
        console.error('SuggestionsSheet: getSlotSubstitutes failed', err);
        setError(err);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, sourceItems, profile, retryToken]);

  // Resolve real display labels for this slot's fine groups (Level 1 tile
  // grid) — cosmetic only; a failed/slow lookup falls back to the raw code
  // rather than blocking the grid (matches GroupsTab's own graceful degrade).
  useEffect(() => {
    if (!open || !slot) return;
    let cancelled = false;
    Promise.all(slot.fineGroups.map((code) => getGroupLabel(code)))
      .then((labels) => {
        if (cancelled) return;
        setGroupLabels(Object.fromEntries(slot.fineGroups.map((code, i) => [code, labels[i]])));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, slot]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setRetryToken((t) => t + 1);
  };

  // Bucket the already-fetched bySourceItem results by which of this slot's
  // fine groups each source item scopes to — see `scopingGroupFor`. An item
  // whose scoping group isn't one of this slot's `fineGroups` (e.g. a recipe
  // outside the C1 overlay dataset, `substituteFineGroup: null`) simply has
  // no tile to surface under — honest degradation, not a new failure mode.
  const bucketed = new Map((slot?.fineGroups ?? []).map((code) => [code, []]));
  for (const entry of bySourceItem) {
    const group = scopingGroupFor(entry.sourceItem);
    if (group && bucketed.has(group)) bucketed.get(group).push(entry);
  }

  const activeEntries = activeGroup ? bucketed.get(activeGroup) ?? [] : [];

  return (
    <BottomSheet open={open} onClose={onClose} title="Suggestions">
      {loading && (
        <p className="text-sm text-blue-950/60 py-6 text-center">Finding suggestions…</p>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center gap-3 py-6">
          <p className="text-sm text-blue-950/70 text-center">
            Could not load suggestions — try again.
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

      {!loading && !error && !activeGroup && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-char-500">
            Browse a food group to find acceptable swaps for {slot?.label}, scored against your conditions.
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {(slot?.fineGroups ?? []).map((code) => {
              const Icon = GROUP_TILE_ICONS[code.charAt(0)] ?? Sparkles;
              const label = groupLabels[code] ?? code;
              const count = bucketed.get(code)?.reduce((n, e) => n + e.substitutes.length, 0) ?? 0;
              return (
                <button
                  key={code}
                  onClick={() => setActiveGroup(code)}
                  className="flex flex-col items-start gap-2 px-3 py-4 rounded-sm bg-white border border-sand-200 shadow-xs text-left
                    transition-all duration-fast hover:border-forest-300 hover:shadow-card active:scale-[0.99]"
                >
                  <div className="w-11 h-11 rounded-lg bg-forest-50 flex items-center justify-center flex-shrink-0">
                    <Icon size={20} className="text-forest-700" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 w-full">
                    <p className="font-sans text-sm font-semibold text-char-900 leading-snug line-clamp-2">{label}</p>
                    <p className="text-[11px] text-char-400 font-sans mt-0.5">
                      {count > 0 ? `${count} suggestion${count === 1 ? '' : 's'}` : 'No suggestions yet'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!loading && !error && activeGroup && (
        <div className="flex flex-col gap-4">
          <button
            onClick={() => setActiveGroup(null)}
            className="inline-flex items-center gap-1 self-start text-sm font-semibold font-sans text-blue-950/70
              hover:text-blue-950 transition-colors duration-fast"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            {groupLabels[activeGroup] ?? activeGroup}
          </button>

          {activeEntries.length === 0 ? (
            <p className="text-sm text-blue-950/50 py-1">
              No confident suggestions yet for this group.
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {activeEntries.map(({ sourceItem, substitutes }) => (
                <div key={sourceItem.id}>
                  <p className="font-label text-xs tracking-widest uppercase text-blue-950/50 mb-2">
                    Instead of {sourceItem.name}
                  </p>

                  {substitutes.length === 0 ? (
                    <p className="text-sm text-blue-950/50 py-1">
                      No confident suggestions yet for this one.
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
        </div>
      )}
    </BottomSheet>
  );
}
