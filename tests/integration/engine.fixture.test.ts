// End-to-end engine integration on fixtures (task 14 §2).
//
// The unit tests cover the pure core, and the jsdom module tests cover scanner/mutator/observer in
// isolation. This suite is the missing INTEGRATION level the task asks for: the real chain
// (scan → parse → convert → mutate → observe) run against realistic saved HTML, including the edge
// cases that broke things in earlier tasks — discounts, split prices, unit prices, pages with no
// prices, lazy injection, SPA navigation — plus the blocklist gate. It is the deterministic,
// offline mirror of the Playwright E2E (tests/e2e), so regressions surface in `pnpm test` too.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { adapterScan } from '@/content/adapters/engine';
import { applyAll, revertAll } from '@/content/mutator';
import { startObserving } from '@/content/observer';
import { createScheduler, type Scheduler } from '@/content/perf/scheduler';
import { isHostActive } from '@/settings/store';
import { DEFAULT_SETTINGS } from '@/settings/schema';

import { CTX, convertedValues, fixtureBody, loadFixture } from './_fixtures';

afterEach(() => {
  document.body.innerHTML = '';
  document.getElementById('tp-style')?.remove();
});

/** Convert a generic fixture in one static pass (no adapter, no observer). */
function convertGeneric(fixture: string): void {
  loadFixture(fixture);
  applyAll(adapterScan(null, document.body), CTX);
}

// --- generic pages --------------------------------------------------------------------

describe('generic engine — realistic pages', () => {
  it('product detail: converts anchored prices, leaves bare numbers/specs alone', () => {
    convertGeneric('generic/generic-shop.html');
    expect(convertedValues()).toEqual([199, 1500, 2000]); // 2 000 Kč, 199 CZK, 1 500,-
    const text = document.body.textContent ?? '';
    for (const bare of ['60 W', '2024', '2026', '12345']) expect(text).toContain(bare);
  });

  it('listing: converts every card price', () => {
    convertGeneric('generic/generic-listing.html');
    expect(convertedValues()).toEqual([500, 1200, 30000]);
  });

  it('prose: converts a price mid-sentence, leaves the year and temperature', () => {
    convertGeneric('generic/generic-blog.html');
    expect(convertedValues()).toEqual([4500]);
    const text = document.body.textContent ?? '';
    expect(text).toContain('2026');
    expect(text).toContain('25 °C');
  });
});

// --- edge cases -----------------------------------------------------------------------

describe('edge cases', () => {
  it('discount: converts both prices and keeps the strikethrough element', () => {
    convertGeneric('edge/discount.html');
    expect(convertedValues()).toEqual([1000, 2000]);
    const del = document.querySelector('del');
    expect(del).not.toBeNull();
    expect(del!.textContent).toBe('2 h'); // 2 000 Kč converted, still inside <del>
    expect(del!.querySelector('[data-timeprice]')).not.toBeNull();
    expect(document.querySelector('.sale')!.textContent).toBe('1 h');
  });

  it('split price: leaves a number/anchor split across elements untouched (no artifact)', () => {
    convertGeneric('edge/split-price.html');
    expect(document.querySelectorAll('[data-timeprice]')).toHaveLength(0);
    expect(document.querySelector('.amount')!.textContent).toBe('30 000');
    expect(document.querySelector('.currency')!.textContent).toBe('Kč');
  });

  it('unit price: converts the amount and preserves the per-unit suffix (offset invariant)', () => {
    convertGeneric('edge/unit-price.html');
    expect(convertedValues()).toEqual([199, 299]);
    const text = document.body.textContent ?? '';
    expect(text).toContain('12 min/kg'); // 199 Kč → 12 min, "/kg" kept
    expect(text).toContain('18 min / měsíc'); // 299 Kč → 18 min, "/ měsíc" kept
    expect(text).not.toContain('199 Kč');
  });

  it('no prices: converts nothing and leaves the document untouched', () => {
    loadFixture('edge/no-prices.html');
    const before = document.body.textContent;
    applyAll(adapterScan(null, document.body), CTX);
    expect(document.querySelectorAll('[data-timeprice]')).toHaveLength(0);
    expect(document.body.textContent).toBe(before);
  });
});

// --- revert round-trip ----------------------------------------------------------------

describe('reversibility', () => {
  it('revertAll restores byte-identical text on a realistic discounted page', () => {
    loadFixture('edge/discount.html');
    const original = document.body.textContent;
    applyAll(adapterScan(null, document.body), CTX);
    expect(document.body.textContent).not.toBe(original);
    revertAll();
    expect(document.body.textContent).toBe(original);
  });
});

// --- blocklist gate -------------------------------------------------------------------

describe('blocklist gate — bank fixture stays untouched', () => {
  const settings = { ...DEFAULT_SETTINGS, enabled: true, netHourlyRateCzk: 1000 };

  it('a built-in sensitive domain is never active, even though its prices are detectable', () => {
    // The bank prices ARE real anchored CZK amounts — the generic scan finds them...
    const body = document.createElement('body');
    body.innerHTML = fixtureBody('blocklist/bank.html');
    expect(adapterScan(null, body).length).toBeGreaterThan(0);

    // ...so it is the host gate, not absence of prices, that protects the page.
    expect(isHostActive(settings, 'george.csas.cz')).toBe(false); // ČSOB internet banking
    expect(isHostActive(settings, 'secure.gopay.com')).toBe(false); // payment gateway
    expect(isHostActive(settings, 'www.alza.cz')).toBe(true); // a normal e-shop is active
  });
});

// --- live observer (dynamic + SPA) ----------------------------------------------------
// Reuses the deterministic animation-frame harness from tests/dom/observer.test.ts: jsdom has no
// IntersectionObserver, so the scheduler converts eagerly inside frame processing.

describe('live observer — dynamic content on fixtures', () => {
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

  it('dynamic: converts a price injected after load (lazy render)', async () => {
    loadFixture('edge/dynamic.html');
    stop = startObserving(scheduler, null);

    // The fixture's inline timeout doesn't run under jsdom; inject the lazy price ourselves.
    const el = document.createElement('div');
    el.className = 'lazy-price';
    el.textContent = '5 000 Kč';
    document.getElementById('root')!.appendChild(el);

    await settle();
    flushFrames();
    expect(convertedValues()).toEqual([5000]);
    expect(document.querySelector('.lazy-price')!.textContent).toBe('5 h');
  });

  it('SPA: re-passes the new view after a pushState navigation', async () => {
    loadFixture('edge/spa.html');
    applyAll(adapterScan(null, document.body), CTX); // first pass
    expect(document.querySelector('.price')!.textContent).toBe('10 h');

    stop = startObserving(scheduler, null);

    // Simulate the router: push a new entry and swap the view (what the fixture's button does).
    history.pushState({}, '', '/product/2');
    document.getElementById('view')!.innerHTML = '<div class="price">20 000 Kč</div>';

    await settle();
    flushFrames();
    expect(document.querySelector('.price')!.textContent).toBe('20 h');
    expect(document.querySelectorAll('[data-timeprice]')).toHaveLength(1);
  });
});
