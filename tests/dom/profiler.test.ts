import { afterEach, describe, expect, it, vi } from 'vitest';

import { profiler } from '@/content/perf/profiler';

type DebugGlobal = { __TIMEPRICE_DEBUG__?: unknown };

const enable = (): void => {
  (globalThis as DebugGlobal).__TIMEPRICE_DEBUG__ = true;
};
const disable = (): void => {
  delete (globalThis as DebugGlobal).__TIMEPRICE_DEBUG__;
};

afterEach(() => {
  disable();
  profiler.reset();
  vi.restoreAllMocks();
});

describe('profiler — disabled (default)', () => {
  it('is a no-op: counts nothing and adds no overhead', () => {
    expect(profiler.enabled).toBe(false);

    profiler.observerBatch();
    profiler.scanned(10);
    profiler.converted(5);
    profiler.deferred(3);
    profiler.capReached();

    expect(profiler.summary()).toEqual({
      observerBatches: 0,
      candidatesScanned: 0,
      converted: 0,
      deferred: 0,
      capReached: false,
    });
  });

  it('time() still runs the function and returns its value when disabled', () => {
    const marks = vi.spyOn(performance, 'mark');
    const out = profiler.time('scan', () => 42);
    expect(out).toBe(42);
    expect(marks).not.toHaveBeenCalled(); // no marks emitted while off
  });

  it('log() does not write to the console when disabled', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    profiler.log('hello');
    expect(debug).not.toHaveBeenCalled();
  });
});

describe('profiler — enabled', () => {
  it('counts the engine work and exposes a running summary', () => {
    enable();
    expect(profiler.enabled).toBe(true);

    profiler.observerBatch();
    profiler.scanned(10);
    profiler.deferred(10);
    profiler.converted(4); // 4 of the deferred get converted
    profiler.capReached();

    expect(profiler.summary()).toEqual({
      observerBatches: 1,
      candidatesScanned: 10,
      converted: 4,
      deferred: 6, // 10 deferred − 4 converted
      capReached: true,
    });
  });

  it('time() brackets the function with performance marks', () => {
    enable();
    const mark = vi.spyOn(performance, 'mark');
    const measure = vi.spyOn(performance, 'measure');

    const out = profiler.time('apply', () => 'done');
    expect(out).toBe('done');
    expect(mark).toHaveBeenCalledWith('tp:apply:start');
    expect(mark).toHaveBeenCalledWith('tp:apply:end');
    expect(measure).toHaveBeenCalledWith('tp:apply', 'tp:apply:start', 'tp:apply:end');
  });

  it('reset() clears the counters', () => {
    enable();
    profiler.observerBatch();
    profiler.scanned(5);
    profiler.reset();
    expect(profiler.summary()).toEqual({
      observerBatches: 0,
      candidatesScanned: 0,
      converted: 0,
      deferred: 0,
      capReached: false,
    });
  });
});
