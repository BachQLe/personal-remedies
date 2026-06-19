/**
 * SwipeDeck — Tinder-style food preference cards.
 *
 * Props (unchanged): foods, onComplete, onSkip
 */
import { useState, useRef } from "react";

export default function SwipeDeck({ foods, onComplete, onSkip }) {
  const [index, setIndex] = useState(0);
  const [likes, setLikes] = useState([]);
  const [dislikes, setDislikes] = useState([]);
  const [drag, setDrag] = useState(null);
  const cardRef = useRef(null);

  const current = foods[index];
  const done = index >= foods.length;

  const decide = (liked) => {
    const food = foods[index];
    if (liked) setLikes((l) => [...l, food.id]);
    else setDislikes((d) => [...d, food.id]);

    if (index + 1 >= foods.length) {
      const newLikes = liked ? [...likes, food.id] : likes;
      const newDislikes = !liked ? [...dislikes, food.id] : dislikes;
      onComplete(newLikes, newDislikes);
    } else {
      setIndex((i) => i + 1);
    }
    setDrag(null);
  };

  const handlePointerDown = (e) => {
    setDrag({ x: 0, startX: e.clientX });
  };
  const handlePointerMove = (e) => {
    if (!drag) return;
    setDrag((d) => ({ ...d, x: e.clientX - d.startX }));
  };
  const handlePointerUp = () => {
    if (!drag) return;
    if (Math.abs(drag.x) > 80) decide(drag.x > 0);
    else setDrag(null);
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-16 h-16 rounded-full bg-forest-50 flex items-center justify-center mb-1">
          <span className="material-symbols-rounded text-forest-600" style={{ fontSize: 32 }}>
            check_circle
          </span>
        </div>
        <p className="font-sans font-semibold text-char-900">All done</p>
      </div>
    );
  }

  const rotation = drag ? drag.x / 15 : 0;
  const opacity = drag ? Math.max(0.6, 1 - Math.abs(drag.x) / 300) : 1;
  const likeOpacity = drag && drag.x > 20 ? Math.min(1, drag.x / 80) : 0;
  const nopeOpacity = drag && drag.x < -20 ? Math.min(1, -drag.x / 80) : 0;

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative w-full max-w-[320px] h-[380px]">
        {/* Next card peek */}
        {index + 1 < foods.length && (
          <div
            className="absolute inset-x-4 top-3 rounded-xl bg-white border border-sand-200 shadow-card h-full"
            style={{ zIndex: 0 }}
          />
        )}

        {/* Current card */}
        <div
          ref={cardRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="absolute inset-0 bg-white rounded-xl border border-sand-200 shadow-card
            flex flex-col items-center justify-center gap-4
            cursor-grab active:cursor-grabbing select-none"
          style={{
            transform: `translateX(${drag?.x ?? 0}px) rotate(${rotation}deg)`,
            opacity,
            zIndex: 1,
            touchAction: "none",
            transition: drag ? "none" : "transform 320ms cubic-bezier(0.22,0.61,0.36,1)",
          }}
        >
          {/* Like / Nope overlays */}
          <div
            className="absolute top-8 left-6 border-2 border-signal-beneficial rounded-sm px-4 py-1 rotate-[-20deg]"
            style={{ opacity: likeOpacity }}
          >
            <span className="text-signal-beneficial font-bold text-xl tracking-wide">
              LIKE
            </span>
          </div>
          <div
            className="absolute top-8 right-6 border-2 border-signal-avoid rounded-sm px-4 py-1 rotate-[20deg]"
            style={{ opacity: nopeOpacity }}
          >
            <span className="text-signal-avoid font-bold text-xl tracking-wide">
              NOPE
            </span>
          </div>

          {/* Food initial (tinted circle instead of emoji) */}
          <div className="w-24 h-24 rounded-full bg-forest-50 flex items-center justify-center">
            <span className="font-display text-4xl font-semibold text-forest-700">
              {current.name?.[0] || ""}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="font-sans font-bold text-char-900 text-xl">
              {current.name}
            </span>
            <span className="text-sm text-char-500">{current.category}</span>
          </div>
          <span className="text-xs text-char-400 font-mono tabular-nums">
            {index + 1} / {foods.length}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => decide(false)}
          className="w-14 h-14 rounded-full bg-white shadow-card border border-sand-200
            flex items-center justify-center text-signal-avoid
            transition-all duration-fast ease-ds-out
            active:translate-y-[1px] active:scale-[0.90]"
          aria-label="Dislike"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 28 }}>
            close
          </span>
        </button>
        <button
          onClick={onSkip}
          className="px-5 py-2 rounded-pill border border-sand-200 text-sm text-char-500 bg-white font-sans
            transition-all duration-fast ease-ds-out
            hover:bg-forest-50 hover:border-forest-300"
        >
          Skip
        </button>
        <button
          onClick={() => decide(true)}
          className="w-14 h-14 rounded-full bg-white shadow-card border border-sand-200
            flex items-center justify-center text-signal-beneficial
            transition-all duration-fast ease-ds-out
            active:translate-y-[1px] active:scale-[0.90]"
          aria-label="Like"
        >
          <span className="material-symbols-rounded fill" style={{ fontSize: 28 }}>
            favorite
          </span>
        </button>
      </div>
    </div>
  );
}
