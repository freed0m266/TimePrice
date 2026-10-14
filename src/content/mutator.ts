// In-place mutator — the "replace" half of the content engine (task 07).
//
// Takes the read-only candidates from the scanner (task 06) and rewrites each price into
// its work-time equivalent (`formatTime`, task 05) DIRECTLY in the page text. Every
// replacement is wrapped in a `<span class="tp-converted" data-timeprice>` that:
//   - holds two inline children — `.tp-time` (the converted time) and `.tp-orig` (the
//     original price) — of which CSS shows exactly one (time-first by default, price-first
//     when the user opts in; task 20/21),
//   - carries everything needed to undo and re-format it (`data-tp-original`,
//     `data-tp-value`, `data-tp-hours`),
//   - inherits the page's color/font/strikethrough so the page looks unchanged.
//
// Hover affordance (task 21): the browser's native tooltip. Each child carries the OTHER face in
// its `title`, so whichever child is shown, hovering it pops the value that isn't on the page.
// The page text never changes on hover — no JS listeners, no DOM mutation, nothing for the
// observer (task 08) to react to. (Task 20's in-place hover-swap is retired.)
//
// The three guarantees this module exists to provide:
//   - Idempotent: re-running never double-processes. The scanner skips `data-timeprice`
//     subtrees; the mutator additionally verifies the original substring is still present
//     before touching a node, so a stale candidate (or an SPA re-render) is a no-op, never
//     a crash or a duplicate.
//   - Reversible: `revertAll` / `revertSpan` restore byte-identical original text and
//     normalize the surrounding text nodes, so disabling (task 09) or re-applying on a
//     rate change leaves no DOM cruft.
//   - Re-formattable: `reformatAll` recomputes the display from the stored `data-tp-value`
//     with a new rate, without re-parsing the DOM (task 08/09 call it on settings change).
//
// Split prices (a number and its anchor in sibling elements) are NOT handled here: the
// `PriceCandidate` shape models a single text node and the scanner never emits them. They
// are resolved precisely by site adapters in task 10.

import { formatTime } from '@core/convert';
import type { ConversionContext } from '@core/convert';
import type { PriceMatch } from '@core/parser/types';

import type { PriceCandidate } from './scanner';

/** Id of the single injected stylesheet that keeps our spans visually invisible. */
const STYLE_ID = 'tp-style';

/** Class on the inline child holding the converted time (shown in time-first mode). */
const TIME_CLASS = 'tp-time';

/** Class on the inline child holding the original price (shown in price-first mode). */
const ORIG_CLASS = 'tp-orig';

/**
 * Marker class on every converted span. Namespaced (`tp-converted`, not a bare `tp`) so a
 * host site's own short class cannot collide with ours and restyle our spans — the goal is
 * to stay visually invisible on arbitrary pages. Identification still keys off the
 * `data-timeprice` attribute everywhere; this class is only a stable styling hook.
 */
const SPAN_CLASS = 'tp-converted';

// Targeted inheritance so the page keeps its exact look: same color and font, and a
// parent's strikethrough (discounts: `<del>`/`line-through`) still paints across our span and
// its children. Deliberately NOT `all: unset` (that would drop font inheritance) and NO layout
// properties on the span itself, so the page's feel is untouched. The rules key off the
// `data-timeprice` attribute (not a bare class) on purpose: an attribute-scoped selector
// outranks a host site's bare `span { … }` rules and cannot be shadowed by them.
//
// Face selection (task 21): exactly one child is displayed, the other is `display:none` — so the
// span is as wide as the shown value only (price-first keeps the page's original layout), the
// pointer can only land on the shown child (its `title` is the one the browser pops), and the
// hidden face is out of the accessibility tree (a screen reader reads the shown value, with the
// other one as the `title` description). The shown child gets an explicit `display:inline` so a
// host `… span { display:block }` rule can't break the price onto its own line.
//
// Price-first mode (`invertHover`): when the root carries `data-tp-invert`, the page shows the
// original PRICE and the tooltip the TIME — the mirror of the default. It's a single
// root-attribute flip (set by the engine on a settings change), so switching modes mutates
// nothing in the price spans: no re-scan, no reformat, no observer churn. The price-first rules
// carry one extra attribute of specificity, so they override the time-first ones.
const STYLE_TEXT =
  '[data-timeprice],[data-timeprice]>.tp-time,[data-timeprice]>.tp-orig{color:inherit;font:inherit;text-decoration:inherit;}' +
  '[data-timeprice]>.tp-time{display:inline;}' +
  '[data-timeprice]>.tp-orig{display:none;}' +
  '[data-tp-invert] [data-timeprice]>.tp-time{display:none;}' +
  '[data-tp-invert] [data-timeprice]>.tp-orig{display:inline;}';

