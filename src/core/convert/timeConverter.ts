// The MVP converter: CZK price → work time, auto-scaled to the most readable unit and
// formatted Czech-style (decimal comma, compact `min` / `h` / `d` suffixes). Pure and
// deterministic — no DOM, no `Date`, no `Math.random` — so the same input always yields
// the same string, in node tests and in the browser alike.

import type { ConversionContext, ConversionResult, Converter, Rounding } from './converter';

// --- Tunable thresholds (kept here, never scattered as magic numbers) -------------------

/** Below this many (rounded) minutes we show minutes; at/above it we roll up to hours. */
const MINUTES_PER_HOUR = 60;

/** Fallbacks if a malformed context slips past the caller's guards (avoid /0 and a 0 threshold). */
const DEFAULT_WORKDAY_HOURS = 8;
const DEFAULT_WORKWEEK_DAYS = 5;

/**
 * Render `value` with the Czech decimal comma.
 *
 * `decimals` fixes the fraction width; `dropTrailingZero` removes a `,0…` tail so whole
 * results read as `"40 d"` rather than `"40,0 d"`. We replace `.`→`,` by hand instead of
 * `Intl.NumberFormat` to stay dependency-free and identical across environments (matches
 * the rest of the codebase); at MVP magnitudes thousands grouping isn't needed.
 */
function czechNumber(value: number, decimals: number, dropTrailingZero: boolean): string {
  let str = value.toFixed(decimals);
  if (dropTrailingZero && decimals > 0) {
    // Strip a pure-zero fraction (and its separator); keep a non-zero one like ".5".
    str = str.replace(/\.0+$/, '');
  }
  return str.replace('.', ',');
}

/** Decimal places + trailing-zero policy for the hours/days bands, per rounding mode. */
function decimalsFor(unit: 'h' | 'day', rounding: Rounding): { decimals: number; drop: boolean } {
  switch (rounding) {
    case 'whole':
      return { decimals: 0, drop: false };
    case 'tenths':
      // Always one decimal, even a trailing zero ("9,0 h") — the user asked for precision.
      return { decimals: 1, drop: false };
    case 'auto':
    default:
      // Hours stay whole (shortest, "rough orientation"); days keep one decimal but drop
      // a bare ",0" so big round counts read cleanly ("250 d", not "250,0 d").
      return unit === 'h' ? { decimals: 0, drop: false } : { decimals: 1, drop: true };
  }
}

/**
 * Smart auto-scaling time converter.
 *
 * Unit selection:
 *   - rounded minutes < 60        → minutes (`"6 min"`, `"<1 min"`, `"0 min"`)
 *   - hours ≤ one workweek (~40h) → hours   (`"30 h"`)
 *   - otherwise                   → workdays (`"7,5 d"`)
 */
export class TimeConverter implements Converter {
  readonly id = 'time';

  convert(priceCzk: number, ctx: ConversionContext): ConversionResult {
    // Defensive no-op: the content engine and popup gate on a positive rate, but never
    // emit NaN/∞ if a bad value slips through. Empty `display` signals "nothing to show".
    if (!(ctx.netHourlyRateCzk > 0) || !(priceCzk >= 0)) {
      return { display: '', hours: 0, unit: 'h' };
    }

    const hours = priceCzk / ctx.netHourlyRateCzk;
    const workdayHours = ctx.workdayHours > 0 ? ctx.workdayHours : DEFAULT_WORKDAY_HOURS;
    const workweekDays = ctx.workweekDays > 0 ? ctx.workweekDays : DEFAULT_WORKWEEK_DAYS;

    // --- Minutes band -------------------------------------------------------------------
    const roundedMin = Math.round(hours * 60);
    if (roundedMin < MINUTES_PER_HOUR) {
      let display: string;
      if (roundedMin === 0) {
        // A real (positive) price too small to reach a minute still deserves a hint.
        display = priceCzk > 0 ? '<1 min' : '0 min';
      } else {
        display = `${roundedMin} min`;
      }
      return { display, hours, unit: 'min' };
    }

    // --- Hours band (up to and including one workweek) ----------------------------------
    if (hours <= workdayHours * workweekDays) {
      const { decimals, drop } = decimalsFor('h', ctx.rounding);
      return { display: `${czechNumber(hours, decimals, drop)} h`, hours, unit: 'h' };
    }

    // --- Days band ----------------------------------------------------------------------
    const days = hours / workdayHours;
    const { decimals, drop } = decimalsFor('day', ctx.rounding);
    return { display: `${czechNumber(days, decimals, drop)} d`, hours, unit: 'day' };
  }
}

/** Default singleton — what `formatTime()` and the registry use. */
export const timeConverter = new TimeConverter();
