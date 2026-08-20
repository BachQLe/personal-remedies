/**
 * OtpCodeEntry — reusable 6-digit code entry step for Remedi's email + OTP
 * sign-in flow (REMEDI_MASTER_PLAN.md §4.3). Shared by src/pages/marketing/
 * Login.jsx, the onboarding "back up your plan?" step
 * (src/components/onboarding/index.jsx), and ProfileScreen's "Back up &
 * sync" sheet — each of those owns the preceding email-collection step and
 * simply renders this once a code has been sent.
 *
 * Single text input (inputMode="numeric" + autoComplete="one-time-code")
 * rather than six separate boxes — simpler, and autoComplete="one-time-code"
 * already gets Safari/iOS's "from Messages/Mail" autofill suggestion without
 * needing per-box focus management. Auto-submits once 6 digits are present
 * (typed or pasted), so a real inbox-copied code can be pasted and verified
 * with no extra tap.
 *
 * Props:
 *   email     (string, required) — the address the code was sent to; shown
 *             in the copy and passed to verifyOtp.
 *   sentAt    (number, required) — epoch ms of the most recent send, drives
 *             the resend cooldown countdown and the expiry hint.
 *   onVerified(session) — called once supabase.auth.verifyOtp succeeds.
 *   onCancel()           — "Use a different email" — optional; hidden if omitted.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  canResend,
  secondsUntilResend,
  isValidCode,
  normalizeCodeInput,
  likelyExpired,
} from '../../api/otpFlow.js';

// Distinct, honest copy per failure mode (T4D brief: "invalid/expired/network
// get distinct honest messages"). `unconfigured` only shows if a resend is
// attempted after Supabase drops out from under the flow (defensive; the
// parent screens gate the email-send step on this already).
const ERROR_COPY = {
  invalid: "That code doesn't look right. Double-check the digits and try again.",
  expired: 'This code has expired. Send a new one below.',
  network: "Couldn't reach the server. Check your connection and try again.",
  unconfigured: "Sign-in isn't available right now — Supabase isn't configured.",
};

export default function OtpCodeEntry({ email, sentAt, onVerified, onCancel }) {
  const { verifyOtp, signInWithEmail } = useAuth();
  const [code, setCode] = useState('');
  const [lastSentAt, setLastSentAt] = useState(() => sentAt ?? Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState(null); // { reason, message } | null
  const [resendNote, setResendNote] = useState('');

  // Ticks the resend countdown / expiry hint. Cheap (one component, one
  // 1s interval, torn down on unmount) so no need to gate it on "cooldown
  // still active" — simpler to reason about.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const resendReady = canResend(lastSentAt, now);
  const secondsLeft = secondsUntilResend(lastSentAt, now);
  const expiredHint = likelyExpired(lastSentAt, now);

  const submit = async (candidate) => {
    if (!isValidCode(candidate) || verifying) return;
    setVerifying(true);
    setError(null);
    const result = await verifyOtp(email, candidate);
    setVerifying(false);
    if (result.ok) {
      onVerified?.(result.session);
    } else {
      setError({ reason: result.reason, message: ERROR_COPY[result.reason] || result.message });
    }
  };

  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (error) setError(null);
    if (digits.length === 6) submit(digits);
  };

  const handlePaste = (e) => {
    const text = e.clipboardData?.getData('text') ?? '';
    const extracted = normalizeCodeInput(text);
    if (!extracted) return; // let the default paste happen; handleChange will filter it
    e.preventDefault();
    setCode(extracted);
    setError(null);
    submit(extracted);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submit(code);
  };

  const handleResend = async () => {
    if (!resendReady || resending) return;
    setResending(true);
    setError(null);
    setResendNote('');
    try {
      await signInWithEmail(email);
      const sentNow = Date.now();
      setLastSentAt(sentNow);
      setCode('');
      setResendNote('New code sent.');
    } catch (err) {
      setError({ reason: 'network', message: err?.message || ERROR_COPY.network });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="font-sans text-[15px] text-char-900">
          We emailed a 6-digit code to <strong>{email}</strong>.
        </p>
        <p className="font-sans text-[13px] text-char-500 mt-1">Enter it below to continue.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="otp-code-input" className="sr-only">
          6-digit verification code
        </label>
        <input
          id="otp-code-input"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={handleChange}
          onPaste={handlePaste}
          disabled={verifying}
          placeholder="000000"
          aria-label="6-digit verification code"
          aria-invalid={!!error}
          aria-describedby={error ? 'otp-code-error' : undefined}
          autoFocus
          className="w-full text-center tracking-[0.5em] text-[22px] font-sans px-4 py-3 bg-white border border-sand-200 rounded-md text-char-900 placeholder:text-char-300 focus:outline-none focus:border-char-700 focus:shadow-[0_0_0_3px_rgba(66,61,54,0.22)] transition-[border-color,box-shadow] duration-[120ms] disabled:opacity-60"
          style={{ minHeight: 44 }}
        />

        {error && (
          <p id="otp-code-error" role="alert" className="font-sans text-[14px] text-signal-avoid">
            {error.message}
          </p>
        )}

        {!error && expiredHint && (
          <p className="font-sans text-[13px] text-char-500">
            Codes expire after about 10 minutes. If yours is old, request a new one below.
          </p>
        )}

        <button
          type="submit"
          disabled={!isValidCode(code) || verifying}
          className="w-full bg-char-900 text-[#F3EFE6] font-sans font-semibold text-[16px] py-3 rounded-[6px] hover:bg-char-700 disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px active:scale-[0.98] transition-all duration-[120ms]"
          style={{ minHeight: 44 }}
        >
          {verifying ? 'Verifying…' : 'Verify code'}
        </button>
      </form>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleResend}
          disabled={!resendReady || resending}
          aria-label={resendReady ? 'Resend code' : `Resend code available in ${secondsLeft} seconds`}
          className="font-sans text-[14px] font-semibold text-char-900 hover:text-char-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-[120ms]"
          style={{ minHeight: 44 }}
        >
          {resending ? 'Sending…' : resendReady ? 'Resend code' : `Resend in ${secondsLeft}s`}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="font-sans text-[14px] text-char-500 hover:text-char-900 transition-colors duration-[120ms]"
            style={{ minHeight: 44 }}
          >
            Use a different email
          </button>
        )}
      </div>

      {resendNote && !error && (
        <p role="status" className="font-sans text-[13px] text-char-700">
          {resendNote}
        </p>
      )}
    </div>
  );
}
