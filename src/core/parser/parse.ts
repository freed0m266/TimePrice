// CZK price matcher. Pure function, no DOM/browser. The accuracy heart of the extension:
// a false positive here = a broken page for the user, so detection requires an explicit
// currency anchor (`Kč` / `CZK` / `,-`) and never guesses from context.

import type { ParseOptions, PriceMatch } from './types';
import { SPACE_CLASS, parseCzkNumber } from './normalize';

// Number core. Grouped (thousands separators + optional decimal) is tried before plain so
// "30 000" wins over a bare "30". A grouped dot is only ever a thousands separator (it
// must be followed by exactly three digits); the CZK decimal mark is always a comma.
const NUMBER = `(?:\\d{1,3}(?:[${SPACE_CLASS}.]\\d{3})+(?:,\\d{1,2})?|\\d+(?:,\\d{1,2})?)`;
const WS = `[${SPACE_CLASS}]`;
const SYMBOL = `(?:Kč|CZK)`;

// Leading guard for branches whose match STARTS at the number. It rejects starting a
// price in the middle of a larger numeric token, which serves three purposes:
//   1. no partial matches — a malformed number like "1.23"/"1 2345" must not re-match its
//      tail ("23"/"2345") and leave a dangling "1."/"1 " on the page;
//   2. no negative amounts — "-100 Kč"/"-30000,-" must not yield a positive 100/30000 with
//      the minus stranded (ASCII hyphen and U+2212 minus);
//   3. linear scan — refusing to start after a digit kills quadratic backtracking on long
//      digit-only strings.
// Crucially it rejects only `<digit><sep>`, never `<letter/space><sep>`, so a normal price
// after a word space ("od 499 Kč") still matches.
const LEAD = `(?<![-\\d\\u2212])(?<!\\d[${SPACE_CLASS}.,])`;

// Three anchored branches, matched directly over the original text so each match's
// [index, index+length) range is the exact substring (offset invariant). Each quantifier
// consumes a disjoint character class, so there is no catastrophic backtracking.
const PRICE_RE = new RegExp(
  // suffix anchor:  "30 000 Kč", "1234 CZK", "30000Kč"
  `${LEAD}(?<numS>${NUMBER})${WS}*(?<symS>${SYMBOL})(?![\\p{L}])` +
    // dash anchor:  "30000,-" (folk notation; must sit tight against the number)
    `|${LEAD}(?<numD>${NUMBER}),-(?![\\d-])` +
    // prefix anchor: "Kč 1 299", "CZK 1234"
    `|(?<!\\p{L})(?<symP>${SYMBOL})${WS}*(?<numP>${NUMBER})`,
  'giu',
);

/** Map a matched anchor symbol to its `PriceMatch.anchor` tag (case-insensitive). */
function anchorOf(symbol: string): 'kc' | 'czk' {
  return symbol.toLowerCase() === 'czk' ? 'czk' : 'kc';
}

/**
 * Find all CZK prices carrying an explicit currency anchor in `text`.
 *
 * Returns matches left-to-right, each with offsets into the original `text`
 * (`text.slice(start, end) === raw`). Numbers without an anchor — years, wattage,
 * phone numbers, percentages — are intentionally ignored.
 */
export function parsePrices(text: string, opts?: ParseOptions): PriceMatch[] {
  const minValue = opts?.minValue ?? 0;
  const out: PriceMatch[] = [];

  for (const m of text.matchAll(PRICE_RE)) {
    const g = m.groups!;
    let numStr: string;
    let anchor: PriceMatch['anchor'];

    if (g.numS !== undefined) {
      numStr = g.numS;
      anchor = anchorOf(g.symS!);
    } else if (g.numD !== undefined) {
      numStr = g.numD;
      anchor = 'dash';
    } else {
      numStr = g.numP!;
      anchor = anchorOf(g.symP!);
    }

    const value = parseCzkNumber(numStr);
    if (value < minValue) continue;

    const start = m.index!;
    const raw = m[0]!;
    out.push({ value, start, end: start + raw.length, raw, anchor });
  }

  return out;
}
