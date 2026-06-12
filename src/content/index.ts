// Thin content-engine orchestrator — the baseline activation path (task 07, scope §6).
//
// One-shot: read settings, gate on host (global switch / per-site override / blocklist)
// and on an onboarded rate, then scan → convert → mutate. That is all this task wires up.
// Live re-application via MutationObserver (task 08) and reacting to toggle/blocklist
// changes without a reload (task 09) layer on top of this — here we just "turn it on once".

import { isHostActive, loadSettings } from '@/settings/store';
import type { ConversionContext } from '@core/convert';

import { applyAll } from './mutator';
import { scan } from './scanner';

/** Activate TimePrice on the current page if settings allow it. */
export async function run(): Promise<void> {
  const settings = await loadSettings();

  // `isHostActive` already covers the global `enabled` switch, the blocklist and the
  // per-site override; we only add the onboarding gate (no rate set yet → do nothing).
  if (!isHostActive(settings, location.host)) return;

  const rate = settings.netHourlyRateCzk;
  if (rate === null || !(rate > 0)) return;

  const ctx: ConversionContext = {
    netHourlyRateCzk: rate,
    workdayHours: settings.workdayHours,
    workweekDays: settings.workweekDays,
    rounding: settings.rounding,
  };

  applyAll(scan(), ctx);
}
