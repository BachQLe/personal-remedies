import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Same spring feel as the rest of the Plan screens' `calmSpring` constant —
// hardcoded here (rather than imported) so this component has no dependency
// on any single screen's local constants.
const calmSpring = { type: 'spring', stiffness: 120, damping: 22, mass: 1 };

/**
 * Snackbar — bottom-anchored, framer-motion slide-up toast. Auto-dismisses
 * after 3500ms; optionally shows an "Undo" action button.
 *
 * This is the shared toast every screen with a save/remove/undo-able action
 * should use. The 3-piece wiring pattern to replicate in a consuming screen:
 *   1. `const [snackbar, setSnackbar] = useState(null);`
 *   2. A `showSnackbar(message, canUndo = false, undoFn = null)` callback
 *      that bumps an id ref and calls `setSnackbar({ id, message, canUndo })`
 *      (store `undoFn` in a ref, invoked from `onUndo`).
 *   3. `<Snackbar snackbar={snackbar} onUndo={handleUndo} onDismiss={() => setSnackbar(null)} />`
 *      mounted once near the root of the screen.
 *
 * @param {Object} props
 * @param {{ id: number, message: string, canUndo?: boolean } | null} props.snackbar
 * @param {() => void} [props.onUndo] - Called when the "Undo" button is tapped.
 * @param {() => void} props.onDismiss - Called on auto-dismiss (3500ms) or after undo.
 */
export default function Snackbar({ snackbar, onUndo, onDismiss }) {
  useEffect(() => {
    if (!snackbar) return;
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [snackbar, onDismiss]);

  return (
    <AnimatePresence>
      {snackbar && (
        <motion.div
          key={snackbar.id}
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={calmSpring}
          className="fixed bottom-[88px] left-0 right-0 mx-auto z-50
            max-w-[360px] w-[calc(100%-40px)]
            flex items-center justify-between gap-3
            px-4 py-3 rounded-xl
            bg-char-900 text-white shadow-lg"
        >
          <span className="font-sans text-sm font-medium">{snackbar.message}</span>
          {snackbar.canUndo && (
            <button
              onClick={onUndo}
              className="font-sans text-sm font-semibold text-forest-300 hover:text-forest-200
                transition-colors duration-fast shrink-0"
            >
              Undo
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
