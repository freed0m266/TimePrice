// In-place mutator — the "replace" half of the content engine (task 07).
//
// Takes the read-only candidates from the scanner (task 06) and rewrites each price into
// its work-time equivalent (`formatTime`, task 05) DIRECTLY in the page text. Every
// replacement is wrapped in a `<span class="tp-converted" data-timeprice>` that:
//   - holds two inline children — `.tp-time` (the converted time, shown) and `.tp-orig`
//     (the original price, hidden until hover; task 20 hover-swap),
//   - carries everything needed to undo and re-format it (`data-tp-original`,
//     `data-tp-value`, `data-tp-hours`),
//   - inherits the page's color/font/strikethrough so the page looks unchanged.
//
// Hover affordance (task 20): hovering the converted time swaps it in place for the original
// price, with NO JS listeners and NO DOM mutation — pure CSS `:hover` toggles `visibility` on
// two grid-stacked children (see STYLE_TEXT). Because hover never mutates the DOM, the observer
// (task 08) has nothing to react to and the self-write guard is irrelevant to it.
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

/** Class on the inline child holding the converted time (the resting, shown state). */
const TIME_CLASS = 'tp-time';

/** Class on the inline child holding the original price (hidden until the parent is hovered). */
const ORIG_CLASS = 'tp-orig';

/**
 * Marker class on every converted span. Namespaced (`tp-converted`, not a bare `tp`) so a
 * host site's own short class cannot collide with ours and restyle our spans — the goal is
 * to stay visually invisible on arbitrary pages. Identification still keys off the
 * `data-timeprice` attribute everywhere; this class is only a stable styling hook.
 */
const SPAN_CLASS = 'tp-converted';

// Targeted inheritance so the page keeps its exact look: same color and font, and a
// parent's strikethrough (discounts: `<del>`/`line-through`) still paints across our span.
// The two children carry the same inheritance, so the strikethrough is drawn on their own
// text (not relied on from the ancestor) — which keeps it working even though the grid below
// makes the span an atomic inline box. Deliberately NOT `all: unset` (that would drop font
// inheritance). The rules key off the `data-timeprice` attribute (not a bare class) on
// purpose: an attribute-scoped selector outranks a host site's bare `span { … }` rules and
// cannot be shadowed by them, so a host `span` rule can't recolor the hidden price.
//
// Hover-swap (task 20): the span is an inline GRID whose two children share the single cell
// (`grid-area:1/1`), so the box is always as wide as the WIDER of {time, price}. Swapping
// toggles `visibility` (which preserves layout) — NOT `display` — so the box never resizes on
// hover. That kills the "layout jump" flicker: with a `display` swap, hovering a wide time
// shrinks the box to the narrower price, the pointer falls outside it, `:hover` drops, the box
// grows back under the pointer, and the two states oscillate. A constant-width box can't.
// `visibility:hidden` also removes the resting-hidden face from the accessibility tree, so a
// screen reader reads exactly the shown value (no `aria-hidden` needed, and it stays correct
// when the direction is inverted). Pure CSS — no JS, no DOM mutation, so the observer never
// sees a thing. The `:hover` rules outrank the resting `visibility`, so they win without
// depending on source order.
//
// Inverted direction (task 20, `invertHover`): when the root carries `data-tp-invert`, the page
// shows the original PRICE at rest and reveals the TIME on hover — the mirror of the default.
// It's a single root-attribute flip (set by the engine on a settings change), so switching
// direction mutates nothing in the price spans: no re-scan, no reformat, no observer churn. The
// inverted rules carry one extra attribute of specificity, so they override the default ones.
const STYLE_TEXT =
  '[data-timeprice]{display:inline-grid;color:inherit;font:inherit;text-decoration:inherit;}' +
  '[data-timeprice]>.tp-time,[data-timeprice]>.tp-orig{grid-area:1/1;color:inherit;font:inherit;text-decoration:inherit;}' +
  '[data-timeprice]>.tp-orig{visibility:hidden;}' +
  '[data-timeprice]:hover>.tp-time{visibility:hidden;}' +
  '[data-timeprice]:hover>.tp-orig{visibility:visible;}' +
  '[data-tp-invert] [data-timeprice]>.tp-time{visibility:hidden;}' +
  '[data-tp-invert] [data-timeprice]>.tp-orig{visibility:visible;}' +
  '[data-tp-invert] [data-timeprice]:hover>.tp-time{visibility:visible;}' +
  '[data-tp-invert] [data-timeprice]:hover>.tp-orig{visibility:hidden;}';

/** Root attribute that flips the hover-swap direction (see STYLE_TEXT). */
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
 * with the original price. The hover-swap (task 20) toggles their visibility purely in CSS, so
 * both faces must live as real text on the page. The resting-hidden one is `visibility:hidden`,
 * which keeps it out of the accessibility tree — so a screen reader (which has no hover) reads the
 * single shown value, never "30 h 30 000 Kč", in either swap direction. No `aria-hidden` here:
 * it is static, so it would read the wrong (or no) face once the direction is inverted.
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

  const orig = doc.createElement('span');
  orig.className = ORIG_CLASS;
  orig.textContent = original;

  span.replaceChildren(time, orig);
}

/**
 * Flip the hover-swap direction for the whole document (task 20, `invertHover`). Sets/clears the
 * `data-tp-invert` marker the stylesheet keys off, so the change is instant and touches no price
 * span — no re-scan, no reformat, no observer churn. Idempotent; safe to call before any price is
 * converted (the attribute simply waits for the spans).
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

  // Write the new time into the `.tp-time` child only — touching `span.textContent` would
  // wipe the `.tp-orig` hover-swap child. If the child is missing (a legacy span, or a foreign
  // re-render that mangled our structure) rebuild both children from `data-tp-original` rather
  // than crash or leave a half-state. A swap that's mid-hover is unaffected: CSS owns the
  // pseudo-state, so the freshly written time shows correctly once the pointer leaves.
  const time = span.querySelector<HTMLElement>(':scope > .' + TIME_CLASS);
  if (time) {
    time.textContent = result.display;
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
