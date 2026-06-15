import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createScheduler, type Scheduler } from '@/content/perf/scheduler';
import { PERF } from '@/content/perf/constants';
import { scan } from '@/content/scanner';
import type { ConversionContext } from '@core/convert';

import { visibleText } from '../visible-text';

// 1000 Kč/h, 8h day, 5d week, auto rounding → 30 000 Kč = 30 h, 24 000 Kč = 24 h.
const CTX: ConversionContext = {
  netHourlyRateCzk: 1000,
  workdayHours: 8,
  workweekDays: 5,
  rounding: 'auto',
};

// --- a controllable IntersectionObserver ---------------------------------------------
// jsdom has none, so we install a fake whose intersections the test drives by hand. This lets
// us assert the viewport-first / lazy-apply behaviour deterministically: only the elements the
// test "scrolls into view" get converted.
class FakeIO {
  static instances: FakeIO[] = [];
  readonly observed = new Set<Element>();
  constructor(
    private cb: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    FakeIO.instances.push(this);
  }
  observe(el: Element): void {
    this.observed.add(el);
  }
  unobserve(el: Element): void {
    this.observed.delete(el);
  }
  disconnect(): void {
    this.observed.clear();
  }
  /** Fire an intersection callback for the given elements (default: all observed). */
  intersect(elements: Element[] = [...this.observed], isIntersecting = true): void {
    const entries = elements.map(
      (target) => ({ target, isIntersecting }) as IntersectionObserverEntry,
    );
    this.cb(entries, this as unknown as IntersectionObserver);
  }
}

// --- controllable animation frames + idle callbacks ----------------------------------
// The scheduler drains the first (visible) batch on a frame and the backlog in idle slots.
let frames: Array<() => void> = [];
const flushFrames = (): void => {
  const pending = frames;
  frames = [];
  for (const run of pending) run();
};

const FULL_BUDGET: IdleDeadline = { didTimeout: false, timeRemaining: () => 50 };
let idleQueue: Array<(d: IdleDeadline) => void> = [];
const flushIdle = (deadline: IdleDeadline = FULL_BUDGET): void => {
  const pending = idleQueue;
  idleQueue = [];
  for (const run of pending) run(deadline);
};

/** Run every scheduled drain (frames then idle slots) to completion. */
const drainAll = (): void => {
  let guard = 0;
  while ((frames.length > 0 || idleQueue.length > 0) && guard < 10_000) {
    flushFrames();
    flushIdle();
    guard += 1;
  }
};

function render(html: string): void {
  document.body.innerHTML = html;
}
const tpSpans = () => document.querySelectorAll('[data-timeprice]');

let scheduler: Scheduler | null = null;

beforeEach(() => {
  FakeIO.instances = [];
  frames = [];
  idleQueue = [];
  vi.stubGlobal('IntersectionObserver', FakeIO as unknown as typeof IntersectionObserver);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(() => cb(0));
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    if (id >= 1 && id <= frames.length) frames[id - 1] = () => {};
  });
  vi.stubGlobal('requestIdleCallback', (cb: (d: IdleDeadline) => void) => {
    idleQueue.push(cb);
    return idleQueue.length; // 1-based handle
  });
  vi.stubGlobal('cancelIdleCallback', (handle: number) => {
    if (handle >= 1 && handle <= idleQueue.length) idleQueue[handle - 1] = () => {};
  });
});

