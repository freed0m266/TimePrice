// Apply scheduler (task 11 §1–§4) — the perf-aware "convert" side of the engine.
//
// The scanner (task 06) and the observer (task 08) find price candidates cheaply; this module
// decides WHEN and IN WHAT ORDER to actually convert them, so a huge page never janks:
//
//   §1 VIEWPORT-FIRST. Candidates are gated through an `IntersectionObserver`. A price is
//      converted only as its element nears the viewport (generous `rootMargin`, so it flips
//      before the user sees it). On infinite-scroll / comparison pages this means we never
//      convert the thousands of rows the user will never scroll to. Each text node is tracked
//      so a repeat scan (SPA route change, container mutation) never defers it twice.
//   §2/§3 BATCHING. When candidates reach the viewport the FIRST batch is drained on the next
//      animation frame — visible prices flip within ~1 frame (the task's goal), not after an
//      idle gap. Any backlog beyond `MAX_NODES_PER_BATCH` rolls into `requestIdleCallback`
//      slots, so no single conversion task runs long and the rest trickles in while idle.
//   §4 HARD CAP. A per-page conversion cap is a safety valve against pathological pages; on
//      reaching it the scheduler stops converting and logs once — never a silent truncation.
//
// Loop safety is unchanged from task 08: every write goes through `withGuard`, and the
// guard's flush (the observer's `takeRecords`) drains the records our own writes produce
// before the observer's microtask can see them. Idempotency (the mutator's offset + processed
// guards) makes deferring safe even if a candidate goes stale before it is converted.
//
// FALLBACK: where `IntersectionObserver` is unavailable (older engines, or jsdom in the
// integration tests) there is no viewport signal, so the scheduler converts eagerly and
// synchronously inside `submit` — exactly the pre-task-11 behaviour, still capped.

import type { ConversionContext } from '@core/convert';

import { withGuard } from '../guard';
import { applyToCandidate } from '../mutator';
import type { PriceCandidate } from '../scanner';

import { PERF } from './constants';
import { cancelIdle, requestIdle } from './idle';
import { profiler } from './profiler';

// Synthetic deadline for the animation-frame drain: a frame has no idle budget, so process up
// to `MAX_NODES_PER_BATCH` (the node cap bounds the work) without the time-budget bail.
const FRAME_DEADLINE: IdleDeadline = { didTimeout: true, timeRemaining: () => 0 };

export interface Scheduler {
  /**
   * Take freshly scanned candidates and convert them under the perf policy: viewport-gated +
   * idle-batched where `IntersectionObserver` exists, eager + synchronous where it doesn't.
   */
  submit(candidates: PriceCandidate[]): void;
  /**
   * Set the self-write flush the scheduler runs after each guarded conversion batch — the
   * observer's `takeRecords`, which discards the records our writes produce (loop break).
   * `undefined` while no observer is attached (the first pass, or after teardown).
   */
  setFlush(flush: (() => void) | undefined): void;
  /**
   * Drop all route-local state — deferred candidates, the dedup map, pending drains, and the
   * per-page conversion cap counter — for an SPA navigation. The previous route's off-viewport
   * candidates and a tripped cap must not carry into a fresh view (the engine keeps running;
   * the observer follows this with a full re-scan of the new route).
   */
  reset(): void;
  /** Disconnect the `IntersectionObserver`, cancel any pending drain, and drop all queues. */
  teardown(): void;
}

/**
 * Create the apply scheduler for one activation. `getCtx` is read at conversion time (not
 * captured once) so candidates deferred before a rate change convert with the new rate.
 */