/** Root attribute that switches the page to price-first mode (see STYLE_TEXT). */
const INVERT_ATTR = 'data-tp-invert';

/**
 * Convert every candidate's prices in place, at the given rate/context. Returns the number of
 * prices actually converted (skipped/stale matches don't count) so callers can enforce a
 * per-page conversion cap (task 11 §4).
 *
 * Order across candidates is irrelevant (each is an independent text node); within a node
 * the matches are replaced back-to-front so earlier offsets stay valid.
 */
export function applyAll(candidates: PriceCandidate[], ctx: ConversionContext): number {
  let converted = 0;
  for (const candidate of candidates) converted += applyToCandidate(candidate, ctx);
  return converted;
}

/**
 * Convert a single candidate's matches in place. Returns how many prices were converted.
 * Exported for per-subtree use (task 08) and per-candidate use by the scheduler (task 11).
 *
 * `limit` caps how many of this node's matches are converted (default: all). The scheduler
 * passes the page's remaining cap allowance so a multi-price node can't overshoot the hard cap
 * (task 11 §4). Matches are converted back-to-front, so a partial conversion leaves the
 * earliest prices raw — harmless: they are just unconverted, like any off-screen price.
 */
export function applyToCandidate(
  candidate: PriceCandidate,
  ctx: ConversionContext,
  limit = Infinity,
): number {
  const node = candidate.node;
  const doc = node.ownerDocument;
  if (!doc || !node.isConnected) return 0; // detached / stale candidate
  if (isInProcessedSpan(node)) return 0; // defensive idempotency guard

  ensureStyles(doc);

  // Replace from the largest start offset down, so each `splitText` only trims the tail of
  // `node` and the still-unprocessed (earlier) matches keep their original offsets. We sort
  // a copy rather than trust input order — the offset invariant is too important to assume.
  const ordered = [...candidate.matches].sort((a, b) => b.start - a.start);
  let converted = 0;
  for (const match of ordered) {
    if (converted >= limit) break;
    converted += applyMatch(node, match, ctx, doc);
  }
  return converted;
}

/**
 * Replace one match inside `node` with a converted-price span. Returns 1 if it converted, 0
 * if it left the node untouched.
 *
 * The offset guard makes this safe to call on a node that has changed since scanning: if
 * the exact original substring is no longer at `[start, end)` we leave the node alone.
 */
function applyMatch(node: Text, match: PriceMatch, ctx: ConversionContext, doc: Document): number {
  if (match.end > node.data.length) return 0;
  if (node.data.slice(match.start, match.end) !== match.raw) return 0;

  const result = formatTime(match.value, ctx);
  if (result.display === '') return 0; // invalid rate/price — leave the original untouched

  // Isolate the matched substring as its own text node, splitting only where needed so no
  // empty text nodes are left behind.
  if (match.end < node.data.length) node.splitText(match.end);
  const priceNode = match.start > 0 ? node.splitText(match.start) : node;

  const span = doc.createElement('span');
  span.className = SPAN_CLASS;
  span.setAttribute('data-timeprice', '');
  span.setAttribute('data-tp-original', match.raw);
  span.setAttribute('data-tp-value', String(match.value));
  span.setAttribute('data-tp-hours', String(result.hours));
  renderSpanChildren(span, result.display, match.raw, doc);

  priceNode.replaceWith(span);
  return 1;
}

/**
 * Build (or rebuild) a converted span's two inline children: `.tp-time` with the time, `.tp-orig`
 * with the original price. CSS shows exactly one of them (time-first / price-first), so both
 * faces live as real text on the page and a mode switch needs no DOM write. Each child's `title`
 * is the OTHER face, so the native tooltip on the shown child always reveals the hidden value
 * (task 21). The hidden child is `display:none`, which keeps it out of the accessibility tree —
 * a screen reader never reads "30 h 30 000 Kč". No `aria-hidden` here: it is static, so it would
 * read the wrong (or no) face once the mode is switched.
 *
 * `replaceChildren` makes this idempotent: a re-render that calls it again can never leave two
 * `.tp-time` nodes behind.
 */
function renderSpanChildren(
  span: HTMLElement,
  display: string,
  original: string,
  doc: Document,
): void {
  const time = doc.createElement('span');
  time.className = TIME_CLASS;
  time.textContent = display;
  time.title = original;

  const orig = doc.createElement('span');
  orig.className = ORIG_CLASS;
  orig.textContent = original;
  orig.title = display;

  span.replaceChildren(time, orig);
}

/**
 * Switch the whole document between time-first and price-first mode (`invertHover`; task 20/21).
 * Sets/clears the `data-tp-invert` marker the stylesheet keys off, so the change is instant and
 * touches no price span — no re-scan, no reformat, no observer churn. Idempotent; safe to call
 * before any price is converted (the attribute simply waits for the spans).
 */
