// Performance budget — the tunable knobs for the hardening layer (task 11).
//
// One place for every cap and interval so they can be reasoned about together and adjusted
// from measurement (task 11 §5) rather than scattered as magic numbers across the engine.
// The defaults target the perf goal in the task: first conversion of visible prices within
// ~1 frame, no main-thread task over ~50 ms, and CPU ≈ 0 once the page settles.

export const PERF = {
  /**
   * Hard cap on converted prices per page (§4 safety valve). Above this the scheduler stops
   * converting and logs once — pathological pages (runaway infinite scroll, comparison sites
   * with tens of thousands of rows) must never let TimePrice monopolise the main thread.
   * Deliberately well above any realistic page; reaching it is logged, never silent.
   */
  MAX_CONVERSIONS_PER_PAGE: 5000,

  /**
   * Max candidates converted in a single idle slot (§3). Keeps each task short; the remainder
   * is pushed to the next idle slot so one huge batch never becomes one long task.
   */
  MAX_NODES_PER_BATCH: 150,

  /**
   * `requestIdleCallback` timeout (§2). Bounds how long deferred conversions can wait when the
   * main thread never goes idle, so work still drains on busy pages instead of starving.
   */
  IDLE_TIMEOUT_MS: 250,

  /**
   * `IntersectionObserver` root margin (§1). Generous so a price converts *before* it scrolls
   * into view — avoids the "raw price flashes, then flips to time" UX flaw flagged in Rizika.
   */
  IO_ROOT_MARGIN: '600px',

  /**
   * Floor for the gap between observer processings under a mutation storm (§4 throttle). The
   * first processing after a quiet period still runs on the next frame; only back-to-back
   * processings inside this window are deferred to hold ≤ 1 processing per interval.
   */
  OBSERVER_THROTTLE_MS: 100,

  /** Ceiling the watchdog may escalate the throttle to under sustained overload (§4). */
  OBSERVER_MAX_THROTTLE_MS: 1000,

  /** Per-processing scan budget; sustained overruns trip the watchdog (§4 adaptive degradation). */
  SCAN_BUDGET_MS: 50,

  /** Consecutive over-/under-budget scans before the watchdog escalates / relaxes the throttle. */
  WATCHDOG_TRIP_COUNT: 3,
} as const;
