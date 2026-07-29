/**
 * MealPlannerPicker.jsx — full-screen "New meal plan" recipe-picker overlay.
 *
 * Opened by the Plan screen's "New meal plan" FAB. Two tabs (`PillSwitcher`):
 * "Best recipes" (ranked candidate pools from `getMealPlanSuggestions`,
 * refreshable via a windowed re-slice — zero extra network) and "Saved
 * recipes" (the user's library, grouped by meal type). Both render through
 * the shared `BestRecipesRails` with `showAdd` so cards carry a selectable
 * "+"/check toggle. Picks are handed to `generatePlanFromPicks`, which builds
 * a fresh 7-day plan seeded from them (or a fully auto week if nothing was
 * picked) — see planBuilder.js.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, RefreshCw } from 'lucide-react';
import PillSwitcher from '../../components/shared/PillSwitcher.jsx';
import BestRecipesRails from '../../components/shared/BestRecipesRails.jsx';
import FoodDetailCard from '../../components/FoodDetailCard.jsx';
import { getMealPlanSuggestions, generatePlanFromPicks, buildRecipeDetail } from '../../api/api.js';
import { getIngredientImage } from '../../api/ingredientImages.js';
import { getLibrary, subscribeLibrary } from '../../state/library.js';
import { mealTypeForItem } from '../../components/shared/mealTypeMeta.jsx';
import { PLAN_SLOT_KEYS } from '../../api/config.js';

const calmSpring = { type: 'spring', stiffness: 120, damping: 22, mass: 1 };

// How many cards are shown per rail at once — Refresh bumps the window
// forward by this much (wrapping around each slot's own pool length), so
// "refresh" re-slices the already-cached pools instead of re-fetching.
const WINDOW_SIZE = 12;

const TAB_OPTIONS = [
  { key: 'best', label: 'Best recipes' },
  { key: 'saved', label: 'Saved recipes' },
];

function emptySlotMap() {
  return Object.fromEntries(PLAN_SLOT_KEYS.map((key) => [key, []]));
}

/** A `window`-sized, wraparound slice of `pool` starting at `offset`. */
function rotate(pool, offset, window = WINDOW_SIZE) {
  const len = pool.length;
  if (len === 0) return [];
  const size = Math.min(window, len);
  return Array.from({ length: size }, (_, i) => pool[(offset + i) % len]);
}