export function setHoverMode(invert: boolean, doc?: Document): void {
  const target = doc ?? (typeof document !== 'undefined' ? document : null);
  const el = target?.documentElement;
  if (!el) return;
  if (invert) el.setAttribute(INVERT_ATTR, '');
  else el.removeAttribute(INVERT_ATTR);
}

/**
 * Re-compute the displayed time for every converted span under `root` (default: the whole
 * document) using `ctx`, without re-parsing the DOM. Reads the stored `data-tp-value`, so
 * it is cheap and leaves `data-tp-original` / `data-tp-value` untouched. Called by task
 * 08/09 when the rate or rounding changes.
 */
export function reformatAll(ctx: ConversionContext, root?: Node): void {
  const scope = scopeOf(root);
  if (!scope) return;
  scope.querySelectorAll('[data-timeprice]').forEach((el) => reformatSpan(el as HTMLElement, ctx));
}

function reformatSpan(span: HTMLElement, ctx: ConversionContext): void {
  const valueAttr = span.getAttribute('data-tp-value');
  if (valueAttr === null) return;
  const value = Number(valueAttr);
  if (!Number.isFinite(value)) return;

  const result = formatTime(value, ctx);
  if (result.display === '') return; // invalid ctx — keep the current display

  // Write the new time into the `.tp-time` child and the `.tp-orig` tooltip only — touching
  // `span.textContent` would wipe the `.tp-orig` child. If either child is missing (a legacy
  // span, or a foreign re-render that mangled our structure) rebuild both from
  // `data-tp-original` rather than crash or leave a half-state. The `title` write is an
  // attribute mutation, which the observer doesn't watch — no re-scan.
  const time = span.querySelector<HTMLElement>(':scope > .' + TIME_CLASS);
  const orig = span.querySelector<HTMLElement>(':scope > .' + ORIG_CLASS);
  if (time && orig) {
    time.textContent = result.display;
    orig.title = result.display;
  } else {
    const doc = span.ownerDocument;
    renderSpanChildren(span, result.display, span.getAttribute('data-tp-original') ?? '', doc);
  }
  span.setAttribute('data-tp-hours', String(result.hours));
}

/**
 * Revert every converted span under `root` (default: the whole document) back to its
 * original price text, restoring byte-identical text. Adjacent text nodes are normalized
 * once per affected parent so the DOM does not accumulate fragments across enable/disable
 * cycles.
 */
export function revertAll(root?: Node): void {
  const scope = scopeOf(root);
  if (!scope) return;

  const parents = new Set<Node>();
  const revertOne = (el: Element): void => {
    const parent = detachSpan(el as HTMLElement);
    if (parent) parents.add(parent);
  };

  // `querySelectorAll` never returns its own root, so handle a root that is itself a span.
  if (root?.nodeType === Node.ELEMENT_NODE && (root as Element).hasAttribute('data-timeprice')) {
    revertOne(root as Element);
  }
  scope.querySelectorAll('[data-timeprice]').forEach(revertOne);

  for (const parent of parents) parent.normalize();
}

/** Revert a single converted span to its original price text and normalize its parent. */
export function revertSpan(span: HTMLElement): void {
  detachSpan(span)?.normalize();
}

/**
 * Replace a converted span with a plain text node carrying its `data-tp-original`. Returns
 * the parent (for batched normalization), or `null` if the span isn't ours / is detached.
 */
function detachSpan(span: HTMLElement): Node | null {
  const original = span.getAttribute('data-tp-original');
  if (original === null) return null;
  const parent = span.parentNode;
  if (!parent) return null;
  parent.replaceChild(span.ownerDocument.createTextNode(original), span);
  return parent;
}

/** True if `node` already sits inside a converted span (so it must not be processed again). */
function isInProcessedSpan(node: Node): boolean {
  for (let el = node.parentElement; el; el = el.parentElement) {
    if (el.hasAttribute('data-timeprice')) return true;
  }
  return false;
}

/** Resolve a `querySelectorAll`-capable scope from an optional root. */
function scopeOf(root: Node | undefined): Document | Element | DocumentFragment | null {
  if (!root) return typeof document !== 'undefined' ? document : null;
  const nt = root.nodeType;
  if (nt === Node.ELEMENT_NODE || nt === Node.DOCUMENT_NODE || nt === Node.DOCUMENT_FRAGMENT_NODE) {
    return root as Document | Element | DocumentFragment;
  }
  return root.ownerDocument; // e.g. a text node → search its document
}

/** Inject the inheritance stylesheet once per document (cheap no-op on repeat calls). */
function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE_TEXT;
  (doc.head ?? doc.documentElement).appendChild(style);
}
