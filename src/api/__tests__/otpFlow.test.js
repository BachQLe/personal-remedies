/**
 * otpFlow.test.js — Guard tests for src/api/otpFlow.js (Task T4D, master plan
 * §4.3). Pure-function module, no jsdom needed.
 */
import { describe, expect, it } from 'vitest';
import {
  RESEND_COOLDOWN_MS,
  EXPIRY_HINT_MS,
  canResend,
  secondsUntilResend,
  isValidCode,
  normalizeCodeInput,
  likelyExpired,
} from '../otpFlow.js';

describe('otpFlow constants', () => {
  it('cooldown is 60s and expiry hint is 10min, per docs/deploy-supabase.md §6', () => {
    expect(RESEND_COOLDOWN_MS).toBe(60_000);
    expect(EXPIRY_HINT_MS).toBe(10 * 60 * 1000);
  });
});

describe('canResend', () => {
  it('is true when no code has ever been sent (null/undefined lastSentAt)', () => {
    expect(canResend(null, 1_000_000)).toBe(true);
    expect(canResend(undefined, 1_000_000)).toBe(true);
  });

  it('is false immediately after sending', () => {
    const now = 1_000_000;
    expect(canResend(now, now)).toBe(false);
  });

  it('is false one ms before the cooldown elapses', () => {
    const lastSentAt = 1_000_000;
    const now = lastSentAt + RESEND_COOLDOWN_MS - 1;
    expect(canResend(lastSentAt, now)).toBe(false);
  });

  it('is true exactly at the cooldown boundary', () => {
    const lastSentAt = 1_000_000;
    const now = lastSentAt + RESEND_COOLDOWN_MS;
    expect(canResend(lastSentAt, now)).toBe(true);
  });

  it('is true well after the cooldown elapses', () => {
    const lastSentAt = 1_000_000;
    const now = lastSentAt + RESEND_COOLDOWN_MS + 30_000;
    expect(canResend(lastSentAt, now)).toBe(true);
  });
});

describe('secondsUntilResend', () => {
  it('is 0 when a code has never been sent', () => {
    expect(secondsUntilResend(null, Date.now())).toBe(0);
  });

  it('is the full 60s immediately after sending', () => {
    const now = 1_000_000;
    expect(secondsUntilResend(now, now)).toBe(60);
  });

  it('rounds UP so it never reads 0 while still blocked (1ms remaining -> 1s)', () => {
    const lastSentAt = 1_000_000;
    const now = lastSentAt + RESEND_COOLDOWN_MS - 1;
    expect(secondsUntilResend(lastSentAt, now)).toBe(1);
  });

  it('is exactly 0 at the cooldown boundary', () => {
    const lastSentAt = 1_000_000;
    const now = lastSentAt + RESEND_COOLDOWN_MS;
    expect(secondsUntilResend(lastSentAt, now)).toBe(0);
  });

  it('mid-cooldown returns the ceil of remaining time', () => {
    const lastSentAt = 1_000_000;
    const now = lastSentAt + 45_500; // 14.5s remaining
    expect(secondsUntilResend(lastSentAt, now)).toBe(15);
  });
});

describe('isValidCode', () => {
  it('accepts exactly 6 digits', () => {
    expect(isValidCode('123456')).toBe(true);
    expect(isValidCode('000000')).toBe(true);
  });

  it('rejects too few or too many digits', () => {
    expect(isValidCode('12345')).toBe(false);
    expect(isValidCode('1234567')).toBe(false);
  });

  it('rejects non-digit characters', () => {
    expect(isValidCode('12345a')).toBe(false);
    expect(isValidCode('123 456')).toBe(false);
    expect(isValidCode('123-456')).toBe(false);
  });

  it('rejects empty string and non-string input', () => {
    expect(isValidCode('')).toBe(false);
    expect(isValidCode(123456)).toBe(false);
    expect(isValidCode(null)).toBe(false);
    expect(isValidCode(undefined)).toBe(false);
  });
});

describe('normalizeCodeInput', () => {
  it('passes through a clean 6-digit code', () => {
    expect(normalizeCodeInput('123456')).toBe('123456');
  });

  it('strips spaces used to visually group the code', () => {
    expect(normalizeCodeInput('123 456')).toBe('123456');
    expect(normalizeCodeInput(' 123456 ')).toBe('123456');
  });

  it('strips hyphens used to visually group the code', () => {
    expect(normalizeCodeInput('123-456')).toBe('123456');
  });

  it('strips both spaces and hyphens together', () => {
    expect(normalizeCodeInput('12 34-56')).toBe('123456');
  });

  it('extracts the code from a full pasted email body', () => {
    const pasted = `Your Remedi sign-in code

Enter this code in the app:

123456

This code expires in 10 minutes. If you didn't request this, ignore this email.`;
    expect(normalizeCodeInput(pasted)).toBe('123456');
  });

  it('prefers an exact 6-digit run over a longer adjacent digit run (order id, phone number)', () => {
    const messy = 'Order #1234567890 — your code 123456 expires soon. Call 1-800-555-0100.';
    expect(normalizeCodeInput(messy)).toBe('123456');
  });

  it('returns "" when no 6-digit run exists', () => {
    expect(normalizeCodeInput('call 555-1234')).toBe(''); // strips to 5551234 (7 digits)
    expect(normalizeCodeInput('12345')).toBe('');
    expect(normalizeCodeInput('no digits here')).toBe('');
    expect(normalizeCodeInput('')).toBe('');
  });

  it('returns "" for non-string input rather than throwing', () => {
    expect(normalizeCodeInput(null)).toBe('');
    expect(normalizeCodeInput(undefined)).toBe('');
    expect(normalizeCodeInput(123456)).toBe('');
  });
});

describe('likelyExpired', () => {
  it('is false when no send has happened yet', () => {
    expect(likelyExpired(null, Date.now())).toBe(false);
  });

  it('is false right after sending', () => {
    const now = 1_000_000;
    expect(likelyExpired(now, now)).toBe(false);
  });

  it('is false just under the 10-minute hint window', () => {
    const sentAt = 1_000_000;
    const now = sentAt + EXPIRY_HINT_MS - 1;
    expect(likelyExpired(sentAt, now)).toBe(false);
  });

  it('is true exactly at and beyond the 10-minute hint window', () => {
    const sentAt = 1_000_000;
    expect(likelyExpired(sentAt, sentAt + EXPIRY_HINT_MS)).toBe(true);
    expect(likelyExpired(sentAt, sentAt + EXPIRY_HINT_MS + 60_000)).toBe(true);
  });
});
