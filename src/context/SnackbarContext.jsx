/**
 * SnackbarContext — provider-izes src/components/shared/Snackbar.jsx.
 *
 * Snackbar.jsx is deliberately provider-less; its docblock documents a
 * 3-piece copy-paste wiring pattern (local `useState` + a `showSnackbar`
 * callback + mounting `<Snackbar/>` near the screen root) that's currently
 * duplicated across 9 files. This context is that pattern extracted once,
 * mounted a single time at the app shell (AppLayout in App.jsx) so any
 * screen can call `useSnackbar().show(...)` instead of re-wiring its own.
 *
 * Migration is NOT part of this wave — the 9 existing screen-local
 * instances keep working exactly as documented in Snackbar.jsx, unmodified.
 * Both patterns coexist safely: a screen-local `<Snackbar/>` and this
 * provider's `<Snackbar/>` are two independent, separately-mounted
 * component instances with their own state, so there's no shared state to
 * collide on. Each only renders (via Snackbar's own `AnimatePresence`)
 * while ITS OWN `snackbar` state is non-null — a provider-driven toast and
 * a screen-local toast simply never appear from the same trigger, so a
 * "double toast" isn't something either instance can cause; the only way to
 * see two at once is a screen firing both its own local toast AND the
 * provider's in response to the same action, which is a call-site choice,
 * not something this file needs to guard against.
 *
 * Known gap (Snackbar.jsx is imported, not modified, per this wave's file
 * ownership): Snackbar.jsx hardcodes its action button's label to "Undo"
 * and its auto-dismiss delay to 3500ms — neither is a prop on the
 * component. `show`'s `actionLabel`/`duration` options below are accepted
 * for a stable, forward-compatible API shape (and `actionLabel` truthiness
 * still correctly toggles whether an action button renders at all), but the
 * rendered button text and the dismiss timing are NOT currently
 * customizable through Snackbar.jsx. A future wave that wants real custom
 * labels/durations needs a small prop addition to Snackbar.jsx itself.
 */
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import Snackbar from '../components/shared/Snackbar.jsx';

const SnackbarContext = createContext(null);

/**
 * @typedef {Object} ShowOptions
 * @property {string} [actionLabel] - Presence (any non-empty string) shows
 *   an action button. See the file docblock re: the button's text being
 *   fixed to "Undo" by Snackbar.jsx regardless of this value.
 * @property {() => void} [onAction] - Called when the action button is
 *   tapped, then the snackbar is dismissed.
 * @property {number} [duration] - Accepted for forward-compat; NOT
 *   currently honored (Snackbar.jsx's auto-dismiss is a fixed 3500ms — see
 *   file docblock).
 */

export function SnackbarProvider({ children }) {
  const [snackbar, setSnackbar] = useState(null);
  const idRef = useRef(0);
  const actionRef = useRef(null);

  /**
   * @param {string} message
   * @param {ShowOptions} [options]
   */
  const show = useCallback((message, options = {}) => {
    const { actionLabel, onAction } = options;
    idRef.current += 1;
    actionRef.current = typeof onAction === 'function' ? onAction : null;
    setSnackbar({ id: idRef.current, message, canUndo: !!actionLabel });
  }, []);

  const handleUndo = useCallback(() => {
    if (actionRef.current) actionRef.current();
    setSnackbar(null);
  }, []);

  const handleDismiss = useCallback(() => {
    setSnackbar(null);
  }, []);

  return (
    <SnackbarContext.Provider value={{ show }}>
      {children}
      <Snackbar snackbar={snackbar} onUndo={handleUndo} onDismiss={handleDismiss} />
    </SnackbarContext.Provider>
  );
}

/**
 * @returns {{ show: (message: string, options?: ShowOptions) => void }}
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useSnackbar() {
  const ctx = useContext(SnackbarContext);
  if (!ctx) {
    throw new Error('useSnackbar() must be called within a <SnackbarProvider>.');
  }
  return ctx;
}
