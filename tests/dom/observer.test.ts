import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startObserving } from '@/content/observer';
import { createScheduler, type Scheduler } from '@/content/perf/scheduler';
import type { ConversionContext } from '@core/convert';

// 1000 Kč/h, 8h day, 5d week, auto rounding → 30 000 Kč = 30 h.
const CTX: ConversionContext = {
  netHourlyRateCzk: 1000,
  workdayHours: 8,
  workweekDays: 5,
  rounding: 'auto',
};

// --- deterministic animation-frame control -------------------------------------------
// The observer batches work into `requestAnimationFrame`. We stub it into a manual queue so
// a test can advance "frames" synchronously and assert on the gap between scheduling and
// processing (the debounce) and on the absence of a follow-up frame (the loop guard).
let frames: Array<() => void> = [];
const flushFrames = (): void => {
  const pending = frames;
  frames = [];
  for (const run of pending) run();
};
/** Let queued microtasks run so the MutationObserver delivers its records to our callback. */
const settle = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

let stop: (() => void) | null = null;
// jsdom has no IntersectionObserver, so the scheduler runs its eager (synchronous) path:
// conversions happen inside the observer's frame processing, exactly as before task 11. The
// viewport-gated path is exercised in scheduler.test.ts; the throttle/watchdog in
// observer-throttle.test.ts.
let scheduler: Scheduler;
const initialUrl = location.href;
const nativePushState = history.pushState;
const nativeReplaceState = history.replaceState;

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(() => cb(0));
    return frames.length; // 1-based id
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    if (id >= 1 && id <= frames.length) frames[id - 1] = () => {};
  });
  // Make `performance.now` leap forward on every read so the observer throttle always sees a
  // wide gap and picks the rAF (fast) path — keeping these tests on the frame queue they
  // already drive. (The throttle's timer path is covered in observer-throttle.test.ts.)
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
  document.body.innerHTML = '';
  document.getElementById('tp-style')?.remove();
  // Fully reset history between tests, even if a test layered a wrapper our stop() declined
  // to unwind.
  history.pushState = nativePushState;
  history.replaceState = nativeReplaceState;
  history.replaceState({}, '', initialUrl); // undo any pushState a test performed
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const tpSpans = () => document.querySelectorAll('[data-timeprice]');

describe('observer — dynamic content', () => {
  it('converts a price added after the observer starts (on the next frame)', async () => {
    stop = startObserving(scheduler);
    document.body.insertAdjacentHTML('beforeend', '<span>30 000 Kč</span>');

    await settle();
    // Debounced: the callback ran and scheduled a frame, but nothing is converted yet.
    expect(document.body.textContent).toBe('30 000 Kč');
    expect(frames).toHaveLength(1);

    flushFrames();
    expect(tpSpans()).toHaveLength(1);
    expect(document.body.textContent).toBe('30 h');
  });

  it('batches many added nodes and scans only their topmost subtrees', async () => {
    stop = startObserving(scheduler);
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div><span>30 000 Kč</span></div><p>24 000 Kč</p>',
    );

    await settle();
    expect(frames).toHaveLength(1); // one coalesced frame for the whole insertion

    flushFrames();
    expect(tpSpans()).toHaveLength(2);
    expect(document.body.textContent).toBe('30 h24 h');
  });

  it('converts text changed in place (characterData)', async () => {
    document.body.innerHTML = '<span>cena bude brzy</span>';
    stop = startObserving(scheduler);

    // SPA mutates the existing text node's content rather than swapping the node.
    document.querySelector('span')!.firstChild!.nodeValue = '30 000 Kč';

    await settle();
    flushFrames();
    expect(document.body.textContent).toBe('30 h');
    expect(tpSpans()).toHaveLength(1);
  });
});

