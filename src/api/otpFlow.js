/**
 * otpFlow.js — Pure, framework-free logic for the email + 6-digit OTP
 * sign-in flow (REMEDI_MASTER_PLAN.md §4.3). No Supabase import, no React —
 * every export here is a plain function of its inputs, so it's trivially
 * unit-testable and reusable from anywhere that embeds the flow
 * (src/components/auth/OtpCodeEntry.jsx, Login.jsx, the onboarding backup
 * step, ProfileScreen's "Back up & sync" sheet).
 *
 * Nothing here talks to Supabase or persisted storage — the server (via
 * src/context/AuthContext.jsx's `verifyOtp`/`signInWithEmail`) is always the
 * authority on whether a code is actually valid; this module only shapes
 * client-side UX (cooldown timing, input parsing, "this might be stale"
 * hinting).
 */

/**
 * Client-side resend cooldown. Supabase does not throttle "resend" attempts
 * beyond its own general rate limits (see docs/deploy-supabase.md §6) — this
 * is a UX guard against spamming the resend button, not a security control.
 */
export const RESEND_COOLDOWN_MS = 60_000;

/**
 * The server-side OTP expiry Remedi's Supabase project is configured for
 * (docs/deploy-supabase.md §6: Auth → Providers → Email → OTP expiry = 10
 * minutes). This is a CLIENT-SIDE HINT ONLY: the server is authoritative. A
 * `true` from `likelyExpired` doesn't guarantee the server will reject the
 * code, and `false` doesn't guarantee it'll accept it (clock skew, someone
 * changing the dashboard setting, etc.) — use it only to soften copy before
 * a verify attempt, never to block submission outright.
 */
export const EXPIRY_HINT_MS = 10 * 60 * 1000;

/**
 * Whether a new code can be sent right now.
 * @param {number|null|undefined} lastSentAt - epoch ms of the last send, or
 *   null/undefined if no code has been sent yet this session.
 * @param {number} [now]
 * @returns {boolean}
 */
export function canResend(lastSentAt, now = Date.now()) {
  if (lastSentAt == null) return true;
  return now - lastSentAt >= RESEND_COOLDOWN_MS;
}

/**
 * Seconds remaining before resend is allowed again, rounded UP so the
 * countdown never reads "0s" while still actually blocked. 0 once
 * `canResend` is true.
 * @param {number|null|undefined} lastSentAt
 * @param {number} [now]
 * @returns {number}
 */
export function secondsUntilResend(lastSentAt, now = Date.now()) {
  if (canResend(lastSentAt, now)) return 0;
  return Math.ceil((RESEND_COOLDOWN_MS - (now - lastSentAt)) / 1000);
}

/**
 * A code is valid INPUT SHAPE iff it's exactly 6 digits — no more, no less,
 * digits only. This is a shape check only; the server is the sole authority
 * on whether the code is actually correct/unexpired.
 * @param {unknown} code
 * @returns {boolean}
 */
export function isValidCode(code) {
  return typeof code === 'string' && /^\d{6}$/.test(code);
}

/**
 * Normalize whatever a user pastes (from Mail, Messages, a password
 * manager, ...) into a 6-digit code, or '' if none can be found.
 *
 * Strips spaces and hyphens first, so a code visually split across a paste
 * (e.g. "123 456" or "123-456") reassembles into one run. Then takes the
 * first MAXIMAL run of digits that is exactly 6 digits long — not just the
 * first 6 digits of a longer run — so a longer number incidentally present
 * in the pasted text (an order id, a phone number, "expires in 10 minutes")
 * doesn't get mistaken for the code.
 * @param {string} input
 * @returns {string} a 6-digit string, or '' if none found.
 */
export function normalizeCodeInput(input) {
  if (typeof input !== 'string') return '';
  const stripped = input.replace(/[\s-]/g, '');
  const runs = stripped.match(/\d+/g) || [];
  return runs.find((run) => run.length === 6) ?? '';
}

/**
 * Client-side HINT that a code was probably sent long enough ago to have
 * expired server-side (see `EXPIRY_HINT_MS`). Never authoritative — only use
 * this to soften copy ("this might be expired — want a new one?") before a
 * verify attempt.
 * @param {number|null|undefined} sentAt
 * @param {number} [now]
 * @returns {boolean}
 */
export function likelyExpired(sentAt, now = Date.now()) {
  if (sentAt == null) return false;
  return now - sentAt >= EXPIRY_HINT_MS;
}
