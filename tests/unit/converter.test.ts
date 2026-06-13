import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CONVERTER_ID,
  formatTime,
  getConverter,
  listConverters,
  timeConverter,
} from '@core/convert';
import type { ConversionContext, Rounding } from '@core/convert';

// Base context: 8 h workday, 5 day workweek → hours→days threshold at 40 h. Individual
// tests override `netHourlyRateCzk` and whatever else they exercise.
function ctx(overrides: Partial<ConversionContext> = {}): ConversionContext {
  return {
    netHourlyRateCzk: 1000,
    workdayHours: 8,
    workweekDays: 5,
    rounding: 'auto',
    ...overrides,
  };
}

describe('formatTime — two-unit band selection', () => {
  it('seconds band: under a minute shows just seconds', () => {
    const r = formatTime(12.9, ctx()); // 0.0129 h = 46.44 s
    expect(r.display).toBe('46 s');
    expect(r.unit).toBe('s');
    expect(r.hours).toBeCloseTo(0.0129, 6);
  });

  it('minutes band: shows minutes + seconds', () => {
    expect(formatTime(18, ctx()).display).toBe('1 min, 5 s'); // 64.8 s
    expect(formatTime(99, ctx()).display).toBe('5 min, 56 s'); // 356.4 s
    expect(formatTime(18, ctx()).unit).toBe('min');
  });

  it('minutes band: drops a zero second unit', () => {
    // rate 1200, price 40 → 40/1200 h = exactly 120 s = 2 min, 0 s.
    expect(formatTime(40, ctx({ netHourlyRateCzk: 1200 })).display).toBe('2 min');
  });

  it('hours band: shows hours + minutes, drops a zero minute unit', () => {
    expect(formatTime(1990, ctx()).display).toBe('1 h, 59 min'); // 1.99 h
    expect(formatTime(30000, ctx()).display).toBe('30 h'); // exactly 30 h
    expect(formatTime(7000, ctx()).display).toBe('7 h');
    expect(formatTime(1990, ctx()).unit).toBe('h');
  });

  it('days band: shows days + hours, drops a zero hour unit', () => {
    expect(formatTime(500000, ctx()).display).toBe('62 d, 4 h'); // 500 h → 62 d 4 h
    expect(formatTime(2000000, ctx()).display).toBe('250 d'); // 2000 h / 8 = 250 d exactly
    expect(formatTime(500000, ctx()).unit).toBe('day');
    expect(formatTime(500000, ctx()).hours).toBe(500);
  });
});

describe('formatTime — band thresholds & carries', () => {
  it('keeps the exact 40 h workweek threshold in hours, tips just past it to days', () => {
    expect(formatTime(40000, ctx()).display).toBe('40 h'); // == threshold
    const past = formatTime(40001, ctx()); // 40.001 h → days, rounds to 40 h → 5 d 0 h
    expect(past.unit).toBe('day');
    expect(past.display).toBe('5 d');
  });

  it('carries 60 rounded minutes up to "1 h" rather than "60 min"', () => {
    // 999 / 1000 = 0.999 h = 59.94 min → rounds to 60 → escalates to the hours band.
    const r = formatTime(999, ctx());
    expect(r.display).toBe('1 h');
    expect(r.unit).toBe('h');
  });

  it('carries 60 rounded seconds up to "1 min" rather than "60 s"', () => {
    expect(formatTime(16.5, ctx()).display).toBe('59 s'); // 59.4 s → 59
    expect(formatTime(16.7, ctx()).display).toBe('1 min'); // 60.12 s → 60 → 1 min
  });
});

describe('formatTime — the discount-on-a-cheap-item case (precision)', () => {
  it('distinguishes a small price from its discounted price (both used to round to "1 min")', () => {
    const original = formatTime(16, ctx()); // 57.6 s
    const discounted = formatTime(12.8, ctx()); // -20% → 46.08 s
    expect(original.display).toBe('58 s');
    expect(discounted.display).toBe('46 s');
    expect(original.display).not.toBe(discounted.display); // the whole point of the change
  });
});

