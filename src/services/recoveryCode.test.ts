import { describe, it, expect } from 'vitest';
import { generateRecoveryCode, normalizeRecoveryCode, isValidRecoveryCode } from './recoveryCode';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

describe('recoveryCode', () => {
  it('formats as 8 groups of 4', () => {
    expect(generateRecoveryCode()).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){7}$/);
  });

  it('uses only Crockford base32 characters', () => {
    const code = generateRecoveryCode().replace(/-/g, '');
    for (const ch of code) expect(ALPHABET).toContain(ch);
  });

  it('does not repeat across calls', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateRecoveryCode()));
    expect(codes.size).toBe(50);
  });

  it('normalizes separators, case, and Crockford aliases', () => {
    const canonical = normalizeRecoveryCode('ABCD-EFGH-JKMN-PQRS-TVWX-YZ01-2345-6789');
    expect(normalizeRecoveryCode('abcd efgh jkmn pqrs tvwx yz01 2345 6789')).toBe(canonical);
    // I and L read as 1, O reads as 0.
    expect(normalizeRecoveryCode('IBCD-EFGH-JKMN-PQRS-TVWX-YZO1-2345-6789'))
      .toBe(normalizeRecoveryCode('1BCD-EFGH-JKMN-PQRS-TVWX-YZ01-2345-6789'));
  });

  it('round-trips its own output', () => {
    const code = generateRecoveryCode();
    expect(normalizeRecoveryCode(code)).toBe(code.replace(/-/g, ''));
    expect(isValidRecoveryCode(code)).toBe(true);
  });

  it('rejects wrong-length or out-of-alphabet input', () => {
    expect(isValidRecoveryCode('TOO-SHORT')).toBe(false);
    expect(isValidRecoveryCode('')).toBe(false);
    // U is excluded from Crockford base32.
    expect(isValidRecoveryCode('UBCD-EFGH-JKMN-PQRS-TVWX-YZ01-2345-6789')).toBe(false);
  });
});
