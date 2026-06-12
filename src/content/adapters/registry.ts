// Adapter registry (task 10) — picks the site adapter for a host by its registrable domain,
// or `null` to mean "use the generic engine on `document.body`". Keyed on
// `registrableDomain` so every subdomain (`www.`, `m.`, `…`) of a supported e-shop shares
// one adapter, consistent with how per-site state and the blocklist are keyed (task 09).

import { registrableDomain } from '@/settings/domain';

import { adapters } from './sites';
import type { SiteAdapter } from './types';

/** Built once at module load: registrable domain → adapter. */
const byDomain = ((): Map<string, SiteAdapter> => {
  const map = new Map<string, SiteAdapter>();
  for (const adapter of adapters) {
    for (const domain of adapter.domains) map.set(domain, adapter);
  }
  return map;
})();

/**
 * Sentinel for "no adapter — scan generically". `getAdapter` returns this (`null`) for any
 * unsupported domain, and the engine reads `null` as `scan(document.body)`.
 */
export const GENERIC_FALLBACK = null;

/** The adapter bound to `host`, or `GENERIC_FALLBACK` (`null`) when none matches. */
export function getAdapter(host: string): SiteAdapter | null {
  const domain = registrableDomain(host);
  if (domain === '') return GENERIC_FALLBACK;
  return byDomain.get(domain) ?? GENERIC_FALLBACK;
}
