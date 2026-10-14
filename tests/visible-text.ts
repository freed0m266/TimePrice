// Shared jsdom test helper (task 20).
//
// Since task 20, a converted price renders TWO inline children — `.tp-time` (shown in the default
// time-first mode) and `.tp-orig` (the original price, `display:none` unless price-first mode is
// on). A browser paints only `.tp-time`, but jsdom has no layout engine, so a naive
// `node.textContent` concatenates both ('30 h' + '30 000 Kč' = '30 h30 000 Kč'). Stripping
// `.tp-orig` recovers what the user actually sees in time-first mode — the assertion most of the
// DOM suite wants.
//
// (Which face CSS shows, and the native `title` tooltip, need a real browser, so they are covered
// in the Playwright E2E, not here.)

/** The user-visible text of `node` in time-first mode: the converted time, with `.tp-orig` text removed. */
export function visibleText(node: Node): string {
  const clone = node.cloneNode(true);
  if (clone instanceof Element || clone instanceof DocumentFragment) {
    clone.querySelectorAll('.tp-orig').forEach((el) => el.remove());
  }
  return clone.textContent ?? '';
}
