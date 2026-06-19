/**
 * BottomSheet — modal drawer (bottom on mobile, centered on desktop).
 *
 * Props (unchanged): open, onClose, children, title
 */
import { useEffect } from "react";

export default function BottomSheet({ open, onClose, children, title }) {
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop — light paper blur */}
      <div
        className="absolute inset-0 bg-char-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="relative bg-white rounded-t-2xl shadow-sheet max-h-[85vh] flex flex-col w-full max-w-[430px]">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-sand-200" />
        </div>
        {title && (
          <div className="flex items-center justify-between px-5 pb-3 pt-1 flex-shrink-0 border-b border-sand-200">
            <h2 className="font-display font-semibold text-char-900 text-lg tracking-tightish">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-paper-200 flex items-center justify-center text-char-500
                transition-colors duration-fast ease-ds-out hover:bg-sand-200"
              aria-label="Close"
            >
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
                close
              </span>
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1 px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
