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

describe('formatTime — auto-scaling unit selection', () => {
  it('shows minutes under one hour', () => {
    const r = formatTime(19, ctx()); // 0.019 h → 1.14 min
    expect(r.display).toBe('1 min');
    expect(r.unit).toBe('min');
    expect(r.hours).toBeCloseTo(0.019, 6);
  });

  it('rolls 60-rounded minutes up to "1 h" rather than "60 min"', () => {
    // 999 / 1000 = 0.999 h = 59.94 min → rounds to 60 → must escalate to hours.
    const r = formatTime(999, ctx());
    expect(r.display).toBe('1 h');
    expect(r.unit).toBe('h');
  });

  it('shows whole hours within the workweek band', () => {
    const r = formatTime(30000, ctx()); // 30 h ≤ 40 h
    expect(r.display).toBe('30 h');
    expect(r.unit).toBe('h');
    expect(r.hours).toBe(30);
  });

  it('keeps the exact threshold (40 h) in hours, tips just past it to days', () => {
    expect(formatTime(40000, ctx()).display).toBe('40 h'); // == threshold
    const past = formatTime(40001, ctx()); // 40.001 h → days
    expect(past.unit).toBe('day');
    expect(past.display).toBe('5 d'); // 40.001 / 8 = 5.0001 → 5,0 → "5"
  });

  it('scales large amounts to workdays with a Czech decimal comma', () => {
    const r = formatTime(500000, ctx()); // 500 h → 62.5 d
    expect(r.display).toBe('62,5 d');
    expect(r.unit).toBe('day');
    expect(r.hours).toBe(500);
  });

  it('drops a trailing ,0 on whole day counts', () => {
    expect(formatTime(2000000, ctx()).display).toBe('250 d'); // 2000 h / 8 = 250 d
  });
});

describe('formatTime — hourly rate drives the result', () => {
  it('same price, different rate → different time', () => {
    // 30000 Kč at 500 / 1000 / 1500 Kč/h = 60 / 30 / 20 h.
    const low = formatTime(30000, ctx({ netHourlyRateCzk: 500 }));
    expect(low.hours).toBe(60);
    expect(low.unit).toBe('day'); // 60 h > 40 h → 7.5 d
    expect(low.display).toBe('7,5 d');

    expect(formatTime(30000, ctx({ netHourlyRateCzk: 1000 })).display).toBe('30 h');

    const high = formatTime(30000, ctx({ netHourlyRateCzk: 1500 }));
    expect(high.hours).toBe(20);
    expect(high.display).toBe('20 h');
  });
});

describe('formatTime — rounding modes', () => {
  it('auto rounds hours to whole and half up', () => {
    expect(formatTime(9500, ctx({ rounding: 'auto' })).display).toBe('10 h'); // 9.5 → 10
    expect(formatTime(9000, ctx({ rounding: 'auto' })).display).toBe('9 h');
  });

  it('tenths always keeps one decimal, even a trailing zero', () => {
    expect(formatTime(9000, ctx({ rounding: 'tenths' })).display).toBe('9,0 h');
    expect(formatTime(9500, ctx({ rounding: 'tenths' })).display).toBe('9,5 h');
    expect(formatTime(500000, ctx({ rounding: 'tenths' })).display).toBe('62,5 d');
  });

  it('whole rounds both hours and days to integers', () => {
    expect(formatTime(9500, ctx({ rounding: 'whole' })).display).toBe('10 h');
    // 500 h / 8 = 62.5 d → rounds half up to 63.
    expect(formatTime(500000, ctx({ rounding: 'whole' })).display).toBe('63 d');
  });
});

describe('formatTime — workday length moves the day threshold', () => {
  it('a shorter workday tips mid-range hours into days', () => {
    // 35 h: with an 8 h day (threshold 40 h) it is still hours…
    expect(formatTime(35000, ctx({ workdayHours: 8 })).display).toBe('35 h');
    // …with a 6 h day (threshold 30 h) it becomes days: 35 / 6 = 5.833 → "5,8 d".
    const sixHourDay = formatTime(35000, ctx({ workdayHours: 6 }));
    expect(sixHourDay.unit).toBe('day');
    expect(sixHourDay.display).toBe('5,8 d');
  });

  it('falls back to 8 h / 5 day defaults when the context carries non-positive values', () => {
    // workdayHours 0 must not divide-by-zero; threshold falls back to 8 * 5 = 40 h.
    const r = formatTime(2000000, ctx({ workdayHours: 0, workweekDays: 0 }));
    expect(r.display).toBe('250 d'); // 2000 h / 8 = 250 d
  });
});

describe('formatTime — small and degenerate inputs', () => {
  it('shows "<1 min" for a positive price below one minute', () => {
    const r = formatTime(1, ctx()); // 0.001 h = 0.06 min → rounds to 0
    expect(r.display).toBe('<1 min');
    expect(r.unit).toBe('min');
  });

  it('shows "0 min" for a zero price', () => {
    const r = formatTime(0, ctx());
    expect(r.display).toBe('0 min');
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

  it('the time converter accepts every rounding mode', () => {
    const modes: Rounding[] = ['auto', 'tenths', 'whole'];
    for (const rounding of modes) {
      expect(formatTime(30000, ctx({ rounding })).display).toMatch(/\d/);
    }
  });
});
