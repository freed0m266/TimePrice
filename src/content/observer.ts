// Live DOM engine — connects the scanner (task 06) + mutator (task 07) to a changing page
// (task 08). After the one-shot first pass, this keeps prices converted as the DOM mutates:
// infinite-scroll appends, lazy-loaded sections, and SPA route changes that swap the whole
// view without a page reload. The two engineered guarantees:
//
//   - NO LOOP. Every write goes through `withGuard`, whose flush drains our own observer
//     records before they can trigger another scan (see `guard.ts`). When React/Vue
//     overwrites a converted span with the original price, that is a *foreign* mutation the
//     observer correctly re-applies — re-application, not a loop.
//   - NO PERF DEATH. Records are batched and processed once per animation frame (not per
//     mutation), and only the mutated subtrees are scanned (`scan({ root })`) — never the
//     whole document. Dirty roots are deduped to their topmost ancestors so a node and its
//     parent are not scanned twice. Finer viewport/idle gating is task 11.
//
// `startObserving` owns only the DOM-watching machinery (the MutationObserver + the SPA
// `history` hook). The settings-driven lifecycle — activate / deactivate / re-format on a
// rate change — lives in the engine orchestrator (`index.ts`), which starts and stops this
// per the active state. The returned `stop()` disconnects the observer and restores the
// patched `history` methods.

import type { ConversionContext } from '@core/convert';

import { withGuard, isWriting } from './guard';
import { applyAll } from './mutator';
import { scan } from './scanner';

/**
 * Start watching `document.body` and converting prices in newly added / changed subtrees,
 * plus re-running a full pass on SPA URL changes. Returns a `stop()` that tears the
 * observer and the `history` patch down. No-op (returns a no-op `stop`) if there is no
 * `document.body` to observe.
 */
export function startObserving(ctx: ConversionContext): () => void {
  if (typeof document === 'undefined' || !document.body) return () => {};

  // Subtrees touched since the last frame, scanned in a batch. A `Set` dedupes repeats; the
  // topmost-ancestor filter at flush time collapses nested entries.
  const dirty = new Set<Node>();
  let frameId: number | null = null;
  let usedRaf = false;
  let lastUrl = location.href;
  // Set by `stop()`. We cannot always un-patch `history` (another script may have wrapped our
  // patch — see `stop()`), so a retained wrapper can still invoke `onUrlChanged` after
  // teardown. This flag makes every entry point inert, so a stopped engine never re-scans.
  let stopped = false;

  const observer = new MutationObserver((records) => {
    // Secondary guard (see guard.ts): the synchronous `takeRecords()` flush is what really
    // prevents the loop; this only matters for a non-spec synchronous delivery.
    if (isWriting()) return;

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

  // --- batching -------------------------------------------------------------------------
  function scheduleFlush(): void {
    if (stopped) return; // never arm a frame once torn down
    if (frameId !== null) return; // a frame is already pending — coalesce into it
    if (typeof requestAnimationFrame === 'function') {
      usedRaf = true;
      frameId = requestAnimationFrame(processDirty);
    } else {
      usedRaf = false;
      frameId = setTimeout(processDirty, 16) as unknown as number;
    }
  }

  function processDirty(): void {
    frameId = null;
    const roots = topmostRoots(dirty);
    dirty.clear();
    if (roots.length === 0) return;

    // One guard window around the whole batch: a single `takeRecords()` flush at the end
    // discards every record our writes produced, so the batch cannot re-trigger itself.
    withGuard(
      () => {
        for (const root of roots) {
          if (!root.isConnected) continue; // dropped before we got to it
          applyAll(scan({ root }), ctx);
        }
      },
      () => observer.takeRecords(),
    );
  }

  return function stop(): void {
    stopped = true;
    observer.disconnect();
    if (frameId !== null) {
      if (usedRaf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frameId);
      else clearTimeout(frameId);
      frameId = null;
    }
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
