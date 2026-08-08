import { describe, it, expect } from 'vitest';
import { toBase64, fromBase64 } from './base64';

describe('base64', () => {
  it('round-trips bytes', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255]);
    expect(Array.from(fromBase64(toBase64(bytes)))).toEqual([0, 1, 127, 128, 255]);
  });

  it('round-trips an empty array', () => {
    expect(fromBase64(toBase64(new Uint8Array([])))).toHaveLength(0);
  });

  it('handles payloads larger than the argument limit', () => {
    // Well past the 0x8000 chunk size used by toBase64. Filled in 64KB slices
    // because crypto.getRandomValues rejects requests over 65,536 bytes.
    const bytes = new Uint8Array(200_000);
    for (let i = 0; i < bytes.length; i += 65_536) {
      crypto.getRandomValues(bytes.subarray(i, Math.min(i + 65_536, bytes.length)));
    }
    expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes));
  });

  it('encodes compactly rather than as a byte array', () => {
    const bytes = new Uint8Array(1000);
    expect(toBase64(bytes).length).toBeLessThan(bytes.length * 1.5);
  });
});
