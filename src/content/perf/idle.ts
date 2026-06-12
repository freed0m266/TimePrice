// Idle scheduling (task 11 §2) — run deferred conversion batches when the main thread is
// free, with a hard timeout so they still run on a page that never goes idle.
//
// `requestIdleCallback` is the right primitive but isn't universal (notably absent in Safari
// and in jsdom). The fallback is the task-specified `setTimeout(…, 1)` with a synthetic
// deadline that always reports a little budget — so callers using `deadline.timeRemaining()`
// to bound a batch still terminate. Globals are read at call time so tests can stub them.

export type IdleHandle = number;

/**
 * Schedule `cb` for the next idle period, falling back to `setTimeout(…, 1)`. `timeout`
 * bounds the wait even when the thread never idles. Returns a handle for {@link cancelIdle}.
 */
export function requestIdle(cb: (deadline: IdleDeadline) => void, timeout: number): IdleHandle {
  if (typeof requestIdleCallback === 'function') {
    return requestIdleCallback(cb, { timeout });
  }
  // Fallback: a near-immediate timeout with a synthetic, already-timed-out deadline. A small
  // positive `timeRemaining` lets a batch make progress; `didTimeout` tells the drain not to
  // bail on the time budget (there is no real idle budget to respect here).
  return setTimeout(
    () => cb({ didTimeout: true, timeRemaining: () => 1 }),
    1,
  ) as unknown as IdleHandle;
}

/** Cancel a handle from {@link requestIdle}, matching whichever primitive scheduled it. */
export function cancelIdle(handle: IdleHandle): void {
  if (typeof cancelIdleCallback === 'function') cancelIdleCallback(handle);
  else clearTimeout(handle);
}
