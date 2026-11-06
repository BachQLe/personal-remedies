/**
 * Copy for the in-app "Important Notes" screen and the "Help & feedback" row.
 * Edit text here only.
 *
 * NOTE: all body copy below is a DRAFT placeholder until the legal work
 * (C3/C5) supplies the real text; each section shows a DRAFT tag on screen.
 */

export const APP_NAME = 'Personal Remedies';

export const SUPPORT_EMAIL = 'hello@personalremedies.com'; // same as marketing Contact page

export const DISCLAIMER_PARAGRAPHS = [
  `${APP_NAME} provides general food and nutrition information for educational purposes. It is not medical advice, does not diagnose or treat any condition, and its publishers are not practicing medicine.`,
  'Always consult your physician or a qualified health professional before changing your diet, especially if you have a medical condition or take medications.',
  'If you think you have a medical emergency, call your doctor or 911.',
];

export const DATA_SOURCE_PARAGRAPHS = [
  'Food guidance is provided by Nutridigm.',
  'Recipes link out to their original sources, such as medlineplus.gov and foodnetwork.com.',
];

export const LEGAL_LINKS = [
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Terms of Use', to: '/terms' },
];

export const PUBLISHER_CREDIT = 'Published by Simple Software Publishing — Mory, Bach, Sunny.';

/** The three Important Notes sections (Prompt B 1.2), in order. */
export const NOTE_SECTIONS = [
  { title: 'Privacy', paragraphs: ['Privacy summary coming from legal review.'], links: LEGAL_LINKS },
  { title: 'Not medical advice', paragraphs: DISCLAIMER_PARAGRAPHS },
  { title: 'About', paragraphs: [...DATA_SOURCE_PARAGRAPHS, PUBLISHER_CREDIT] },
];