afterEach(() => {
  scheduler?.teardown();
  scheduler = null;
  document.body.innerHTML = '';
  document.getElementById('tp-style')?.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const onlyIO = (): FakeIO => {
  expect(FakeIO.instances).toHaveLength(1);
  return FakeIO.instances[0]!;
};

describe('scheduler — viewport-first gating (§1)', () => {
  it('observes candidate elements but converts nothing until they intersect', () => {
    render('<span>30 000 Kč</span><span>24 000 Kč</span>');
    scheduler = createScheduler(() => CTX);
    scheduler.submit(scan());

    // Submitted → observed, but not yet converted (off-viewport).
    const io = onlyIO();
    expect(io.observed.size).toBe(2);
    expect(tpSpans()).toHaveLength(0);

    // The first element scrolls into view → its conversion is queued, then drained.
    const [first] = [...io.observed];
    io.intersect([first!]);
    drainAll();

    expect(tpSpans()).toHaveLength(1);
    expect(io.observed.size).toBe(1); // converted one is unobserved; the other still waits
  });

  it('converts each element only as it intersects (infinite-scroll friendly)', () => {
    render('<p>30 000 Kč</p><p>24 000 Kč</p><p>8 000 Kč</p>');
    scheduler = createScheduler(() => CTX);
    scheduler.submit(scan());
    const io = onlyIO();
    expect(io.observed.size).toBe(3);

    io.intersect(); // all three reach the viewport
    drainAll();
    expect(tpSpans()).toHaveLength(3);
    expect(io.observed.size).toBe(0);
  });

  it('does not convert an element reported as not intersecting', () => {
    render('<span>30 000 Kč</span>');
    scheduler = createScheduler(() => CTX);
    scheduler.submit(scan());
    const io = onlyIO();

    io.intersect([...io.observed], false); // a callback that says "still off-screen"
    drainAll();

    expect(tpSpans()).toHaveLength(0);
    expect(io.observed.size).toBe(1); // still watched
  });

  it('releases a deferred target that was removed from the DOM before it intersected', () => {
    render('<span>30 000 Kč</span><span>24 000 Kč</span>');
    scheduler = createScheduler(() => CTX);
    scheduler.submit(scan());
    const io = onlyIO();
    expect(io.observed.size).toBe(2);

    // Virtualized churn: one off-screen element is removed, then IO reports it not-intersecting.
    const [removed, kept] = [...io.observed];
    removed!.remove();
    io.intersect([removed!], false);

    expect(io.observed.size).toBe(1); // the detached target is unobserved + dropped…
    expect([...io.observed][0]).toBe(kept); // …the still-attached one stays watched
  });

  it('uses a generous IntersectionObserver rootMargin so prices convert before they show', () => {
    render('<span>30 000 Kč</span>');
    scheduler = createScheduler(() => CTX);
    scheduler.submit(scan());
    expect(onlyIO().options?.rootMargin).toBe(PERF.IO_ROOT_MARGIN);
  });

  it('reads the rate at conversion time, so a rate change before intersect is honoured', () => {
    render('<span>30 000 Kč</span>');
    let ctx = CTX;
    scheduler = createScheduler(() => ctx);
    scheduler.submit(scan());

    ctx = { ...CTX, netHourlyRateCzk: 2000 }; // 30 000 / 2000 = 15 h, set while deferred
    onlyIO().intersect();
    drainAll();

    expect(visibleText(document.body)).toBe('15 h');
  });

  it('does not defer the same text node twice across repeat scans (dedup)', () => {
    render('<span>30 000 Kč</span>');
    scheduler = createScheduler(() => CTX);
    const candidates = scan();
    scheduler.submit(candidates);
    scheduler.submit(candidates); // e.g. an SPA full-body rescan before it intersects

    const io = onlyIO();
    expect(io.observed.size).toBe(1); // observed once, not twice

    io.intersect();
    drainAll();
    expect(tpSpans()).toHaveLength(1); // converted once, no stale duplicate work
  });

  it('refreshes a deferred candidate when its text node is rescanned with new content', () => {
    render('<span>30 000 Kč</span>');
    scheduler = createScheduler(() => CTX);
    scheduler.submit(scan());

    // An SPA updates the price text in place (characterData) before it scrolls into view; the
    // observer rescans the same node. The scheduler must convert the UPDATED price, not the
    // stale one (whose offsets no longer match → the mutator would no-op).
    const textNode = document.querySelector('span')!.firstChild as Text;
    textNode.data = '24 000 Kč';
    scheduler.submit(scan());

    onlyIO().intersect();
    drainAll();
    expect(visibleText(document.body)).toBe('24 h'); // updated 24 000 Kč, not stale 30 h or raw
  });
});

describe('scheduler — batching (§2/§3)', () => {
  it('drains the first visible batch on a frame, then the backlog in idle slots', () => {
    const n = PERF.MAX_NODES_PER_BATCH + 10;
    render(Array.from({ length: n }, () => '<span>30 000 Kč</span>').join(''));
    scheduler = createScheduler(() => CTX);
    scheduler.submit(scan());

    onlyIO().intersect(); // all n reach the viewport at once

    flushFrames(); // the first (visible) batch runs on the next frame
    expect(tpSpans()).toHaveLength(PERF.MAX_NODES_PER_BATCH);
    expect(idleQueue.length).toBeGreaterThan(0); // the rest was handed to an idle slot

    flushIdle(); // idle slot drains the remainder
    expect(tpSpans()).toHaveLength(n);
  });

  it('yields when the idle budget is exhausted and resumes in the next slot', () => {
    const n = PERF.MAX_NODES_PER_BATCH + 2;
    render(Array.from({ length: n }, () => '<span>30 000 Kč</span>').join(''));
    scheduler = createScheduler(() => CTX);
    scheduler.submit(scan());
    onlyIO().intersect();

    flushFrames(); // first batch (node-cap) on the frame; the 2 leftovers go to idle
    expect(tpSpans()).toHaveLength(PERF.MAX_NODES_PER_BATCH);

    // Zero remaining budget, not timed out → convert nothing this slot, reschedule.
    flushIdle({ didTimeout: false, timeRemaining: () => 0 });
    expect(tpSpans()).toHaveLength(PERF.MAX_NODES_PER_BATCH);
    expect(idleQueue.length).toBeGreaterThan(0);

    // A timed-out deadline must push through despite zero budget (deferred work can't starve).
    flushIdle({ didTimeout: true, timeRemaining: () => 0 });
    expect(tpSpans()).toHaveLength(n);
  });
});

describe('scheduler — hard cap (§4, never silent)', () => {
  it('caps conversions, logs once, and releases queued + observed work when it trips', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});

    const n = PERF.MAX_CONVERSIONS_PER_PAGE + 50;
    render(Array.from({ length: n }, () => '<span>10 Kč</span>').join(''));
    scheduler = createScheduler(() => CTX);
    scheduler.submit(scan());
    const io = onlyIO();

    // Intersect more than the cap, but leave some elements deferred/observed so we can prove
    // the cap-trip releases them too (not just the queue).
    const observed = [...io.observed];
    io.intersect(observed.slice(0, PERF.MAX_CONVERSIONS_PER_PAGE + 10));
    drainAll();

    expect(tpSpans()).toHaveLength(PERF.MAX_CONVERSIONS_PER_PAGE); // capped, not n
    expect(info).toHaveBeenCalledTimes(1); // logged once — the cap is never silent
    expect(info.mock.calls[0]![0]).toContain(String(PERF.MAX_CONVERSIONS_PER_PAGE));
    expect(io.observed.size).toBe(0); // remaining observations disconnected → memory bounded
  });

  it('logs once when conversions land exactly on the cap, and never silently afterwards', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});

    // Conversions land *exactly* on the cap with an empty queue — the edge where the old code
    // could finish without ever logging. The drain tail must still flag it.
    const n = PERF.MAX_CONVERSIONS_PER_PAGE;
    render(Array.from({ length: n }, () => '<span>10 Kč</span>').join(''));
    scheduler = createScheduler(() => CTX);
    scheduler.submit(scan());
    onlyIO().intersect();
    drainAll();
    expect(tpSpans()).toHaveLength(n);
    expect(info).toHaveBeenCalledTimes(1); // exact-boundary cap is logged, not silent

    // A later dynamic submit can convert nothing and must not double-log nor convert.
    document.body.insertAdjacentHTML('beforeend', '<span>99 Kč</span>');
    scheduler.submit(scan());
    expect(tpSpans()).toHaveLength(n); // the new price is not converted (capped)
    expect(info).toHaveBeenCalledTimes(1); // still exactly once
  });
});

