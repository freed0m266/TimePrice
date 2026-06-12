// Pure-TS price parser types. No DOM, no browser APIs — unit-tested in node.

/**
 * A single CZK price located in a text node.
 *
 * Offsets index the ORIGINAL (un-normalized) text so the DOM mutator (task 07) can
 * replace the exact characters. The offset invariant always holds:
 * `text.slice(start, end) === raw`.
 */
export interface PriceMatch {
  /** Numeric value in CZK (e.g. 30000, 19.9). */
  value: number;
  /** Start offset in the original text. */
  start: number;
  /** End offset (exclusive) in the original text. */
  end: number;
  /** The exact matched substring, including the anchor (e.g. "30 000 Kč"). */
  raw: string;
  /**
   * How the currency anchor was detected — for debug and adapter logic.
   * `'none'` is never produced by the generic parser (which always requires an anchor); it
   * tags a number matched anchorless by a site adapter inside an explicit price selector,
   * where the currency is implied by the selector scope (task 10).
   */
  anchor: 'kc' | 'czk' | 'dash' | 'none'; // "Kč" | "CZK" | ",-" | implied-by-selector
}

export interface ParseOptions {
  /** Minimum value to keep; matches strictly below it are dropped. Default 0. */
  minValue?: number;
}
