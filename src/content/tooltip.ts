// Hover affordance for a converted price (task 07, scope §4).
//
// MVP baseline: the native `title` attribute. It is accessible, needs zero JS and zero
// positioning logic, and — unlike a custom CSS bubble — is immune to `overflow: hidden`
// ancestors and z-index stacking on real e-shops. The downsides (OS styling, show delay)
// are explicitly accepted by the task.
//
// A prettier `::after` bubble is a documented nice-to-have; it can layer on top later
// without touching the mutator, because the original price already lives in the span's
// `data-tp-original` attribute.

/** Attach the original-price hover affordance to a converted-price span. */
export function setTooltip(span: HTMLElement, originalPrice: string): void {
  span.title = originalPrice;
}
