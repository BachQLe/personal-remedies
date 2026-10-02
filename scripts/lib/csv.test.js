/**
 * scripts/lib/csv.test.js — parser edge-case coverage for scripts/lib/csv.mjs
 * (Track 1C content pipeline). Hand-built tiny CSV strings, no file I/O —
 * same house pattern as scripts/audit-overlay.test.js.
 */
import { describe, expect, it } from 'vitest';
import { normalizeHeader, normalizeRecordKeys, parseCsv } from './csv.mjs';

describe('parseCsv', () => {
  it('parses a plain header + rows into objects keyed by header', () => {
    const text = 'a,b,c\n1,2,3\n4,5,6\n';
    expect(parseCsv(text)).toEqual([
      { a: '1', b: '2', c: '3' },
      { a: '4', b: '5', c: '6' },
    ]);
  });

  it('handles a quoted field containing a comma', () => {
    const text = 'name,note\n"Vietnamese Noodle Soup, Light Broth",ok\n';
    expect(parseCsv(text)).toEqual([{ name: 'Vietnamese Noodle Soup, Light Broth', note: 'ok' }]);
  });

  it('unescapes doubled quotes inside a quoted field', () => {
    const text = 'quote\n"She said ""hi"" today"\n';
    expect(parseCsv(text)).toEqual([{ quote: 'She said "hi" today' }]);
  });

  it('handles a quoted field containing an embedded newline', () => {
    const text = 'a,b\n"line one\nline two",x\n';
    expect(parseCsv(text)).toEqual([{ a: 'line one\nline two', b: 'x' }]);
  });

  it('handles CRLF line endings', () => {
    const text = 'a,b\r\n1,2\r\n3,4\r\n';
    expect(parseCsv(text)).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('handles a lone-CR line ending', () => {
    const text = 'a,b\r1,2\r';
    expect(parseCsv(text)).toEqual([{ a: '1', b: '2' }]);
  });

  it('strips a leading UTF-8 BOM', () => {
    const text = '﻿a,b\n1,2\n';
    expect(parseCsv(text)).toEqual([{ a: '1', b: '2' }]);
  });

  it('trims header cells', () => {
    const text = ' a , b \n1,2\n';
    expect(parseCsv(text)).toEqual([{ a: '1', b: '2' }]);
  });

  it('does not emit a phantom row for a trailing blank line', () => {
    const text = 'a,b\n1,2\n\n';
    expect(parseCsv(text)).toEqual([{ a: '1', b: '2' }]);
  });

  it('parses a row with no trailing newline at end of file', () => {
    const text = 'a,b\n1,2';
    expect(parseCsv(text)).toEqual([{ a: '1', b: '2' }]);
  });

  it('fills a short data row with empty strings for missing trailing cells', () => {
    const text = 'a,b,c\n1,2\n';
    expect(parseCsv(text)).toEqual([{ a: '1', b: '2', c: '' }]);
  });

  it('returns an empty array for an empty string', () => {
    expect(parseCsv('')).toEqual([]);
  });

  it('returns an empty array for header-only input', () => {
    expect(parseCsv('a,b\n')).toEqual([]);
  });

  it('throws a TypeError for non-string input', () => {
    expect(() => parseCsv(null)).toThrow(TypeError);
  });
});

describe('normalizeHeader', () => {
  it('lowercases, trims, and collapses internal whitespace', () => {
    expect(normalizeHeader('  Calorie   Count ')).toBe('calorie count');
    expect(normalizeHeader('calorie count')).toBe('calorie count');
    expect(normalizeHeader('CALORIE COUNT')).toBe('calorie count');
  });

  it('does not alter underscores', () => {
    expect(normalizeHeader('FI_TEXT')).toBe('fi_text');
  });

  it('handles null/undefined without throwing', () => {
    expect(normalizeHeader(undefined)).toBe('');
    expect(normalizeHeader(null)).toBe('');
  });
});

describe('normalizeRecordKeys', () => {
  it('re-keys a record by normalized header', () => {
    const record = { ' FI ': '5000', 'Calorie Count': '420' };
    expect(normalizeRecordKeys(record)).toEqual({ fi: '5000', 'calorie count': '420' });
  });
});
