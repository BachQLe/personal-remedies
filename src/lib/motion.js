// Shared motion vocabulary (ux-motion skill). Import these instead of inlining
// easings/durations so every screen moves the same way.
export const ease = {
  out: [0.16, 1, 0.3, 1], // entering
  in: [0.7, 0, 0.84, 0], // leaving
  inOut: [0.65, 0, 0.35, 1], // moving on screen
}

export const dur = { press: 0.12, base: 0.22, panel: 0.36, exit: 0.14 }

export const spring = { type: 'spring', stiffness: 420, damping: 32 } // ~0.8 damping ratio

// Stagger lists: 40ms apart, cap so cascades stay under ~300ms.
export const staggerDelay = (i) => Math.min(i, 7) * 0.04
