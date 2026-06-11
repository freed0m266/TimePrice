import { describe, expect, it } from 'vitest';

import { formatTimePreview } from '../../entrypoints/popup/format';

// Temporary inline preview formatter (TODO task05). These lock in the output contract —
// Czech decimal comma, min/h/d suffixes, workday-aware day scaling — so the eventual
// swap to the shared formatTime() can be checked against the same expectations.
describe('formatTimePreview', () => {
  const WORKDAY = 8;

  it('returns null when there is no usable rate', () => {
    expect(formatTimePreview(1000, null, WORKDAY)).toBeNull();
    expect(formatTimePreview(1000, 0, WORKDAY)).toBeNull();
    expect(formatTimePreview(1000, -50, WORKDAY)).toBeNull();
  });

  it('returns null for negative prices', () => {
    expect(formatTimePreview(-1, 1000, WORKDAY)).toBeNull();
  });

  it('shows whole minutes under an hour', () => {
    expect(formatTimePreview(99, 1000, WORKDAY)).toBe('6 min'); // 5.94 min → 6
    expect(formatTimePreview(0, 1000, WORKDAY)).toBe('0 min');
  });

  it('shows hours from one hour up to a workday', () => {
    expect(formatTimePreview(1000, 1000, WORKDAY)).toBe('1 h');
    expect(formatTimePreview(2500, 1000, WORKDAY)).toBe('2,5 h');
  });

  it('scales to days at and beyond a workday, using the Czech comma', () => {
    expect(formatTimePreview(8000, 1000, WORKDAY)).toBe('1 d'); // exactly one workday
    expect(formatTimePreview(30000, 1000, WORKDAY)).toBe('3,8 d'); // 3.75 d → 3,8
  });

  it('respects a custom workday length', () => {
    // 6000 / 1000 = 6 h; with a 6 h workday that is exactly one day.
    expect(formatTimePreview(6000, 1000, 6)).toBe('1 d');
  });

  it('falls back to an 8 h workday when given a non-positive one', () => {
    expect(formatTimePreview(8000, 1000, 0)).toBe('1 d');
  });
});
