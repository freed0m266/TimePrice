// Domain normalization. Per-site overrides and the blocklist key on the registrable
// domain so that `www.` and other subdomains share one state.
//
// MVP heuristic: take the last two labels, except for a small table of known
// multi-label public suffixes (`co.uk`, `com.au`, …) where we take three. This is
// deliberately NOT the full public-suffix-list — pulling in `psl` would bloat the
// content bundle. Limitation: exotic multi-label suffixes not in the table collapse to
// two labels (e.g. `a.b.someprefecture.jp`). Acceptable for a CZK-first MVP; revisit if
// real coverage gaps appear.

/**
 * Known second-level public suffixes where the registrable domain needs three labels.
 * Not exhaustive — just the ones a Czech user is realistically exposed to.
 */
const MULTI_LABEL_SUFFIXES = new Set([
  // United Kingdom
  'co.uk',
  'org.uk',
  'me.uk',
  'ac.uk',
  'gov.uk',
  'ltd.uk',
  'plc.uk',
  // Australia / New Zealand
  'com.au',
  'net.au',
  'org.au',
  'co.nz',
  'org.nz',
  // Other common
  'co.jp',
  'co.kr',
  'co.za',
  'co.in',
  'com.br',
  'com.cn',
  'com.tr',
  'com.mx',
]);

const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Reduce a host to its registrable domain.
 *
 * `www.alza.cz` → `alza.cz`, `shop.example.co.uk` → `example.co.uk`.
 * Single-label hosts (`localhost`), IPv4 literals, and empty input are returned as-is.
 */
export function registrableDomain(host: string): string {
  let h = host.trim().toLowerCase();
  // Strip a trailing port and a fully-qualified-domain trailing dot if present.
  h = h.replace(/:\d+$/, '').replace(/\.$/, '');
  if (h === '') return '';

  // IPv4 literals and single-label hosts (localhost) have no registrable reduction.
  if (IPV4_RE.test(h)) return h;
  const labels = h.split('.');
  if (labels.length <= 2) return h;

  const lastTwo = labels.slice(-2).join('.');
  if (MULTI_LABEL_SUFFIXES.has(lastTwo)) {
    return labels.slice(-3).join('.');
  }
  return lastTwo;
}
