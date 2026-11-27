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

// Every sliding thumb (tab bar, pill switcher, day strip, age slider) uses this
// one spring so they all feel the same: a touch softer than `spring`.
export const sliderSpring = { type: 'spring', stiffness: 320, damping: 32 }

// Every page/tab-body swap: current content drops 10px and fades, the next
// rises from 10px below and fades in. Use with AnimatePresence mode="wait".
export const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } },
  exit: { opacity: 0, y: 10, transition: { duration: dur.exit, ease: ease.in } },
}
