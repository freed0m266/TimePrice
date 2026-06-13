// The MVP converter: CZK price → work time, shown as the TWO most significant time units so
// small price differences (e.g. a discount on a cheap item) stay visible. Czech compact suffixes
// (`d` / `h` / `min` / `s`), separated by a comma+space ("1 h, 59 min", "62 d, 4 h", "46 s"). Pure
// and deterministic — no DOM, no `Date`, no `Math.random` — so the same input always yields the
// same string, in node tests and in the browser alike.

import type { ConversionContext, ConversionResult, Converter } from './converter';

// --- Ladder + thresholds (kept here, never scattered as magic numbers) ------------------

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR;

/** Fallbacks if a malformed context slips past the caller's guards (avoid /0 and a 0 threshold). */
const DEFAULT_WORKDAY_HOURS = 8;
const DEFAULT_WORKWEEK_DAYS = 5;

/**
 * Two-unit composite time converter.
 *
 * The unit ladder is days → hours → minutes → seconds, where a "day" is one *workday*
 * (`workdayHours`, default 8 h), not 24 h. The band is chosen by magnitude, and we render the top
 * non-zero unit plus the next one down, rounding at that smaller (displayed) unit. A zero second
 * unit is dropped, so round amounts read cleanly ("30 h", not "30 h, 0 min"):
 *
 *   - more than one workweek of work → days + hours   ("62 d, 4 h", "250 d")
 *   - at least one hour              → hours + minutes ("30 h", "1 h, 59 min")
 *   - at least one minute           → minutes + seconds("1 min, 5 s", "46 s" once < 1 min)
 *   - under a minute                → seconds          ("46 s", "<1 s", "0 s")
 *
 * Note: the `ctx.rounding` setting (auto/tenths/whole) is intentionally ignored — the second unit
 * provides the precision the old single-unit rounding tried to approximate. The field is kept on
 * `ConversionContext` only for stored-settings compatibility.
 */
export class TimeConverter implements Converter {
  readonly id = 'time';

  convert(priceCzk: number, ctx: ConversionContext): ConversionResult {
    // Defensive no-op: the content engine and popup gate on a positive rate, but never emit
    // NaN/∞ if a bad value slips through. Empty `display` signals "nothing to show".
    if (!(ctx.netHourlyRateCzk > 0) || !(priceCzk >= 0)) {
      return { display: '', hours: 0, unit: 'h' };
    }

    const hours = priceCzk / ctx.netHourlyRateCzk;
    const workdayHours = ctx.workdayHours > 0 ? ctx.workdayHours : DEFAULT_WORKDAY_HOURS;
    const workweekDays = ctx.workweekDays > 0 ? ctx.workweekDays : DEFAULT_WORKWEEK_DAYS;
    const dayThresholdHours = workdayHours * workweekDays;

    const roundedSeconds = Math.round(hours * SECONDS_PER_HOUR);

    // --- Seconds band: under a minute ---------------------------------------------------
    // Checked first so a sub-minute price keeps its precision (the discount-on-a-cucumber case).
    if (roundedSeconds < SECONDS_PER_MINUTE) {
      const display =
        roundedSeconds === 0 ? (priceCzk > 0 ? '<1 s' : '0 s') : `${roundedSeconds} s`;
      return { display, hours, unit: 's' };
    }

    // --- Days band: more than one workweek of work --------------------------------------
    // Rounds to whole hours (the displayed smaller unit), so a near-day-boundary value can't show
    // a stray "8 h" remainder — flooring after rounding the total keeps days + hours consistent.
    if (hours > dayThresholdHours) {
      const totalHours = Math.round(hours);
      const days = Math.floor(totalHours / workdayHours);
      const remHours = totalHours - days * workdayHours;
      const display = remHours > 0 ? `${days} d, ${remHours} h` : `${days} d`;
      return { display, hours, unit: 'day' };
    }

    // --- Hours band: at least one hour, up to one workweek ------------------------------
    // Round the total to whole minutes first; flooring/mod by 60 then naturally carries a 60-min
    // remainder up an hour (e.g. 59.94 min → "1 h", not "60 min").
    const totalMinutes = Math.round(hours * MINUTES_PER_HOUR);
    if (totalMinutes >= MINUTES_PER_HOUR) {
      const h = Math.floor(totalMinutes / MINUTES_PER_HOUR);
      const remMinutes = totalMinutes % MINUTES_PER_HOUR;
      const display = remMinutes > 0 ? `${h} h, ${remMinutes} min` : `${h} h`;
      return { display, hours, unit: 'h' };
    }

    // --- Minutes band: at least one minute, under an hour -------------------------------
    // `roundedSeconds` is in [60, 3600) here (≥ 1 min, and < 1 h or the hours band caught it).
    const minutes = Math.floor(roundedSeconds / SECONDS_PER_MINUTE);
    const remSeconds = roundedSeconds % SECONDS_PER_MINUTE;
    const display = remSeconds > 0 ? `${minutes} min, ${remSeconds} s` : `${minutes} min`;
    return { display, hours, unit: 'min' };
  }
}

/** Default singleton — what `formatTime()` and the registry use. */
export const timeConverter = new TimeConverter();
