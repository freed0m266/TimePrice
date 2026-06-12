// Whitespace inventory + numeric normalization for the CZK price parser.
//
// Czech e-shops separate thousands with any of several Unicode space characters (and
// sometimes a dot) and use a comma for decimals. We match directly over the ORIGINAL
// text — never a normalized copy — so PriceMatch offsets stay exact and the DOM mutator
// (task 07) hits the right characters. This module therefore does NOT rewrite the input;
// it only centralizes the space inventory (shared with the matcher regex) and converts a
// already-matched number substring into its numeric value.

/**
 * Whitespace characters used as thousands separators / padding around prices, expressed
 * as the inside of a regex character class so callers can compose patterns:
 * U+0020 space, U+00A0 no-break space, U+202F narrow no-break space, U+2009 thin space.
 * E-shops use all four. (A wider `\s` would also match newlines/tabs, inviting matches
 * that span unrelated text — we stay deliberately narrow.)
 */
export const SPACE_CLASS = ' \\u00a0\\u202f\\u2009';

/** Thousands separators inside a matched number: the spaces above plus a literal dot. */
const THOUSANDS_SEP_RE = new RegExp(`[${SPACE_CLASS}.]`, 'gu');

/**
 * Convert a matched CZK number substring into its numeric value.
 *
 * Strips thousands separators (spaces + dots) and turns the decimal comma into a dot. In
 * CZK the comma is ALWAYS the decimal mark and the dot is ALWAYS a thousands separator,
 * so removing every dot is safe — the matcher only ever captures a dot when it sits
 * between digit groups (followed by exactly three digits).
 *
 * `"30 000"` → 30000, `"1.299"` → 1299, `"19,90"` → 19.9, `"1.299,00"` → 1299.
 */
export function parseCzkNumber(num: string): number {
  const normalized = num.replace(THOUSANDS_SEP_RE, '').replace(',', '.');
  return Number.parseFloat(normalized);
}
