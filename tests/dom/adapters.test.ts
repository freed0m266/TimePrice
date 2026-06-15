import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { adapterScan } from '@/content/adapters/engine';
import { GENERIC_FALLBACK, getAdapter } from '@/content/adapters/registry';
import { startObserving } from '@/content/observer';
import { createScheduler, type Scheduler } from '@/content/perf/scheduler';
import { applyAll } from '@/content/mutator';
import { alza } from '@/content/adapters/sites/alza';
import { mall } from '@/content/adapters/sites/mall';
import { datart } from '@/content/adapters/sites/datart';
import { czc } from '@/content/adapters/sites/czc';
import { notino } from '@/content/adapters/sites/notino';
import type { SiteAdapter } from '@/content/adapters/types';
import type { ConversionContext } from '@core/convert';

import { visibleText } from '../visible-text';

// 1000 Kč/h, 8h day, 5d week, auto rounding → 30 000 Kč = 30 h.
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

afterEach(() => {
  document.body.innerHTML = '';
  document.getElementById('tp-style')?.remove();
});

/** Every match value across all candidates, sorted (order is not the point of most tests). */
const scanValues = (adapter: SiteAdapter | null, root?: Node): number[] =>
  adapterScan(adapter, root)
    .flatMap((c) => c.matches.map((m) => m.value))
    .sort((a, b) => a - b);

// --- registry -------------------------------------------------------------------------

describe('getAdapter — domain resolution', () => {
  it('resolves a supported host to its adapter by registrable domain', () => {
    expect(getAdapter('www.alza.cz')).toBe(alza);
    expect(getAdapter('m.alza.cz')).toBe(alza);
    expect(getAdapter('alza.cz')).toBe(alza);
    expect(getAdapter('notino.cz')).toBe(notino);
  });

  it('binds every declared domain of an adapter (incl. the .sk variants)', () => {
    expect(getAdapter('alza.sk')).toBe(alza);
    expect(getAdapter('www.notino.sk')).toBe(notino);
  });

  it('returns the generic fallback (null) for unsupported or empty hosts', () => {
    expect(getAdapter('example.com')).toBe(GENERIC_FALLBACK);
    expect(getAdapter('shop.heureka.cz')).toBe(GENERIC_FALLBACK);
    expect(getAdapter('')).toBe(GENERIC_FALLBACK);
    expect(GENERIC_FALLBACK).toBeNull();
  });
});

// --- the shipped adapters -------------------------------------------------------------
// Each fixture nests an ignored price (comparison / without-VAT) inside the price container
// and adds a price OUTSIDE any container, so one assertion proves narrowing AND ignore.

describe('shipped adapters — narrow to price selectors, honor ignore selectors', () => {
  const cases: Array<{ name: string; adapter: SiteAdapter; html: string; expected: number[] }> = [
    {
      name: 'alza',
      adapter: alza,
      html: `
        <div class="price-box__price">30 000 Kč
          <span class="price-box__compare-price">35 000 Kč</span>
        </div>
        <div class="footer">Doprava 79 Kč</div>`,
      expected: [30000],
    },
    {
      name: 'mall',
      adapter: mall,
      html: `
        <div class="pdp-prices__main">1 299 Kč
          <span class="pdp-prices__original">1 599 Kč</span>
        </div>
        <div class="footer">99 Kč</div>`,
      expected: [1299],
    },
    {
      name: 'datart',
      adapter: datart,
      html: `
        <div class="product-price__main">4 990 Kč
          <span class="product-price__old">5 990 Kč</span>
        </div>
        <div class="footer">49 Kč</div>`,
      expected: [4990],
    },
    {
      name: 'czc',
      adapter: czc,
      html: `
        <div class="pd-price__value">12 345 Kč
          <span class="price-novat">10 202 Kč</span>
        </div>
        <div class="footer">59 Kč</div>`,
      expected: [12345],
    },
    {
      name: 'notino',
      adapter: notino,
      html: `
        <div data-testid="pd-price">499 Kč<del>699 Kč</del></div>
        <div class="footer">29 Kč</div>`,
      expected: [499],
    },
  ];

  for (const { name, adapter, html, expected } of cases) {
    it(`${name}: converts the price, skips comparison/ignored and out-of-container prices`, () => {
      render(html);
      expect(scanValues(adapter)).toEqual(expected);
    });
  }

  it('alza: handles an A/B markup variant via a second price selector', () => {
    render('<div class="c2-price-final">7 000 Kč</div>');
    expect(scanValues(alza)).toEqual([7000]);
  });
});

// --- narrowing precision & the null adapter -------------------------------------------

