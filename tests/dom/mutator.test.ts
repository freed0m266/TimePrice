import { afterEach, describe, expect, it } from 'vitest';

import {
  applyAll,
  applyToCandidate,
  reformatAll,
  revertAll,
  revertSpan,
  setHoverMode,
} from '@/content/mutator';
import { scan } from '@/content/scanner';
import type { ConversionContext } from '@core/convert';

import { visibleText } from '../visible-text';

/** The `.tp-time` (shown) child of a converted span. */
const timeOf = (span: Element) => span.querySelector('.tp-time');
/** The `.tp-orig` (hover-swap) child of a converted span. */
const origOf = (span: Element) => span.querySelector('.tp-orig');

// 1000 Kč/h, 8h day, 5d week, auto rounding → 30 000 Kč = 30 h, 24 000 Kč = 24 h.
const CTX: ConversionContext = {
  netHourlyRateCzk: 1000,
  workdayHours: 8,
  workweekDays: 5,
  rounding: 'auto',
};

function render(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

/** The real pipeline: scan the body, then convert in place. */
function activate(ctx: ConversionContext = CTX): void {
  applyAll(scan(), ctx);
}

const tpSpans = () => document.querySelectorAll('[data-timeprice]');

afterEach(() => {
  document.body.innerHTML = '';
  document.getElementById('tp-style')?.remove();
  document.documentElement.removeAttribute('data-tp-invert');
});

describe('mutator — single replacement', () => {
  it('replaces a price with its time equivalent in place', () => {
    render('<span>30 000 Kč</span>');
    activate();

    const tp = document.querySelector('[data-timeprice]') as HTMLElement;
    expect(tp).not.toBeNull();
    expect(timeOf(tp)?.textContent).toBe('30 h'); // visible (resting) child
    expect(tp.className).toBe('tp-converted');
    expect(tp.getAttribute('data-tp-original')).toBe('30 000 Kč');
    expect(tp.getAttribute('data-tp-value')).toBe('30000');
    expect(tp.getAttribute('data-tp-hours')).toBe('30');
    expect(visibleText(document.body)).toBe('30 h');
  });

  it('builds the two hover-swap children, both faces carried as real text', () => {
    render('<span>30 000 Kč</span>');
    activate();

    const tp = document.querySelector('[data-timeprice]') as HTMLElement;
    // Exactly two inline children: the time and the original price.
    expect(tp.children).toHaveLength(2);
    const time = timeOf(tp)!;
    const orig = origOf(tp)!;
    expect(time.textContent).toBe('30 h');
    expect(orig.textContent).toBe('30 000 Kč'); // === match.raw / data-tp-original

    // No `aria-hidden`: the resting-hidden face is dropped from the a11y tree by `visibility`
    // (CSS, not assertable in jsdom), which stays correct when the swap direction is inverted.
    expect(orig.hasAttribute('aria-hidden')).toBe(false);
    expect(time.hasAttribute('aria-hidden')).toBe(false);

    // The OS-tooltip affordance is gone — the swap fully replaces it.
    expect(tp.title).toBe('');
  });

  it('does not set layout-altering inline styles and injects the style sheet once', () => {
    render('<span>30 000 Kč</span><span>1 299 Kč</span>');
    activate();
    for (const tp of tpSpans()) {
      expect(tp.getAttribute('style')).toBeNull();
    }
    expect(document.querySelectorAll('#tp-style')).toHaveLength(1);
  });

  it('leaves the price untouched when the rate is invalid', () => {
    render('<span>30 000 Kč</span>');
    applyAll(scan(), { ...CTX, netHourlyRateCzk: 0 });
    expect(document.querySelector('[data-timeprice]')).toBeNull();
    expect(document.body.textContent).toBe('30 000 Kč');
  });
});

describe('mutator — idempotency', () => {
  it('does not double-process when the pipeline runs twice', () => {
    render('<span>30 000 Kč</span>');
    activate();
    const htmlAfterFirst = document.body.innerHTML;

    activate(); // a fresh scan skips the data-timeprice subtree → no-op
    expect(tpSpans()).toHaveLength(1);
    expect(document.body.innerHTML).toBe(htmlAfterFirst);
  });

  it('does not double-process or throw when handed the same candidates twice', () => {
    render('<span>30 000 Kč</span>');
    const stale = scan();
    applyAll(stale, CTX);
    applyAll(stale, CTX); // stale: the node was already split/replaced

    expect(tpSpans()).toHaveLength(1);
    expect(visibleText(document.body)).toBe('30 h');
  });
});

describe('mutator — reversibility', () => {
  it('reverts to byte-identical original text and normalizes the DOM', () => {
    const original = 'Bylo 30 000 Kč, teď 24 000 Kč';
    render(`<p>${original}</p>`);
    const p = document.querySelector('p')!;

    activate();
    expect(visibleText(p)).toBe('Bylo 30 h, teď 24 h');

    revertAll();
    expect(p.textContent).toBe(original);
    expect(p.childNodes).toHaveLength(1); // collapsed back to a single text node
    expect(tpSpans()).toHaveLength(0);
  });

  it('revertSpan restores a single span and normalizes its parent', () => {
    render('<span>cena 30 000 Kč dnes</span>');
    activate();

    const wrap = document.querySelector('span')!; // outer wrapper (document order)
    const tp = wrap.querySelector('[data-timeprice]') as HTMLElement;
    revertSpan(tp);

    expect(wrap.textContent).toBe('cena 30 000 Kč dnes');
    expect(wrap.childNodes).toHaveLength(1);
  });
});

describe('mutator — discounts', () => {
  it('converts both prices and leaves the strikethrough element intact', () => {
    render('<del>30 000 Kč</del> <ins>24 000 Kč</ins>');
    activate();

    const del = document.querySelector('del')!;
    const ins = document.querySelector('ins')!;
    expect(visibleText(del)).toBe('30 h');
    expect(visibleText(ins)).toBe('24 h');

    // The <del> element (its line-through styling) is untouched — we replaced text only.
    const delSpan = del.querySelector('[data-timeprice]') as HTMLElement;
    expect(delSpan.getAttribute('data-tp-original')).toBe('30 000 Kč');
    expect(ins.querySelector('[data-timeprice]')?.getAttribute('data-tp-original')).toBe(
      '24 000 Kč',
    );
  });
});

describe('mutator — re-formatting on rate change', () => {
  it('updates display from data-tp-value without re-parsing or changing the stored value', () => {
    render('<span>30 000 Kč</span>');
    activate(); // 1000/h → 30 h
    const tp = document.querySelector('[data-timeprice]') as HTMLElement;
    expect(timeOf(tp)?.textContent).toBe('30 h');

    reformatAll({ ...CTX, netHourlyRateCzk: 2000 }); // → 15 h
    expect(timeOf(tp)?.textContent).toBe('15 h'); // only the time child is rewritten
    expect(origOf(tp)?.textContent).toBe('30 000 Kč'); // hover-swap child untouched
    expect(tp.children).toHaveLength(2); // no duplicate children
    expect(tp.getAttribute('data-tp-hours')).toBe('15');
    expect(tp.getAttribute('data-tp-value')).toBe('30000'); // unchanged
    expect(tp.getAttribute('data-tp-original')).toBe('30 000 Kč'); // unchanged
  });
});

describe('mutator — multiple matches in one node', () => {
  it('replaces every match with correct offsets (back-to-front)', () => {
    render('<span>Bylo 30 000 Kč, teď 24 000 Kč</span>');
    activate();

    const spans = tpSpans();
    expect(spans).toHaveLength(2);
    expect(spans[0]!.getAttribute('data-tp-original')).toBe('30 000 Kč');
    expect(spans[1]!.getAttribute('data-tp-original')).toBe('24 000 Kč');
    expect(visibleText(document.body)).toBe('Bylo 30 h, teď 24 h');
  });

  it('round-trips a multi-match node through revert', () => {
    const original = 'Od 199 Kč do 1 499 Kč';
    render(`<span>${original}</span>`);
    activate();
    expect(tpSpans()).toHaveLength(2);

    revertAll();
    expect(document.body.textContent).toBe(original);
    expect(tpSpans()).toHaveLength(0);
  });

  it('honors a per-node conversion limit (back-to-front), returning the count converted', () => {
    // The scheduler passes its remaining cap allowance as a limit so a multi-price node can't
    // overshoot the page cap (task 11 §4). The limit converts the latest matches first.
    render('<span>199 Kč, 299 Kč, 399 Kč</span>');
    const [candidate] = scan();
    const converted = applyToCandidate(candidate!, CTX, 2);

    expect(converted).toBe(2);
    expect(tpSpans()).toHaveLength(2);
    // Back-to-front: the two highest-offset prices convert; the first stays raw. Read the
    // resting text — `.tp-orig` still holds the converted prices' raw strings for the swap.
    const shown = visibleText(document.body);
    expect(shown).toContain('199 Kč');
    expect(shown).not.toContain('299 Kč');
    expect(shown).not.toContain('399 Kč');
  });
});

describe('mutator — hover-swap direction (invertHover)', () => {
  it('toggles the root marker the stylesheet keys off, without touching the spans', () => {
    render('<span>30 000 Kč</span>');
    activate();
    const tp = document.querySelector('[data-timeprice]') as HTMLElement;
    const before = tp.outerHTML;

    // Default: no marker. The actual visual swap is CSS-only (jsdom can't render `:hover`), so we
    // assert the marker the rules depend on, plus that flipping it never mutates a price span.
    expect(document.documentElement.hasAttribute('data-tp-invert')).toBe(false);

    setHoverMode(true);
    expect(document.documentElement.hasAttribute('data-tp-invert')).toBe(true);
    expect(tp.outerHTML).toBe(before); // direction is a root flip — spans are untouched

    setHoverMode(false);
    expect(document.documentElement.hasAttribute('data-tp-invert')).toBe(false);
    expect(tp.outerHTML).toBe(before);
  });

  it('is idempotent and safe to call before anything is converted', () => {
    expect(() => setHoverMode(true)).not.toThrow();
    setHoverMode(true); // repeat
    expect(document.documentElement.hasAttribute('data-tp-invert')).toBe(true);
  });
});
