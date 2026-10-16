/**
 * FavoritesScreen - /app/favorites, "Pick your favorites": the user's favorite
 * recipes (grouped by recency or meal type), plus their saved days and saved
 * weeks. Saved days / weeks open a read-only peek; loading happens on the plan.
 * Bookmarking a recipe anywhere in the app adds it here.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown } from 'lucide-react';
import BackButton from '../../components/shared/BackButton.jsx';
import EmptyState from '../../components/shared/EmptyState.jsx';
import FoodImageCard from '../../components/shared/FoodImageCard.jsx';
import SaveButton from '../../components/shared/SaveButton.jsx';
import FoodDetailCard from '../../components/FoodDetailCard.jsx';
import { useSnackbar } from '../../context/SnackbarContext.jsx';
import { favoritesBySlot, deleteSavedDay, restoreSavedDay, deleteSavedPlan, restoreSavedPlan, restoreActiveSavedPlan } from '../../api/api.js';
import { getIngredientImage } from '../../api/ingredientImages.js';
import { getOverlayImageFile } from '../../api/localTables.js';
import { PLAN_SLOTS } from '../../api/config.js';
import { getLibrary, subscribeLibrary } from '../../state/library.js';
import { COPY } from '../plan/plannerCopy.js';
import SavedList from './SavedList.jsx';
import SavedPeekSheet from './SavedPeekSheet.jsx';
import { useSavedLists } from './useSavedLists.js';
import { useRecipeDetail } from './useRecipeDetail.js';

const LABEL = 'font-label text-xs uppercase tracking-widest text-blue-950/70';

function FavoriteGrid({ items, onSelect, onBlocked }) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item) => (
        <div key={item.id} className="w-[calc(50%-0.375rem)] min-w-0">
          <FoodImageCard
            id={item.id}
            image={item.image || getIngredientImage(item.name, item.group, getOverlayImageFile(item.id))}
            numericId={item.numericId}
            title={item.name}
            subtitle={item.tier ?? undefined}
            aspectRatio="4/5"
            onClick={() => onSelect(item)}
            saveAction={<SaveButton item={item} onBlocked={onBlocked} />}
            className="w-full"
          />
        </div>
      ))}
    </div>
  );
}

export default function FavoritesScreen() {
  const { show } = useSnackbar();
  const [library, setLibrary] = useState(getLibrary);
  const [group, setGroup] = useState('recent');
  const [peek, setPeek] = useState(null); // { kind: 'day' | 'week', id }
  const { days, weeks, active } = useSavedLists();
  const { detail, open: openRecipe, close: closeRecipe } = useRecipeDetail();

  useEffect(() => subscribeLibrary(setLibrary), []);

  const peekEntry = peek ? (peek.kind === 'day' ? days : weeks).find((e) => e.id === peek.id) : null;

  // Delete with Undo; a deleted active week gets its pointer back on Undo.
  const handleDelete = () => {
    const entry = peekEntry;
    const wasActive = peek.kind === 'week' && active?.id === entry.id;
    const previousActive = active;
    const deleted = peek.kind === 'day' ? deleteSavedDay(entry.id) : deleteSavedPlan(entry.id);
    setPeek(null);
    if (!deleted) return;
    show(COPY.deleted(entry.name), {
      actionLabel: 'Undo',
      onAction: () => {
        if (peek.kind === 'day') restoreSavedDay(entry);
        else {
          restoreSavedPlan(entry);
          if (wasActive) restoreActiveSavedPlan(previousActive);
        }
      },
    });
  };

  const browse = (
    <Link
      to="/app/recipes"
      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-pill bg-blue-950 px-6 py-3 font-sans text-sm
        font-semibold text-white transition duration-fast hover:bg-blue-900 active:scale-[0.99]"
    >
      {COPY.browseRecipes}
      <ArrowRight size={16} aria-hidden="true" />
    </Link>
  );

  const bySlot = group === 'meal' ? favoritesBySlot(library) : null;

  return (
    <div className="bg-forest-300 flex flex-col min-h-screen -mb-28">
      <div className="px-5 pt-10 pb-6 flex flex-col gap-3">
        <BackButton fallback="/app/plan" />
        <div>
          <p className="font-label text-xs uppercase tracking-widest text-blue-950/60">{COPY.stepPick}</p>
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight text-blue-950">{COPY.favoritesTitle}</h1>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-8 rounded-t-2xl bg-paper-100 px-5 pb-28 pt-5 shadow-[0_-2px_16px_rgba(45,36,24,0.05)]">
        <section aria-labelledby="fav-recipes" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="fav-recipes" className={LABEL}>{COPY.sectionRecipes}</h2>
            {library.length > 0 && (
              <div className="relative">
                <label htmlFor="fav-group" className="sr-only">{COPY.groupLabel}</label>
                <select
                  id="fav-group"
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  className="min-h-[44px] appearance-none rounded-pill border border-sand-200 bg-white pl-4 pr-9 font-sans
                    text-sm font-semibold text-blue-950"
                >
                  <option value="recent">{COPY.groupRecent}</option>
                  <option value="meal">{COPY.groupMeal}</option>
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-blue-950/60"
                  aria-hidden="true"
                />
              </div>
            )}
          </div>

          {library.length === 0 ? (
            <EmptyState icon="bookmark" title={COPY.emptyTitle} body={COPY.emptyBody} action={browse} />
          ) : (
            <>
              {bySlot ? (
                <div className="flex flex-col gap-6">
                  {PLAN_SLOTS.filter((slot) => bySlot[slot.key].length > 0).map((slot) => (
                    <div key={slot.key} className="flex flex-col gap-3">
                      <h3 className={LABEL}>{slot.label}</h3>
                      <FavoriteGrid items={bySlot[slot.key]} onSelect={openRecipe} onBlocked={show} />
                    </div>
                  ))}
                </div>
              ) : (
                <FavoriteGrid items={[...library].reverse()} onSelect={openRecipe} onBlocked={show} />
              )}
              <div className="flex justify-center">{browse}</div>
            </>
          )}
        </section>

        <section aria-labelledby="fav-days" className="flex flex-col gap-3">
          <h2 id="fav-days" className={LABEL}>{COPY.sectionDays}</h2>
          <SavedList entries={days} onPick={(e) => setPeek({ kind: 'day', id: e.id })} emptyText={COPY.noSavedDays} />
        </section>

        <section aria-labelledby="fav-weeks" className="flex flex-col gap-3">
          <h2 id="fav-weeks" className={LABEL}>{COPY.sectionWeeks}</h2>
          <SavedList entries={weeks} onPick={(e) => setPeek({ kind: 'week', id: e.id })} emptyText={COPY.noSavedWeeks} />
        </section>
      </div>

      {peekEntry && (
        <SavedPeekSheet
          kind={peek.kind}
          entry={peekEntry}
          hidden={!!detail}
          onSelectItem={openRecipe}
          onDelete={handleDelete}
          onClose={() => setPeek(null)}
        />
      )}

      <FoodDetailCard item={detail} open={!!detail} onClose={closeRecipe} />
    </div>
  );
}
