// Shared jsdom test helper (task 20).
//
// Since task 20, a converted price renders TWO inline children — `.tp-time` (shown) and
// `.tp-orig` (the original price, CSS-hidden until the span is hovered). A browser paints only
// `.tp-time` at rest, but jsdom has no layout engine, so a naive `node.textContent` concatenates
// both ('30 h' + '30 000 Kč' = '30 h30 000 Kč'). Stripping `.tp-orig` recovers what the user
// actually sees in the resting (non-hover) state — the assertion most of the DOM suite wants.
//
// (The hover state itself — `:hover` swapping the two children — needs real CSS, so it is covered
// in the Playwright E2E, not here.)

/** The user-visible text of `node` at rest: the converted time, with `.tp-orig` swap text removed. */
export function visibleText(node: Node): string {
  const clone = node.cloneNode(true);
  if (clone instanceof Element || clone instanceof DocumentFragment) {
    clone.querySelectorAll('.tp-orig').forEach((el) => el.remove());
  }
  return clone.textContent ?? '';
}