describe('adapterScan — narrowing precision', () => {
  it('ignores an anchored price outside the price containers when the adapter is healthy', () => {
    render('<div class="price-box__price">100 Kč</div><div class="banner">9 999 Kč</div>');
    expect(scanValues(alza)).toEqual([100]); // 9 999 Kč is outside the selectors
  });

  it('a null adapter is the generic engine verbatim', () => {
    render('<div class="anything">500 Kč</div>');
    expect(scanValues(GENERIC_FALLBACK)).toEqual([500]);
  });
});

// --- stale-markup fallback (§5) -------------------------------------------------------

describe('adapterScan — stale-markup fallback', () => {
  it('falls back to the generic anchored scan when no price container exists', () => {
    // The e-shop changed its markup: none of alza's selectors match. The page must still be
    // converted via the generic engine, not left blank.
    render('<div class="redesigned-price">2 500 Kč</div>');
    expect(scanValues(alza)).toEqual([2500]);
  });

  it('the fallback still requires a currency anchor (no false positives)', () => {
    render('<div class="redesigned-price">rok 2026, 100 W</div>');
    expect(scanValues(alza)).toEqual([]);
  });

  it('does not fall back when containers exist but hold no price (no generic blast)', () => {
    // Container present (adapter healthy) but empty; an anchored price elsewhere must NOT be
    // swept up by a generic fallback.
    render('<div class="price-box__price"></div><div class="elsewhere">3 000 Kč</div>');
    expect(scanValues(alza)).toEqual([]);
  });
});

// --- allowAnchorless ------------------------------------------------------------------

describe('adapterScan — allowAnchorless (selector-scoped)', () => {
  const anchorless: SiteAdapter = {
    domains: ['anchorless.test'],
    priceSelectors: ['.amount'],
    allowAnchorless: true,
  };

  it('matches a bare number inside the price selector, but nothing outside it', () => {
    render('<div class="amount">30 000</div><div class="year">2026</div>');
    expect(scanValues(anchorless)).toEqual([30000]); // 2026 is outside .amount
  });

  it('a bare number is NOT matched without allowAnchorless (anchor still required)', () => {
    const anchored: SiteAdapter = { domains: ['anchored.test'], priceSelectors: ['.amount'] };
    render('<div class="amount">30 000</div>');
    expect(scanValues(anchored)).toEqual([]);
  });
});

// --- extract --------------------------------------------------------------------------

describe('adapterScan — extract', () => {
  it('uses a custom extractor to convert a split price (amount + currency siblings)', () => {
    const split: SiteAdapter = {
      domains: ['split.test'],
      priceSelectors: ['.box'],
      extract: (container) => {
        const numEl = container.querySelector('.num');
        const node = numEl?.firstChild;
        if (!node || node.nodeType !== Node.TEXT_NODE) return null;
        const raw = (node as Text).data;
        return [
          {
            node: node as Text,
            match: { value: 30000, start: 0, end: raw.length, raw, anchor: 'none' },
          },
        ];
      },
    };
    render('<div class="box"><span class="num">30 000</span><span class="cur">Kč</span></div>');
    const cands = adapterScan(split, document.body);
    expect(cands).toHaveLength(1);
    expect(cands[0]!.node.data).toBe('30 000');
    expect(cands[0]!.matches[0]!.value).toBe(30000);
  });

  it('defers to the default anchored scan when the extractor returns null', () => {
    const deferring: SiteAdapter = {
      domains: ['defer.test'],
      priceSelectors: ['.box'],
      extract: () => null, // never handles → falls through
    };
    render('<div class="box">1 234 Kč</div>');
    expect(scanValues(deferring)).toEqual([1234]);
  });

  it('applies ignoreSelectors to extractor output', () => {
    const ex: SiteAdapter = {
      domains: ['ex.test'],
      priceSelectors: ['.box'],
      ignoreSelectors: ['.skip'],
      extract: (container) =>
        [...container.querySelectorAll('.num')].map((el) => {
          const node = el.firstChild as Text;
          const raw = node.data;
          return {
            node,
            match: { value: Number(raw), start: 0, end: raw.length, raw, anchor: 'none' as const },
          };
        }),
    };
    render('<div class="box"><span class="num">100</span><span class="num skip">200</span></div>');
    expect(scanValues(ex)).toEqual([100]); // .skip excluded
  });

  it('drops an extractor match that would break the offset invariant', () => {
    const bad: SiteAdapter = {
      domains: ['bad.test'],
      priceSelectors: ['.box'],
      extract: (container) => {
        const node = container.querySelector('.num')!.firstChild as Text;
        return [{ node, match: { value: 1, start: 0, end: 5, raw: 'WRONG', anchor: 'none' } }];
      },
    };
    render('<div class="box"><span class="num">100</span></div>');
    expect(scanValues(bad)).toEqual([]); // raw !== node.data.slice(start,end) → dropped
  });
});

