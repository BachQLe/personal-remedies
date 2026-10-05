import pkg from '../../../package.json';
import { APP_NAME, SUPPORT_EMAIL } from './importantNotesContent.js';

/** Builds the mailto: URL for Profile's "Help & feedback" row. */
export function buildSupportMailto(
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
) {
  const subject = `${APP_NAME} feedback`;
  const body = [
    'Hi there,',
    '',
    '(Write your question or feedback here)',
    '',
    '---',
    `App version: ${pkg.version}`,
    `Device: ${userAgent}`,
  ].join('\n');
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
