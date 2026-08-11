#!/usr/bin/env node
/**
 * scripts/check-contrast.mjs — WCAG 2.x contrast checker for Remedi's design
 * tokens (T6A, REMEDI_MASTER_PLAN.md Phase 5 "Accessibility").
 *
 * WHAT THIS DOES: computes WCAG relative-luminance contrast ratios for a
 * curated list of foreground/background token pairings the app actually
 * renders (see PAIRINGS below — each entry cites the component/file it was
 * observed in), and classifies each against WCAG 2.x Level AA:
 *   - normal text: >= 4.5:1
 *   - large text (>=24px regular or >=18.66px/14pt bold) / UI components
 *     and graphical objects (WCAG 1.4.11 "Non-text Contrast"): >= 3:1
 *
 * WHERE THE TOKENS COME FROM: colors are read directly from
 * `tailwind.config.js`'s `theme.extend.colors` (dynamically imported, so
 * this stays in sync with the real palette automatically — no hand-copied
 * hex values to drift) plus a small MANUAL_TOKENS map for the handful of
 * literal hex values used directly in JSX/CSS that aren't Tailwind palette
 * entries (`#F3EFE6` "text-on-dark", used via arbitrary-value classes like
 * `text-[#F3EFE6]` and inline `style={{ color: '#F3EFE6' }}` in
 * PrimaryButton.jsx) and Tailwind's built-in `white`/`black`, which aren't
 * customized in tailwind.config.js's `extend` block so don't appear there.
 *
 * USAGE:
 *   node scripts/check-contrast.mjs        — prints the full pass/fail table
 *   node scripts/check-contrast.mjs --json — prints machine-readable JSON
 *
 * Also imported by scripts/check-contrast.test.js (a vitest regression
 * guard) — see that file for how KNOWN_FAILURES is used to let CI catch
 * *new* violations while a documented baseline of pre-existing ones stays
 * visible without blocking the suite. Bach (not this script) decides
 * whether to change the brand palette to fix any of them.
 */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

/**
 * Hex values used directly in the app that are NOT part of the Tailwind
 * palette (so a plain `theme.extend.colors` flatten wouldn't find them),
 * plus Tailwind's built-in `white`/`black` (not overridden in
 * tailwind.config.js's `extend`, so absent from the extend-only flatten).
 * @type {Record<string, string>}
 */
const MANUAL_TOKENS = {
  white: '#FFFFFF',
  black: '#000000',
  // "text-on-dark" semantic alias (src/styles/remedy/tokens/colors.css
  // `--text-on-dark`) — used as a literal hex (`text-[#F3EFE6]`, or inline
  // `style={{ color: '#F3EFE6' }}` in PrimaryButton.jsx) rather than a
  // Tailwind class, since it's not registered as a Tailwind color token.
  'text-on-dark': '#F3EFE6',
};

/**
 * Flattens Tailwind's nested color config (`{ forest: { 700: '#..', DEFAULT: '#..' } }`)
 * into `{ 'forest-700': '#..', forest: '#..' }`-style flat keys matching the
 * `text-forest-700` / `bg-forest-700` class suffix convention used in JSX.
 * @param {Record<string, unknown>} colors
 * @param {string} prefix
 * @param {Record<string, string>} out
 * @returns {Record<string, string>}
 */
function flattenColors(colors, prefix = '', out = {}) {
  for (const [key, val] of Object.entries(colors)) {
    const flatKey = prefix ? `${prefix}-${key}` : key;
    if (typeof val === 'string') {
      out[flatKey] = val;
    } else if (val && typeof val === 'object') {
      if (typeof val.DEFAULT === 'string') out[flatKey] = val.DEFAULT;
      flattenColors(val, flatKey, out);
    }
  }
  return out;
}

/**
 * Loads and flattens the live token table: tailwind.config.js's custom
 * colors + MANUAL_TOKENS. Re-reads the config on every call (dynamic
 * import, no caching) so this never silently drifts from the real palette.
 * @returns {Promise<Record<string, string>>}
 */
async function loadTokens() {
  const configUrl = pathToFileURL(path.join(REPO_ROOT, 'tailwind.config.js')).href;
  const { default: config } = await import(configUrl);
  const flat = flattenColors(config?.theme?.extend?.colors || {});
  return { ...MANUAL_TOKENS, ...flat };
}

/**
 * Resolves a pairing's `fg`/`bg` value to a hex string: either a literal
 * `#rrggbb` (used as-is) or a token key looked up in `tokens`.
 * @param {string} value
 * @param {Record<string, string>} tokens
 * @returns {string} hex color, e.g. "#628C22"
 */
function resolveHex(value, tokens) {
  if (value.startsWith('#')) return value;
  const hex = tokens[value];
  if (!hex) throw new Error(`check-contrast: unknown token "${value}" — not in tailwind.config.js theme.extend.colors or MANUAL_TOKENS`);
  return hex;
}

