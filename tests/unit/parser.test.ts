import { describe, expect, it } from 'vitest';

import { parsePrices } from '@/core/parser/parse';
import { parseCzkNumber } from '@/core/parser/normalize';
import type { PriceMatch } from '@/core/parser/types';

// Unicode spaces e-shops use as thousands separators / padding.
const NBSP = ' '; // no-break space
const NNBSP = ' '; // narrow no-break space
const THIN = ' '; // thin space

type Anchor = PriceMatch['anchor'];

describe('parsePrices — positive cases', () => {
  const cases: Array<{ text: string; value: number; anchor: Anchor; raw: string }> = [
    // Thousands separators (space variants) + decimal comma.
    { text: '30 000 Kč', value: 30000, anchor: 'kc', raw: '30 000 Kč' },
    { text: '30000 Kč', value: 30000, anchor: 'kc', raw: '30000 Kč' },
    { text: '30 000,00 Kč', value: 30000, anchor: 'kc', raw: '30 000,00 Kč' },
    { text: '19,90 Kč', value: 19.9, anchor: 'kc', raw: '19,90 Kč' },
    { text: '30000Kč', value: 30000, anchor: 'kc', raw: '30000Kč' }, // no space before anchor
    // Dot as a thousands separator (NOT decimal — comma is the only CZK decimal mark).
    { text: '1.299 Kč', value: 1299, anchor: 'kc', raw: '1.299 Kč' },
    { text: '1.299,00 Kč', value: 1299, anchor: 'kc', raw: '1.299,00 Kč' }, // badly localized
    // Folk ",-" notation.
    { text: '30000,-', value: 30000, anchor: 'dash', raw: '30000,-' },
    { text: '30 000,-', value: 30000, anchor: 'dash', raw: '30 000,-' },
    // CZK textual anchor, suffix and prefix.
    { text: '1234 CZK', value: 1234, anchor: 'czk', raw: '1234 CZK' },
    { text: 'CZK 1234', value: 1234, anchor: 'czk', raw: 'CZK 1234' },
    { text: 'Kč 1 299', value: 1299, anchor: 'kc', raw: 'Kč 1 299' }, // currency before number
    // Case variants of the Kč anchor (e-shops use KČ / kč too).
    { text: '50 kč', value: 50, anchor: 'kc', raw: '50 kč' },
    { text: '50 KČ', value: 50, anchor: 'kc', raw: '50 KČ' },
    { text: 'kč 50', value: 50, anchor: 'kc', raw: 'kč 50' },
    { text: 'czk 99', value: 99, anchor: 'czk', raw: 'czk 99' },
    // Prefix/suffix surrounding context — only the base price is captured.
    { text: 'od 499 Kč', value: 499, anchor: 'kc', raw: '499 Kč' },
    { text: '499 Kč/ks', value: 499, anchor: 'kc', raw: '499 Kč' },
    { text: '499 Kč / měsíc', value: 499, anchor: 'kc', raw: '499 Kč' },
    // Unicode whitespace separators.
    { text: `30${NBSP}000 Kč`, value: 30000, anchor: 'kc', raw: `30${NBSP}000 Kč` },
    { text: `30${NNBSP}000${NNBSP}Kč`, value: 30000, anchor: 'kc', raw: `30${NNBSP}000${NNBSP}Kč` },
    { text: `1${THIN}299 Kč`, value: 1299, anchor: 'kc', raw: `1${THIN}299 Kč` },
    // Millions (multiple separator groups).
    { text: '2 500 000 Kč', value: 2500000, anchor: 'kc', raw: '2 500 000 Kč' },
  ];

  for (const c of cases) {
    it(`parses ${JSON.stringify(c.text)} → ${c.value} (${c.anchor})`, () => {
      const matches = parsePrices(c.text);
      expect(matches).toHaveLength(1);
      const [m] = matches;
      expect(m!.value).toBe(c.value);
      expect(m!.anchor).toBe(c.anchor);
      expect(m!.raw).toBe(c.raw);
      // Offset invariant — the heart of correct DOM replacement.
      expect(c.text.slice(m!.start, m!.end)).toBe(c.raw);
      // `start` points at the price itself, not at surrounding context.
      expect(m!.start).toBe(c.text.indexOf(c.raw));
    });
  }
});

