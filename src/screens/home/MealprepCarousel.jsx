/**
 * MealprepCarousel — the tallest element on the home screen.
 *
 * Horizontal lane of 3d-tilted cards that auto-advance. On each advance a
 * spring animates the tilt: an initial backward-velocity kick causes a brief
 * anticipation (card tilts slightly toward flat), then the spring pulls to a
 * forward tilt that follows the scroll motion, then eases back to the resting
 * angle once the scroll settles.
 */
import { useRef, useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import { getRecommendations } from '../../api/recommendations.js';
import { buildRecipeDetail } from '../../api/recipeDetail.js';
import { storage } from '../../api/storage.js';
import { DEFAULT_DEV_CONDITIONS } from '../../api/config.js';
import RecipeDetailCard from '../../components/RecipeDetailCard.jsx';
import FoodDetail from '../../components/FoodDetail.jsx';

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

// Tilt is driven by scroll velocity: the lane leans most while it's moving
// fastest (the middle of each transition) and is flat at rest. A per-frame lerp
// plus a short idle delay let it ease back to flat a beat after the scroll stops.
const MAX_TILT = 20;   // peak lean, degrees
const TILT_GAIN = 22;  // scroll velocity (px/ms) → degrees
const SMOOTH = 0.18;   // per-frame lerp toward the velocity-driven target

export default function MealprepCarousel() {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [recipeDetail, setRecipeDetail] = useState(null);
  const [selectedFood, setSelectedFood] = useState(null);
  const laneRef = useRef(null);
  const profile = useRef(getProfile());

  useEffect(() => {
    Promise.all([
      getRecommendations('breakfast', 0, 3),
      getRecommendations('lunch', 0, 3),
      getRecommendations('dinner', 0, 2),
    ]).then(([b, l, d]) => setCards([...b, ...l, ...d])).catch(console.error);
  }, []);

  const pausedRef = useRef(false);
  const cardEls = useRef([]);
  // Velocity-driven tilt state
  const tiltRef = useRef(0);
  const targetRef = useRef(0);
  const velRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTRef = useRef(0);
  const rafRef = useRef(null);
  const idleRef = useRef(null);
  // Counts scroll events to skip after a silent teleport (each scrollLeft= fires one)
  const teleportSkipRef = useRef(0);

  // After cards load, jump to the middle copy so there's room to scroll both ways
  useEffect(() => {
    if (!cards.length) return;
    const lane = laneRef.current;
    if (!lane) return;
    requestAnimationFrame(() => {
      teleportSkipRef.current = 1;
      lane.scrollLeft = lane.scrollWidth / 3;
      lastXRef.current = lane.scrollLeft;
      lastTRef.current = performance.now();
    });
  }, [cards]);

  const apply = (t) => {
    cardEls.current.forEach(el => {
      if (el) el.style.transform = `rotateY(${t}deg) rotateX(0deg)`;
    });
  };

  const tick = useCallback(() => {
    const cur = tiltRef.current + (targetRef.current - tiltRef.current) * SMOOTH;
    tiltRef.current = cur;
    apply(cur);
    if (Math.abs(cur) < 0.05 && targetRef.current === 0) {
      apply(0);
      tiltRef.current = 0;
      rafRef.current = null;
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const ensureRaf = useCallback(() => {
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => {
    const lane = laneRef.current;
    if (!lane) return;
    lastXRef.current = lane.scrollLeft;
    lastTRef.current = performance.now();

    const onScroll = () => {
      // Absorb the echo scroll event that fires after a silent teleport
      if (teleportSkipRef.current > 0) {
        teleportSkipRef.current--;
        lastXRef.current = lane.scrollLeft;
        lastTRef.current = performance.now();
        return;
      }

      // Teleport back to middle copy when drifting into an edge copy
      const oneSet = lane.scrollWidth / 3;
      if (lane.scrollLeft < oneSet * 0.5) {
        teleportSkipRef.current = 1;
        lane.scrollLeft += oneSet;
        lastXRef.current = lane.scrollLeft;
        lastTRef.current = performance.now();
        return;
      }
      if (lane.scrollLeft > oneSet * 2.5) {
        teleportSkipRef.current = 1;
        lane.scrollLeft -= oneSet;
        lastXRef.current = lane.scrollLeft;
        lastTRef.current = performance.now();
        return;
      }

      const now = performance.now();
      const dt = now - lastTRef.current;
      const dx = lane.scrollLeft - lastXRef.current;
      lastXRef.current = lane.scrollLeft;
      lastTRef.current = now;
      if (dt > 0) {
        const vx = dx / dt;
        velRef.current = velRef.current * 0.6 + vx * 0.4;
        const t = -velRef.current * TILT_GAIN;
        targetRef.current = Math.max(-MAX_TILT, Math.min(MAX_TILT, t));
      }
      ensureRaf();
      clearTimeout(idleRef.current);
      idleRef.current = setTimeout(() => { targetRef.current = 0; ensureRaf(); }, 70);
    };

    lane.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      lane.removeEventListener('scroll', onScroll);
      clearTimeout(idleRef.current);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [ensureRaf]);

  // Always step forward — teleport logic handles wrapping
  const advance = useCallback(() => {
    const lane = laneRef.current;
    if (!lane || pausedRef.current) return;
    const step = lane.clientWidth * 0.62;
    lane.scrollTo({ left: lane.scrollLeft + step, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const id = setInterval(advance, 6400);
    return () => clearInterval(id);
  }, [advance]);

  const pause = () => { pausedRef.current = true; };
  const resume = () => { pausedRef.current = false; };

  const tripled = cards.length ? [...cards, ...cards, ...cards] : [];

  return (
    <>
    <RecipeDetailCard
      recipe={recipeDetail}
      open={!!selectedCard}
      onClose={() => { setSelectedCard(null); setRecipeDetail(null); }}
      onSelectIngredient={setSelectedFood}
    />
    {selectedFood && (
      <FoodDetail
        food={selectedFood}
        profile={profile.current}
        onClose={() => setSelectedFood(null)}
      />
    )}
    <div className="flex flex-col">
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

      {/* 3d lane — perspective on the rail, spring-animated tilt on each card wrapper */}
      <div className="relative rounded-md overflow-hidden flex flex-col">
        <div
          ref={laneRef}
          onPointerDown={pause}
          onPointerUp={resume}
          onPointerLeave={resume}
          className="flex items-center gap-3 overflow-x-auto overflow-y-hidden
            snap-x snap-mandatory scroll-smooth pb-1
            [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ perspective: '1100px', perspectiveOrigin: '50% 45%' }}
        >
          {tripled.map((card, i) => (
            <div
              key={i}
              ref={el => { cardEls.current[i] = el; }}
              className="snap-center shrink-0 w-[62%] aspect-[3/4]"
              style={{
                transform: 'rotateY(0deg) rotateX(0deg)',
                transformOrigin: 'center center',
                willChange: 'transform',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            >
              <CarouselCard card={card} onClick={() => {
                // Open immediately with minimal data; enrich async
                setSelectedCard(card);
                setRecipeDetail({
                  foodId: card.foodId ?? null,
                  name: card.name,
                  image: card.image,
                  sourceName: card.sourceName ?? null,
                  conditions: card.matchedConditions ?? [],
                  ingredients: [],
                });
                buildRecipeDetail(card).then(setRecipeDetail).catch(() => {});
              }} />
            </div>
          ))}
        </div>
        <div className="absolute inset-y-0 left-0 flex gap-[2px] items-stretch pointer-events-none z-10 -translate-x-[4px]">
          {[0.6, 0.38, 0.2, 0.09, 0.03].map((op, i) => (
            <div key={i} className="w-[8px] bg-neutral-100" style={{ opacity: op }} />
          ))}
        </div>
        <div className="absolute inset-y-0 right-0 flex flex-row-reverse gap-[2px] items-stretch pointer-events-none z-10 translate-x-[4px]">
          {[0.6, 0.38, 0.2, 0.09, 0.03].map((op, i) => (
            <div key={i} className="w-[8px] bg-neutral-100" style={{ opacity: op }} />
          ))}
        </div>
      </div>
    </div>
    </>
  );
}
