/**
 * MealprepCarousel — the tallest element on the home screen.
 *
 * Horizontal lane of 3d-tilted cards that auto-advance, via the shared
 * TiltCarousel engine (see src/components/shared/TiltCarousel.jsx for the
 * tilt/velocity/teleport mechanics). This file owns the data fetching, card
 * rendering, and the food/recipe detail popup.
 */
import { useRef, useEffect, useState, useCallback } from 'react';
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
import Snackbar from '../../components/shared/Snackbar.jsx';

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

export default function MealprepCarousel() {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const profile = useRef(getProfile());
  const [snackbar, setSnackbar] = useState(null);
  const snackbarIdRef = useRef(0);

  const showSnackbar = useCallback((message, canUndo = false) => {
    snackbarIdRef.current += 1;
    setSnackbar({ id: snackbarIdRef.current, message, canUndo });
  }, []);

  useEffect(() => {
    getHomeRecommendations(profile.current, 8)
      .then((items) => setCards(items.map((item) => ({
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
      }))))
      .catch(console.error);
  }, []);

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

        <TiltCarousel autoAdvance infinite edgeFadeClass="bg-neutral-100">
          {cards.map((card, i) => (
            <CarouselCard
              key={i}
              card={card}
              onSaveBlocked={showSnackbar}
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
      </div>

      <Snackbar
        snackbar={snackbar}
        onDismiss={() => setSnackbar(null)}
      />
    </>
  );
}
