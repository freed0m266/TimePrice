// Site-adapter contracts (task 10).
//
// An adapter is a THIN refinement of the generic engine — never a replacement for the
// parser or converter. It tells the scanner WHERE on a specific e-shop prices live
// (`priceSelectors`), what to leave alone (`ignoreSelectors`), and — only when the site's
// markup needs it — how to pull a split price out of a container (`extract`) or that a
// number inside its selectors is a price even without a currency anchor (`allowAnchorless`).
//
// The currency anchor (task 04) still rules everywhere by default; `allowAnchorless` is the
// single, explicit, selector-scoped exception. Every other invariant (offset, idempotency,
// reversibility, no observer loop) is unchanged: adapters only steer the scan, the mutator
// still does the in-place replacement.

import type { PriceMatch } from '@core/parser/types';

/**
 * A price located by a custom `extract` implementation: the text node to rewrite plus the
 * match (with offsets into that node, so `node.data.slice(start, end) === raw`). The engine
 * groups these by node into the same `PriceCandidate` shape the scanner emits, so the
 * mutator processes them identically — no special replacement path.
 */
export interface AdapterPriceMatch {
  /** The text node whose `[match.start, match.end)` substring will be replaced. */
  node: Text;
  /** The price match within that node. */
  match: PriceMatch;
}

export interface SiteAdapter {
  /**
   * Registrable domains this adapter binds to (e.g. `'alza.cz'`). Keyed exactly as
   * `registrableDomain(host)` returns, so `www.alza.cz` and `m.alza.cz` both resolve here.
   */
  domains: string[];
  /**
   * CSS selectors for price containers. The scanner walks ONLY inside the matched elements
   * (perf + precision). Omit to keep scanning the whole subtree (an adapter that only adds
   * `ignoreSelectors`). Write these tolerantly and date-stamp them — markup drifts, and the
   * engine falls back to the generic anchored scan when none match (see the registry).
   */
  priceSelectors?: string[];
  /**
   * CSS selectors to always skip: cart quantity widgets, free-shipping thresholds,
   * strikethrough/comparison prices, unit prices. A text node is ignored when it has an
   * ancestor matching any of these (checked via `closest`), even inside a price container.
   */
  ignoreSelectors?: string[];
  /**
   * Optional custom extractor for split prices a single text node can't model (e.g. the
   * number and its `Kč` in sibling elements). Return the matches for `container`, an empty
   * array when the container genuinely holds no price, or `null` to defer to the default
   * anchored/anchorless scan of the container.
   */
  extract?: (container: Element) => AdapterPriceMatch[] | null;
  /**
   * Allow a bare number inside `priceSelectors` to be treated as a price without a currency
   * anchor — for sites that render `Kč` as an icon, a `::after`, or a non-text element, so
   * the price text node is just the number. Scoped strictly to the selectors; never widens
   * the generic engine. Ignored when `extract` is set (the extractor owns detection).
   */
  allowAnchorless?: boolean;
}
