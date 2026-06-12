// Self-write guard — the first line of defense against the MutationObserver loop (task 08).
//
// The trap: our mutator writes into the DOM → the MutationObserver records those writes →
// it scans them → it writes again → … forever. This module wraps every self-write so the
// observer can recognise and discard its own records.
//
// Two layers, in order of importance:
//   1. PRIMARY — flush. MutationObserver delivers records asynchronously (a microtask), so a
//      plain "are we writing?" flag is already `false` by the time the callback runs and
//      cannot help. The real fix is to drain the observer's own queued records with
//      `observer.takeRecords()` *synchronously* right after the write, before that microtask
//      fires, and throw them away. `withGuard` runs the caller-supplied flush in its
//      `finally`, which is still synchronous, so our records never reach the callback.
//   2. SECONDARY — `isWriting()`. A cheap re-entrancy check the observer callback can make at
//      its top. It only catches a synchronous re-entrant delivery (which a spec-compliant
//      MutationObserver never does), so it is pure belt-and-suspenders; the flush above is
//      what actually breaks the loop. The scanner skipping `data-timeprice` subtrees is a
//      third, idempotency-level backstop living in task 06.
//
// The guard is intentionally generic: it knows nothing about the observer. The observer
// passes its own `takeRecords()` as the flush, so this file carries no DOM coupling.

/** Re-entrancy depth, so nested guarded writes flush exactly once (at the outermost exit). */
let depth = 0;

/** True while a guarded self-write is in progress. See the secondary-layer note above. */
export function isWriting(): boolean {
  return depth > 0;
}

/**
 * Run `write` as a guarded self-mutation.
 *
 * `flushSelfRecords` (the observer's `takeRecords()`) is invoked synchronously once the
 * outermost guarded write completes, draining and discarding the records that write just
 * queued — the primary loop break. Nested calls only flush when the last one unwinds.
 */
export function withGuard<T>(write: () => T, flushSelfRecords?: () => void): T {
  depth++;
  try {
    return write();
  } finally {
    depth--;
    if (depth === 0) flushSelfRecords?.();
  }
}
