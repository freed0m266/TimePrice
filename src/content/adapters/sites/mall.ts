// Mall.cz adapter (task 10).
//
// Best-effort, date-stamped selectors — re-verify against the live DOM and snapshot in a
// fixture (task 14). Stale selectors → generic anchored fallback, page stays intact.
//
// ověřeno 2026-06 (needs live re-verification before release):
//   - detail price:   .pdp-prices__main / [data-element="product-price"]
//   - listing card:   .product-box__price
//   - original / strikethrough price and the free-shipping threshold are ignored.

import type { SiteAdapter } from '../types';

export const mall: SiteAdapter = {
  domains: ['mall.cz', 'mall.sk'],
  priceSelectors: ['.pdp-prices__main', '.product-box__price', '[data-element="product-price"]'],
  ignoreSelectors: [
    '.pdp-prices__original', // pre-discount price
    '.product-box__price--old',
    '.free-delivery-threshold', // "free shipping over X"
  ],
};
