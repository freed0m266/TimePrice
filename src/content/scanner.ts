// DOM scanner — the "find" half of the content engine (task 06).
//
// Walks the DOM (or a given subtree) with a `TreeWalker` over text nodes, runs the pure
// CZK parser (`parsePrices`, task 04) on each one, and returns the text nodes that carry
// at least one price. It is strictly READ-ONLY: it inspects the tree and returns
// candidates — the in-place replacement is the mutator's job (task 07).
//
// Forbidden contexts are skipped here so nothing downstream has to re-check them:
// `<script>`/`<style>`/`<noscript>` (not user-facing text), `<textarea>`/`<select>`/
// `<option>` (form controls), `contenteditable` regions (rewriting would corrupt user
// input), and any subtree already marked `data-timeprice` / `data-timeprice-skip`
// (idempotency + an opt-out hook for adapters in task 10).
//
// Split-price glue (a number and its anchor living in sibling elements, e.g.
// `<span>30 000</span><span>Kč</span>`) is intentionally NOT handled here: it is a
// false-positive-prone heuristic and the binding `PriceCandidate` shape models a single
// text node. Task 10 (site adapters) resolves split prices precisely via CSS selectors.

import { parsePrices } from '../core/parser/parse';
import type { PriceMatch } from '../core/parser/types';

/** A text node found to contain one or more CZK prices, ready for the mutator. */
export interface PriceCandidate {
  /** The text node containing the price(s). */
  node: Text;
  /** Parser matches, with offsets into `node.data` (`node.data.slice(start, end) === raw`). */
  matches: PriceMatch[];
}

export interface ScanOptions {
  /** Subtree to scan. Defaults to `document.body`. Task 08 passes mutated subtrees here. */
  root?: Node;
  /** Minimum price value to keep; matches strictly below it are dropped. Default 0. */
  minValue?: number;
}

/** Element tag names whose text content must never be rewritten. */
const BLOCKED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'SELECT', 'OPTION']);

/** Attributes that mark a subtree as off-limits (already processed, or adapter opt-out). */
const SKIP_ATTRS = ['data-timeprice', 'data-timeprice-skip'];

// Cheap pre-filter: a price always carries a digit, so a node without one can never match
// and is rejected before the (more expensive) parser runs. No `g` flag — `.test()` is then
// stateless and safe to reuse.
const HAS_DIGIT = /\d/;

/**
 * Walk ancestors of a text node and decide whether it sits in a forbidden context.
 *
 * One upward pass handles all three rejection reasons (blocked tag, skip attribute,
 * editable region) — cheaper than several `closest()` calls and robust in jsdom, whose
 * `isContentEditable` is unreliable. `contenteditable` inherits, so the nearest ancestor
 * carrying the attribute wins: `true`/`""`/`plaintext-only` ⇒ editable (reject), `false`
 * ⇒ explicitly not editable (stop inheriting), any other value ⇒ keep inheriting.
 */
function inForbiddenContext(start: Element | null): boolean {
  let editableDecided = false;
  for (let el: Element | null = start; el; el = el.parentElement) {
    if (BLOCKED_TAGS.has(el.tagName)) return true;
    for (const attr of SKIP_ATTRS) {
      if (el.hasAttribute(attr)) return true;
    }
    if (!editableDecided && el.hasAttribute('contenteditable')) {
      const v = (el.getAttribute('contenteditable') ?? '').trim().toLowerCase();
      if (v === 'true' || v === '' || v === 'plaintext-only') return true;
      if (v === 'false') editableDecided = true;
    }
  }
  return false;
}

/**
 * Whether a text node is worth parsing: it must carry a digit (cheap pre-filter) and not
 * live in a forbidden context. Shared by the `TreeWalker` filter and the text-node-root
 * fast path so both apply identical rules.
 */
function isScannableText(node: Node): boolean {
  const text = node.nodeValue;
  if (!text || !HAS_DIGIT.test(text)) return false;
  return !inForbiddenContext(node.parentElement);
}

/**
 * Find every text node under `root` (default `document.body`) that contains a CZK price.
 *
 * Returns candidates in document order (a `TreeWalker` yields them that way for free).
 * Pure read: no DOM is mutated and no layout-forcing API (`getComputedStyle`, geometry) is
 * touched — visibility/viewport filtering is a separate, batched concern (task 11).
 */
export function scan(opts?: ScanOptions): PriceCandidate[] {
  const candidates: PriceCandidate[] = [];

  const root = opts?.root ?? (typeof document !== 'undefined' ? document.body : null);
  if (!root) return candidates; // e.g. called before <body> exists

  const minValue = opts?.minValue;
  const collect = (node: Text): void => {
    const matches = parsePrices(node.data, { minValue });
    if (matches.length > 0) candidates.push({ node, matches });
  };

  // A `TreeWalker` never yields its own root, so a text-node root — e.g. a `characterData`
  // mutation record from the observer (task 08) — would otherwise be skipped entirely.
  // Handle it directly, applying the same scannability rules.
  if (root.nodeType === Node.TEXT_NODE) {
    if (isScannableText(root)) collect(root as Text);
    return candidates;
  }

  const doc =
    root.nodeType === Node.DOCUMENT_NODE
      ? (root as Document)
      : (root.ownerDocument ?? (typeof document !== 'undefined' ? document : null));
  if (!doc) return candidates;

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      isScannableText(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  });

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    collect(node as Text);
  }

  return candidates;
}
