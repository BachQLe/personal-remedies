/**
 * messages.js — In-app news/alerts channel (REMEDI_MASTER_PLAN.md §4.7:
 * "News / alerts channel. In-app message surface now; push once native.").
 *
 * Guest-first, no backend: content lives in `public/messages.json`, a
 * static file a redeploy updates — no server, no auth, no per-user
 * targeting. It's fetched through the existing TTL cache layer
 * (src/api/cache.js) so screens aren't re-fetching it on every visit, and
 * this module degrades SILENTLY to an empty list on any failure (missing
 * file, network error, malformed JSON) — a broken/absent news file is never
 * something the user should see as an app error, it just means no messages
 * show.
 *
 * Dismissal is local-only (per-device, no account needed), persisted
 * through src/api/storage.js under a `dismissedMessages` sub-key of the
 * `remedi.v1` root — the same storage.get/set pattern every other piece of
 * client state uses (see src/state/library.js for the reference shape).
 *
 * NOT wired into any screen this wave (Task T5C) — HomeScreen, the eventual
 * banner mount point, is owned by another workstream this wave. This
 * module is data + logic only; `getActiveMessages` is the one function a
 * future banner component should call.
 */

import { cachedFetch } from './cache.js';
import { storage } from './storage.js';

/** storage.js sub-key (under the `remedi.v1` root) holding dismissed message ids. */
const STORAGE_KEY = 'dismissedMessages';

/** cache.js key for the fetched messages.json payload. */
const CACHE_KEY = 'messages.json';

/** Cache TTL — short so a content redeploy shows up quickly for returning users. */
export const MESSAGES_TTL_MS = 15 * 60 * 1000; // 15 min

/**
 * @typedef {Object} Message
 * @property {string} id - Stable identifier; also the dismissal key.
 * @property {string} title
 * @property {string} body
 * @property {string|null} [startsAt] - ISO date string. Missing/null = no
 *   lower bound (the message is active from the start of time).
 * @property {string|null} [endsAt] - ISO date string. Missing/null = no
 *   upper bound (the message never expires on its own).
 * @property {'info'|'notice'|'warning'} [severity] - Display tone; purely
 *   advisory for whatever UI eventually renders these. Not validated
 *   against a fixed enum here — an unrecognized value is passed through
 *   rather than dropping an otherwise-valid message.
 * @property {boolean} [dismissible] - Whether the user can dismiss it.
 *   Defaults to `true` when absent (existing behavior HomeScreen's
 *   discovery banner already had, before it moved into messages.json).
 */

/**
 * Fetch + parse `public/messages.json` through the cache layer. Never
 * throws — any failure (network error, non-OK status, non-JSON body, or a
 * JSON body that isn't an array) resolves to `[]`. See file header re: why
 * this fails silent rather than surfacing an error state.
 * @returns {Promise<any[]>}
 */
async function fetchAllMessages() {
  try {
    const raw = await cachedFetch(CACHE_KEY, MESSAGES_TTL_MS, async () => {
      const res = await fetch('/messages.json');
      if (!res.ok) throw new Error(`messages.json fetch failed: ${res.status}`);
      return res.json();
    });
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

/**
 * Whether a raw parsed row is well-formed enough to display. Malformed
 * rows (missing/empty/non-string id, title, or body) are dropped rather
 * than risking a blank or crashing render further up the stack — a bad row
 * in messages.json should never take down the whole channel.
 * @param {any} row
 * @returns {boolean}
 */
function isValidMessage(row) {
  return (
    row != null &&
    typeof row === 'object' &&
    typeof row.id === 'string' && row.id.length > 0 &&
    typeof row.title === 'string' && row.title.length > 0 &&
    typeof row.body === 'string' && row.body.length > 0
  );
}

/**
 * True when `nowMs` falls within a message's [startsAt, endsAt] window.
 * A missing, null, or unparsable bound is treated as unbounded on that
 * side — a message with no dates at all (or a typo'd date) degrades to
 * "always active" rather than being silently hidden or crashing.
 * @param {Message} message
 * @param {number} nowMs
 * @returns {boolean}
 */
function isWithinWindow(message, nowMs) {
  const startsMs = message.startsAt ? Date.parse(message.startsAt) : NaN;
  const endsMs = message.endsAt ? Date.parse(message.endsAt) : NaN;

  if (Number.isFinite(startsMs) && nowMs < startsMs) return false;
  if (Number.isFinite(endsMs) && nowMs > endsMs) return false;
  return true;
}

/**
 * Read the set of message ids dismissed on this device.
 * @returns {string[]}
 */
function getDismissedIds() {
  const ids = storage.get(STORAGE_KEY, []);
  return Array.isArray(ids) ? ids : [];
}

/**
 * Record that `id` has been dismissed, so `getActiveMessages` excludes it
 * from now on. Idempotent — dismissing an already-dismissed id doesn't
 * write a duplicate entry.
 * @param {string} id
 */
export function dismissMessage(id) {
  if (typeof id !== 'string' || !id) return;
  const dismissed = getDismissedIds();
  if (dismissed.includes(id)) return;
  storage.set(STORAGE_KEY, [...dismissed, id]);
}

/**
 * Active, non-dismissed messages as of `now`. The one function a future
 * banner/alerts UI should call — it folds together the cached fetch
 * (fail-silent), row validation, the startsAt/endsAt window, and dismissal
 * filtering into a single flat list.
 *
 * @param {number|Date} [now] - Defaults to the current time. Accepts a
 *   Date or epoch-ms number so callers/tests can pin "now" deterministically.
 * @returns {Promise<Message[]>}
 */
export async function getActiveMessages(now = Date.now()) {
  const nowMs = now instanceof Date ? now.getTime() : now;
  const all = await fetchAllMessages();
  const dismissed = new Set(getDismissedIds());

  return all
    .filter(isValidMessage)
    .filter((message) => isWithinWindow(message, nowMs))
    .filter((message) => !dismissed.has(message.id));
}
