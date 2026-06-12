// Datart.cz adapter (task 10).
//
// Best-effort, date-stamped selectors — re-verify against the live DOM and snapshot in a
// fixture (task 14). Stale selectors → generic anchored fallback, page stays intact.
//
// ověřeno 2026-06 (needs live re-verification before release):
//   - detail price:   .product-price__main / .actual-price
//   - listing card:   .product-box .price
//   - original / strikethrough price and unit ("per kg") price are ignored.

import type { SiteAdapter } from '../types';

export const datart: SiteAdapter = {
  domains: ['datart.cz', 'datart.sk'],
  priceSelectors: ['.product-price__main', '.actual-price', '.product-box .price'],
  ignoreSelectors: [
    '.product-price__old', // pre-discount price
    '.product-box .price--old',
    '.unit-price', // "per kg / per piece"
  ],
};