export function createScheduler(getCtx: () => ConversionContext): Scheduler {
  // Candidates whose element has reached (near) the viewport and await conversion in an idle
  // slot. A plain queue: FIFO keeps document-ish order without extra bookkeeping.
  const queue: PriceCandidate[] = [];
  // Off-viewport candidates, keyed by the element observed for them. One element can host
  // several price text nodes, so the value is a list.
  const deferred = new Map<Element, PriceCandidate[]>();
  // Text nodes currently deferred OR queued, mapped to their candidate. The dedup guard so a
  // repeat scan of an unconverted price doesn't enqueue it twice — and the place we refresh
  // the matches when an in-flight node is rescanned with new text (an in-place SPA update), so
  // the eventual conversion uses the current price, not a stale one. The mapped object is the
  // SAME instance held in `deferred` / `queue`, so mutating its `matches` updates it there too.
  const inflight = new Map<Text, PriceCandidate>();

  let io: IntersectionObserver | null = null;
  let drainHandle: number | null = null;
  let drainViaRaf = false;
  let flush: (() => void) | undefined;
  let converted = 0;
  let capLogged = false;
  let stopped = false;

  const supportsIO = typeof IntersectionObserver === 'function';

  function submit(candidates: PriceCandidate[]): void {
    if (stopped || candidates.length === 0) return;
    // Cap reached → nothing more will convert, so don't even observe/queue more (bounds memory
    // on pathological pages). Route through atCap() so a dynamic submit after the cap is hit is
    // logged once, even if an earlier batch landed exactly on the cap without logging.
    if (atCap()) return;
    profiler.scanned(candidates.length);

    if (!supportsIO) {
      // No viewport signal → convert now, synchronously, still respecting the page cap.
      for (const c of candidates) queue.push(c);
      drainEager();
      return;
    }

    const observer = ensureIO();
    let deferredNow = 0;
    for (const c of candidates) {
      const stale = inflight.get(c.node);
      if (stale) {
        // Already deferred or queued. Refresh its matches in place in case the node's text
        // changed since it was scanned, then skip re-observing/re-queuing it.
        stale.matches = c.matches;
        continue;
      }
      const el = c.node.parentElement;
      if (!el) continue; // detached text node → the mutator would no-op anyway
      inflight.set(c.node, c);
      const existing = deferred.get(el);
      if (existing) {
        existing.push(c);
      } else {
        deferred.set(el, [c]);
        observer.observe(el); // its initial callback reports visibility → viewport-first
      }
      deferredNow += 1;
    }
    profiler.deferred(deferredNow);
  }

  /** The single `IntersectionObserver`, created on first need. */
  function ensureIO(): IntersectionObserver {
    if (io) return io;
    io = new IntersectionObserver(onIntersect, { rootMargin: PERF.IO_ROOT_MARGIN });
    return io;
  }

  /** An observed element entered (near) the viewport: move its candidates into the apply queue. */
  function onIntersect(entries: IntersectionObserverEntry[]): void {
    if (stopped) return;
    for (const entry of entries) {
      const el = entry.target;
      if (!entry.isIntersecting) {
        // Virtualized / infinite-scroll lists remove off-screen prices before they ever show;
        // IO still reports them. Release any target that has left the document so we don't
        // retain detached nodes (and their candidates) for the page's lifetime.
        if (!el.isConnected) dropTarget(el);
        continue;
      }
      io?.unobserve(el); // convert once; re-renders re-submit fresh candidates
      const cands = deferred.get(el);
      if (cands) {
        deferred.delete(el);
        for (const c of cands) queue.push(c); // stays in `inflight` until drained
      }
    }
    if (queue.length > 0) scheduleDrain(true); // visible now → drain promptly (next frame)
  }

  /** Stop observing `el` and forget its deferred candidates (also clears their dedup marks). */
  function dropTarget(el: Element): void {
    io?.unobserve(el);
    const cands = deferred.get(el);
    if (cands) for (const c of cands) inflight.delete(c.node);
    deferred.delete(el);
  }

  /**
   * Arm one drain pass; coalesces — a pending pass swallows further calls. `prompt` work (newly
   * visible prices) runs on the next animation frame for ~1-frame latency; backlog overflow
   * uses `requestIdleCallback` so it never blocks the main thread.
   */
  function scheduleDrain(prompt: boolean): void {
    if (stopped || drainHandle !== null) return;
    if (prompt && typeof requestAnimationFrame === 'function') {
      drainViaRaf = true;
      drainHandle = requestAnimationFrame(() => {
        drainHandle = null;
        runDrain(FRAME_DEADLINE);
      });
    } else {
      drainViaRaf = false;
      drainHandle = requestIdle((deadline) => {
        drainHandle = null;
        runDrain(deadline);
      }, PERF.IDLE_TIMEOUT_MS);
    }
  }

  function cancelDrain(): void {
    if (drainHandle === null) return;
    if (drainViaRaf && typeof cancelAnimationFrame === 'function')
      cancelAnimationFrame(drainHandle);
    else cancelIdle(drainHandle);
    drainHandle = null;
  }

  /** Convert up to one batch, respecting the time budget and the page cap. */
  function runDrain(deadline: IdleDeadline): void {
    if (stopped) return;

    const before = converted;
    profiler.time('apply', () =>
      withGuard(() => {
        let processed = 0;
        while (queue.length > 0) {
          if (atCap()) break; // `converted` is updated live below, so the cap stops us mid-batch
          if (processed >= PERF.MAX_NODES_PER_BATCH) break;
          // Yield the slot back when out of idle budget — unless this is the timeout-forced
          // (or animation-frame) run, where we push through so deferred work can't starve.
          if (!deadline.didTimeout && deadline.timeRemaining() <= 0) break;
          const candidate = queue.shift()!;
          inflight.delete(candidate.node);
          // Cap the node to the page's remaining allowance so a multi-price node can't overshoot.
          converted += applyToCandidate(candidate, getCtx(), remainingCap());
          processed += 1;
        }
      }, flush),
    );

    const applied = converted - before;
    if (applied > 0) profiler.converted(applied);
    if (atCap()) {
      releaseDeferred(); // cap hit → bound memory: drop the rest + stop observing
    } else if (queue.length > 0) {
      scheduleDrain(false); // backlog remains → idle slot
    }
  }

  /**
   * Once the page cap trips, conversion stops for good — so drop the queued candidates and
   * tear down the `IntersectionObserver`, otherwise a very large page would keep both alive
   * for nothing. New submits are already short-circuited by the `atCap()` guard in `submit`.
   */
  function releaseDeferred(): void {
    queue.length = 0;
    io?.disconnect();
    io = null;
    deferred.clear();
    inflight.clear();
  }

  /** Synchronous conversion for the no-`IntersectionObserver` fallback. Page cap still applies. */
  function drainEager(): void {
    const before = converted;
    profiler.time('apply', () =>
      withGuard(() => {
        while (queue.length > 0) {
          if (atCap()) {
            queue.length = 0; // nothing more will convert — drop the rest
            break;
          }
          converted += applyToCandidate(queue.shift()!, getCtx(), remainingCap());
        }
      }, flush),
    );
    const applied = converted - before;
    if (applied > 0) profiler.converted(applied);
  }

  /** Prices still convertible before the page cap — passed to the mutator as a per-node limit. */
  function remainingCap(): number {
    return PERF.MAX_CONVERSIONS_PER_PAGE - converted;
  }

  /** Whether the per-page cap is reached; logs once on the transition (no silent caps, §4). */
  function atCap(): boolean {
    if (converted < PERF.MAX_CONVERSIONS_PER_PAGE) return false;
    if (!capLogged) {
      capLogged = true;
      profiler.capReached();
      // Always surface the cap — this path is the documented, non-silent truncation.
      console.info(
        `[TimePrice] Reached the ${PERF.MAX_CONVERSIONS_PER_PAGE}-price cap on this page; ` +
          `remaining prices are left unconverted.`,
      );
    }
    return true;
  }

  function setFlush(next: (() => void) | undefined): void {
    flush = next;
  }

  /** Shared cleanup for both `reset` (new route) and `teardown` (engine stop). */
  function clearAll(): void {
    io?.disconnect();
    io = null;
    cancelDrain();
    queue.length = 0;
    deferred.clear();
    inflight.clear();
  }

  function reset(): void {
    if (stopped) return;
    clearAll();
    converted = 0; // new route → the per-page cap starts fresh
    capLogged = false;
  }

  function teardown(): void {
    stopped = true;
    clearAll();
  }

  return { submit, setFlush, reset, teardown };
}