describe('scheduler — reset (SPA navigation)', () => {
  it('drops the previous route’s observations and converts the new route', () => {
    render('<span>30 000 Kč</span>');
    scheduler = createScheduler(() => CTX);
    scheduler.submit(scan());
    const oldIO = onlyIO();
    expect(oldIO.observed.size).toBe(1);

    scheduler.reset();
    expect(oldIO.observed.size).toBe(0); // old route's observations disconnected

    // New route content is observed by a fresh IntersectionObserver and converts normally.
    render('<span>24 000 Kč</span>');
    scheduler.submit(scan());
    const newIO = FakeIO.instances[FakeIO.instances.length - 1]!;
    expect(newIO).not.toBe(oldIO);
    newIO.intersect();
    drainAll();
    expect(visibleText(document.body)).toBe('24 h');
  });

  it('resets the per-page cap so a new route converts after the previous one capped out', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {}); // route 1 will log the cap; silence it

    const n = PERF.MAX_CONVERSIONS_PER_PAGE;
    render(Array.from({ length: n }, () => '<span>10 Kč</span>').join(''));
    scheduler = createScheduler(() => CTX);
    scheduler.submit(scan());
    onlyIO().intersect();
    drainAll();
    expect(tpSpans()).toHaveLength(n); // route 1 hit the cap

    scheduler.reset(); // navigate to route 2
    render('<span>30 000 Kč</span>');
    scheduler.submit(scan());
    FakeIO.instances[FakeIO.instances.length - 1]!.intersect();
    drainAll();
    expect(visibleText(document.body)).toBe('30 h'); // not blocked by route 1's cap
  });
});

describe('scheduler — teardown', () => {
  it('disconnects the IntersectionObserver and cancels pending drains', () => {
    render('<span>30 000 Kč</span><span>24 000 Kč</span>');
    scheduler = createScheduler(() => CTX);
    scheduler.submit(scan());
    const io = onlyIO();
    io.intersect(); // queues a drain

    scheduler.teardown();
    scheduler = null;
    expect(io.observed.size).toBe(0); // disconnected

    drainAll(); // any leftover handle is inert after teardown
    expect(tpSpans()).toHaveLength(0); // nothing converted post-teardown
  });

  it('ignores intersections that arrive after teardown', () => {
    render('<span>30 000 Kč</span>');
    scheduler = createScheduler(() => CTX);
    scheduler.submit(scan());
    const io = onlyIO();

    scheduler.teardown();
    io.intersect(); // a late callback from a retained observer
    drainAll();

    expect(tpSpans()).toHaveLength(0);
  });
});

describe('scheduler — eager fallback (no IntersectionObserver)', () => {
  it('converts synchronously inside submit when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render('<span>30 000 Kč</span>');
    scheduler = createScheduler(() => CTX);
    scheduler.submit(scan());

    // No IO → no deferral: converted immediately, no frame/idle slot needed.
    expect(tpSpans()).toHaveLength(1);
    expect(visibleText(document.body)).toBe('30 h');
    expect(FakeIO.instances).toHaveLength(0);
  });
});
