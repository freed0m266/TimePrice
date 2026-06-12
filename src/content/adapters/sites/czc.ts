// CZC.cz adapter (task 10).
//
// Best-effort, date-stamped selectors — re-verify against the live DOM and snapshot in a
// fixture (task 14). Stale selectors → generic anchored fallback, page stays intact.
//
// ověřeno 2026-06 (needs live re-verification before release):
//   - detail price:   .pd-price__value (with-VAT) / .price-vatdisplay
//   - listing card:   .tile-price .price
//   - without-VAT line, original / strikethrough price, and watt/spec numbers are ignored.

import type { SiteAdapter } from '../types';

export const czc: SiteAdapter = {
  domains: ['czc.cz'],
  priceSelectors: ['.pd-price__value', '.price-vatdisplay', '.tile-price .price'],
  ignoreSelectors: [
    '.price-novat', // price without VAT
    '.pd-price__old', // pre-discount price
    '.tile-price .price--old',
  ],
};
