// Content-engine orchestrator — the live activation lifecycle (tasks 07 + 08).
//
// Task 07 wired the one-shot first pass: gate on host + onboarded rate, then
// scan → convert → mutate once. Task 08 makes it live:
//   - after the first pass, `startObserving` keeps prices converted as the DOM changes
//     (infinite scroll, lazy load, SPA route swaps);
//   - `onSettingsChanged` lets a popup edit take effect without a page reload — a rate /
//     rounding change re-formats the already-converted spans cheaply, while toggling the
//     extension (or a per-site override) on/off activates or reverts the whole page.
//
// The settings reaction lives here, not in the observer, because the activate/deactivate
// decision needs the host gate (`isHostActive`) and the rate gate — and this is the single
// place that owns the observer handle. Full per-site / blocklist toggle nuance is task 09;
// here we branch on the merged settings event. The returned teardown disconnects the
// observer, restores the patched `history`, and unsubscribes the settings listener (task 08
// §5) — the engine leaves no trace once stopped.

import { isHostActive, loadSettings, onSettingsChanged } from '@/settings/store';
import type { AppSettings } from '@/settings/schema';
import type { ConversionContext } from '@core/convert';

import { adapterScan } from './adapters/engine';
import { getAdapter } from './adapters/registry';
import { reformatAll, revertAll } from './mutator';
import { startObserving } from './observer';
import { profiler } from './perf/profiler';
import { createScheduler, type Scheduler } from './perf/scheduler';

/**
 * Activate TimePrice on the current page and keep it live until the returned teardown is
 * called. Safe to ignore the return value in the content script (the page lifetime tears
 * everything down); it exists for deterministic teardown in tests.
 */
export async function run(): Promise<() => void> {
  const initial = await loadSettings();
  let ctx = contextFor(initial);
  let active = false;
  let stopObserver: (() => void) | null = null;
  let scheduler: Scheduler | null = null;

  // The site adapter is fixed by the host for the page's lifetime (task 10). `null` (no
  // adapter / unsupported domain) drives the generic engine; a supported domain narrows the
  // scan to its price selectors with a stale-markup fallback to generic.
  const adapter = getAdapter(location.host);

  const activate = (): void => {
    profiler.reset();
    // The scheduler owns the perf-aware "convert" side (task 11): viewport-first, idle-batched,
    // page-capped. `() => ctx` is read at conversion time so deferred (off-viewport) candidates
    // pick up a later rate change automatically — no observer restart needed.
    scheduler = createScheduler(() => ctx);
    scheduler.submit(adapterScan(adapter)); // first pass — gated/deferred by the scheduler
    stopObserver = startObserving(scheduler, adapter);
    active = true;
  };

  const deactivate = (): void => {
    stopObserver?.(); // stop observing first, so reverting prices isn't re-converted
    stopObserver = null;
    scheduler?.teardown(); // drop the IntersectionObserver + any candidates queued off-viewport
    scheduler = null;
    revertAll();
    active = false;
  };

  if (isActive(initial)) activate();

  const unsubscribe = onSettingsChanged((next) => {
    const nextActive = isActive(next);

    if (nextActive && !active) {
      ctx = contextFor(next);
      activate();
    } else if (!nextActive && active) {
      deactivate();
    } else if (nextActive && active) {
      const nextCtx = contextFor(next);
      if (contextChanged(ctx, nextCtx)) {
        ctx = nextCtx;
        // Re-format the spans already on the page. Candidates the scheduler hasn't converted
        // yet (still off-viewport) will pick up the new `ctx` via its `() => ctx` getter, so
        // the observer needs no restart.
        reformatAll(ctx);
      }
    }
  });

  return () => {
    unsubscribe();
    stopObserver?.();
    stopObserver = null;
    scheduler?.teardown();
    scheduler = null;
    active = false;
  };
}

/** Whether the engine should be running: globally/per-site enabled, not blocked, onboarded. */
function isActive(settings: AppSettings): boolean {
  if (!isHostActive(settings, location.host)) return false;
  const rate = settings.netHourlyRateCzk;
  return rate !== null && rate > 0;
}

/**
 * Build the converter context from settings. When the rate is not yet set the engine is
 * inactive and this context is unused, so a `0` placeholder is harmless (and `formatTime`
 * treats it as invalid anyway).
 */
function contextFor(settings: AppSettings): ConversionContext {
  return {
    netHourlyRateCzk: settings.netHourlyRateCzk ?? 0,
    workdayHours: settings.workdayHours,
    workweekDays: settings.workweekDays,
    rounding: settings.rounding,
  };
}

/** True if anything affecting the displayed time differs — the trigger for `reformatAll`. */
function contextChanged(a: ConversionContext, b: ConversionContext): boolean {
  return (
    a.netHourlyRateCzk !== b.netHourlyRateCzk ||
    a.workdayHours !== b.workdayHours ||
    a.workweekDays !== b.workweekDays ||
    a.rounding !== b.rounding
  );
}
