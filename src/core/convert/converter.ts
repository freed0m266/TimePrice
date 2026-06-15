// Pluggable conversion contracts. Pure TS — no DOM, no browser APIs — so the whole
// `convert/` layer is unit-testable in node and shared verbatim by the content mutator
// (task 07) and the popup preview (task 03).
//
// The `Converter` interface is the seam for future metrics (% of income, savings weeks —
// task 16): each is a new implementation behind the registry in `index.ts`, never a
// rewrite of scan/mutate/observe. The MVP ships exactly one: `TimeConverter`.

/**
 * Legacy rounding strategy. Once selected the decimal precision of a single-unit display;
 * now IGNORED by `TimeConverter`, which always shows two units (the second unit supplies the
 * precision). Kept here — and structurally identical to the settings `Rounding` — only so stored
 * settings keep validating (`src/core` must not import the settings layer; ESLint enforces it).
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
  /** Legacy rounding strategy — ignored by the current two-unit converter (see {@link Rounding}). */
  rounding: Rounding;
}

/** The largest (primary) unit chosen for `display`. Exposed for tests and future per-unit styling. */
export type TimeUnit = 's' | 'min' | 'h' | 'day';

export interface ConversionResult {
  /** Ready-to-insert human string — the top two time units, e.g. `"1 h, 59 min"`, `"62 d, 4 h"`, `"46 s"`. */
  display: string;
  /** Machine value in hours, unrounded — stored on the span (`data-tp-hours`) for future sorting. */
  hours: number;
  /** The largest (primary) unit shown in `display`. */
  unit: TimeUnit;
}

export interface Converter {
  /** Stable id used as the registry key. `'time'` for the MVP converter. */
  readonly id: string;
  convert(priceCzk: number, ctx: ConversionContext): ConversionResult;
}
