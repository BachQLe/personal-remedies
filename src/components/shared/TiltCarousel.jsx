/**
 * TiltCarousel — shared horizontal lane engine for the app's 3d-tilted,
 * auto-advancing card carousels (currently home's MealprepCarousel).
 * Extracted so multiple carousels can keep identical tilt feel, timing,
 * and edge treatment instead of drifting apart as separate copies.
 *
 * Tilt is driven by scroll velocity: the lane leans most while it's moving
 * fastest (the middle of each transition) and is flat at rest. A per-frame
 * lerp plus a short idle delay let it ease back to flat a beat after the
 * scroll stops.
 *
 * Two wrap modes:
 *  - infinite: renders three copies of `children` and silently teleports
 *    back to the middle copy when the scroll position drifts into an edge
 *    copy, so it can be endlessly advanced in either direction.
 *  - non-infinite (default): advances forward and jumps back to the start
 *    once the lane reaches its end.
 *
 * Sizing: the root flexes to fill its parent's leftover height; each lane
 * slot fills the lane height and derives its width from the 3/4 portrait
 * aspect, so the consumer's layout — not a fixed slot width — sets card size.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - one card node per item; each is
 *   wrapped in the snap-aligned, tilt-ref'd lane slot internally.
 * @param {boolean} [props.autoAdvance=true]
 * @param {boolean} [props.infinite=false]
 * @param {string} [props.edgeFadeClass='bg-neutral-100'] - bg color for the
 *   edge-fade bars; should match the surrounding page background.
 */
import { useRef, useEffect, useCallback, Children, cloneElement } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MAX_TILT = 20;   // peak lean, degrees
const TILT_GAIN = 22;  // scroll velocity (px/ms) → degrees
const SMOOTH = 0.18;   // per-frame lerp toward the velocity-driven target
const AUTO_ADVANCE_MS = 6400;
const STEP_RATIO = 0.48;

