// Public surface of the conversion layer. One import site for the content mutator
// (task 07) and the popup preview (task 03) so there is a single source of truth for how
// a price becomes a human time string.

import type { ConversionContext, ConversionResult, Converter } from './converter';
import { timeConverter } from './timeConverter';

export type {
  ConversionContext,
  ConversionResult,
  Converter,
  Rounding,
  TimeUnit,
} from './converter';
export { TimeConverter, timeConverter } from './timeConverter';

/**
 * Registry of available converters, keyed by `Converter.id`. The MVP holds exactly one
 * (`'time'`); task 16 registers further metrics here and the popup/settings expose a
 * picker — no change to scan/mutate/observe required.
 */
const registry = new Map<string, Converter>([[timeConverter.id, timeConverter]]);

/** The metric used when the caller doesn't pick one. */
export const DEFAULT_CONVERTER_ID = timeConverter.id;

/** Look up a registered converter by id, or `undefined` if none matches. */
export function getConverter(id: string): Converter | undefined {
  return registry.get(id);
}

/** All registered converters, for a future settings picker (task 16). */
export function listConverters(): Converter[] {
  return [...registry.values()];
}

/**
 * Thin facade over the default `TimeConverter`. This is what callers use to turn a CZK
 * price into a ready-to-insert time string.
 */
export function formatTime(priceCzk: number, ctx: ConversionContext): ConversionResult {
  return timeConverter.convert(priceCzk, ctx);
}
