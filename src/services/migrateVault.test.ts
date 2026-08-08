import { describe, it, expect, beforeEach } from 'vitest';
import { needsMigration, migrateToV2 } from './migrateVault';
import { cryptoService, LEGACY_SALT_KEY, LEGACY_VALIDATION_KEY } from './cryptoService';
import { readVault } from './vault';
import { seedV1Vault } from './testSupport';

const KEY = 'fch_secure_people';
const PEOPLE = [{ id: '1', name: 'Ada', allergies: 'penicillin' }];

describe('migrateVault', () => {
  beforeEach(() => {
    localStorage.clear();
    cryptoService.lock();
  });

  it('detects a v1 vault', async () => {
    expect(needsMigration()).toBe(false);
    await seedV1Vault('123456', { [KEY]: PEOPLE });
    expect(needsMigration()).toBe(true);
  });

  it('migrates records and returns a recovery code', async () => {
    await seedV1Vault('123456', { [KEY]: PEOPLE });

    const code = await migrateToV2('123456', [KEY]);
    expect(code).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){7}$/);

    expect(readVault()!.slots.pin).toBeTruthy();
    expect(localStorage.getItem(LEGACY_VALIDATION_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_SALT_KEY)).toBeNull();
    expect(needsMigration()).toBe(false);

    expect(JSON.parse(localStorage.getItem(KEY)!).v).toBe(2);
    expect(cryptoService.isUnlocked()).toBe(true);
    expect(JSON.parse(await cryptoService.decrypt(localStorage.getItem(KEY)!))).toEqual(PEOPLE);
  });

  it('unlocks with the new recovery code afterwards', async () => {
    await seedV1Vault('123456', { [KEY]: PEOPLE });
    const code = await migrateToV2('123456', [KEY]);
    cryptoService.lock();
    expect(await cryptoService.unlockWithRecovery(code)).toBe(true);
  });

  it('leaves everything untouched when the PIN is wrong', async () => {
    await seedV1Vault('123456', { [KEY]: PEOPLE });
    const before = localStorage.getItem(KEY);

    await expect(migrateToV2('654321', [KEY])).rejects.toThrow();

    expect(localStorage.getItem(KEY)).toBe(before);
    expect(localStorage.getItem(LEGACY_VALIDATION_KEY)).toBeTruthy();
    expect(readVault()).toBeNull();
  });

  it('is all-or-nothing when one record is corrupt', async () => {
    await seedV1Vault('123456', { [KEY]: PEOPLE, 'fch_secure_meds': [] });
    localStorage.setItem('fch_secure_meds', JSON.stringify({ v: 1, iv: 'AAAAAAAAAAAAAAAA', data: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAA' }));
    const before = localStorage.getItem(KEY);

    await expect(migrateToV2('123456', [KEY, 'fch_secure_meds'])).rejects.toThrow();

    expect(localStorage.getItem(KEY)).toBe(before);
    expect(readVault()).toBeNull();
  });

  it('migrates pre-encryption plaintext records too', async () => {
    await seedV1Vault('123456', {});
    localStorage.setItem(KEY, JSON.stringify(PEOPLE)); // never encrypted at all

    await migrateToV2('123456', [KEY]);

    expect(JSON.parse(localStorage.getItem(KEY)!).v).toBe(2);
    expect(JSON.parse(await cryptoService.decrypt(localStorage.getItem(KEY)!))).toEqual(PEOPLE);
  });
});
