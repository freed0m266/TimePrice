// Popup-side adapter over the shared core converter. The live preview and the content
// engine (task 07) both format through `src/core/convert`, so there is one source of
// truth for how a price reads as time — no drift between what the popup promises and what
// the page shows. This file only adds the popup's "no rate yet → show nothing" guard and
// maps settings onto a ConversionContext.

import { formatTime } from '@core/convert';
import type { AppSettings } from '@/settings/schema';

/** The settings fields the converter needs; the popup passes `settings.current`. */
type RateSettings = Pick<AppSettings, 'workdayHours' | 'workweekDays' | 'rounding'>;

/**
 * Convert a CZK price to the work time needed to earn it, at a given net hourly rate.
 * Returns the core converter's display string, or `null` when the inputs can't produce a
 * meaningful value (no/zero/negative rate, negative price) so the caller can show a hint.
 */
export function formatTimePreview(
  priceCzk: number,
  netHourlyRateCzk: number | null,
  settings: RateSettings,
): string | null {
  if (netHourlyRateCzk === null || !(netHourlyRateCzk > 0) || !(priceCzk >= 0)) {
    return null;
  }

  return formatTime(priceCzk, {
    netHourlyRateCzk,
    workdayHours: settings.workdayHours,
    workweekDays: settings.workweekDays,
    rounding: settings.rounding,
  }).display;
}