export default function TiltCarousel({
  children,
  autoAdvance = true,
  infinite = false,
  edgeFadeClass = 'bg-neutral-100',
}) {
  const laneRef = useRef(null);
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
  // Resumes auto-advance one interval after an arrow-button click
  const arrowResumeRef = useRef(null);

  const items = Children.toArray(children);
  const count = items.length;
  const renderItems = infinite
    ? [0, 1, 2].flatMap((copy) => items.map((child) => cloneElement(child, { key: `${copy}-${child.key}` })))
    : items;

  const apply = (t) => {
    cardEls.current.forEach((el) => {
      if (el) el.style.transform = `rotateY(${t}deg) rotateX(0deg)`;
    });
  };

  const tick = useCallback(function tick() {
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

  // Infinite mode only: after items (re)populate, jump to the middle copy so
  // there's room to scroll both ways.
  useEffect(() => {
    if (!infinite || !count) return;
    const lane = laneRef.current;
    if (!lane) return;
    requestAnimationFrame(() => {
      teleportSkipRef.current = 1;
      lane.scrollLeft = lane.scrollWidth / 3;
      lastXRef.current = lane.scrollLeft;
      lastTRef.current = performance.now();
    });
  }, [infinite, count]);

  useEffect(() => {
    const lane = laneRef.current;
    if (!lane) return;
    lastXRef.current = lane.scrollLeft;
    lastTRef.current = performance.now();

    const onScroll = () => {
      if (infinite) {
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
  }, [ensureRaf, infinite]);

  // Infinite mode always steps forward — teleport logic handles wrapping.
  // Non-infinite mode steps forward then loops back to the start at the end.
  const advance = useCallback(() => {
    const lane = laneRef.current;
    if (!lane || pausedRef.current || !autoAdvance) return;
    const step = lane.clientWidth * STEP_RATIO;
    if (infinite) {
      lane.scrollTo({ left: lane.scrollLeft + step, behavior: 'smooth' });
    } else {
      const atEnd = lane.scrollLeft + lane.clientWidth >= lane.scrollWidth - 8;
      lane.scrollTo({ left: atEnd ? 0 : lane.scrollLeft + step, behavior: 'smooth' });
    }
  }, [autoAdvance, infinite]);

  useEffect(() => {
    if (!autoAdvance) return;
    const id = setInterval(advance, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [advance, autoAdvance]);

  useEffect(() => () => clearTimeout(arrowResumeRef.current), []);

  const pause = () => { pausedRef.current = true; };
  const resume = () => { pausedRef.current = false; };

  // Arrow-button clicks pause auto-advance for one interval, then resume —
  // separate from the pointer down/up pause used for drag/touch scrolling.
  const pauseForOneInterval = () => {
    pausedRef.current = true;
    clearTimeout(arrowResumeRef.current);
    arrowResumeRef.current = setTimeout(() => { pausedRef.current = false; }, AUTO_ADVANCE_MS);
  };

  const scrollByStep = (dir) => {
    const lane = laneRef.current;
    if (!lane) return;
    lane.scrollBy({ left: dir * lane.clientWidth * STEP_RATIO, behavior: 'smooth' });
    pauseForOneInterval();
  };

  return (
    // 3d lane — perspective on the rail, spring-animated tilt on each card wrapper
    <div className="relative rounded-md overflow-hidden flex flex-col flex-1 min-h-0 [transform:translateZ(0)]">
      <div
        ref={laneRef}
        onPointerDown={pause}
        onPointerUp={resume}
        onPointerLeave={resume}
        className="flex items-center gap-3 overflow-x-auto overflow-y-hidden min-h-0 flex-1
          snap-x snap-mandatory scroll-smooth pb-1
          [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ perspective: '1100px', perspectiveOrigin: '50% 45%' }}
      >
        {renderItems.map((child, i) => (
          <div
            key={i}
            ref={(el) => { cardEls.current[i] = el; }}
            className="snap-center shrink-0 h-full aspect-[3/4]"
            style={{
              transform: 'rotateY(0deg) rotateX(0deg)',
              transformOrigin: 'center center',
              willChange: 'transform',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          >
            {child}
          </div>
        ))}
      </div>

      {/* Arrow pills — sit above the edge fade, scroll one step per click and
          pause auto-advance for one interval so it doesn't fight the user. */}
      <button
        type="button"
        onClick={() => scrollByStep(-1)}
        aria-label="Scroll left"
        className="absolute left-1 top-1/2 -translate-y-1/2 z-20 h-9 px-5 rounded-pill
          bg-white/85 backdrop-blur-sm shadow-sm text-char-700
          flex items-center justify-center
          transition-all duration-fast hover:bg-white active:scale-[0.94]"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        type="button"
        onClick={() => scrollByStep(1)}
        aria-label="Scroll right"
        className="absolute right-1 top-1/2 -translate-y-1/2 z-20 h-9 px-5 rounded-pill
          bg-white/85 backdrop-blur-sm shadow-sm text-char-700
          flex items-center justify-center
          transition-all duration-fast hover:bg-white active:scale-[0.94]"
      >
        <ChevronRight size={18} />
      </button>

      {/* Edge fade — fading vertical bars matching parent bg (see DESIGN_SYSTEM.md) */}
      <div className="absolute inset-y-0 left-0 flex gap-[2px] items-stretch pointer-events-none z-10 -translate-x-[4px]">
        {[0.6, 0.38, 0.2, 0.09, 0.03].map((op, i) => (
          <div key={i} className={`w-[8px] ${edgeFadeClass}`} style={{ opacity: op }} />
        ))}
      </div>
      <div className="absolute inset-y-0 right-0 flex flex-row-reverse gap-[2px] items-stretch pointer-events-none z-10 translate-x-[4px]">
        {[0.6, 0.38, 0.2, 0.09, 0.03].map((op, i) => (
          <div key={i} className={`w-[8px] ${edgeFadeClass}`} style={{ opacity: op }} />
        ))}
      </div>
    </div>
  );
}
