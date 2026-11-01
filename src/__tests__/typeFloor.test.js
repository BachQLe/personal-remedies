/**
 * No user-facing text below the caption size, and all type in relative units,
 * so it follows the iPhone text-size setting (Mory's 30 Oct review, 1.1/1.2).
 * Print styles are exempt: they are ink on paper, not a screen.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import tailwindConfig from '../../tailwind.config.js';

const CAPTION_REM = 0.875;
const ROOT = fileURLToPath(new URL('..', import.meta.url));

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.(jsx?|css)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
  });
}

const stripPrint = (css) => {
  const start = css.search(/@media print\s*\{/);
  if (start === -1) return css;
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') depth -= 1;
    if (depth === 0) return css.slice(0, start) + stripPrint(css.slice(i + 1));
  }
  return css.slice(0, start);
};

// The dev-only component gallery (/kitchen-sink) isn't part of the product.
const files = sourceFiles(ROOT).filter((file) => !file.endsWith('KitchenSink.jsx')).map((file) => {
  const text = fs.readFileSync(file, 'utf8');
  return { name: path.relative(ROOT, file), text: file.endsWith('.css') ? stripPrint(text) : text };
});

describe('type floor', () => {
  it('uses no px text-size classes', () => {
    const offenders = files.flatMap(({ name, text }) => (text.match(/text-\[\d+(\.\d+)?px\]/g) ?? []).map((m) => `${name}: ${m}`));
    expect(offenders).toEqual([]);
  });

  it('has no rem text-size class below the caption size', () => {
    const offenders = files.flatMap(({ name, text }) => [...text.matchAll(/text-\[(\d*\.?\d+)rem\]/g)]
      .filter((m) => Number(m[1]) < CAPTION_REM)
      .map((m) => `${name}: ${m[0]}`));
    expect(offenders).toEqual([]);
  });

  it('uses no px font-size in CSS or inline styles', () => {
    const offenders = files.flatMap(({ name, text }) => [
      ...text.matchAll(/font-size:\s*\d+(\.\d+)?px/g),
      ...text.matchAll(/fontSize:\s*(\d+|['"]\d+(\.\d+)?px['"])/g),
    ].map((m) => `${name}: ${m[0]}`));
    expect(offenders).toEqual([]);
  });

  it('has no rem font-size in CSS below the caption size', () => {
    const offenders = files.flatMap(({ name, text }) => [...text.matchAll(/font-size:\s*(\d*\.?\d+)rem/g)]
      .filter((m) => Number(m[1]) < CAPTION_REM)
      .map((m) => `${name}: ${m[0]}`));
    expect(offenders).toEqual([]);
  });

  it('makes text-xs, the smallest Tailwind step in use, the caption size', () => {
    const [size] = tailwindConfig.theme.extend.fontSize.xs;
    expect(parseFloat(size)).toBeGreaterThanOrEqual(CAPTION_REM);
  });

  it('declares the design tokens in relative units, none below the caption size', () => {
    const tokens = fs.readFileSync(path.join(ROOT, 'styles/remedy/tokens/typography.css'), 'utf8');
    const sizes = [...tokens.matchAll(/--fs-[a-z0-9-]+:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) {
      expect(size).toMatch(/rem$/);
      expect(parseFloat(size)).toBeGreaterThanOrEqual(CAPTION_REM);
    }
  });
});
