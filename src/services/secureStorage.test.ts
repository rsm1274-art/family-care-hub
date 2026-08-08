import { describe, it, expect, beforeEach } from 'vitest';
import { cryptoService, VAULT_KEYS } from './cryptoService';
import { loadSecure, saveSecure, isEncrypted } from './secureStorage';

const KEY = 'fch_secure_people';
const PEOPLE = [
  { id: '1', name: 'Ada', allergies: 'penicillin' },
  { id: '2', name: 'Grace', allergies: 'none' },
];

describe('secureStorage', () => {
  beforeEach(async () => {
    localStorage.clear();
    cryptoService.lock();
    await cryptoService.setupPin('123456');
  });

  it('returns the fallback when nothing is stored', async () => {
    await expect(loadSecure(KEY, [])).resolves.toEqual([]);
  });

  it('round-trips a value', async () => {
    await saveSecure(KEY, PEOPLE);
    await expect(loadSecure(KEY, [])).resolves.toEqual(PEOPLE);
  });

  it('writes ciphertext, not plaintext', async () => {
    await saveSecure(KEY, PEOPLE);
    const raw = localStorage.getItem(KEY) ?? '';
    expect(raw).not.toContain('penicillin');
    expect(raw).not.toContain('Ada');
    expect(isEncrypted(raw)).toBe(true);
  });

  describe('migration from the pre-encryption format', () => {
    it('reads legacy plaintext records', async () => {
      localStorage.setItem(KEY, JSON.stringify(PEOPLE));
      await expect(loadSecure(KEY, [])).resolves.toEqual(PEOPLE);
    });

    it('re-encrypts legacy records once they are saved back', async () => {
      localStorage.setItem(KEY, JSON.stringify(PEOPLE));
      expect(isEncrypted(localStorage.getItem(KEY) ?? '')).toBe(false);

      const migrated = await loadSecure<typeof PEOPLE>(KEY, []);
      await saveSecure(KEY, migrated);

      const raw = localStorage.getItem(KEY) ?? '';
      expect(isEncrypted(raw)).toBe(true);
      expect(raw).not.toContain('penicillin');
      await expect(loadSecure(KEY, [])).resolves.toEqual(PEOPLE);
    });
  });

  describe('backup and restore', () => {
    // Mirrors what App.handleBackup writes and PinPad's restore reads back:
    // clear everything, replay the backed-up keys, then unlock again.
    const backup = (keys: string[]) =>
      Object.fromEntries(keys.map((k) => [k, localStorage.getItem(k)]));

    const restore = (data: Record<string, string | null>) => {
      localStorage.clear();
      cryptoService.lock();
      for (const [k, v] of Object.entries(data)) {
        if (v !== null) localStorage.setItem(k, v);
      }
    };

    it('restores readable data when the vault keys are included', async () => {
      await saveSecure(KEY, PEOPLE);
      const file = backup([KEY, ...VAULT_KEYS]);

      restore(file);

      expect(await cryptoService.unlock('123456')).toBe(true);
      await expect(loadSecure(KEY, [])).resolves.toEqual(PEOPLE);
    });

    it('produces undecryptable data when the vault keys are omitted', async () => {
      await saveSecure(KEY, PEOPLE);
      const file = backup([KEY]); // the pre-encryption backup shape

      restore(file);

      // No salt or validation token survived, so the app falls back to setup
      // mode. A fresh PIN derives a different key and the records are lost.
      expect(cryptoService.isSetup()).toBe(false);
      await cryptoService.setupPin('123456');
      await expect(loadSecure(KEY, [])).rejects.toThrow();
    });
  });

  describe('failure handling', () => {
    // The whole point: a failed read must never be mistaken for "no data",
    // because the caller would then persist an empty list over real records.
    it('throws on tampered ciphertext instead of returning the fallback', async () => {
      await saveSecure(KEY, PEOPLE);
      const envelope = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      const bytes = atob(envelope.data).split('');
      bytes[0] = String.fromCharCode(bytes[0].charCodeAt(0) ^ 0xff);
      envelope.data = btoa(bytes.join(''));
      localStorage.setItem(KEY, JSON.stringify(envelope));

      await expect(loadSecure(KEY, [])).rejects.toThrow();
    });

    it('throws when the vault is locked rather than returning the fallback', async () => {
      await saveSecure(KEY, PEOPLE);
      cryptoService.lock();
      await expect(loadSecure(KEY, [])).rejects.toThrow(/locked/i);
    });

    it('refuses to save while locked', async () => {
      cryptoService.lock();
      await expect(saveSecure(KEY, PEOPLE)).rejects.toThrow(/locked/i);
    });
  });
});
