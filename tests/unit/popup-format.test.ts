import { describe, expect, it } from 'vitest';

import { formatTimePreview } from '../../entrypoints/popup/format';
import type { AppSettings } from '../../src/settings/schema';

// `formatTimePreview` is now a thin adapter over the shared core converter
// (`src/core/convert`). These tests pin the popup-specific behaviour — the "no rate yet →
// null" guard and the settings→context mapping — and confirm the preview now scales by the
// same workweek threshold the content engine uses (e.g. 8 h reads as "8 h", not "1 d").
type RateSettings = Pick<AppSettings, 'workdayHours' | 'workweekDays' | 'rounding'>;
const settings = (overrides: Partial<RateSettings> = {}): RateSettings => ({
  workdayHours: 8,
  workweekDays: 5,
  rounding: 'auto',
  ...overrides,
});

describe('formatTimePreview', () => {
  it('returns null when there is no usable rate', () => {
    expect(formatTimePreview(1000, null, settings())).toBeNull();
    expect(formatTimePreview(1000, 0, settings())).toBeNull();
    expect(formatTimePreview(1000, -50, settings())).toBeNull();
  });

  it('returns null for negative prices', () => {
    expect(formatTimePreview(-1, 1000, settings())).toBeNull();
  });

  it('shows whole minutes under an hour', () => {
    expect(formatTimePreview(99, 1000, settings())).toBe('6 min'); // 5.94 min → 6
    expect(formatTimePreview(0, 1000, settings())).toBe('0 min');
  });

  it('shows hours across the whole workweek band', () => {
    expect(formatTimePreview(1000, 1000, settings())).toBe('1 h');
    // 8 h is one workday but still within a 40 h workweek → hours, not days.
    expect(formatTimePreview(8000, 1000, settings())).toBe('8 h');
    expect(formatTimePreview(30000, 1000, settings())).toBe('30 h');
  });

  it('scales to days past a workweek, using the Czech comma', () => {
    expect(formatTimePreview(500000, 1000, settings())).toBe('62,5 d'); // 500 h / 8
  });

  it('respects the rounding setting', () => {
    expect(formatTimePreview(9000, 1000, settings({ rounding: 'tenths' }))).toBe('9,0 h');
  });

  it('respects a custom workday length for the day threshold', () => {
    // 6 h workday → 30 h workweek; 35 h crosses it: 35 / 6 = 5.833 → "5,8 d".
    expect(formatTimePreview(35000, 1000, settings({ workdayHours: 6 }))).toBe('5,8 d');
  });
});
