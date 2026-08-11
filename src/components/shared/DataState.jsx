/**
 * DataState — presentational wrapper for the shared state matrix
 * (REMEDI_MASTER_PLAN.md §4.1; see src/api/loadState.js for how `status` is
 * derived and src/hooks/useAsyncData.js for the hook that produces it).
 *
 * Pure rendering, no fetching/timers/subscriptions of its own — a screen
 * hands it a `status` string plus the copy it wants for the empty/error
 * cases, and gets back the right branch:
 *   - 'success' / 'offline-cached'  → renders `children` (offline-cached
 *     ALSO shows a slim "Offline — showing saved data" banner above them,
 *     non-blocking — the data underneath is still real and interactive).
 *   - 'loading'                     → a neutral Skeleton/SkeletonGroup
 *     block. Screens with their own bespoke ghost/skeleton UI (the
 *     `.rm-ghost` system, local skeletons) should keep using it and simply
 *     never pass 'loading' through this component — this is the fallback
 *     for screens that don't have one, not a replacement for those that do.
 *   - 'empty' / 'empty-no-profile'  → EmptyState, with per-status defaults
 *     that `emptyTitle`/`emptyBody`/`emptyAction` override.
 *   - 'error-network' / 'error-api' / 'offline-no-cache' → a message panel
 *     (built on EmptyState) with a Retry button wired to `onRetry`.
 *
 * Copy throughout is functional/neutral by design — no health language, no
 * alarmist tone (guardrail: this file only ever says things like "Couldn't
 * load this" / "Try again", never anything implying a health consequence).
 *
 * @param {Object} props
 * @param {import('../../api/loadState.js').LoadState} props.status
 * @param {() => void} [props.onRetry] - Wired to the Retry button on every
 *   error-shaped status ('error-network', 'error-api', 'offline-no-cache').
 *   Omit to hide the button entirely (e.g. a screen that only wants the
 *   message, with its own retry affordance elsewhere).
 * @param {string} [props.emptyTitle] - Overrides the default 'empty' copy.
 * @param {string} [props.emptyBody] - Overrides the default 'empty' copy.
 * @param {import('react').ReactNode} [props.emptyAction] - Optional CTA
 *   rendered under the empty-state copy (e.g. "Browse foods").
 * @param {string} [props.screenName] - Used only for the accessible label on
 *   the loading/empty/error panels (e.g. "Loading recipes"); purely a11y,
 *   no visible copy or logging tied to it.
 * @param {import('react').ReactNode} props.children - Rendered on
 *   'success'/'offline-cached'.
 */
import EmptyState from './EmptyState.jsx';
import Skeleton, { SkeletonGroup } from './Skeleton.jsx';
import Icon from './Icon.jsx';

const STATUS_COPY = {
  'error-network': {
    icon: 'cloud',
    title: 'Connection problem',
    body: "Couldn't reach the server. Check your connection and try again.",
  },
  'error-api': {
    icon: 'alert-triangle',
    title: 'Something went wrong',
    body: "This didn't load. Try again in a moment.",
  },
  'offline-no-cache': {
    icon: 'cloud',
    title: "You're offline",
    body: 'Nothing saved for this yet. Reconnect and try again.',
  },
  'empty-no-profile': {
    icon: 'user',
    title: 'Set up your profile',
    body: 'Add your health profile to see this.',
  },
  empty: {
    icon: 'search',
    title: 'Nothing here yet',
    body: "There's nothing to show right now.",
  },
};

const RETRY_BTN_CLS =
  'px-5 py-2.5 rounded-xs bg-forest-700 text-white text-sm font-semibold font-sans ' +
  'transition-all duration-fast ease-ds-out hover:bg-forest-800 active:scale-[0.98]';

const ERROR_STATUSES = ['error-network', 'error-api', 'offline-no-cache'];

export default function DataState({
  status,
  onRetry,
  emptyTitle,
  emptyBody,
  emptyAction,
  screenName,
  children,
}) {
  if (status === 'success' || status === 'offline-cached') {
    return (
      <>
        {status === 'offline-cached' && (
          <div
            role="status"
            className="flex items-center gap-2 px-4 py-2 mb-3 rounded-lg bg-sand-100 text-char-500 text-xs font-sans font-medium"
          >
            <Icon name="cloud" size={14} className="text-char-400 shrink-0" />
            Offline — showing saved data
          </div>
        )}
        {children}
      </>
    );
  }

  if (status === 'loading') {
    return (
      <div
        className="px-5 py-6"
        role="status"
        aria-label={screenName ? `Loading ${screenName}` : 'Loading'}
      >
        <SkeletonGroup rows={4} />
        <Skeleton shape="card" className="h-24 w-full mt-4" />
      </div>
    );
  }

  const isEmptyStatus = status === 'empty' || status === 'empty-no-profile';
  const copy = STATUS_COPY[status] || STATUS_COPY.empty;
  const showRetry = ERROR_STATUSES.includes(status) && typeof onRetry === 'function';

  return (
    <div aria-label={screenName ? `${copy.title} — ${screenName}` : undefined}>
      <EmptyState
        icon={copy.icon}
        title={isEmptyStatus ? emptyTitle || copy.title : copy.title}
        body={isEmptyStatus ? emptyBody || copy.body : copy.body}
        action={
          isEmptyStatus ? (
            emptyAction
          ) : showRetry ? (
            <button type="button" onClick={onRetry} className={RETRY_BTN_CLS}>
              Retry
            </button>
          ) : undefined
        }
      />
    </div>
  );
}
