/**
 * MealprepCarousel — the tallest element on the home screen.
 *
 * Horizontal lane of 3d-tilted cards that auto-advance, via the shared
 * TiltCarousel engine (see src/components/shared/TiltCarousel.jsx for the
 * tilt/velocity/teleport mechanics). This file owns the data fetching, card
 * rendering, and the food/recipe detail popup.
 */
import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import { getRecommendations } from '../../api/recommendations.js';
import { buildRecipeDetail } from '../../api/api.js';
import { storage } from '../../api/storage.js';
import { DEFAULT_DEV_CONDITIONS } from '../../api/config.js';
import FoodDetailCard from '../../components/FoodDetailCard.jsx';
import TiltCarousel from '../../components/shared/TiltCarousel.jsx';

const TIER_LABEL = { top: 'Top pick', strong: 'Strong', good: 'Good' };

function getProfile() {
  const saved = storage.get('profile', null);
  if (saved?.conditions?.length) return saved;
  return { conditions: DEFAULT_DEV_CONDITIONS };
}

function CarouselCard({ card, onClick }) {
  const [imgError, setImgError] = useState(false);
  return (
    <button
      onClick={onClick}
      className="w-full h-full rounded-xl overflow-hidden relative bg-char-900 text-left
        transition-all duration-base ease-ds-out
        hover:-translate-y-[2px] active:translate-y-[1px] active:scale-[0.99]"
    >
      {!imgError && card.image ? (
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
        {TIER_LABEL[card.tier] && (
          <span className="inline-block mb-1 text-[10px] font-semibold font-sans bg-white/20 text-white rounded-full px-2 py-0.5">
            {TIER_LABEL[card.tier]}
          </span>
        )}
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

  useEffect(() => {
    Promise.all([
      getRecommendations('breakfast', 0, 3),
      getRecommendations('lunch', 0, 3),
      getRecommendations('dinner', 0, 2),
    ]).then(([b, l, d]) => setCards([...b, ...l, ...d])).catch(console.error);
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
          Top ingredients for you
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
            onClick={() => {
              // Open immediately with minimal data; enrich async
              setSelectedItem({
                foodId: card.foodId ?? null,
                name: card.name,
                image: card.image,
                sourceName: card.sourceName ?? null,
                conditions: card.matchedConditions ?? [],
                ingredients: [],
                isRecipe: true,
              });
              buildRecipeDetail(card, profile.current)
                .then((detail) => setSelectedItem({ ...detail, isRecipe: true }))
                .catch(() => {});
            }}
          />
        ))}
      </TiltCarousel>
    </div>
    </>
  );
}
