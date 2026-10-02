import { useEffect, useState } from 'react';
import { ArrowLeftRight, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import BottomSheet from '../../components/shared/BottomSheet.jsx';
import FoodImageCard from '../../components/shared/FoodImageCard.jsx';
import {
  getSlotSubstitutes,
  getCandidatesForSlot,
  getFineFoodGroups,
  getFineGroupSuggestions,
  getGroupLabels,
} from '../../api/api.js';
import { getIngredientImage } from '../../api/ingredientImages.js';
import { getOverlayImageFile } from '../../api/localTables.js';
import { COARSE_GROUP_LABELS } from '../../api/config.js';
import { FINE_GROUP_IMAGES } from '../../assets/food-groups/index.js';

function cardImage(item) {
  return item.image || getIngredientImage(item.name, item.group, getOverlayImageFile(item.id));
}

/**
 * The fine food group a Plan item's substitutes are scoped by — mirrors
 * adapter.js's private `scopingGroupsForItem` (same fields, kept in sync
 * deliberately: a food-kind item scopes by its own `fineGroup`; a
 * recipe-kind item's own `fineGroup` is always the hardcoded recipe group
 * 'l', so it uses `substituteFineGroup` instead). Used here purely to find
 * which of the slot's CURRENT items (if any) the user is looking at an
 * "Instead of {name}" swap list for, inside a tapped group's Level 2 view —
 * never to refetch or rescope anything (`getSlotSubstitutes` already did
 * that fetch-side scoping).
 * @param {import('../../state/dailyPlan.js').PlanItem} item
 * @returns {string|null}
 */
function scopingGroupFor(item) {
  return item.kind === 'recipe' ? item.substituteFineGroup ?? null : item.fineGroup || null;
}

/**
 * Buckets a flat `getFineFoodGroups()` menu into coarse-family groups,
 * preserving the input's order (ascending by code, so each coarse family's
 * entries are already contiguous — see getFineFoodGroups's own docblock).
 * Deliberately duplicated from `src/screens/suggestions/SuggestTab.jsx`'s
 * identically-named helper rather than imported — same reasoning this file
 * has always used for adapting GroupsTab/SuggestTab's visual pattern inline
 * instead of importing their components (see module doc below): that file
 * is owned by a different part of this build and wired to route navigation,
 * not a sheet, so this keeps its own copy rather than creating a cross-owner
 * dependency between files worked on in parallel.
 * @param {Array<{code: string, label: string, coarse: string}>} fineGroups
 * @returns {Array<{coarse: string, groups: Array<{code: string, label: string, coarse: string}>}>}
 */
function bucketFineGroups(fineGroups) {
  const buckets = [];
  const byCoarse = new Map();
  for (const fg of fineGroups ?? []) {
    let bucket = byCoarse.get(fg.coarse);
    if (!bucket) {
      bucket = { coarse: fg.coarse, groups: [] };
      byCoarse.set(fg.coarse, bucket);
      buckets.push(bucket);
    }
    bucket.groups.push(fg);
  }
  return buckets;
}

/**
 * Plan-safety filter for `getFineGroupSuggestions` items (Wave 4). That
 * function was built for the Suggest browse surface and deliberately
 * returns the FULL condition-ranked spread, numericId 1-7 — including the
 * "Avoid" end (5-7) — because a browse list's whole point is showing a food
 * group's full picture (see its doc in adapter.js). A Plan slot must NEVER
 * offer a harmful item, the same invariant `normalizePlanGroup` enforces for
 * every other Plan-facing list in this app — so anything headed for this
 * sheet's `onAdd` must be re-filtered to numericId 1-4 here, at the one call
 * site that crosses from the browse data layer into the Plan surface.
 * `isExcludedItem` (lifestyle/recipe fine-group exclusion) is already baked
 * into `getFineGroupSuggestions` upstream — not re-applied here.
 *
 * Also stamps `kind: 'food'`, which `getFineGroupSuggestions` items never
 * carry (they're not PlanCandidates — see that function's doc) but which
 * `toPlanItem` (planBuilder.js) and the save/nutrition paths downstream
 * genuinely need. Every item here is implicitly food-kind already —
 * `getFineFoodGroups()` excludes the recipe fine group 'l' from its menu —
 * so this never mislabels a recipe as a food.
 * @param {Array<Object>} items - `getFineGroupSuggestions` result items
 * @returns {Array<Object>} Plan-safe, `kind`-stamped candidates
 */
function toPlanSafeCandidates(items) {
  return items
    .filter((item) => item.numericId != null && item.numericId >= 1 && item.numericId <= 4)
    .map((item) => ({ ...item, kind: 'food' }));
}

/**
 * A single tap-to-add/tap-to-view candidate card — the exact card markup
 * both the "All {slot} options" section and the group-browse "+Add" list
 * use, factored out so the call sites can't drift.
 */
function CandidateCard({ candidate, onSelect, onAdd }) {
  return (
    <FoodImageCard
      id={candidate.id}
      image={cardImage(candidate)}
      numericId={candidate.numericId}
      title={candidate.name}
      subtitle={candidate.kind === 'recipe' ? candidate.sourceName : undefined}
      aspectRatio="4/5"
      onClick={() => onSelect(candidate)}
      action={() => (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onAdd(candidate); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onAdd(candidate);
            }
          }}
          aria-label={`Add ${candidate.name} to plan`}
          className="tap-target w-8 h-8 rounded-full flex items-center justify-center shadow-sm
            transition-all duration-fast active:scale-95 cursor-pointer
            bg-white/90 hover:bg-white hover:shadow-md"
        >
          <Plus size={16} className="text-char-500" aria-hidden="true" />
        </span>
      )}
      className="w-full"
    />
  );
}

