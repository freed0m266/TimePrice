import { afterEach, describe, expect, it } from 'vitest';

import { applyAll, reformatAll, revertAll, revertSpan } from '@/content/mutator';
import { scan } from '@/content/scanner';
import type { ConversionContext } from '@core/convert';

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
});

describe('mutator — single replacement', () => {
  it('replaces a price with its time equivalent in place', () => {
    render('<span>30 000 Kč</span>');
    activate();

    const tp = document.querySelector('[data-timeprice]') as HTMLElement;
    expect(tp).not.toBeNull();
    expect(tp.textContent).toBe('30 h');
    expect(tp.className).toBe('tp-converted');
    expect(tp.getAttribute('data-tp-original')).toBe('30 000 Kč');
    expect(tp.getAttribute('data-tp-value')).toBe('30000');
    expect(tp.getAttribute('data-tp-hours')).toBe('30');
    expect(document.body.textContent).toBe('30 h');
  });

  it('exposes the original price as a hover tooltip (title baseline)', () => {
    render('<span>30 000 Kč</span>');
    activate();
    const tp = document.querySelector('[data-timeprice]') as HTMLElement;
    expect(tp.title).toBe('30 000 Kč');
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
    expect(document.body.textContent).toBe('30 h');
  });
});

describe('mutator — reversibility', () => {
  it('reverts to byte-identical original text and normalizes the DOM', () => {
    const original = 'Bylo 30 000 Kč, teď 24 000 Kč';
    render(`<p>${original}</p>`);
    const p = document.querySelector('p')!;

    activate();
    expect(p.textContent).toBe('Bylo 30 h, teď 24 h');

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
    expect(del.textContent).toBe('30 h');
    expect(ins.textContent).toBe('24 h');

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
    expect(tp.textContent).toBe('30 h');

    reformatAll({ ...CTX, netHourlyRateCzk: 2000 }); // → 15 h
    expect(tp.textContent).toBe('15 h');
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
    expect(document.body.textContent).toBe('Bylo 30 h, teď 24 h');
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
});