describe('parsePrices — multiple prices in one text', () => {
  it('finds two prices with correct values, order, and offsets', () => {
    const text = 'Bylo 30 000 Kč, teď 24 000 Kč';
    const matches = parsePrices(text);
    expect(matches.map((m) => m.value)).toEqual([30000, 24000]);
    expect(matches.map((m) => m.anchor)).toEqual(['kc', 'kc']);
    for (const m of matches) {
      expect(text.slice(m.start, m.end)).toBe(m.raw);
    }
    expect(matches[0]!.raw).toBe('30 000 Kč');
    expect(matches[1]!.raw).toBe('24 000 Kč');
    // Non-overlapping, left-to-right.
    expect(matches[0]!.end).toBeLessThanOrEqual(matches[1]!.start);
  });

  it('handles mixed anchors in one string', () => {
    const matches = parsePrices('Akce 1.499,- místo 1 999 Kč nebo 2000 CZK');
    expect(matches.map((m) => m.value)).toEqual([1499, 1999, 2000]);
    expect(matches.map((m) => m.anchor)).toEqual(['dash', 'kc', 'czk']);
  });
});

describe('parsePrices — negative cases (zero false positives)', () => {
  const negatives = [
    '500 W', // wattage
    '1000 GB', // capacity
    '1000 mAh',
    '2024', // year
    'PSČ 30000', // postal code, no anchor
    '20 %', // percentage
    '+420 777 123 456', // phone number
    '30000', // bare number, no anchor
    'cena na dotaz', // no number at all
    '', // empty
    'Kč', // anchor without a number
    ',-', // dash without a number
    '30000, - sleva', // ",-" not tight against the number (space inside)
    '30000 ,-', // space before the comma — not tight
    '100 wattů', // word starting with a letter, no anchor
    // Negative / refund amounts must not yield a positive match with a stranded minus.
    '-100 Kč', // ASCII hyphen-minus
    '−100 Kč', // U+2212 minus sign
    '-30000,-', // negative folk notation
    // Malformed numbers must not partially re-match their tail (would strand a prefix).
    '1.23 Kč', // dot-decimal (unsupported) — must NOT become "23 Kč"
    '1 2345 Kč', // 4-digit group — must NOT become "2345 Kč"
    '1,2345 Kč', // 4-digit decimal — must NOT become "2345 Kč"
  ];

  for (const text of negatives) {
    it(`ignores ${JSON.stringify(text)}`, () => {
      expect(parsePrices(text)).toEqual([]);
    });
  }
});

describe('parsePrices — minValue option', () => {
  it('drops matches strictly below minValue', () => {
    const text = '5 Kč nebo 500 Kč';
    expect(parsePrices(text, { minValue: 100 }).map((m) => m.value)).toEqual([500]);
  });

  it('keeps everything by default (minValue 0), including 0 Kč', () => {
    expect(parsePrices('0 Kč').map((m) => m.value)).toEqual([0]);
    expect(parsePrices('5 Kč nebo 500 Kč').map((m) => m.value)).toEqual([5, 500]);
  });

  it('treats minValue as inclusive (value === minValue is kept)', () => {
    expect(parsePrices('100 Kč', { minValue: 100 }).map((m) => m.value)).toEqual([100]);
  });
});

describe('parsePrices — robustness', () => {
  it('does not catastrophically backtrack on a long digit-only string', () => {
    // A pathological all-digit run followed by a single real price. If the matcher had
    // exponential/quadratic blowup this would hang well past the test timeout.
    const haystack = '1234567890'.repeat(5000) + ' a 100 Kč';
    const matches = parsePrices(haystack);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.value).toBe(100);
    expect(haystack.slice(matches[0]!.start, matches[0]!.end)).toBe('100 Kč');
  });

  it('keeps offsets exact when the price is buried in surrounding text', () => {
    const text = 'Lorem ipsum dolor 1 299 Kč sit amet';
    const [m] = parsePrices(text);
    expect(m!.raw).toBe('1 299 Kč');
    expect(text.slice(m!.start, m!.end)).toBe('1 299 Kč');
  });
});

describe('parseCzkNumber', () => {
  it.each([
    ['30 000', 30000],
    ['1.299', 1299],
    ['19,90', 19.9],
    ['1.299,00', 1299],
    [`2${NNBSP}500${NNBSP}000`, 2500000],
  ])('normalizes %j → %d', (input, expected) => {
    expect(parseCzkNumber(input)).toBe(expected);
  });
});
