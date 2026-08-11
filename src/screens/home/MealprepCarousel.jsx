/**
 * MealprepCarousel — the tallest element on the home screen.
 *
 * Horizontal lane of 3d-tilted cards that auto-advance, via the shared
 * TiltCarousel engine (see src/components/shared/TiltCarousel.jsx for the
 * tilt/velocity/teleport mechanics). This file owns the data fetching, card
 * rendering, and the food/recipe detail popup.
 *
 * State matrix (T5A): fetch runs through `useAsyncData` so a failed load
 * gets a real error panel + working Retry instead of a silently empty lane
 * (previously `.catch(console.error)`), and going offline with nothing
 * loaded yet says so honestly instead of just showing zero cards. The
 * 'loading' status is rendered with a bespoke `CarouselGhost` — sized to
 * TiltCarousel's own `h-full aspect-[3/4]` card slots — rather than
 * DataState's generic page skeleton, which is built for a full page, not
 * this fixed-height lane (see DataState.jsx's doc: screens with their own
 * loading treatment should just never pass 'loading' through it). Every
 * other status (success, empty, the error statuses, offline-cached,
 * offline-no-cache) goes through DataState.
 */
import { useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import { getHomeRecommendations, cleanNotes } from '../../api/recommendations.js';
import { buildRecipeDetail } from '../../api/api.js';
import { storage } from '../../api/storage.js';
import { DEFAULT_DEV_CONDITIONS } from '../../api/config.js';
import { getIngredientImage } from '../../api/ingredientImages.js';
import FoodDetailCard from '../../components/FoodDetailCard.jsx';
import TiltCarousel from '../../components/shared/TiltCarousel.jsx';
import SaveButton from '../../components/shared/SaveButton.jsx';
import DataState from '../../components/shared/DataState.jsx';
import Skeleton from '../../components/shared/Skeleton.jsx';
import { useAsyncData } from '../../hooks/useAsyncData.js';
import { useSnackbar } from '../../context/SnackbarContext.jsx';

function getProfile() {
  const saved = storage.get('profile', null);
  if (saved?.conditions?.length) return saved;
  return { conditions: DEFAULT_DEV_CONDITIONS };
}

function CarouselCard({ card, onClick, onSaveBlocked }) {
  const [imgError, setImgError] = useState(false);
  return (
    <button
      onClick={onClick}
      className="w-full h-full rounded-xl overflow-hidden relative bg-char-900 text-left
        transition-all duration-base ease-ds-out
        hover:-translate-y-[2px] active:translate-y-[1px] active:scale-[0.99]"
    >
      <div className="absolute top-3 right-3 z-10">
        <SaveButton item={card} onBlocked={onSaveBlocked} />
      </div>
      {!imgError && card.image && !card.isLifestyle ? (
        <img
          src={card.image}
          alt={card.name}
          className="absolute inset-0 w-full h-full object-cover brightness-[0.75]"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Leaf size={72} className="text-white/30" strokeWidth={1.2} />
        </div>
      )}
      {/* gradient for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 px-3 py-3">
        <p className="font-display text-sm font-semibold text-white leading-snug">{card.name}</p>
        {card.blurb && (
          <p className="text-[11px] text-white/70 font-sans leading-snug mt-0.5">{card.blurb}</p>
        )}
      </div>
    </button>
  );
}

/** Loading ghost sized to TiltCarousel's own card slots (h-full, 3:4 portrait) — see file doc. */
function CarouselGhost() {
  return (
    <div
      className="h-full flex items-center gap-3 overflow-hidden"
      role="status"
      aria-label="Loading recommendations"
    >
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} shape="card" className="h-full aspect-[3/4] shrink-0" />
      ))}
    </div>
  );
}

export default function MealprepCarousel() {
  const navigate = useNavigate();
  const [selectedItem, setSelectedItem] = useState(null);
  const profile = useRef(getProfile());
  const { show } = useSnackbar();

  const fetcher = useCallback(
    () =>
      getHomeRecommendations(profile.current, 8).then((items) =>
        items.map((item) => ({
          id: item.id,
          foodId: item.id,
          name: item.name,
          // Lifestyle items (Exercise, Smoking, …) never get a stock food
          // photo — leaving image unset routes CarouselCard to the Leaf-icon
          // fallback tile instead of a mismatched image.
          image: item.isLifestyle ? undefined : getIngredientImage(item.name, item.group),
          blurb: cleanNotes(item.notes) || item.groupLabel || undefined,
          isLifestyle: item.isLifestyle,
          kind: 'food',
        }))
      ),
    []
  );

  const { status, data, retry } = useAsyncData(fetcher, [], {});
  const cards = data ?? [];

  return (
    <>
      <FoodDetailCard
        item={selectedItem}
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />
      <div className="h-full flex flex-col">
        <div className="flex items-baseline justify-between px-1 pb-2 shrink-0">
          <span className="font-label text-xs font-semibold uppercase tracking-eyebrow text-char-500">
            Top recommendations for you
          </span>
          <button
            onClick={() => navigate('/app/recipes')}
            className="text-xs font-semibold font-sans text-forest-700 hover:text-forest-800 transition-colors duration-fast"
          >
            See all
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col justify-center">
          {status === 'loading' ? (
            <CarouselGhost />
          ) : (
            <DataState
              status={status}
              onRetry={retry}
              emptyTitle="No recommendations yet"
              emptyBody="There's nothing to recommend right now."
              screenName="home recommendations"
            >
              <TiltCarousel autoAdvance infinite edgeFadeClass="bg-neutral-100">
                {cards.map((card, i) => (
                  <CarouselCard
                    key={i}
                    card={card}
                    onSaveBlocked={show}
                    onClick={() => {
                      // Open immediately with minimal data; enrich async
                      setSelectedItem({
                        foodId: card.foodId ?? null,
                        name: card.name,
                        image: card.image,
                        sourceName: card.sourceName ?? null,
                        conditions: card.matchedConditions ?? [],
                        ingredients: [],
                        isRecipe: false,
                      });
                      // Cards here are always plain foods/lifestyle items (Top Dos &
                      // Don'ts never returns recipes) — buildRecipeDetail still
                      // fabricates a companion-ingredients list for its "similar
                      // items" display, so isRecipe must be pinned false explicitly
                      // rather than left to FoodDetailCard's ingredients-based
                      // fallback (which would otherwise misread that list as proof
                      // this is a recipe, breaking the save-gate's kind check).
                      buildRecipeDetail(card, profile.current)
                        .then((detail) => setSelectedItem({ ...detail, isRecipe: false }))
                        .catch(() => { });
                    }}
                  />
                ))}
              </TiltCarousel>
            </DataState>
          )}
        </div>
      </div>
    </>
  );
}
