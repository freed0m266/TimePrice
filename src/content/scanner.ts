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

import { LEAD, NUMBER, parsePrices } from '../core/parser/parse';
import { parseCzkNumber } from '../core/parser/normalize';
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
  /**
   * Adapter ignore predicate (task 10): a text node is skipped when this returns `true` for
   * its parent element. Adapters pass a `closest(ignoreSelectors)` check so cart quantities,
   * shipping thresholds, and comparison prices inside their containers are left alone.
   */
  ignore?: (el: Element) => boolean;
  /**
   * Opt into anchorless matching (task 10) — match bare numbers with NO currency anchor.
   * OFF by default and only ever set by a site adapter scanning inside its explicit
   * `priceSelectors`, where the currency is implied by the selector scope. The generic
   * engine never sets this: anchorless guessing on the open web is the false-positive trap
   * the currency anchor exists to prevent.
   */
  allowAnchorless?: boolean;
}

/** Element tag names whose text content must never be rewritten. */
const BLOCKED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'SELECT', 'OPTION']);

/** Attributes that mark a subtree as off-limits (already processed, or adapter opt-out). */
const SKIP_ATTRS = ['data-timeprice', 'data-timeprice-skip'];

// Cheap pre-filter: a price always carries a digit, so a node without one can never match
// and is rejected before the (more expensive) parser runs. No `g` flag — `.test()` is then
// stateless and safe to reuse.
const HAS_DIGIT = /\d/;

// Anchorless number matcher for the adapter `allowAnchorless` path. It is just the parser's
// number grammar (`NUMBER`) behind the same leading guard (`LEAD`, which forbids starting
// mid-number / on a negative) — with the currency anchor stripped off. The `LEAD` lookbehind
// is zero-width, so each match's `[index, index + length)` range is exactly the number
// substring and the offset invariant still holds. This lives here (content), never in the
// pure core parser, so the no-anchor capability stays fenced to adapter selectors.
const ANCHORLESS_RE = new RegExp(`${LEAD}(?:${NUMBER})`, 'giu');

/**
 * Find every bare CZK number in `text`, ignoring the missing currency anchor. Used only by
 * the adapter `allowAnchorless` path, within explicit price selectors — see `ScanOptions`.
 */
function parseAnchorlessNumbers(text: string, minValue: number): PriceMatch[] {
  const out: PriceMatch[] = [];
  for (const m of text.matchAll(ANCHORLESS_RE)) {
    const raw = m[0]!; // `LEAD` is zero-width, so this is the number itself
    const value = parseCzkNumber(raw);
    if (!Number.isFinite(value) || value < minValue) continue;
    const start = m.index!;
    out.push({ value, start, end: start + raw.length, raw, anchor: 'none' });
  }
  return out;
}

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
 * Whether a text node is worth parsing: it must carry a digit (cheap pre-filter), not live
 * in a forbidden context, and not be excluded by the adapter `ignore` predicate. Shared by
 * the `TreeWalker` filter and the text-node-root fast path so both apply identical rules.
 */
function isScannableText(node: Node, ignore?: (el: Element) => boolean): boolean {
  const text = node.nodeValue;
  if (!text || !HAS_DIGIT.test(text)) return false;
  const parent = node.parentElement;
  if (inForbiddenContext(parent)) return false;
  if (ignore && parent && ignore(parent)) return false;
  return true;
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
  const ignore = opts?.ignore;
  const allowAnchorless = opts?.allowAnchorless ?? false;
  const collect = (node: Text): void => {
    const matches = allowAnchorless
      ? parseAnchorlessNumbers(node.data, minValue ?? 0)
      : parsePrices(node.data, { minValue });
    if (matches.length > 0) candidates.push({ node, matches });
  };

  // A `TreeWalker` never yields its own root, so a text-node root — e.g. a `characterData`
  // mutation record from the observer (task 08) — would otherwise be skipped entirely.
  // Handle it directly, applying the same scannability rules.
  if (root.nodeType === Node.TEXT_NODE) {
    if (isScannableText(root, ignore)) collect(root as Text);
    return candidates;
  }

  const doc =
    root.nodeType === Node.DOCUMENT_NODE
      ? (root as Document)
      : (root.ownerDocument ?? (typeof document !== 'undefined' ? document : null));
  if (!doc) return candidates;

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      isScannableText(node, ignore) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  });

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    collect(node as Text);
  }

  return candidates;
}