function SkeletonRails() {
  return (
    <div className="flex flex-col gap-6">
      {PLAN_SLOT_KEYS.map((key) => (
        <div key={key} className="flex flex-col gap-3">
          <div className="h-4 w-24 rounded bg-sand-200 animate-pulse" />
          <div className="flex gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-[150px] shrink-0 rounded-xl bg-sand-200 animate-pulse"
                style={{ aspectRatio: '4/5' }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {boolean} props.open
 * @param {import('../../api/types.js').Profile} props.profile
 * @param {() => void} props.onClose
 * @param {() => void} [props.onGenerated] - called right after a plan is
 *   successfully generated, before `onClose`.
 */
export default function MealPlannerPicker({ open, profile, onClose, onGenerated }) {
  const [activeTab, setActiveTab] = useState('best');
  const [pools, setPools] = useState(emptySlotMap);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [library, setLibrary] = useState(getLibrary);
  const [selected, setSelected] = useState(() => new Map());
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => subscribeLibrary(setLibrary), []);

  // Reset transient session state each time the overlay OPENS (guarded
  // render-time state adjustment — same escape hatch SuggestionsScreen uses
  // for its paramsKey/resolvedFor tab resync — rather than an effect, since
  // synchronous setState in an effect body trips react-hooks/set-state-in-effect).
  const [sessionOpen, setSessionOpen] = useState(false);
  if (open && !sessionOpen) {
    setSessionOpen(true);
    setOffset(0);
    setSelected(new Map());
    setActiveTab('best');
    setSelectedRecipe(null);
    setLoading(true);
  } else if (!open && sessionOpen) {
    setSessionOpen(false);
  }

  // Fetch the ranked candidate pools whenever the picker opens with a
  // resolved profile (getMealPlanSuggestions is cached 8h — cheap to call).
  // `loading` is flipped true by the render-time reset above on open; this
  // effect only ever turns it off / fills pools, so it never sets state
  // synchronously in the effect body itself (matches SuggestionsScreen's
  // BestRecipesTab fetch effect).
  useEffect(() => {
    if (!open || !profile) return;
    let cancelled = false;
    getMealPlanSuggestions(profile)
      .then((res) => {
        if (!cancelled) setPools(res?.candidates || emptySlotMap());
      })
      .catch((err) => {
        console.error('MealPlannerPicker: getMealPlanSuggestions failed', err);
        if (!cancelled) setPools(emptySlotMap());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, profile]);

  // Each item is tagged with the rail (`fromSlot`) it's shown under, so a
  // pick round-trips back to the exact slot it was picked from in
  // `generatePlanFromPicks` (`mealTypeForItem` prefers `fromSlot` over
  // re-inferring from food group, which can be ambiguous across slots).
  const visibleCandidates = useMemo(() => {
    const out = emptySlotMap();
    for (const key of PLAN_SLOT_KEYS) {
      out[key] = rotate(pools[key] || [], offset).map((item) => ({ ...item, fromSlot: key }));
    }
    return out;
  }, [pools, offset]);

  const savedBySlot = useMemo(() => {
    const out = emptySlotMap();
    for (const item of library) {
      const slotKey = mealTypeForItem(item);
      const image = item.image || getIngredientImage(item.name, item.group);
      out[slotKey] = [...(out[slotKey] || []), { ...item, image, fromSlot: slotKey }];
    }
    return out;
  }, [library]);

  const handleRefresh = useCallback(() => {
    setOffset((o) => o + WINDOW_SIZE);
  }, []);

  const handleToggleSelect = useCallback((item) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });
  }, []);

  const selectedIds = useMemo(() => new Set(selected.keys()), [selected]);

  // Seed + enrich the detail card exactly like SuggestionsScreen's
  // BestRecipesTab.openRecipe: immediate seed from the card's own fields,
  // then buildRecipeDetail fills in real per-condition tiers/ingredients.
  const handleSelectCard = useCallback((item) => {
    const seed = {
      foodId: item.id ?? null,
      name: item.name,
      image: item.image,
      sourceName: item.sourceName ?? null,
      matchedConditions: [],
    };
    setSelectedRecipe({
      foodId: seed.foodId,
      name: seed.name,
      image: seed.image,
      sourceName: seed.sourceName,
      conditions: seed.matchedConditions,
      ingredients: [],
      isRecipe: true,
    });
    buildRecipeDetail(seed)
      .then((detail) => setSelectedRecipe({ ...detail, isRecipe: true }))
      .catch(() => {});
  }, []);

  const handleCreatePlan = useCallback(async () => {
    setGenerating(true);
    try {
      await generatePlanFromPicks(profile, [...selected.values()]);
      onGenerated?.();
      onClose?.();
    } catch (err) {
      console.error('MealPlannerPicker: generatePlanFromPicks failed', err);
    } finally {
      setGenerating(false);
    }
  }, [profile, selected, onGenerated, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={calmSpring}
          className="fixed inset-0 z-[60] bg-paper-100 flex flex-col"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 shrink-0 bg-paper-100 border-b border-sand-200
            flex items-center justify-between px-4 py-3">
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm
                transition-all duration-fast hover:shadow-md active:scale-95"
            >
              <X size={18} className="text-char-700" />
            </button>
            <p className="font-display text-base font-semibold text-blue-950">New meal plan</p>
            <button
              onClick={() => console.log('MealPlannerPicker: search is not wired up yet')}
              aria-label="Search"
              className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm
                transition-all duration-fast hover:shadow-md active:scale-95"
            >
              <Search size={18} className="text-char-700" />
            </button>
          </div>

          {/* Tabs + refresh */}
          <div className="shrink-0 px-4 pt-4 pb-2 flex items-center gap-2">
            <div className="flex-1">
              <PillSwitcher options={TAB_OPTIONS} value={activeTab} onChange={setActiveTab} size="sm" />
            </div>
            {activeTab === 'best' && (
              <button
                onClick={handleRefresh}
                aria-label="Refresh options"
                className="w-9 h-9 shrink-0 rounded-full bg-white flex items-center justify-center shadow-sm
                  transition-all duration-fast hover:shadow-md active:scale-95"
              >
                <RefreshCw size={16} className="text-char-700" />
              </button>
            )}
          </div>

          {/* Rails */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-32">
            {activeTab === 'best' ? (
              loading ? (
                <SkeletonRails />
              ) : (
                <BestRecipesRails
                  candidatesBySlot={visibleCandidates}
                  onSelectCard={handleSelectCard}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  showAdd
                  edgeFadeClass="bg-paper-100"
                />
              )
            ) : (
              <BestRecipesRails
                candidatesBySlot={savedBySlot}
                onSelectCard={handleSelectCard}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                showAdd
                edgeFadeClass="bg-paper-100"
              />
            )}
          </div>

          {/* Floating summary CTA — absolute within this full-viewport
              overlay (not `fixed`, so it isn't affected by the ancestor's
              framer-motion transform) but reads the same as a bottom-docked
              bar since the overlay itself already spans the full viewport. */}
          <div className="absolute inset-x-4 bottom-6 z-20 max-w-[400px] mx-auto safe-area-bottom
            flex items-center justify-between gap-3 px-4 py-3 rounded-pill
            bg-blue-950 text-white shadow-lg">
            <span className="font-sans text-sm font-medium">{selected.size} selected</span>
            <button
              onClick={handleCreatePlan}
              disabled={generating}
              className="inline-flex items-center gap-1.5 rounded-pill bg-white text-blue-950
                text-sm font-semibold font-sans px-4 py-2
                hover:bg-sand-50 active:scale-[0.99] transition-all duration-fast
                disabled:opacity-60 disabled:pointer-events-none"
            >
              {generating ? 'Creating…' : 'Create meal plan'}
            </button>
          </div>

          <FoodDetailCard
            item={selectedRecipe}
            open={!!selectedRecipe}
            onClose={() => setSelectedRecipe(null)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
