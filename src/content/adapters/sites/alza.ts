// Alza.cz adapter (task 10).
//
// Selectors are best-effort and date-stamped — they MUST be re-verified against the live DOM
// and pinned with a fixture snapshot (task 14). If they go stale the engine falls back to the
// generic anchored scan, so a wrong selector degrades coverage, never breaks the page.
//
// ověřeno 2026-06 (needs live re-verification before release):
//   - detail price block:   .price-box__price
//   - listing card price:   .c2-price-final / [data-testid="pricePrimary"]
//   - comparison / original (strikethrough) price and cart quantity are ignored.

import type { SiteAdapter } from '../types';

export const alza: SiteAdapter = {
  domains: ['alza.cz', 'alza.sk'],
  priceSelectors: ['.price-box__price', '.c2-price-final', '[data-testid="pricePrimary"]'],
  ignoreSelectors: [
    '.price-box__compare-price', // crossed-out original price
    '.c2-price-old',
    '.js-priceWithoutVat', // price-without-VAT line
    '.cart-quantity', // basket qty widget
  ],
};
