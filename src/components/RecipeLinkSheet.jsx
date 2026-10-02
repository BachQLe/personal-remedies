import { createPortal } from 'react-dom';
import { ExternalLink } from 'lucide-react';
import BottomSheet from './shared/BottomSheet.jsx';
import { resolveRecipePreview } from '../utils/foodDetailCard.js';
import { openUrl } from '../api/browser.js';

/**
 * RecipeLinkSheet — in-app "before you leave" preview for a recipe's
 * directions link, opened from FoodDetailCard's CTA instead of navigating
 * straight out.
 *
 * Why this exists instead of an iframe (Instagram-style in-app browser):
 * medlineplus.gov, the app's only recipe source, sends
 * `x-frame-options: SAMEORIGIN` + `frame-ancestors 'self'`, so framing it
 * is impossible — verified, not assumed. This sheet is the honest
 * substitute: it shows what the user is about to open (photo, title,
 * calories when real, who hosts it) and hands off via a single explicit
 * button, rather than silently popping a new tab the way the old direct
 * `openUrl` CTA did.
 *
 * `openUrl` (src/api/browser.js) stays the ONE place `window.open` is
 * touched — this sheet is just another caller of it, same contract
 * FoodDetailCard's CTA used to have directly.
 *
 * `zClass` mirrors BottomSheet's own prop: FoodDetailCard renders at
 * `z-30`, and MealPlannerPicker's full-screen overlay (one of the six
 * screens that open FoodDetailCard) sits at `z-[60]` — this sheet needs to
 * stack above both, so callers pass `z-[70]` (the established convention
 * for "above MealPlannerPicker").
 *
 * Portal (verified in Playwright at 430×800): FoodDetailCard mounts this
 * component inside its own root `<div className="fixed inset-0 z-30 ...">`.
 * `position: fixed` + a `z-index` creates a stacking context regardless of
 * `transform`, so `zClass="z-[70]"` only ever wins *within* that z-30
 * context — the app's TabBar (`z-40`, src/components/layout/TabBar.jsx)
 * lives in a sibling stacking context entirely outside it and rendered on
 * top, intercepting taps on this sheet's bottom button. Rendering the
 * sheet's content straight into `document.body` via `createPortal` escapes
 * FoodDetailCard's stacking context so `z-[70]` is compared at the
 * document root, where it correctly beats both the TabBar (`z-40`) and
 * MealPlannerPicker (`z-[60]`). BottomSheet.jsx itself is untouched — its
 * focus trap, Escape handling, and scroll lock all read `document`/refs
 * directly, so they keep working unchanged through the portal. Guarded for
 * environments with no `document` (SSR).
 */
export default function RecipeLinkSheet({ open, onClose, item, zClass }) {
  if (!item) return null;

  const preview = resolveRecipePreview(item);

  const sheet = (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Recipe"
      ariaLabel="Recipe preview"
      zClass={zClass}
    >
      <div className="flex items-center gap-3 mb-4">
        {preview.image ? (
          <img
            src={preview.image}
            alt=""
            className="w-16 h-16 rounded-xl object-cover shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-paper-200 shrink-0" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <p className="font-display font-semibold text-blue-950 text-base leading-snug truncate">
            {preview.title}
          </p>
          {preview.calories !== null && (
            <p className="text-xs text-char-500 mt-0.5">
              ~{preview.calories} calories, per serving
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-paper-200 border border-sand-200 px-4 py-3 mb-5">
        <p className="font-label text-[11px] tracking-[0.14em] uppercase text-char-500 mb-1">
          {preview.eyebrow}
        </p>
        <p className="text-sm text-char-900 leading-snug">{preview.body}</p>
        {preview.showHostname && (
          <p className="text-xs text-char-500 mt-1">{preview.hostname}</p>
        )}
      </div>

      <button
        onClick={() => openUrl(preview.url)}
        className="w-full py-3.5 px-4 rounded-pill bg-blue-950 text-white
          font-display font-semibold text-base shadow-fab
          flex items-center justify-center gap-2
          transition-all duration-base ease-ds-out
          hover:-translate-y-[1px] hover:shadow-lg
          active:translate-y-[1px] active:scale-[0.99]"
      >
        <ExternalLink size={17} className="flex-shrink-0" aria-hidden="true" />
        <span className="truncate">{preview.ctaLabel}</span>
      </button>
    </BottomSheet>
  );

  return typeof document !== 'undefined' ? createPortal(sheet, document.body) : sheet;
}
