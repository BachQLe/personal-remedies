/**
 * dragScrollProps — spread onto a native `overflow-x: auto` rail to add mouse
 * click-and-drag scrolling. Touch and trackpad already scroll natively, so only
 * `pointerType === 'mouse'` is handled. Props (not a hook) so it works inside a
 * `.map()` of rails.
 *
 * - Scroll-snap is suspended while dragging, then restored (the browser
 *   re-snaps on release).
 * - A drag that moved more than a few px swallows the click that follows, so
 *   dragging across a card never opens it; a plain tap is untouched.
 * - `onDragStart` cancels the browser's native image drag, which otherwise
 *   hijacks a mouse press on a photo card.
 */
const DRAG_THRESHOLD_PX = 4;

export const dragScrollProps = {
  onPointerDown(event) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const rail = event.currentTarget;
    const startX = event.clientX;
    const startLeft = rail.scrollLeft;
    let moved = false;
    rail.style.scrollSnapType = 'none';

    const onMove = (e) => {
      const dx = e.clientX - startX;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX) moved = true;
      if (moved) rail.scrollLeft = startLeft - dx;
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      rail.style.scrollSnapType = '';
      if (!moved) return;
      const swallow = (e) => { e.stopPropagation(); e.preventDefault(); };
      rail.addEventListener('click', swallow, { capture: true, once: true });
      // The click (if any) fires right after pointerup; drop the guard so it
      // can't eat a later, unrelated tap.
      setTimeout(() => rail.removeEventListener('click', swallow, { capture: true }), 0);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  },
  onDragStart(event) {
    event.preventDefault();
  },
};
