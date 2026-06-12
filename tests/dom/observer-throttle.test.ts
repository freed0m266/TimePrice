import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startObserving } from '@/content/observer';
import { createScheduler, type Scheduler } from '@/content/perf/scheduler';
import { PERF } from '@/content/perf/constants';
import type { ConversionContext } from '@core/convert';

// Throttle (§4) and watchdog (§4 adaptive degradation) need exact control over the clock and
// the timers, so this file stubs `performance.now`, `requestAnimationFrame` and `setTimeout`
// into manual queues. The scheduler runs eager (no IntersectionObserver stubbed) so the only
// scheduling under test is the observer's own.

const CTX: ConversionContext = {
  netHourlyRateCzk: 1000,
  workdayHours: 8,
  workweekDays: 5,
  rounding: 'auto',
};

// `performance.now` returns the current clock, then advances by `step` — so a single scan
// (two reads: start + end) costs exactly `step` ms. Tests set `step` to put a scan over or
// under the watchdog budget at will.
let clock = 0;
let step = 0;

let frames: Array<() => void> = [];
const flushFrames = (): void => {
  const pending = frames;
  frames = [];
  for (const run of pending) run();
};

interface Timer {
  cb: () => void;
  delay: number;
  cleared: boolean;
}
let timers: Timer[] = [];
const flushTimers = (): void => {
  const pending = timers.filter((t) => !t.cleared);
  timers = [];
  for (const t of pending) t.cb();
};

const settle = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

/** What the observer scheduled this tick: a frame (fast path) or a deferred timer + its delay. */
const pending = (): { kind: 'frame' } | { kind: 'timer'; delay: number } | { kind: 'none' } => {
  if (frames.length > 0) return { kind: 'frame' };
  const live = timers.filter((t) => !t.cleared);
  if (live.length > 0) return { kind: 'timer', delay: live[live.length - 1]!.delay };
  return { kind: 'none' };
};
const flushPending = (): void => {
  if (frames.length > 0) flushFrames();
  else flushTimers();
};

let scheduler: Scheduler;
let stop: (() => void) | null = null;

beforeEach(() => {
  clock = 0;
  step = 0;
  frames = [];
  timers = [];
  vi.spyOn(performance, 'now').mockImplementation(() => {
    const v = clock;
    clock += step;
    return v;
  });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(() => cb(0));
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    if (id >= 1 && id <= frames.length) frames[id - 1] = () => {};
  });
  vi.stubGlobal('setTimeout', (cb: () => void, delay = 0) => {
    timers.push({ cb, delay, cleared: false });
    return timers.length;
  });
  vi.stubGlobal('clearTimeout', (id: number) => {
    if (id >= 1 && id <= timers.length) timers[id - 1]!.cleared = true;
  });
  scheduler = createScheduler(() => CTX);
  stop = startObserving(scheduler);
});

afterEach(() => {
  stop?.();
  stop = null;
  scheduler.teardown();
  document.body.innerHTML = '';
  document.getElementById('tp-style')?.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const addPrice = async (): Promise<void> => {
  document.body.insertAdjacentHTML('beforeend', '<span>30 000 Kč</span>');
  await settle();
};
const tpCount = () => document.querySelectorAll('[data-timeprice]').length;

describe('observer — throttle (§4)', () => {
  it('processes the first change on a frame, then defers a same-window burst to a timer', async () => {
    step = 0; // scans are instant — keep the watchdog out of this test

    await addPrice();
    expect(pending()).toEqual({ kind: 'frame' }); // first change → next frame (fast)

    clock = 10; // 10 ms later we process it
    flushFrames();
    expect(tpCount()).toBe(1);

    // A second change arrives 0 ms after that processing — inside the throttle window.
    await addPrice();
    const p = pending();
    expect(p.kind).toBe('timer');
    expect((p as { delay: number }).delay).toBe(PERF.OBSERVER_THROTTLE_MS); // held ~100 ms

    expect(tpCount()).toBe(1); // not converted until the timer fires
    clock = 200;
    flushTimers();
    expect(tpCount()).toBe(2);
  });
});

describe('observer — watchdog (§4 adaptive degradation)', () => {
  it('widens the throttle after sustained over-budget scans, then relaxes when calm', async () => {
    // Each scan costs `step` ms; over the budget trips the watchdog.
    step = PERF.SCAN_BUDGET_MS + 10; // 60 ms → over the 50 ms budget
    const base = PERF.OBSERVER_THROTTLE_MS;

    // First cycle goes on a frame (no prior processing to throttle against).
    await addPrice();
    expect(pending().kind).toBe('frame');
    flushPending();

    // Next cycles are deferred by ~(throttle - elapsed); elapsed stabilises to `step`.
    await addPrice();
    expect(pending()).toEqual({ kind: 'timer', delay: base - step }); // 100 - 60 = 40
    flushPending(); // 2nd over-budget scan

    await addPrice();
    flushPending(); // 3rd over-budget scan → watchdog escalates the throttle to 2× base

    // The widened throttle is now observable: the same in-window burst waits longer.
    await addPrice();
    expect(pending()).toEqual({ kind: 'timer', delay: base * 2 - step }); // 200 - 60 = 140
    flushPending();

    // Calm returns: cheap scans pull the throttle back down to baseline.
    step = 10; // 10 ms → under budget
    for (let i = 0; i < 5; i += 1) {
      await addPrice();
      flushPending();
    }
    await addPrice();
    expect(pending()).toEqual({ kind: 'timer', delay: base - step }); // relaxed back: 100 - 10 = 90
  });
});
