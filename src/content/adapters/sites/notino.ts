// Notino.cz adapter (task 10).
//
// Notino is React-heavy, so it is the proving ground for observer re-application (the
// framework re-renders and overwrites our span → the observer must re-convert without
// looping; covered by the adapter + observer tests).
//
// Split-price note: where Notino renders the amount and `Kč` in SEPARATE elements, this
// adapter deliberately stays conservative — it narrows + anchors, so a bare-number node
// without an anchor is left untouched (a graceful no-op) rather than producing a "30 h Kč"
// artifact. The task explicitly permits leaving the split case on the generic/anchored path
// rather than shipping a broken in-place result; a clean split extractor can be added later
// behind `extract` once the live DOM is pinned (task 14) without touching the engine.
//
// Best-effort, date-stamped selectors — re-verify against the live DOM and snapshot in a
// fixture (task 14). Stale selectors → generic anchored fallback, page stays intact.
//
// ověřeno 2026-06 (needs live re-verification before release):
//   - detail price:   [data-testid="pd-price"] / .pd-price
//   - listing card:   [data-testid="product-price"]
//   - original / strikethrough price is ignored.

import type { SiteAdapter } from '../types';

export const notino: SiteAdapter = {
  domains: ['notino.cz', 'notino.sk'],
  priceSelectors: ['[data-testid="pd-price"]', '.pd-price', '[data-testid="product-price"]'],
  ignoreSelectors: [
    '[data-testid="pd-price-old"]', // pre-discount price
    '.pd-price--old',
    'del', // strikethrough comparison price
  ],
};
