// Live DOM engine — connects the scanner (task 06) + scheduler (task 11) to a changing page
// (task 08). After the one-shot first pass, this keeps prices converted as the DOM mutates:
// infinite-scroll appends, lazy-loaded sections, and SPA route changes that swap the whole
// view without a page reload. The engineered guarantees:
//
//   - NO LOOP. The observer itself never writes; it scans dirty subtrees (read-only) and hands
//     the candidates to the scheduler. The scheduler wraps every conversion in `withGuard`,
//     whose flush — the observer's `takeRecords` — drains our own records before they can
//     trigger another scan (see `guard.ts`). When React/Vue overwrites a converted span with
//     the original price, that is a *foreign* mutation the observer correctly re-applies.
//   - NO PERF DEATH. Records are batched and processed at most once per animation frame (not
//     per mutation), only mutated subtrees are scanned, and dirty roots are deduped to their
//     topmost ancestors. The scheduler then converts viewport-first in idle slots (task 11).
//     Under a mutation storm a throttle holds processing to ≤ 1 per `OBSERVER_THROTTLE_MS`,
//     and a watchdog widens that gap if scans repeatedly overrun their budget (§4).
//
// `startObserving` owns only the DOM-watching machinery (the MutationObserver + the SPA
// `history` hook) and feeds the scheduler. The settings-driven lifecycle — activate /
// deactivate / re-format on a rate change — lives in the engine orchestrator (`index.ts`),
// which owns the scheduler and starts/stops this per the active state. The returned `stop()`
// disconnects the observer, detaches the scheduler flush, and restores the patched `history`.

import { adapterScan } from './adapters/engine';
import type { SiteAdapter } from './adapters/types';
import { PERF } from './perf/constants';
import { profiler } from './perf/profiler';
import type { Scheduler } from './perf/scheduler';
import type { PriceCandidate } from './scanner';

/** rAF debounce target when not throttled — roughly one frame at 60 Hz. */
const FRAME_MS = 16;

const nowMs = (): number => (typeof performance !== 'undefined' ? performance.now() : 0);

/**
 * Start watching `document.body`, scanning newly added / changed subtrees and feeding the
 * `scheduler` (which converts viewport-first in idle slots), plus a full re-pass on SPA URL
 * changes. Returns a `stop()` that tears the observer and the `history` patch down. No-op
 * (returns a no-op `stop`) if there is no `document.body` to observe.
 *
 * `adapter` (task 10) steers every re-scan through the site adapter: mutations outside the
 * adapter's price areas are skipped (precision + perf), while a stale adapter degrades to the
 * generic anchored scan. `null` is the generic engine.
 */
