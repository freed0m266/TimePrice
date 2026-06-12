// Built-in sensitive-domain blocklist (banks, payment gateways, government, brokers).
//
// TimePrice never runs on these domains even when globally enabled — a hard gate the user
// cannot override in the MVP (a deliberate security default; a power-user override is a
// possible later addition). The criterion for inclusion is conservative:
//
//   "anywhere swapping a money amount for a time value could mislead the user about money
//    they are actually sending or hold" — bank balances, payment totals, tax owed, broker
//    portfolios. When in doubt, block: a false-skip (we don't convert on some shop) is a
//    far cheaper mistake than altering a number next to a real payment.
//
// Entries are REGISTRABLE domains (see `domain.ts`): one entry covers every subdomain,
// because `registrableDomain` collapses `internetbanking.csas.cz` → `csas.cz` before the
// lookup. The list is intentionally easy to extend — add a domain with a one-line reason.

/** Exact registrable-domain matches. Keep alphabetical within each group for easy upkeep. */
export const BUILTIN_BLOCKLIST: readonly string[] = [
  // --- Czech banks (internet banking shows balances + initiates transfers) -------------
  'airbank.cz', // Air Bank
  'creditas.cz', // Banka CREDITAS
  'csas.cz', // Česká spořitelna (George)
  'csob.cz', // ČSOB
  'fio.cz', // Fio banka
  'hellobank.cz', // Hello bank!
  'kb.cz', // Komerční banka
  'mbank.cz', // mBank
  'moneta.cz', // MONETA Money Bank
  'rb.cz', // Raiffeisenbank
  'trinitybank.cz', // Trinity Bank
  'unicreditbank.cz', // UniCredit Bank

  // --- Payment gateways (the amount on screen is what the user is about to pay) ---------
  'adyen.com',
  'comgate.cz',
  'gopay.com',
  'gpwebpay.cz',
  'paypal.com',
  'stripe.com',
  'thepay.cz',

  // --- Government / identity (tax owed, data boxes, e-identity) -------------------------
  // `*.gov.cz` is covered by the suffix list below (nia.gov.cz, data.gov.cz, …).
  'czechpoint.cz',
  'identitaobcana.cz', // Identita občana (NIA)
  'mojedane.cz', // MOJE daně (tax portal)
  'mojedatovaschranka.cz', // Datové schránky

  // --- Investing / brokers / crypto / transfers (amount = balance, not a price) ---------
  'binance.com',
  'coinbase.com',
  'degiro.com',
  'etoro.com',
  'fondee.cz',
  'interactivebrokers.com',
  'portu.cz',
  'revolut.com',
  'trading212.com',
  'wise.com',
  'xtb.com',
];

/**
 * Suffix matches: block a domain and everything beneath it. Used for whole top-level
 * government namespaces where every subdomain is sensitive. `registrableDomain` already
 * collapses `nia.gov.cz` → `gov.cz`, so an exact entry would suffice today; the explicit
 * suffix check is the robust, intent-revealing form and survives any future change to the
 * domain heuristic.
 */
export const BUILTIN_BLOCKLIST_SUFFIXES: readonly string[] = [
  'gov.cz', // Czech state administration (data.gov.cz, nia.gov.cz, …)
];

const EXACT = new Set(BUILTIN_BLOCKLIST);

/**
 * Whether `domain` (a registrable domain from {@link registrableDomain}) is on the built-in
 * sensitive-domain blocklist — matched exactly, or as a suffix for whole gov namespaces.
 */
export function isBuiltinBlocked(domain: string): boolean {
  if (domain === '') return false;
  if (EXACT.has(domain)) return true;
  return BUILTIN_BLOCKLIST_SUFFIXES.some(
    (suffix) => domain === suffix || domain.endsWith(`.${suffix}`),
  );
}
