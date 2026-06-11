// TODO(task05): swap for the shared formatTime() / Converter from src/core/convert.
//
// This is a deliberately simple inline stand-in so the popup's live preview works
// before task 05 lands. It intentionally mirrors the TARGET output shape — Czech
// decimal comma, compact `min` / `h` / `d` suffixes, workday-aware day scaling — so
// that swapping in the real formatter later is a drop-in with minimal visual drift.
// Keep the behaviour close to that contract; do not grow extra features here (other
// metrics like days/% are task 16, not the preview).

/**
 * Convert a CZK price to the work time needed to earn it, at a given net hourly rate.
 * Returns a short human string (`"6 min"`, `"1 h"`, `"3,8 d"`) or `null` when the
 * inputs can't produce a meaningful value (no/zero rate, negative price).
 */
export function formatTimePreview(
  priceCzk: number,
  netHourlyRateCzk: number | null,
  workdayHours: number,
): string | null {
  if (netHourlyRateCzk === null || !(netHourlyRateCzk > 0) || !(priceCzk >= 0)) {
    return null;
  }

  const hours = priceCzk / netHourlyRateCzk;
  const minutes = hours * 60;

  // Under an hour → whole minutes; reads more naturally than "0,1 h".
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }

  const workday = workdayHours > 0 ? workdayHours : 8;
  if (hours < workday) {
    return `${czechNumber(hours)} h`;
  }
  return `${czechNumber(hours / workday)} d`;
}

/** Round to one decimal, drop a trailing `,0`, and use the Czech decimal comma. */
function czechNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return str.replace('.', ',');
}