export function startObserving(
  scheduler: Scheduler,
  adapter: SiteAdapter | null = null,
): () => void {
  if (typeof document === 'undefined' || !document.body) return () => {};

  // Subtrees touched since the last frame, scanned in a batch. A `Set` dedupes repeats; the
  // topmost-ancestor filter at flush time collapses nested entries.
  const dirty = new Set<Node>();
  let lastUrl = location.href;
  let stopped = false;

  // --- scheduling state (debounce + throttle + watchdog) --------------------------------
  let pending = false; // a processing run is scheduled
  let pendingIsFrame = false; // …via requestAnimationFrame (vs setTimeout)
  let pendingHandle = 0;
  let lastProcessAt = Number.NEGATIVE_INFINITY; // end of the last processing; -∞ ⇒ first run is never throttled
  let throttleMs: number = PERF.OBSERVER_THROTTLE_MS; // current min gap; watchdog adjusts
  let overBudgetStreak = 0;
  let underBudgetStreak = 0;

  const observer = new MutationObserver((records) => {
    if (stopped) return;

    for (const rec of records) {
      if (rec.type === 'characterData') {
        // SPA updating a node's text in place (e.g. a price ticking) — re-scan that text
        // node directly; the scanner has a text-node-root fast path for exactly this.
        dirty.add(rec.target);
      } else {
        // childList: only freshly added nodes can carry an unconverted price. Removed nodes
        // are gone; attribute changes are not observed.
        rec.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
            dirty.add(node);
          }
        });
      }
    }

    if (dirty.size > 0) scheduleFlush();
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  // The scheduler converts asynchronously (idle slots); its guard must drain THIS observer's
  // own records, so hand it our `takeRecords` as the self-write flush (loop break, task 08).
  scheduler.setFlush(() => observer.takeRecords());

  // --- SPA navigation -------------------------------------------------------------------
  // SPAs change the URL via history.pushState/replaceState without reloading, then swap the
  // view. The MutationObserver usually sees that swap, but an explicit URL hook is more
  // reliable for a clean full re-scan (and matters for per-site re-eval in task 09). Patch
  // defensively: keep and call the original so we never break the site's own navigation.
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  const onUrlChanged = (): void => {
    if (stopped) return; // a history wrapper outlived our teardown — stay inert
    if (location.href === lastUrl) return; // replaceState with no real change → skip
    lastUrl = location.href;
    // A new SPA route is a fresh page: drop the previous route's deferred candidates and its
    // per-page cap counter so a capped or half-scrolled old view can't starve the new one.
    scheduler.reset();
    dirty.add(document.body); // full re-scan; dedupe makes <body> swallow any other root
    scheduleFlush();
  };

  const patchedPushState = function (this: History, ...args: Parameters<History['pushState']>) {
    const result = originalPushState.apply(this, args);
    onUrlChanged();
    return result;
  };
  const patchedReplaceState = function (
    this: History,
    ...args: Parameters<History['replaceState']>
  ) {
    const result = originalReplaceState.apply(this, args);
    onUrlChanged();
    return result;
  };
  history.pushState = patchedPushState;
  history.replaceState = patchedReplaceState;
  window.addEventListener('popstate', onUrlChanged);

  // --- batching + throttle --------------------------------------------------------------
  // The first processing after a quiet period runs on the next frame (fast — the perf goal is
  // "visible prices convert within ~1 frame"). Back-to-back processings within `throttleMs`
  // are deferred to a timer so a mutation storm can't busy the main thread (§4 throttle).
  function scheduleFlush(): void {
    if (stopped || pending) return; // coalesce into the already-pending run
    pending = true;
    const elapsed = nowMs() - lastProcessAt;
    if (elapsed >= throttleMs && typeof requestAnimationFrame === 'function') {
      pendingIsFrame = true;
      pendingHandle = requestAnimationFrame(processDirty);
    } else {
      pendingIsFrame = false;
      const wait = elapsed >= throttleMs ? FRAME_MS : throttleMs - elapsed;
      pendingHandle = setTimeout(processDirty, wait) as unknown as number;
    }
  }

  function clearPending(): void {
    if (!pending) return;
    if (pendingIsFrame && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(pendingHandle);
    } else {
      clearTimeout(pendingHandle);
    }
    pending = false;
  }

  function processDirty(): void {
    pending = false;
    if (stopped) return;

    const start = nowMs();
    const roots = topmostRoots(dirty);
    dirty.clear();

    if (roots.length > 0) {
      profiler.observerBatch();
      const candidates: PriceCandidate[] = [];
      profiler.time('scan', () => {
        for (const root of roots) {
          if (!root.isConnected) continue; // dropped before we got to it
          for (const c of adapterScan(adapter, root)) candidates.push(c);
        }
      });
      // Hand off to the scheduler — it owns the guard/flush and the viewport/idle policy.
      scheduler.submit(candidates);
    }

    const end = nowMs();
    lastProcessAt = end;
    watchdog(end - start);
  }

  // --- watchdog (§4 adaptive degradation) -----------------------------------------------
  // If scans repeatedly overrun their budget the page is fighting us (huge churny SPA); widen
  // the throttle so we process less often. The task offers "disconnect characterData OR widen
  // the debounce" — we take the latter, the reversible, lower-risk option (Rizika warns that
  // dropping characterData can silently stop reacting to text-update SPAs). It relaxes back to
  // baseline once scans are comfortably under budget again. All transitions are logged.
  function watchdog(durationMs: number): void {
    if (durationMs > PERF.SCAN_BUDGET_MS) {
      overBudgetStreak += 1;
      underBudgetStreak = 0;
      if (
        overBudgetStreak >= PERF.WATCHDOG_TRIP_COUNT &&
        throttleMs < PERF.OBSERVER_MAX_THROTTLE_MS
      ) {
        throttleMs = Math.min(throttleMs * 2, PERF.OBSERVER_MAX_THROTTLE_MS);
        overBudgetStreak = 0;
        profiler.log(
          `watchdog: raised observer throttle to ${throttleMs}ms (scans over ${PERF.SCAN_BUDGET_MS}ms budget)`,
        );
      }
    } else {
      underBudgetStreak += 1;
      overBudgetStreak = 0;
      if (underBudgetStreak >= PERF.WATCHDOG_TRIP_COUNT && throttleMs > PERF.OBSERVER_THROTTLE_MS) {
        throttleMs = Math.max(Math.floor(throttleMs / 2), PERF.OBSERVER_THROTTLE_MS);
        underBudgetStreak = 0;
        profiler.log(
          `watchdog: relaxed observer throttle to ${throttleMs}ms (scans back under budget)`,
        );
      }
    }
  }

  return function stop(): void {
    stopped = true;
    observer.disconnect();
    scheduler.setFlush(undefined); // our takeRecords is gone — don't let the scheduler call it
    clearPending();
    dirty.clear();
    window.removeEventListener('popstate', onUrlChanged);
    // Restore only if our patch is still the live one. If another script layered its own on
    // top of ours, leave it alone — restoring the original would clobber their navigation.
    // The `stopped` flag above already neutralizes that retained wrapper, so it can keep
    // calling our `onUrlChanged` harmlessly.
    if (history.pushState === patchedPushState) history.pushState = originalPushState;
    if (history.replaceState === patchedReplaceState) history.replaceState = originalReplaceState;
  };
}

/**
 * Reduce a set of dirty nodes to the topmost ones: any node contained by another in the set
 * is dropped, so a subtree is scanned once instead of once per nested entry. Disconnected
 * nodes are discarded — they cannot be scanned and would never match.
 */
function topmostRoots(nodes: Set<Node>): Node[] {
  const connected = [...nodes].filter((n) => n.isConnected);
  return connected.filter(
    (node) => !connected.some((other) => other !== node && other.contains(node)),
  );
}
