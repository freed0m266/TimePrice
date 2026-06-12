// Dev-only profiler (task 11 §5) — numbers for "it doesn't slow the browser down".
//
// Everything here is gated behind a debug flag and is a strict no-op when the flag is off, so
// it adds zero overhead to normal runs. When on, it counts the engine's work (observer
// batches, candidates scanned, prices converted, deferred items, whether the cap was hit) and
// times spans with `performance.mark`/`measure`, then exposes a summary for tuning.
//
// Enable it without a rebuild by either:
//   - setting `localStorage['tp-debug'] = '1'` on the page (persists across reloads), or
//   - setting `globalThis.__TIMEPRICE_DEBUG__ = true` (handy in a console or a test).
// When enabled, `globalThis.__TIMEPRICE_PROFILE__()` returns the live summary on demand.
//
// This is measurement only — no network, no persistence beyond reading the flag. It stays
// within the privacy invariant (it never sends anything anywhere).

export interface ProfileSummary {
  /** Observer processings (scan passes) run since load. */
  observerBatches: number;
  /** Candidates handed to the scheduler (≈ price-bearing text nodes seen). */
  candidatesScanned: number;
  /** Prices actually converted in place. */
  converted: number;
  /** Candidates currently deferred (off-viewport, awaiting their `IntersectionObserver`). */
  deferred: number;
  /** Whether the per-page conversion cap was reached. */
  capReached: boolean;
}

const MARK_PREFIX = 'tp:';

// Read localStorage exactly once (it can throw in sandboxed/partitioned contexts, and probing
// it on every hot-path `enabled` check would itself be a cost). Runtime toggling goes through
// the cheap `__TIMEPRICE_DEBUG__` global instead.
const storedFlag = ((): boolean => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('tp-debug') === '1';
  } catch {
    return false;
  }
})();

function readFlag(): boolean {
  // A global wins (lets a test or the page console flip it without a reload); otherwise use the
  // cached localStorage value. Just a property read + boolean — safe to call per scan/apply.
  return (
    (globalThis as { __TIMEPRICE_DEBUG__?: unknown }).__TIMEPRICE_DEBUG__ === true || storedFlag
  );
}

class Profiler {
  private counts = {
    observerBatches: 0,
    candidatesScanned: 0,
    converted: 0,
    deferred: 0,
    capReached: false,
  };

  /** Re-read each call so the flag can be flipped at runtime without a reload. */
  get enabled(): boolean {
    return readFlag();
  }

  /** One observer processing happened (a scan pass over dirty roots). */
  observerBatch(): void {
    if (!this.enabled) return;
    this.counts.observerBatches += 1;
  }

  /** `n` candidates were handed to the scheduler this submit. */
  scanned(n: number): void {
    if (!this.enabled) return;
    this.counts.candidatesScanned += n;
  }

  /** `n` candidates were deferred (off-viewport) or un-deferred (negative) this tick. */
  deferred(n: number): void {
    if (!this.enabled) return;
    this.counts.deferred = Math.max(0, this.counts.deferred + n);
  }

  /** `n` prices were converted in place this batch. */
  converted(n: number): void {
    if (!this.enabled) return;
    this.counts.converted += n;
    this.counts.deferred = Math.max(0, this.counts.deferred - n);
  }

  /** The per-page conversion cap was reached (logged once by the scheduler). */
  capReached(): void {
    if (!this.enabled) return;
    this.counts.capReached = true;
  }

  /**
   * Time `fn` as a `performance` measure named `tp:<label>` (DevTools timeline) when enabled,
   * otherwise call it directly with no overhead. Returns whatever `fn` returns.
   */
  time<T>(label: string, fn: () => T): T {
    if (!this.enabled || typeof performance === 'undefined') return fn();
    const start = `${MARK_PREFIX}${label}:start`;
    const end = `${MARK_PREFIX}${label}:end`;
    performance.mark(start);
    try {
      return fn();
    } finally {
      performance.mark(end);
      try {
        performance.measure(`${MARK_PREFIX}${label}`, start, end);
      } catch {
        // measure() can throw if marks were cleared mid-run — never let profiling break work.
      }
    }
  }

  /** Console line, gated. Prefixed so it's filterable in DevTools. */
  log(message: string, data?: unknown): void {
    if (!this.enabled) return;
    if (data === undefined) console.debug(`[TimePrice] ${message}`);
    else console.debug(`[TimePrice] ${message}`, data);
  }

  /** A snapshot of the current counters. */
  summary(): ProfileSummary {
    return { ...this.counts };
  }

  /** Reset all counters (engine teardown / re-activation). */
  reset(): void {
    this.counts = {
      observerBatches: 0,
      candidatesScanned: 0,
      converted: 0,
      deferred: 0,
      capReached: false,
    };
  }
}

/** The single shared profiler for the content engine. */
export const profiler = new Profiler();

// Expose an on-demand summary for manual inspection from the page console (no-op cost: just a
// property assignment). Guarded so it never throws in an exotic global.
try {
  (globalThis as { __TIMEPRICE_PROFILE__?: () => ProfileSummary }).__TIMEPRICE_PROFILE__ = () =>
    profiler.summary();
} catch {
  // ignore — a frozen/exotic global just means no console helper.
}