/**
 * @param {string} hex e.g. "#628C22" or "#fff"
 * @returns {[number, number, number]} 0-255 RGB
 */
function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * WCAG relative luminance (sRGB channel linearization per the 2.x spec).
 * @param {[number, number, number]} rgb
 * @returns {number} 0 (black) – 1 (white)
 */
function relativeLuminance([r, g, b]) {
  const toLinear = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [rl, gl, bl] = [toLinear(r), toLinear(g), toLinear(b)];
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/**
 * WCAG contrast ratio between two hex colors, 1:1 (no contrast) to 21:1
 * (black on white).
 * @param {string} hexA
 * @param {string} hexB
 * @returns {number}
 */
export function contrastRatio(hexA, hexB) {
  const lA = relativeLuminance(hexToRgb(hexA));
  const lB = relativeLuminance(hexToRgb(hexB));
  const [lighter, darker] = lA > lB ? [lA, lB] : [lB, lA];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * AA threshold for a pairing's `type`.
 * @param {'normal'|'large'|'ui'} type
 * @returns {number}
 */
function aaThreshold(type) {
  return type === 'normal' ? 4.5 : 3.0;
}

/**
 * Curated foreground/background pairings actually rendered by the app,
 * gathered by grepping `text-*`/`bg-*` usage across src/ (frequency counts
 * confirmed via `grep -roh` before authoring this list) and reading the
 * shared components that own them. `type` drives the AA threshold:
 *   - 'normal' — body/label/button text under ~18px or not bold
 *   - 'large'  — text at/above the WCAG large-text size+weight cutoff
 *   - 'ui'     — non-text UI element (icon-on-fill, per WCAG 1.4.11)
 *
 * NOTE ON SCOPE: most `source` files below are shared/ components this
 * task owns; a few (marketing eyebrow labels, Snackbar) are cited from
 * files outside this task's ownership because they use tokens this task's
 * components also use (Snackbar.jsx IS owned) — included because "the
 * app's actual color pairings" per the brief means real usage, not just
 * this task's file list. Fixing any FAILING pairing (changing which token
 * is used where) is out of scope — see check-contrast.test.js.
 */
export const PAIRINGS = [
  { id: 'body-text-on-page', fg: 'char-900', bg: 'paper-200', type: 'normal', source: 'src/index.css:29 (body default)' },
  { id: 'body-text-on-white-card', fg: 'char-900', bg: 'white', type: 'normal', source: '.ds-card and white-card pattern app-wide' },
  { id: 'secondary-text-on-white', fg: 'char-500', bg: 'white', type: 'normal', source: 'EmptyState.jsx body copy; most common text/bg combo in src (153x)' },
  { id: 'secondary-text-on-page', fg: 'char-500', bg: 'paper-200', type: 'normal', source: 'body copy directly on page background' },
  { id: 'muted-text-on-white', fg: 'char-400', bg: 'white', type: 'normal', source: 'SearchInput.jsx icon-adjacent / DataState.jsx cloud-icon label context' },
  { id: 'heading-on-page', fg: 'blue-950', bg: 'paper-200', type: 'normal', source: 'PageHeader.jsx title over page/colored header bg' },
  { id: 'heading-on-white', fg: 'blue-950', bg: 'white', type: 'normal', source: 'BottomSheet.jsx title, EmptyState.jsx title, Card.jsx title' },
  { id: 'primary-btn-text', fg: 'text-on-dark', bg: 'forest-700', type: 'normal', source: 'PrimaryButton.jsx' },
  { id: 'pill-forest-text', fg: 'text-on-dark', bg: 'forest-700', type: 'normal', source: 'src/index.css .pill-forest' },
  { id: 'pill-plum-text', fg: 'text-on-dark', bg: 'plum-700', type: 'normal', source: 'src/index.css .pill-plum' },
  { id: 'pill-honey-text', fg: 'white', bg: 'honey-600', type: 'normal', source: 'src/index.css .pill-honey' },
  { id: 'secondary-btn-text', fg: 'char-900', bg: 'white', type: 'normal', source: 'SecondaryButton.jsx' },
  { id: 'snackbar-text', fg: 'white', bg: 'char-900', type: 'normal', source: 'Snackbar.jsx message' },
  { id: 'snackbar-undo-link', fg: 'forest-300', bg: 'char-900', type: 'normal', source: 'Snackbar.jsx action button (text-forest-300 on bg-char-900)' },
  { id: 'retry-btn-text', fg: 'white', bg: 'forest-700', type: 'normal', source: 'DataState.jsx RETRY_BTN_CLS' },
  { id: 'signalchip-beneficial-text', fg: 'benefit-600', bg: 'benefit-100', type: 'normal', source: 'SignalChip.jsx signal="beneficial"' },
  { id: 'signalchip-beneficial-dot', fg: 'white', bg: 'benefit-600', type: 'ui', source: 'SignalChip.jsx dot-icon fill' },
  { id: 'signalchip-limit-text', fg: 'caution-600', bg: 'caution-100', type: 'normal', source: 'SignalChip.jsx signal="limit"' },
  { id: 'signalchip-limit-dot', fg: 'white', bg: 'caution-600', type: 'ui', source: 'SignalChip.jsx dot-icon fill' },
  { id: 'signalchip-avoid-text', fg: 'avoid-600', bg: 'avoid-100', type: 'normal', source: 'SignalChip.jsx signal="avoid"' },
  { id: 'signalchip-avoid-dot', fg: 'white', bg: 'avoid-600', type: 'ui', source: 'SignalChip.jsx dot-icon fill' },
  { id: 'conditiontag-text-outline', fg: 'char-900', bg: 'white', type: 'normal', source: 'ConditionTag.jsx solid=false (outline)' },
  { id: 'conditiontag-text-solid', fg: 'char-900', bg: 'forest-50', type: 'normal', source: 'ConditionTag.jsx solid=true' },
  { id: 'studyreferences-link', fg: 'forest-700', bg: 'white', type: 'normal', source: 'StudyReferences.jsx citation link' },
  { id: 'pillswitcher-selected-positive', fg: 'white', bg: 'forest-600', type: 'normal', source: 'PillSwitcher.jsx tone="positive" thumb' },
  { id: 'pillswitcher-selected-negative', fg: 'white', bg: 'red-500', type: 'normal', source: 'PillSwitcher.jsx tone="negative" thumb' },
  { id: 'pillswitcher-unselected', fg: 'char-500', bg: 'sand-100', type: 'normal', source: 'PillSwitcher.jsx unselected option on track bg' },
  { id: 'pill-selected', fg: 'white', bg: 'forest-700', type: 'normal', source: 'Pill.jsx selected' },
  { id: 'pill-unselected', fg: 'char-900', bg: 'white', type: 'normal', source: 'Pill.jsx unselected' },
  { id: 'tag-eyebrow', fg: 'char-500', bg: 'white', type: 'normal', source: 'src/index.css .tag (12px semibold — below the WCAG large-text cutoff)' },
  { id: 'marketing-eyebrow-on-dark', fg: 'yellow-400', bg: 'blue-950', type: 'normal', source: 'Hero.jsx/TwoDoors.jsx/FinalCTA.jsx etc. eyebrow labels on dark hero bg' },
  { id: 'searchinput-placeholder', fg: 'char-300', bg: 'white', type: 'normal', source: 'SearchInput.jsx placeholder:text-char-300' },
  { id: 'searchinput-icon', fg: 'char-400', bg: 'white', type: 'ui', source: 'SearchInput.jsx leading search icon (decorative, aria-hidden)' },
  { id: 'emptystate-icon', fg: 'forest-600', bg: 'forest-50', type: 'ui', source: 'EmptyState.jsx icon-in-circle' },
];

/**
 * @typedef {Object} PairingResult
 * @property {string} id
 * @property {string} fgHex
 * @property {string} bgHex
 * @property {number} ratio
 * @property {number} threshold
 * @property {boolean} pass
 */

/**
 * Evaluates every entry in PAIRINGS against its AA threshold.
 * @returns {Promise<PairingResult[]>}
 */
export async function evaluatePairings() {
  const tokens = await loadTokens();
  return PAIRINGS.map((p) => {
    const fgHex = resolveHex(p.fg, tokens);
    const bgHex = resolveHex(p.bg, tokens);
    const ratio = contrastRatio(fgHex, bgHex);
    const threshold = aaThreshold(p.type);
    return { ...p, fgHex, bgHex, ratio: Math.round(ratio * 100) / 100, threshold, pass: ratio + 1e-9 >= threshold };
  });
}

// ── CLI entry point ─────────────────────────────────────────────────────────
const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const results = await evaluatePairings();
  const asJson = process.argv.includes('--json');

  if (asJson) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    const failures = results.filter((r) => !r.pass);
    const passes = results.filter((r) => r.pass);

    console.log(`\nRemedi contrast check — WCAG 2.x Level AA\n${'='.repeat(60)}`);
    for (const r of results) {
      const status = r.pass ? 'PASS' : 'FAIL';
      console.log(
        `[${status}] ${r.id.padEnd(30)} ${r.ratio.toFixed(2)}:1  (need ${r.threshold}:1, ${r.type})  ${r.fg} on ${r.bg}  [${r.fgHex} / ${r.bgHex}]`
      );
    }
    console.log(`${'='.repeat(60)}`);
    console.log(`${passes.length}/${results.length} pass, ${failures.length} fail\n`);
    if (failures.length > 0) {
      console.log('Failing pairings (source references):');
      for (const r of failures) {
        console.log(`  - ${r.id}: ${r.source}`);
      }
      console.log('');
    }
    process.exitCode = failures.length > 0 ? 1 : 0;
  }
}
