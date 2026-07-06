import { useRef, useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sun, Leaf, Utensils, Zap, BookOpen, Cloud,
  FlaskConical, Activity, Star,
} from 'lucide-react';

const MAX_TILT = 20;
const TILT_GAIN = 22;
const SMOOTH = 0.18;

const CATEGORY_ICONS = {
  d: Sun,
  e: Leaf,
  b: Utensils,
  c: Zap,
  f: BookOpen,
  g: Cloud,
  i: FlaskConical,
  k: Activity,
};

function CategoryCard({ pick, onClick }) {
  const [imgError, setImgError] = useState(false);
  const CategoryIcon = CATEGORY_ICONS[pick.categoryId] || Star;

  return (
    <button
      onClick={onClick}
      className="w-full h-full rounded-xl overflow-hidden relative bg-char-900 text-left
        transition-all duration-base ease-ds-out
        hover:-translate-y-[2px] active:translate-y-[1px] active:scale-[0.99]"
    >
      {!imgError && pick.topIngredient.imageUrl ? (
        <img
          src={pick.topIngredient.imageUrl}
          alt={pick.topIngredient.name}
          className="absolute inset-0 w-full h-full object-cover brightness-[0.75]"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <CategoryIcon size={64} className="text-white/30" strokeWidth={1.5} />
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

      {/* Category label — top left in chillax */}
      <div className="absolute top-3 left-3 right-3">
        <p className="font-display text-sm font-semibold text-white leading-tight">
          Best &amp; worst
        </p>
      </div>

      {/* Centered category icon + label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <CategoryIcon size={48} className="text-white" strokeWidth={2.5} />
        <p className="font-display text-lg font-semibold text-white leading-tight">
          for {pick.categoryLabel}
        </p>
      </div>

      {/* Bottom text */}
      <div className="absolute bottom-0 left-0 right-0 px-3 py-3">
        <p className="font-display text-sm font-semibold text-white/50 leading-snug">
          {pick.topIngredient.name}
        </p>
      </div>
    </button>
  );
}

export default function CategoryCarousel({ picks = [], autoAdvance = true }) {
  const navigate = useNavigate();
  const laneRef = useRef(null);
  const pausedRef = useRef(false);
  const cardEls = useRef([]);
  const tiltRef = useRef(0);
  const targetRef = useRef(0);
  const velRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTRef = useRef(0);
  const rafRef = useRef(null);
  const idleRef = useRef(null);

  const apply = (t) => {
    cardEls.current.forEach((el) => {
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
      idleRef.current = setTimeout(() => {
        targetRef.current = 0;
        ensureRaf();
      }, 70);
    };

    lane.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      lane.removeEventListener('scroll', onScroll);
      clearTimeout(idleRef.current);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [ensureRaf]);

  const advance = useCallback(() => {
    const lane = laneRef.current;
    if (!lane || pausedRef.current || !autoAdvance) return;
    const step = lane.clientWidth * 0.62;
    const atEnd = lane.scrollLeft + lane.clientWidth >= lane.scrollWidth - 8;
    lane.scrollTo({ left: atEnd ? 0 : lane.scrollLeft + step, behavior: 'smooth' });
  }, [autoAdvance]);

  useEffect(() => {
    if (!autoAdvance) return;
    const id = setInterval(advance, 6400);
    return () => clearInterval(id);
  }, [advance, autoAdvance]);

  const pause = () => { pausedRef.current = true; };
  const resume = () => { pausedRef.current = false; };

  if (!picks.length) return null;

  return (
    <div className="flex flex-col">
      {/* Header row + sublabel */}
      <div className="flex flex-col px-1 pb-0 shrink-0">
        <div className="flex items-baseline justify-between">
          <span className="font-label text-xs font-semibold uppercase tracking-eyebrow text-char-500">
            Food picks by category
          </span>
          <button
            onClick={() => navigate('/app/suggestions')}
            className="text-xs font-semibold font-sans text-forest-700 hover:text-forest-800 transition-colors duration-fast"
          >
            Browse all
          </button>
        </div>
        <span className="text-[16px] font-sans text-char-400 mb-2">
          Click to see best and worst picks
        </span>
      </div>

      {/* Lane with edge fade gradients — its 3:4 cards set its own height */}
      <div className="relative rounded-md overflow-hidden [transform:translateZ(0)]">
        <div
          ref={laneRef}
          onPointerDown={pause}
          onPointerUp={resume}
          onPointerLeave={resume}
          className=" flex items-center gap-3 overflow-x-auto overflow-y-hidden
            snap-x snap-mandatory scroll-smooth
            [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ perspective: '1100px', perspectiveOrigin: '50% 45%' }}
        >
          {picks.map((pick, i) => (
            <div
              key={pick.categoryId}
              ref={(el) => { cardEls.current[i] = el; }}
              className="snap-center shrink-0 w-[62%] aspect-[3/4]"
              style={{
                transform: 'rotateY(0deg) rotateX(0deg)',
                transformOrigin: 'center center',
                willChange: 'transform',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            >
              <CategoryCard
                pick={pick}
                onClick={() => navigate(`/app/suggestions?category=${pick.categoryId}`)}
              />
            </div>
          ))}
        </div>

        {/* Edge fade — fading vertical bars matching parent bg (see DESIGN_SYSTEM.md) */}
        <div className="absolute inset-y-0 left-0 flex gap-[2px] items-stretch pointer-events-none z-10 -translate-x-[4px]">
          {[0.6, 0.38, 0.2, 0.09, 0.03].map((op, i) => (
            <div key={i} className="w-[8px] bg-neutral-50" style={{ opacity: op }} />
          ))}
        </div>
        <div className="absolute inset-y-0 right-0 flex flex-row-reverse gap-[2px] items-stretch pointer-events-none z-10 translate-x-[4px]">
          {[0.6, 0.38, 0.2, 0.09, 0.03].map((op, i) => (
            <div key={i} className="w-[8px] bg-neutral-50" style={{ opacity: op }} />
          ))}
        </div>
      </div>
    </div>
  );
}
