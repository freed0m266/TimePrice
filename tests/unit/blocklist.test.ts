import { describe, expect, it } from 'vitest';

import {
  BUILTIN_BLOCKLIST,
  BUILTIN_BLOCKLIST_SUFFIXES,
  isBuiltinBlocked,
} from '@/settings/blocklist';

describe('isBuiltinBlocked', () => {
  it('matches blocked registrable domains exactly', () => {
    expect(isBuiltinBlocked('csas.cz')).toBe(true); // bank
    expect(isBuiltinBlocked('paypal.com')).toBe(true); // payment gateway
    expect(isBuiltinBlocked('mojedane.cz')).toBe(true); // government
    expect(isBuiltinBlocked('portu.cz')).toBe(true); // broker
  });

  it('matches whole gov.cz namespace as a suffix', () => {
    expect(isBuiltinBlocked('gov.cz')).toBe(true);
    expect(isBuiltinBlocked('nia.gov.cz')).toBe(true);
    expect(isBuiltinBlocked('data.gov.cz')).toBe(true);
  });

  it('does not match a non-blocked domain or a lookalike of a blocked one', () => {
    expect(isBuiltinBlocked('alza.cz')).toBe(false);
    expect(isBuiltinBlocked('czc.cz')).toBe(false);
    // A different registrable domain that merely contains a blocked label must not match.
    expect(isBuiltinBlocked('notgov.cz')).toBe(false);
    expect(isBuiltinBlocked('mojedane.com')).toBe(false);
  });

  it('returns false for the empty domain', () => {
    expect(isBuiltinBlocked('')).toBe(false);
  });

  it('keeps the exported lists consistent and non-empty', () => {
    expect(BUILTIN_BLOCKLIST.length).toBeGreaterThan(0);
    expect(BUILTIN_BLOCKLIST_SUFFIXES).toContain('gov.cz');
    // No accidental duplicates in the exact list.
    expect(new Set(BUILTIN_BLOCKLIST).size).toBe(BUILTIN_BLOCKLIST.length);
  });
});