/**
 * SuggestionsSheet — the Plan screen's per-SLOT "See other healthy
 * suggestions" affordance (Task 11; renamed + re-skinned from the former
 * "Substitutions" icon+sheet — see SlotSection.jsx's trigger, now a plain
 * text link instead of an icon button, and Wave 4's rename of the link
 * copy itself). ONE sheet still covers every item currently in the slot — a
 * slot with 3 lunch recipes needs only one trigger, not one per card
 * (unchanged from before; see the file this replaced, SubstitutionsSheet.jsx,
 * for the fuller "why this must stay distinct from the deleted SwapSheet"
 * history).
 *
 * What changed (Task 11, per explicit product direction): the picker's
 * SHAPE matches the website's Suggest screen (`src/screens/suggestions/
 * SuggestTab.jsx`'s fine-group photo-row pattern, itself adapted from the
 * older `GroupsTab.jsx`'s `CategoryGrid`) instead of a flat "Instead of
 * {name}" card list. This is a two-level view:
 *   - Level 1 (default): a single-column list of rows, one per fine food
 *     group, each fronted by its own true photo (FINE_GROUP_IMAGES,
 *     src/assets/food-groups) — same visual/interaction pattern as
 *     SuggestTab's fine-group list (tap a row to drill in).
 *   - Level 2 (a tile tapped): that group's suggestions, with a `+` to add
 *     straight into the slot, PLUS (see Wave 4 note below) any "Instead of
 *     {name}" swap tiles for a current slot item that genuinely scopes to
 *     this exact group.
 * `SuggestTab.jsx`/`GroupsTab.jsx` themselves are NOT reused directly
 * (they're wired to route navigation, not a sheet, and live in
 * src/screens/suggestions/, owned by another agent/wave) — this adapts the
 * same pattern inline instead (see `bucketFineGroups` above, deliberately
 * duplicated rather than imported), per the task's own "your call, adapt
 * inline" option.
 *
 * WAVE 4 — FULL MENU, NOT A SLOT SUBSET (per explicit product direction:
 * "bring to the full menu of the suggest menu, get rid of the subset"):
 * Level 1 now lists ALL 17 fine food groups from `getFineFoodGroups()`,
 * bucketed under coarse-family headers exactly like SuggestTab — NOT
 * `PLAN_SLOTS[slotKey].fineGroups` (2-3 groups curated for that slot's
 * auto-fill, config.js), which stays untouched and still drives
 * `ensurePlanForWeek`/`shuffleSlot`'s own candidate pools; it's just no
 * longer what this PICKER offers. Tapping any of the 17 groups fetches that
 * group's suggestions via `getFineGroupSuggestions` (the same data the
 * Suggest browse surface uses) — re-filtered to numericId 1-4 by
 * `toPlanSafeCandidates` above, since that function's full 1-7 spread is
 * wrong for a Plan-facing list (see its doc). Every group is reachable and
 * populated regardless of what's currently in the slot.
 *
 * THE TASK 13 EMPTY-SCOPE BRANCH IS GONE, AND WHY IT'S NO LONGER NEEDED: the
 * OLD two-level picker was scoped by what's ALREADY IN the slot
 * (`scopingGroupFor` on each current item) — Level 1 was literally built
 * from `slot.fineGroups` intersected with whatever groups the current items
 * happened to resolve to. For an EMPTY slot, or a slot whose items all fell
 * outside the small C1 overlay dataset (`substituteFineGroup: null` on every
 * recipe — e.g. Lunch), that gave the picker nothing to group by, so Task 13
 * added a `noScopedItems` escape hatch that skipped the whole two-level view
 * for that case. The Wave 4 full menu has NO such dependency — it lists the
 * same 17 groups and fetches real suggestions for whichever one is tapped
 * regardless of the slot's current contents — so that failure mode is
 * structurally impossible now, and the conditional branch built to work
 * around it has been deleted outright rather than kept as dead code.
 *
 * `onSwap` IS STILL A DIFFERENT THING FROM `onAdd` AND STILL WORKS: the old
 * "Instead of {name}" swap tiles (scoped substitutes for a specific CURRENT
 * slot item, via `getSlotSubstitutes`) are not the same feature as adding a
 * fresh item from the full menu, and keeping them was explicit scope here.
 * `bySourceItem` (from `getSlotSubstitutes`, unchanged) is still fetched on
 * open; `scopingGroupFor` still resolves which fine group each current item
 * scopes to. When the user drills into a Level 2 group that happens to be a
 * current item's scope group, that item's "Instead of {name}" swap tiles
 * render above the general group list, using `onSwap` exactly as before —
 * this is now purely a LOOKUP (`bySourceItem.filter(...)`) rather than the
 * thing gating whether Level 1 even renders. A failed/slow
 * `getSlotSubstitutes` fetch degrades this supplementary section to empty
 * (console.error'd, no dedicated Retry UI) rather than blocking the group's
 * main suggestion list, which has its own independent loading/error state.
 *
 * FULL LIST, ALWAYS SHOWN (Task 12, "Suggestions must show the full list for
 * the slot") — UNCHANGED, explicitly kept per this wave's instructions:
 * below the group picker, this sheet ALWAYS shows an "All {slot} options"
 * section — that slot's full candidate pool (`getCandidatesForSlot`,
 * planBuilder.js — same cached candidates `ensurePlanForWeek`/`shuffleSlot`
 * draw from, zero extra network calls) minus whatever's already in the
 * slot, with no truncation. Tapping a card here ADDS it to the slot
 * (`onAdd`) rather than swapping it in for a specific source item, since
 * these candidates aren't tied to any one current item. Fetched via its own
 * effect/loading/error state (`fullCandidates`/`fullLoading`/`fullError`),
 * independent of every other fetch on this sheet, so one failing/being slow
 * never blocks the others' content.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {import('../../api/config.js').PLAN_SLOTS[number]|null} props.slot - the slot this sheet is open for (label + key; `fineGroups` is no longer read here — Level 1 is the full 17-group menu, not this slot's curated subset)
 * @param {import('../../state/dailyPlan.js').PlanItem[]} props.sourceItems - the slot's current items
 * @param {import('../../api/types.js').Profile} props.profile
 * @param {(substitute: Object) => void} props.onSelect - opens the substitute's read-only detail card
 * @param {(sourceItem: Object, substitute: Object) => void} props.onSwap - swap a substitute into the plan in place of sourceItem
 * @param {(candidate: Object) => void} props.onAdd - add a candidate straight
 *   into the slot (group-browse "+", and the always-shown "All options"
 *   section) — no source item to swap for.
 */
