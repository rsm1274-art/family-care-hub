import { describe, it, expect, beforeEach } from 'vitest';
import { generateDek, wrapDek, unwrapDek, readVault, writeVault } from './vault';
import { VAULT_STORAGE_KEY, PBKDF2_ITERATIONS } from './vaultTypes';

const exportKey = async (key: CryptoKey) =>
  Array.from(new Uint8Array(await crypto.subtle.exportKey('raw', key)));

describe('vault', () => {
  beforeEach(() => localStorage.clear());

  it('generates a 256-bit AES-GCM key', async () => {
    expect(await exportKey(await generateDek())).toHaveLength(32);
  });

  it('generates a different DEK each time', async () => {
    expect(await exportKey(await generateDek()))
      .not.toEqual(await exportKey(await generateDek()));
  });

  it('unwraps to the identical DEK with the right secret', async () => {
    const dek = await generateDek();
    const slot = await wrapDek(dek, '123456');
    expect(await exportKey(await unwrapDek(slot, '123456'))).toEqual(await exportKey(dek));
  });

  it('throws on the wrong secret', async () => {
    const slot = await wrapDek(await generateDek(), '123456');
    await expect(unwrapDek(slot, '654321')).rejects.toThrow();
  });

  it('records the iteration count and a fresh salt per slot', async () => {
    const dek = await generateDek();
    const a = await wrapDek(dek, '123456');
    const b = await wrapDek(dek, '123456');
    expect(a.iterations).toBe(PBKDF2_ITERATIONS);
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
  });

  it('wraps one DEK into two slots that both unwrap to it', async () => {
    const dek = await generateDek();
    const pin = await wrapDek(dek, '123456');
    const recovery = await wrapDek(dek, 'ABCDEFGHJKMNPQRSTVWXYZ0123456789');
    expect(await exportKey(await unwrapDek(pin, '123456')))
      .toEqual(await exportKey(await unwrapDek(recovery, 'ABCDEFGHJKMNPQRSTVWXYZ0123456789')));
  });

  it('does not leak the secret into the slot', async () => {
    const slot = await wrapDek(await generateDek(), '123456');
    expect(JSON.stringify(slot)).not.toContain('123456');
  });

  it('reads back what it writes, and null when absent', () => {
    expect(readVault()).toBeNull();
    const descriptor = { v: 2 as const, slots: {} };
    writeVault(descriptor);
    expect(readVault()).toEqual(descriptor);
    expect(localStorage.getItem(VAULT_STORAGE_KEY)).toBeTruthy();
  });

  it('returns null for a corrupt descriptor rather than throwing', () => {
    localStorage.setItem(VAULT_STORAGE_KEY, 'not json');
    expect(readVault()).toBeNull();
  });
});
