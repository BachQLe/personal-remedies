/**
 * browser.js — thin adapter for outbound-URL, print, and share concerns.
 *
 * This is the ONLY file allowed to touch `window.open`, `window.print`,
 * `navigator.share`, and `navigator.clipboard`. Everything else (screens,
 * components, state stores) should call through here instead of reaching
 * for the global directly — that keeps the rest of the app portable when
 * it's ported to Expo/React Native later, where none of these globals
 * exist in the same shape (or at all).
 *
 * No UI lives here: functions return plain data/booleans/results and let
 * the caller decide what toast/dialog to show.
 */

/**
 * Open a URL in a new tab, with `noopener,noreferrer` so the new tab can't
 * reach back into `window.opener` (tab-nabbing protection) and doesn't leak
 * a Referer header.
 *
 * No-ops outside a browser (SSR/tests) so importing this module is always
 * safe.
 *
 * @param {string} url
 * @returns {void}
 */
export function openUrl(url) {
  if (typeof window === 'undefined' || !url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Trigger the browser's print dialog for the current page.
 *
 * No-ops outside a browser so importing this module is always safe.
 *
 * @returns {void}
 */
export function printPage() {
  if (typeof window === 'undefined' || typeof window.print !== 'function') return;
  window.print();
}

/**
 * Share `{ title, text }` via the platform share sheet when available,
 * falling back to copying `text` to the clipboard otherwise.
 *
 * Capability-detected rather than UA-sniffed: `navigator.share` only
 * exists on browsers/contexts that can actually show a share sheet (mostly
 * mobile), so its presence IS the feature check.
 *
 * A user backing out of the share sheet rejects the `navigator.share()`
 * promise with an `AbortError` — that's a cancellation, not a failure, so
 * it's reported back as `{ ok: true, method: 'share' }` rather than an
 * error. Any other rejection (e.g. permission denied) is a real failure.
 *
 * @param {{ title?: string, text?: string }} payload
 * @returns {Promise<{ ok: boolean, method: 'share' | 'clipboard' | 'none', error?: Error }>}
 */
export async function share({ title, text } = {}) {
  if (typeof navigator === 'undefined') {
    return { ok: false, method: 'none' };
  }

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text });
      return { ok: true, method: 'share' };
    } catch (error) {
      // User dismissed the native share sheet — not an error.
      if (error && error.name === 'AbortError') {
        return { ok: true, method: 'share' };
      }
      return { ok: false, method: 'share', error };
    }
  }

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text ?? '');
      return { ok: true, method: 'clipboard' };
    } catch (error) {
      return { ok: false, method: 'clipboard', error };
    }
  }

  // Neither the Web Share API nor the Clipboard API is available.
  return { ok: false, method: 'none' };
}
