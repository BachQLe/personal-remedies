import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Bookmark, ChevronLeft, ExternalLink } from 'lucide-react';
import ConditionTag from './shared/ConditionTag.jsx';
import Icon from './shared/Icon.jsx';
import { getLibrary, addToLibrary, removeFromLibrary } from '../state/library.js';

const DISMISS_THRESHOLD = 100;

/**
 * @param {Object} props
 * @param {Object} props.recipe
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {(food: {id: string|number, name: string}) => void} [props.onSelectIngredient]
 *   Optional — when present and an ingredient row carries a `foodId`, the row
 *   becomes a tappable button that opens FoodDetail for that ingredient.
 */
export default function RecipeDetailCard({ recipe, open, onClose, onSelectIngredient }) {
  const [saved, setSaved] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [dragY, setDragY] = useState(0);

  const isDragging = useRef(false);
  const dragOriginY = useRef(0);

  // Lock body scroll while the card is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Sync saved state with library on open
  useEffect(() => {
    if (open && recipe?.foodId != null) {
      setSaved(getLibrary().some((f) => f.id === recipe.foodId));
    }
  }, [open, recipe?.foodId]);

  const handleClose = useCallback(() => {
    setFlipped(false);
    setDragY(0);
    onClose?.();
  }, [onClose]);

  const handleSave = useCallback(() => {
    if (!recipe) return;
    if (saved) {
      removeFromLibrary(recipe.foodId);
    } else {
      addToLibrary({ id: recipe.foodId, name: recipe.name, image: recipe.image });
    }
    setSaved((s) => !s);
  }, [saved, recipe]);

  const onHandleDown = (e) => {
    isDragging.current = true;
    dragOriginY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onHandleMove = (e) => {
    if (!isDragging.current) return;
    setDragY(Math.max(0, e.clientY - dragOriginY.current));
  };

  const onHandleUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (dragY >= DISMISS_THRESHOLD) {
      handleClose();
    } else {
      setDragY(0);
    }
  };

  if (!open || !recipe) return null;

  const dismissProgress = Math.min(1, dragY / DISMISS_THRESHOLD);
  const cardOpacity = 1 - dismissProgress * 0.4;
  const backdropOpacity = 1 - dismissProgress * 0.6;

  const ingredients = recipe.ingredients ?? [];

  // No recipe URLs exist in the API — link out via a new-tab web search.
  const handleGetRecipe = () => {
    const query = `${recipe.name} ${recipe.sourceName || 'Food Network'} recipe`;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center px-4">
      {/* Scrim */}
      <div
        className="absolute inset-0 bg-char-900/50 backdrop-blur-[3px]"
        style={{ opacity: backdropOpacity }}
        onClick={handleClose}
      />

      {/* Card wrapper — 2:3 ratio */}
      <div
        className="relative w-full max-w-[400px] z-10"
        style={{
          aspectRatio: '2/3',
          maxHeight: 'calc(100dvh - 180px)',
          opacity: cardOpacity,
          transform: `translateY(${dragY}px)`,
          transition: isDragging.current
            ? 'none'
            : 'transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1)',
        }}
      >
        {/* Flip container */}
        <div
          className="w-full h-full"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: 'transform 0.55s cubic-bezier(0.22, 0.61, 0.36, 1)',
          }}
        >

          {/* ── FRONT FACE ──────────────────────────────────────── */}
          <div
            className="absolute inset-0 rounded-2xl shadow-lg overflow-hidden touch-none select-none"
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}
          >
            {/* Background image — fills entire card */}
            {recipe.image ? (
              <img
                src={recipe.image}
                alt={recipe.name}
                className="absolute inset-0 w-full h-full object-cover object-center"
                loading="eager"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-sand-100">
                <Icon name="leaf" size={48} className="text-char-300" />
              </div>
            )}

            {/* Drag pill — centered at top */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
              <div className="w-14 h-1.5 rounded-full bg-white/60" />
            </div>

            {/* Save — top-left */}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleSave}
              className={`absolute top-4 left-4 z-20 w-11 h-11 rounded-full flex items-center justify-center
                shadow-md transition-all duration-fast backdrop-blur-sm
                ${saved ? 'bg-white text-forest-700' : 'bg-white/90 text-char-500 hover:text-char-900'}`}
              aria-label={saved ? 'Remove from cookbook' : 'Save to cookbook'}
            >
              <Bookmark size={20} fill={saved ? 'currentColor' : 'none'} />
            </button>

            {/* X close — top-right */}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleClose}
              className="absolute top-4 right-4 z-20 w-11 h-11 rounded-full bg-white/90 backdrop-blur-sm
                flex items-center justify-center text-char-500 hover:text-char-900
                shadow-md transition-all duration-fast"
              aria-label="Close"
            >
              <X size={20} />
            </button>

            {/* Info panel — pinned to bottom, independent of image */}
            <div
              className="absolute bottom-0 left-0 right-0 z-20 bg-neutral-900/70 backdrop-blur-sm rounded-t-2xl px-5 pt-4 pb-5 flex flex-col gap-2"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {/* Condition chips */}
              {recipe.conditions?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {recipe.conditions.map((c, i) => (
                    <ConditionTag key={i} condition={c} compact />
                  ))}
                </div>
              )}

              {/* Food name */}
              <h2 className="font-display text-2xl font-semibold text-white leading-snug tracking-tightish">
                {recipe.name}
              </h2>

              {/* Flip CTA */}
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setFlipped(true)}
                className="mt-2 w-full py-3.5 rounded-xl bg-white text-blue-950
                  font-display font-semibold text-base shadow-fab
                  transition-all duration-base ease-ds-out
                  hover:bg-sand-50 hover:-translate-y-[1px] hover:shadow-lg
                  active:translate-y-[1px] active:scale-[0.99]"
              >
                See ingredients
              </button>
            </div>
          </div>

          {/* ── BACK FACE (Ingredients + link out) ──────────────── */}
          <div
            className="absolute inset-0 z-30 bg-paper-100 rounded-2xl shadow-lg flex flex-col overflow-hidden"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            {/* Back header */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 pt-5 pb-3">
              <div className="min-w-0">
                <h3 className="font-display text-xl font-semibold text-blue-950 leading-snug tracking-tightish truncate">
                  {recipe.name}
                </h3>
                {recipe.sourceName && (
                  <p className="text-xs text-char-500 font-sans mt-0.5 truncate">
                    {recipe.sourceName}
                  </p>
                )}
              </div>
              <button
                onClick={() => setFlipped(false)}
                className="flex-shrink-0 ml-3 h-9 px-3.5 rounded-full bg-white border border-neutral-200
                  flex items-center gap-1 text-char-600 text-sm font-sans
                  hover:bg-sand-100 transition-all duration-fast shadow-xs"
                aria-label="Back to overview"
              >
                <ChevronLeft size={15} />
                <span>To front</span>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex flex-col gap-3">

                {/* Ingredients card */}
                <div className="rounded-xl border border-neutral-300/50 shadow-xs bg-white p-4">
                  <p className="text-[11px] font-label tracking-[0.14em] uppercase text-char-400 mb-3">
                    Ingredients
                  </p>
                  {ingredients.length > 0 ? (
                    <div className="flex flex-col">
                      {ingredients.map((ing, i) => {
                        const name = typeof ing === 'string' ? ing : ing.name;
                        const foodId = typeof ing === 'string' ? null : ing.foodId;
                        const tappable = !!foodId && !!onSelectIngredient;
                        const rowContent = (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-forest-400 flex-shrink-0" />
                            <span className="text-sm text-char-800 font-sans">{name}</span>
                          </>
                        );
                        return tappable ? (
                          <button
                            key={i}
                            onClick={() => onSelectIngredient({ id: foodId, name })}
                            className="flex items-center gap-3 py-2 border-b border-sand-100 last:border-0
                              w-full text-left rounded-md transition-colors duration-fast
                              hover:bg-sand-50 active:bg-sand-100"
                            aria-label={`View details for ${name}`}
                          >
                            {rowContent}
                          </button>
                        ) : (
                          <div
                            key={i}
                            className="flex items-center gap-3 py-2 border-b border-sand-100 last:border-0"
                          >
                            {rowContent}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-char-400 font-sans italic">No ingredients listed.</p>
                  )}
                </div>

              </div>
            </div>

            {/* Get the recipe — pinned to the bottom */}
            <div className="flex-shrink-0 px-4 pb-4">
              <button
                onClick={handleGetRecipe}
                className="w-full py-3.5 rounded-xl bg-blue-950 text-white
                  font-display font-semibold text-base shadow-fab
                  flex items-center justify-center gap-2
                  transition-all duration-base ease-ds-out
                  hover:-translate-y-[1px] hover:shadow-lg
                  active:translate-y-[1px] active:scale-[0.99]"
              >
                <ExternalLink size={17} />
                Get the recipe
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
