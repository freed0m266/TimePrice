// Adapter-aware scan (task 10) — the one entry point the orchestrator (task 07) and the
// observer (task 08) use to turn a root into price candidates, with or without a site
// adapter. It owns three behaviours the generic scanner deliberately does not:
//
//   1. NARROWING. With an adapter, only the subtrees matching `priceSelectors` are scanned
//      (perf + precision), `ignoreSelectors` are excluded, and `extract` / `allowAnchorless`
//      steer detection inside each container.
//   2. STALE-MARKUP SAFETY NET (§5). If the adapter's price containers are nowhere on the
//      page — the e-shop changed its markup, or an SPA hasn't rendered yet — we fall back to
//      the generic, anchor-required scan so the page is converted, never left blank.
//   3. PRECISION FOR DYNAMIC CONTENT (§4). When the adapter IS healthy (containers exist) but
//      a given mutation root touches no container, we return nothing rather than
//      generic-scanning it — the adapter's selectors are the source of truth for that page.
//
// The same call serves the first pass (root = `document.body`) and the observer (root = a
// mutated subtree): the staleness check is page-wide, so both agree on whether the adapter
// is live.

import { scan } from '../scanner';
import type { PriceCandidate } from '../scanner';
import type { PriceMatch } from '@core/parser/types';

import type { AdapterPriceMatch, SiteAdapter } from './types';

/**
 * Scan `root` (default `document.body`) for price candidates under `adapter`. A `null`
 * adapter is the generic engine verbatim — `scan({ root })`.
 */
export function adapterScan(adapter: SiteAdapter | null, root?: Node): PriceCandidate[] {
  const target = root ?? (typeof document !== 'undefined' ? document.body : null);
  if (!target) return [];
  if (!adapter) return scan({ root: target });

  const ignore = ignorePredicate(adapter);
  const selectors = adapter.priceSelectors;

  // Refine-only adapter (no narrowing): generic scan with the ignore filter applied.
  if (!selectors || selectors.length === 0) {
    return scan({ root: target, ignore });
  }

  const selector = selectors.join(',');
  const doc = documentOf(target);

  // §5 — the adapter's containers are nowhere on the page: treat the adapter as stale (or
  // not-yet-rendered) and fall back to the generic anchored scan. The anchor requirement
  // keeps this safety net false-positive-free even when the ignore selectors have also gone
  // stale.
  if (doc && !doc.querySelector(selector)) {
    return scan({ root: target, ignore });
  }

  const containers = topmost(queryContainers(target, selector));
  if (containers.length === 0) return []; // §4 — healthy adapter, root outside the price areas

  const out: PriceCandidate[] = [];
  const seen = new Set<Text>();
  const push = (cands: PriceCandidate[]): void => {
    for (const c of cands) {
      if (seen.has(c.node)) continue; // nested containers can re-yield the same text node
      seen.add(c.node);
      out.push(c);
    }
  };

  for (const container of containers) {
    if (adapter.extract) {
      const extracted = adapter.extract(container);
      if (extracted !== null) {
        push(candidatesFromExtract(extracted, ignore));
        continue; // extractor handled this container
      }
      // extractor deferred (returned null) → fall through to the default scan
    }
    push(scan({ root: container, ignore, allowAnchorless: adapter.allowAnchorless }));
  }
  return out;
}

/** Build the `ignore` predicate from `ignoreSelectors`, or `undefined` when there are none. */
function ignorePredicate(adapter: SiteAdapter): ((el: Element) => boolean) | undefined {
  const selectors = adapter.ignoreSelectors;
  if (!selectors || selectors.length === 0) return undefined;
  const selector = selectors.join(',');
  return (el) => el.closest(selector) !== null;
}

/**
 * Every price container relevant to `root`: containers inside it, `root` itself if it
 * matches, and the container `root` sits within (a deep mutation inside a price box). The
 * caller reduces these to their topmost ancestors.
 */
function queryContainers(root: Node, selector: string): Element[] {
  const found = new Set<Element>();

  // An element host (root itself, or a text node's parent) lets us look UP for an enclosing
  // container — the SPA-re-renders-inside-a-price-box case.
  const host = hostElement(root);
  if (host) {
    if (host.matches(selector)) found.add(host);
    const ancestor = host.closest(selector);
    if (ancestor) found.add(ancestor);
  }

  // Look DOWN for containers contained by root.
  const scope = queryScope(root);
  scope?.querySelectorAll(selector).forEach((el) => found.add(el));

  return [...found];
}

/**
 * Convert `extract` output into `PriceCandidate`s, grouping matches by their text node.
 * Drops detached nodes, ignored nodes, and matches that would break the offset invariant —
 * the mutator re-checks the latter, so this is defensive belt-and-suspenders.
 */
function candidatesFromExtract(
  matches: AdapterPriceMatch[],
  ignore?: (el: Element) => boolean,
): PriceCandidate[] {
  const byNode = new Map<Text, PriceMatch[]>();
  for (const { node, match } of matches) {
    if (!node || node.nodeType !== Node.TEXT_NODE || !node.isConnected) continue;
    const parent = node.parentElement;
    if (!parent) continue;
    if (ignore && ignore(parent)) continue;
    if (match.end > node.data.length) continue;
    if (node.data.slice(match.start, match.end) !== match.raw) continue;
    const list = byNode.get(node);
    if (list) list.push(match);
    else byNode.set(node, [match]);
  }
  return [...byNode].map(([node, m]) => ({ node, matches: m }));
}

/** Drop any element contained by another in the set, so a subtree is scanned once. */
function topmost(els: Element[]): Element[] {
  return els.filter((el) => !els.some((other) => other !== el && other.contains(el)));
}

/** The element to anchor an upward (`closest`) lookup on: the node itself or its parent. */
function hostElement(root: Node): Element | null {
  if (root.nodeType === Node.ELEMENT_NODE) return root as Element;
  return root.parentElement; // text/other → its parent element (null for a document)
}

/** A `querySelectorAll`-capable scope for the downward lookup, or `null` (e.g. a text node). */
function queryScope(root: Node): Element | Document | null {
  const nt = root.nodeType;
  if (nt === Node.ELEMENT_NODE) return root as Element;
  if (nt === Node.DOCUMENT_NODE) return root as Document;
  return null;
}

/** Resolve the owning document for the page-wide staleness check. */
function documentOf(root: Node): Document | null {
  if (root.nodeType === Node.DOCUMENT_NODE) return root as Document;
  return root.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
}