describe('formatTime — hourly rate drives the result', () => {
  it('same price, different rate → different time', () => {
    // 30000 Kč at 500 / 1000 / 1500 Kč/h = 60 / 30 / 20 h.
    const low = formatTime(30000, ctx({ netHourlyRateCzk: 500 }));
    expect(low.hours).toBe(60);
    expect(low.unit).toBe('day'); // 60 h > 40 h → 7 d 4 h
    expect(low.display).toBe('7 d, 4 h');

    expect(formatTime(30000, ctx({ netHourlyRateCzk: 1000 })).display).toBe('30 h');

    const high = formatTime(30000, ctx({ netHourlyRateCzk: 1500 }));
    expect(high.hours).toBe(20);
    expect(high.display).toBe('20 h');
  });
});

describe('formatTime — rounding setting is ignored (two units supply precision)', () => {
  it('every rounding mode yields the identical two-unit display', () => {
    const modes: Rounding[] = ['auto', 'tenths', 'whole'];
    for (const rounding of modes) {
      expect(formatTime(9000, ctx({ rounding })).display).toBe('9 h'); // no "9,0 h"
      expect(formatTime(1990, ctx({ rounding })).display).toBe('1 h, 59 min');
      expect(formatTime(500000, ctx({ rounding })).display).toBe('62 d, 4 h'); // no "62,5 d"
    }
  });
});

describe('formatTime — workday length moves the day threshold', () => {
  it('a shorter workday tips mid-range hours into days', () => {
    // 35 h: with an 8 h day (threshold 40 h) it is still hours…
    expect(formatTime(35000, ctx({ workdayHours: 8 })).display).toBe('35 h');
    // …with a 6 h day (threshold 30 h) it becomes days: 35 h = 5 workdays + 5 h.
    const sixHourDay = formatTime(35000, ctx({ workdayHours: 6 }));
    expect(sixHourDay.unit).toBe('day');
    expect(sixHourDay.display).toBe('5 d, 5 h');
  });

  it('falls back to 8 h / 5 day defaults when the context carries non-positive values', () => {
    // workdayHours 0 must not divide-by-zero; threshold falls back to 8 * 5 = 40 h.
    const r = formatTime(2000000, ctx({ workdayHours: 0, workweekDays: 0 }));
    expect(r.display).toBe('250 d'); // 2000 h / 8 = 250 d
  });
});

describe('formatTime — small and degenerate inputs', () => {
  it('shows "<1 s" for a positive price below one second', () => {
    const r = formatTime(0.01, ctx()); // 0.036 s → rounds to 0
    expect(r.display).toBe('<1 s');
    expect(r.unit).toBe('s');
  });

  it('shows "0 s" for a zero price', () => {
    const r = formatTime(0, ctx());
    expect(r.display).toBe('0 s');
    expect(r.hours).toBe(0);
  });

  it('is a no-op (empty display) when the rate is missing or non-positive', () => {
    for (const rate of [0, -50, Number.NaN]) {
      const r = formatTime(1000, ctx({ netHourlyRateCzk: rate }));
      expect(r.display).toBe('');
      expect(r.hours).toBe(0);
    }
  });

  it('is a no-op for a negative price', () => {
    expect(formatTime(-1, ctx()).display).toBe('');
  });
});

describe('formatTime — determinism', () => {
  it('returns an identical result for identical input', () => {
    const args: [number, ConversionContext] = [30000, ctx({ netHourlyRateCzk: 777 })];
    expect(formatTime(...args)).toStrictEqual(formatTime(...args));
  });
});

describe('converter registry', () => {
  it('exposes the time converter under its id and as the default', () => {
    expect(DEFAULT_CONVERTER_ID).toBe('time');
    expect(getConverter('time')).toBe(timeConverter);
    expect(getConverter('nope')).toBeUndefined();
    expect(listConverters()).toEqual([timeConverter]);
  });

  it('formatTime delegates to the time converter', () => {
    const c = ctx();
    expect(formatTime(30000, c)).toStrictEqual(timeConverter.convert(30000, c));
  });
});