describe('observer — no infinite loop', () => {
  it('does not schedule a follow-up frame for its own writes', async () => {
    stop = startObserving(scheduler);
    document.body.insertAdjacentHTML('beforeend', '<span>30 000 Kč</span>');

    await settle();
    flushFrames(); // converts; the guard flush drains the records this write produced

    // The decisive check: our own mutation queued no new frame → the loop is broken.
    expect(frames).toHaveLength(0);

    // And it stays stable across another cycle — no second span, no runaway growth.
    await settle();
    flushFrames();
    expect(tpSpans()).toHaveLength(1);
    expect(document.body.textContent).toBe('30 h');
    expect(frames).toHaveLength(0);
  });
});

describe('observer — survives framework re-renders', () => {
  it('re-applies when a framework overwrites our span with the original price', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    const host = document.getElementById('host')!;
    stop = startObserving(scheduler);

    host.innerHTML = '<span>30 000 Kč</span>';
    await settle();
    flushFrames();
    expect(host.textContent).toBe('30 h');

    // React-style: the framework throws away our converted subtree and re-renders the price.
    host.innerHTML = '<span>30 000 Kč</span>';
    await settle();
    flushFrames();

    expect(host.textContent).toBe('30 h'); // re-applied, not left raw and not duplicated
    expect(tpSpans()).toHaveLength(1);
    expect(frames).toHaveLength(0); // re-application is not a loop
  });
});

describe('observer — SPA navigation', () => {
  it('runs a full re-scan on a history.pushState URL change', async () => {
    // Content present before observing is NOT scanned (the observer only reacts to changes),
    // so it stays raw until navigation forces a full pass.
    document.body.innerHTML = '<span>30 000 Kč</span>';
    stop = startObserving(scheduler);

    await settle();
    flushFrames();
    expect(document.body.textContent).toBe('30 000 Kč'); // untouched so far

    history.pushState({}, '', '/products');
    flushFrames();

    expect(document.body.textContent).toBe('30 h');
    expect(tpSpans()).toHaveLength(1);
  });

  it('ignores a pushState that does not actually change the URL', async () => {
    stop = startObserving(scheduler);
    flushFrames(); // drain anything pending

    history.pushState({}, '', location.href); // same URL → no re-scan scheduled
    expect(frames).toHaveLength(0);
  });
});

describe('observer — teardown', () => {
  it('stops reacting to DOM changes after stop()', async () => {
    stop = startObserving(scheduler);
    stop();
    stop = null;

    document.body.insertAdjacentHTML('beforeend', '<span>30 000 Kč</span>');
    await settle();

    expect(frames).toHaveLength(0); // observer disconnected → no frame scheduled
    flushFrames();
    expect(document.body.textContent).toBe('30 000 Kč');
    expect(tpSpans()).toHaveLength(0);
  });

  it('stops reacting to navigation after stop() and restores history', () => {
    const nativePushState = history.pushState;
    stop = startObserving(scheduler);
    expect(history.pushState).not.toBe(nativePushState); // patched while observing

    stop();
    stop = null;
    expect(history.pushState).toBe(nativePushState); // restored

    history.pushState({}, '', '/after-teardown');
    expect(frames).toHaveLength(0); // no re-scan scheduled
  });

  it('stays inert after teardown even when another script wrapped our history patch', () => {
    // A pre-existing price the observer never converted (it only reacts to mutations).
    document.body.innerHTML = '<span>30 000 Kč</span>';
    stop = startObserving(scheduler);

    // A third party wraps OUR patched pushState (common in SPAs / analytics). stop() then
    // cannot safely un-patch — but it must still stop us from reacting to navigation.
    const wrapped = history.pushState;
    let foreignCalls = 0;
    history.pushState = function (this: History, ...args: Parameters<History['pushState']>) {
      foreignCalls += 1;
      return wrapped.apply(this, args);
    };

    stop();
    stop = null;

    history.pushState({}, '', '/elsewhere'); // foreign → our retained patch → onUrlChanged
    expect(foreignCalls).toBe(1); // the foreign wrapper is preserved, not clobbered
    flushFrames();

    expect(document.body.textContent).toBe('30 000 Kč'); // but no re-scan happened
    expect(tpSpans()).toHaveLength(0);
  });
});