export default function SuggestionsSheet({
  open,
  onClose,
  slot,
  sourceItems,
  profile,
  onSelect,
  onSwap,
  onAdd,
}) {
  const [fineGroups, setFineGroups] = useState([]);
  const [fineGroupsLoading, setFineGroupsLoading] = useState(true);
  const [coarseLabels, setCoarseLabels] = useState({});
  const [activeGroup, setActiveGroup] = useState(null); // { code, label, coarse } | null

  const [groupLoading, setGroupLoading] = useState(false);
  const [groupError, setGroupError] = useState(null);
  const [groupCandidates, setGroupCandidates] = useState([]);

  const [scopedLoading, setScopedLoading] = useState(false);
  const [bySourceItem, setBySourceItem] = useState([]);

  const [fullLoading, setFullLoading] = useState(false);
  const [fullError, setFullError] = useState(null);
  const [fullCandidates, setFullCandidates] = useState([]);

  const [retryToken, setRetryToken] = useState(0);

  // The 17-group menu + coarse labels are profile-independent and cached
  // (getFineFoodGroups reads a bundled local table — no network round trip;
  // getGroupLabels is the same cached dictionary SuggestTab/GroupsTab use),
  // so this fetches once and doesn't need to re-run per slot/open — unlike
  // every other fetch on this sheet, it's not keyed on `open`/`slot`.
  useEffect(() => {
    let cancelled = false;
    Promise.all([getFineFoodGroups(), getGroupLabels()])
      .then(([groups, { coarse }]) => {
        if (cancelled) return;
        setFineGroups(groups);
        setCoarseLabels(Object.fromEntries(coarse));
      })
      .catch((err) => {
        console.error('SuggestionsSheet: failed to load fine food groups', err);
        // Graceful fallback, same reasoning as SuggestTab: labels fall back
        // to COARSE_GROUP_LABELS/the raw code at render time.
      })
      .finally(() => {
        if (!cancelled) setFineGroupsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Reset transient fetch state (and the drill-down level) each time the
  // sheet OPENS — guarded render-time state adjustment, same escape hatch
  // MealPlannerPicker.jsx/the former SubstitutionsSheet used, rather than an
  // effect, since synchronous setState in an effect body trips
  // react-hooks/set-state-in-effect.
  const [sessionOpen, setSessionOpen] = useState(false);
  if (open && !sessionOpen) {
    setSessionOpen(true);
    setScopedLoading(true);
    setFullLoading(true);
    setFullError(null);
    setActiveGroup(null);
  } else if (!open && sessionOpen) {
    setSessionOpen(false);
  }

  // Task 12: fetch the slot's full candidate pool — ALWAYS, independent of
  // the group picker above (see the module doc's "FULL LIST, ALWAYS SHOWN"
  // note). Minus whatever's already in the slot; no truncation.
  useEffect(() => {
    if (!open || !slot) return;
    let cancelled = false;
    const existingIds = new Set(sourceItems.map((item) => item.id));
    getCandidatesForSlot(profile, slot.key)
      .then((candidates) => {
        if (cancelled) return;
        setFullCandidates(candidates.filter((c) => !existingIds.has(c.id)));
        setFullLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('SuggestionsSheet: getCandidatesForSlot failed', err);
        setFullError(err);
        setFullLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, slot, sourceItems, profile, retryToken]);

  // "Instead of {name}" swap data — fetched whenever the sheet is open,
  // regardless of whether the slot is empty or has any scoped item
  // (`getSlotSubstitutes` already no-ops cleanly with no items/conditions —
  // see its own guard in adapter.js). Supplementary to the group picker
  // (Wave 4): a failure here degrades to "no swap tiles for this group"
  // rather than blocking anything, so it's logged but doesn't surface its
  // own error/Retry UI.
  useEffect(() => {
    if (!open || !slot) return;
    let cancelled = false;
    getSlotSubstitutes(profile, sourceItems)
      .then((result) => {
        if (cancelled) return;
        setBySourceItem(result.bySourceItem);
        setScopedLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('SuggestionsSheet: getSlotSubstitutes failed', err);
        setBySourceItem([]);
        setScopedLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, slot, sourceItems, profile, retryToken]);

  // Level 2: the tapped group's own suggestions, Plan-safety-filtered (see
  // `toPlanSafeCandidates`'s doc for why `getFineGroupSuggestions`'s raw 1-7
  // spread can't be used as-is here) and minus whatever's already in the
  // slot (same "don't offer what's already here" rule the full-list section
  // follows).
  useEffect(() => {
    if (!open || !activeGroup) return;
    let cancelled = false;
    const existingIds = new Set(sourceItems.map((item) => item.id));
    getFineGroupSuggestions(profile, activeGroup.code)
      .then(({ items }) => {
        if (cancelled) return;
        setGroupCandidates(toPlanSafeCandidates(items).filter((c) => !existingIds.has(c.id)));
        setGroupLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('SuggestionsSheet: getFineGroupSuggestions failed', err);
        setGroupError(err);
        setGroupLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, activeGroup, sourceItems, profile, retryToken]);

  const handleRetry = () => {
    setScopedLoading(true);
    setFullLoading(true);
    setFullError(null);
    if (activeGroup) {
      setGroupLoading(true);
      setGroupError(null);
    }
    setRetryToken((t) => t + 1);
  };

  const buckets = bucketFineGroups(fineGroups);

  // Which current slot item(s), if any, genuinely scope to the group the
  // user has drilled into — see the module doc's "onSwap IS STILL A
  // DIFFERENT THING" note. Empty while `scopedLoading`, which simply means
  // these tiles haven't appeared yet rather than that none exist.
  const scopedEntriesForActiveGroup = (!scopedLoading && activeGroup)
    ? bySourceItem.filter((entry) => scopingGroupFor(entry.sourceItem) === activeGroup.code)
    : [];

  return (
    <BottomSheet open={open} onClose={onClose} title="Suggestions">
      <div className="flex flex-col gap-8">
        {/* Group picker — Level 1 (all 17 fine groups) / Level 2 (one
            group's suggestions + any "Instead of {name}" swap tiles).
            Always rendered (Wave 4 — see module doc on the removed Task 13
            branch); not gated on the slot's current contents. */}
        <div>
          {fineGroupsLoading && (
            <p className="text-sm text-blue-950/60 py-6 text-center">Loading food groups…</p>
          )}

          {!fineGroupsLoading && !activeGroup && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-char-500">
                Browse any food group to find acceptable options for {slot?.label}, scored against your conditions.
              </p>
              <div className="flex flex-col gap-4">
                {buckets.map((bucket) => (
                  <div key={bucket.coarse} className="flex flex-col gap-2.5">
                    {/* Single-fine-group families (d/e/f today) skip the
                        header — same reasoning as SuggestTab: the header's
                        label would just repeat the single row beneath it. */}
                    {bucket.groups.length > 1 && (
                      <h3 className="text-xs font-sans font-semibold uppercase tracking-wide text-char-400 px-1">
                        {coarseLabels[bucket.coarse] ?? COARSE_GROUP_LABELS[bucket.coarse] ?? bucket.coarse}
                      </h3>
                    )}
                    {bucket.groups.map((fg) => (
                      <button
                        key={fg.code}
                        onClick={() => {
                          // Reset here (the click handler), not inside the
                          // Level 2 fetch effect below — setState synchronously
                          // at the top of an effect body triggers cascading
                          // renders (react-hooks/set-state-in-effect); an event
                          // handler has no such restriction.
                          setGroupLoading(true);
                          setGroupError(null);
                          setActiveGroup(fg);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-sm bg-white border border-sand-200 shadow-xs text-left
                          transition-all duration-fast hover:border-forest-300 hover:shadow-card active:scale-[0.99]"
                      >
                        <img
                          src={FINE_GROUP_IMAGES[fg.code]}
                          alt=""
                          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-sans text-base font-semibold text-char-900 leading-snug">{fg.label}</p>
                        </div>
                        <ChevronRight size={16} className="text-char-400 shrink-0" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!fineGroupsLoading && activeGroup && (
            <div className="flex flex-col gap-4">
              <button
                onClick={() => setActiveGroup(null)}
                className="inline-flex items-center gap-1 self-start text-sm font-semibold font-sans text-blue-950/70
                  hover:text-blue-950 transition-colors duration-fast"
              >
                <ChevronLeft size={16} aria-hidden="true" />
                {activeGroup.label}
              </button>

              {scopedEntriesForActiveGroup.length > 0 && (
                <div className="flex flex-col gap-6">
                  {scopedEntriesForActiveGroup.map(({ sourceItem, substitutes }) => (
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

              <div className="flex flex-col gap-3">
                {scopedEntriesForActiveGroup.length > 0 && (
                  <p className="font-label text-xs tracking-widest uppercase text-blue-950/50">
                    More from {activeGroup.label}
                  </p>
                )}

                {groupLoading && (
                  <p className="text-sm text-blue-950/60 py-6 text-center">Finding suggestions…</p>
                )}

                {!groupLoading && groupError && (
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

                {!groupLoading && !groupError && (
                  groupCandidates.length === 0 ? (
                    <p className="text-sm text-blue-950/50 py-1">
                      No confident suggestions yet for this group.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {groupCandidates.map((candidate) => (
                        <CandidateCard key={candidate.id} candidate={candidate} onSelect={onSelect} onAdd={onAdd} />
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Task 12: full candidate list for this slot — ALWAYS shown (never
            truncated), on top of the group picker above. Tapping a card
            ADDS it to the slot (no source item to swap for). */}
        <div className="flex flex-col gap-4">
          <p className="font-label text-xs tracking-widest uppercase text-blue-950/50">
            All {slot?.label} options
          </p>
          <p className="text-xs text-char-500">
            {sourceItems.length === 0
              ? `Nothing in ${slot?.label} yet — add one of these, scored against your conditions.`
              : `More options for ${slot?.label}, scored against your conditions.`}
          </p>

          {fullLoading && (
            <p className="text-sm text-blue-950/60 py-6 text-center">Finding options…</p>
          )}

          {!fullLoading && fullError && (
            <div className="flex flex-col items-center gap-3 py-6">
              <p className="text-sm text-blue-950/70 text-center">
                Could not load options — try again.
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

          {!fullLoading && !fullError && (
            fullCandidates.length === 0 ? (
              <p className="text-sm text-blue-950/50 py-1">
                No suggestions yet for {slot?.label}.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {fullCandidates.map((candidate) => (
                  <CandidateCard key={candidate.id} candidate={candidate} onSelect={onSelect} onAdd={onAdd} />
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
