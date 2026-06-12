// Pluggable conversion contracts. Pure TS — no DOM, no browser APIs — so the whole
// `convert/` layer is unit-testable in node and shared verbatim by the content mutator
// (task 07) and the popup preview (task 03).
//
// The `Converter` interface is the seam for future metrics (% of income, savings weeks —
// task 16): each is a new implementation behind the registry in `index.ts`, never a
// rewrite of scan/mutate/observe. The MVP ships exactly one: `TimeConverter`.

/**
 * How fractional results are rounded for display. Structurally identical to the settings
 * `Rounding`, but redeclared here on purpose: `src/core` must not import the settings
 * layer (ESLint enforces it). Callers map `AppSettings.rounding` straight onto this — the
 * string unions match, so the assignment is type-safe.
 */
export type Rounding = 'auto' | 'tenths' | 'whole';

/**
 * Everything a converter needs beyond the raw price. Sourced from `AppSettings`
 * (task 02) by the caller; the converter itself stays stateless and deterministic.
 */
export interface ConversionContext {
  /** Net CZK the user earns per hour. Callers must pass a positive value. */
  netHourlyRateCzk: number;
  /** Hours in a workday, used to scale into "days". Default 8. */
  workdayHours: number;
  /** Workdays in a week. Default 5 — sets the hours→days threshold (one workweek). */
  workweekDays: number;
  /** How fractional results are rounded for display. */
  rounding: Rounding;
}

/** Selected output unit. Exposed for tests and future per-unit styling (task 07). */
export type TimeUnit = 'min' | 'h' | 'day';

export interface ConversionResult {
  /** Ready-to-insert human string, e.g. `"30 h"`, `"7,5 d"`, `"<1 min"`. */
  display: string;
  /** Machine value in hours, unrounded — for the tooltip and future sorting. */
  hours: number;
  /** The auto-scaled unit chosen for `display`. */
  unit: TimeUnit;
}

export interface Converter {
  /** Stable id used as the registry key. `'time'` for the MVP converter. */
  readonly id: string;
  convert(priceCzk: number, ctx: ConversionContext): ConversionResult;
}