// --- nested containers ----------------------------------------------------------------

describe('adapterScan — nested containers', () => {
  it('scans a text node once when containers nest (topmost + node dedupe)', () => {
    const nested: SiteAdapter = { domains: ['nest.test'], priceSelectors: ['.box'] };
    render('<div class="box"><div class="box">500 Kč</div></div>');
    const cands = adapterScan(nested, document.body);
    expect(cands).toHaveLength(1);
    expect(scanValues(nested)).toEqual([500]); // not [500, 500]
  });
});

// --- mutator integration --------------------------------------------------------------

describe('adapter + mutator — in-place conversion respects ignore', () => {
  it('converts the price and leaves the nested comparison price untouched', () => {
    render(
      '<div class="price-box__price">30 000 Kč<span class="price-box__compare-price">35 000 Kč</span></div>',
    );
    applyAll(adapterScan(alza, document.body), CTX);

    expect(document.querySelectorAll('[data-timeprice]')).toHaveLength(1);
    expect(visibleText(document.querySelector('[data-timeprice]')!)).toBe('30 h');
    expect(document.querySelector('.price-box__compare-price')!.textContent).toBe('35 000 Kč');
  });
});

// --- observer integration -------------------------------------------------------------
// Reuses the deterministic animation-frame harness from observer.test.ts.

describe('adapter + observer — live conversion', () => {
  let frames: Array<() => void> = [];
  const flushFrames = (): void => {
    const pending = frames;
    frames = [];
    for (const run of pending) run();
  };
  const settle = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
  };

  let stop: (() => void) | null = null;
  // jsdom lacks IntersectionObserver → the scheduler converts eagerly inside frame processing,
  // so these adapter-integration tests keep their frame-driven flow (see observer.test.ts).
  let scheduler: Scheduler;
  const initialUrl = location.href;
  const nativePushState = history.pushState;
  const nativeReplaceState = history.replaceState;

  beforeEach(() => {
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(() => cb(0));
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      if (id >= 1 && id <= frames.length) frames[id - 1] = () => {};
    });
    // Leap `performance.now` forward each read so the throttle always picks the rAF path.
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => {
      const v = clock;
      clock += 1_000_000;
      return v;
    });
    scheduler = createScheduler(() => CTX);
  });

  afterEach(() => {
    stop?.();
    stop = null;
    scheduler.teardown();
    history.pushState = nativePushState;
    history.replaceState = nativeReplaceState;
    history.replaceState({}, '', initialUrl);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const tpSpans = () => document.querySelectorAll('[data-timeprice]');

  it('converts a dynamically-added card inside a price selector, ignoring prices outside', () => {
    // A pre-existing container keeps the adapter "healthy" (not stale).
    document.body.innerHTML = '<div class="price-box__price">100 Kč</div>';
    stop = startObserving(scheduler, alza);

    document.body.insertAdjacentHTML('beforeend', '<div class="price-box__price">30 000 Kč</div>');
    document.body.insertAdjacentHTML('beforeend', '<div class="banner">9 999 Kč</div>');

    return settle().then(() => {
      flushFrames();
      expect(tpSpans()).toHaveLength(1); // only the new in-container card
      expect(document.body.textContent).toContain('30 h');
      expect(document.querySelector('.banner')!.textContent).toBe('9 999 Kč'); // outside → untouched
      expect(document.querySelector('.price-box__price')!.textContent).toBe('100 Kč'); // pre-existing, never scanned
    });
  });

  it('falls back to the generic engine for dynamic content when the adapter is stale', async () => {
    // No alza selectors anywhere → adapter stale → the observer converts via generic anchored scan.
    stop = startObserving(scheduler, alza);
    document.body.insertAdjacentHTML('beforeend', '<div class="redesigned">2 500 Kč</div>');

    await settle();
    flushFrames();
    expect(tpSpans()).toHaveLength(1);
    expect(document.querySelector('.redesigned')!.textContent).not.toBe('2 500 Kč');
  });

  it('re-applies after a React-style re-render overwrites our span (no loop)', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    const host = document.getElementById('host')!;
    stop = startObserving(scheduler, notino);

    host.innerHTML = '<div data-testid="pd-price">30 000 Kč</div>';
    await settle();
    flushFrames();
    expect(visibleText(host)).toBe('30 h');

    // Framework throws away our converted subtree and re-renders the raw price.
    host.innerHTML = '<div data-testid="pd-price">30 000 Kč</div>';
    await settle();
    flushFrames();

    expect(visibleText(host)).toBe('30 h'); // re-applied, not duplicated
    expect(tpSpans()).toHaveLength(1);
    expect(frames).toHaveLength(0); // re-application is not a loop
  });
});
