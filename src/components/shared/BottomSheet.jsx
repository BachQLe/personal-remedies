/**
 * BottomSheet — modal drawer (bottom on mobile, centered on desktop).
 *
 * Props: open, onClose, children, title, ariaLabel, zClass
 *
 * `zClass` exists because the default `z-50` sits BELOW the full-screen
 * MealPlannerPicker overlay (`z-[60]`); a sheet opened from inside that
 * overlay must pass a higher layer or it renders behind it.
 *
 * DIALOG SEMANTICS (T6A). This is the app's primary modal surface (Profile
 * editors, CalorieGapSheet, SlotBrowseSheet, NutritionFactsSheet, etc.), so
 * it carries full `role="dialog"` behavior:
 *   - `role="dialog"` + `aria-modal="true"` on the sheet panel.
 *   - Accessible name: `aria-labelledby` pointing at the visible `title`
 *     heading when one is passed (every current call site but one does);
 *     falls back to an `ariaLabel` prop, and finally to a generic
 *     `aria-label="Dialog"` so the sheet is never nameless even for call
 *     sites that pass neither (e.g. CalorieGapSheet, which renders its own
 *     in-body `<h2>` instead of using the `title` prop).
 *   - Focus moves into the sheet on open and returns to whatever was
 *     focused beforehand on close.
 *   - Escape closes the sheet.
 *   - Tab/Shift+Tab is trapped to the sheet's own focusable elements.
 *   - The backdrop stays a mouse-only affordance (a plain `<div onClick>`,
 *     `aria-hidden`) — per T6A guidance this is the simpler, standard
 *     pattern; keyboard users close via Escape or a real close/back
 *     button instead of hunting for a focusable backdrop.
 */
import { useEffect, useId, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Icon from "./Icon.jsx";
import { ease, dur } from "../../lib/motion.js";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function BottomSheet({
  open,
  onClose,
  children,
  title,
  ariaLabel,
  zClass = "z-50",
}) {
  const sheetRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const titleId = useId();

  // Scroll lock — unchanged from before this pass.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Focus management: remember what had focus before the sheet opened, move
  // focus into the sheet, and restore it on close/unmount.
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement;
    sheetRef.current?.focus();

    return () => {
      const toRestore = previouslyFocusedRef.current;
      if (toRestore && typeof toRestore.focus === "function") {
        toRestore.focus();
      }
    };
  }, [open]);

  // Escape closes; Tab/Shift+Tab is trapped within the sheet's focusables.
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;

      const node = sheetRef.current;
      if (!node) return;
      const focusable = node.querySelectorAll(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const labelProps = title
    ? { "aria-labelledby": titleId }
    : { "aria-label": ariaLabel || "Dialog" };

  // Enter: ease-out, slides up. Exit: faster, ease-in. Both retarget from the
  // current value, so a close mid-open (or reopen mid-close) never jumps.
  const enter = { duration: dur.panel, ease: ease.out };
  const exit = { duration: dur.exit, ease: ease.in };

  return (
    <AnimatePresence>
      {open && (
        <div key="sheet" className={`fixed inset-0 ${zClass} flex items-end justify-center`}>
          {/* Backdrop — mouse-only affordance by design; keyboard users close via
              Escape or a real close/back button (see docblock above). */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: enter }}
            exit={{ opacity: 0, transition: exit }}
          >
            <div className="absolute inset-0 bg-char-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
          </motion.div>
          {/* Sheet — slides up on open. The motion wrapper only animates; the
              dialog itself stays a plain element. */}
          <motion.div
            className="relative w-full max-w-[430px]"
            initial={{ y: "24%", opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: enter }}
            exit={{ y: "16%", opacity: 0, transition: exit }}
          >
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            {...labelProps}
            className="bg-white rounded-t-2xl shadow-sheet max-h-[85vh] flex flex-col w-full outline-none"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0" aria-hidden="true">
              <div className="w-10 h-1 rounded-full bg-paper-200" />
            </div>
            {title && (
              <div className="flex items-center justify-between px-5 pb-3 pt-1 flex-shrink-0 border-b border-paper-200">
                <h2 id={titleId} className="font-display font-semibold text-blue-950 text-lg tracking-tightish">
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="tap-target w-8 h-8 rounded-full bg-paper-200 flex items-center justify-center text-char-500
                    transition-[transform,background-color] duration-press ease-ux-out mouse:hover:bg-sand-200 active:scale-90"
                  aria-label="Close"
                >
                  <Icon name="x" size={18} aria-hidden="true" />
                </button>
              </div>
            )}
            <div className="overflow-y-auto overscroll-contain flex-1 px-5 py-4">{children}</div>
          </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
