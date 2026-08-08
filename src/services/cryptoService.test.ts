import { describe, it, expect, beforeEach } from 'vitest';
import { cryptoService } from './cryptoService';

describe('cryptoService', () => {
  beforeEach(() => {
    localStorage.clear();
    cryptoService.lock();
  });

  describe('PIN lifecycle', () => {
    it('reports not set up before a PIN exists', () => {
      expect(cryptoService.isSetup()).toBe(false);
    });

    it('reports set up after setupPin', async () => {
      await cryptoService.setupPin('123456');
      expect(cryptoService.isSetup()).toBe(true);
    });

    it('leaves the session unlocked immediately after setup', async () => {
      await cryptoService.setupPin('123456');
      expect(cryptoService.isUnlocked()).toBe(true);
    });

    it('never writes the PIN to storage', async () => {
      await cryptoService.setupPin('123456');
      const dump = JSON.stringify(localStorage);
      expect(dump).not.toContain('123456');
    });

    it('unlocks with the correct PIN', async () => {
      await cryptoService.setupPin('123456');
      cryptoService.lock();
      await expect(cryptoService.unlock('123456')).resolves.toBe(true);
      expect(cryptoService.isUnlocked()).toBe(true);
    });

    it('rejects an incorrect PIN and stays locked', async () => {
      await cryptoService.setupPin('123456');
      cryptoService.lock();
      await expect(cryptoService.unlock('654321')).resolves.toBe(false);
      expect(cryptoService.isUnlocked()).toBe(false);
    });

    it('lock() clears the in-memory key', async () => {
      await cryptoService.setupPin('123456');
      cryptoService.lock();
      expect(cryptoService.isUnlocked()).toBe(false);
    });
  });

  describe('encryption', () => {
    it('round-trips a payload', async () => {
      await cryptoService.setupPin('123456');
      const plaintext = JSON.stringify([{ id: '1', name: 'Ada', allergies: 'penicillin' }]);
      const sealed = await cryptoService.encrypt(plaintext);
      await expect(cryptoService.decrypt(sealed)).resolves.toBe(plaintext);
    });

    it('does not leave plaintext in the ciphertext', async () => {
      await cryptoService.setupPin('123456');
      const sealed = await cryptoService.encrypt('penicillin');
      expect(sealed).not.toContain('penicillin');
    });

    it('uses a fresh IV per call, so identical input differs', async () => {
      await cryptoService.setupPin('123456');
      const a = await cryptoService.encrypt('same');
      const b = await cryptoService.encrypt('same');
      expect(a).not.toBe(b);
    });

    it('refuses to encrypt while locked', async () => {
      await cryptoService.setupPin('123456');
      cryptoService.lock();
      await expect(cryptoService.encrypt('x')).rejects.toThrow(/locked/i);
    });

    it('refuses to decrypt while locked', async () => {
      await cryptoService.setupPin('123456');
      const sealed = await cryptoService.encrypt('x');
      cryptoService.lock();
      await expect(cryptoService.decrypt(sealed)).rejects.toThrow(/locked/i);
    });

    it('cannot decrypt data sealed under a different PIN', async () => {
      await cryptoService.setupPin('111111');
      const sealed = await cryptoService.encrypt('secret');

      localStorage.clear();
      cryptoService.lock();
      await cryptoService.setupPin('222222');

      await expect(cryptoService.decrypt(sealed)).rejects.toThrow();
    });

    it('rejects tampered ciphertext rather than returning garbage', async () => {
      await cryptoService.setupPin('123456');
      const sealed = await cryptoService.encrypt('secret');
      const envelope = JSON.parse(sealed);
      // Flip a byte in the base64 payload.
      const bytes = atob(envelope.data).split('');
      bytes[0] = String.fromCharCode(bytes[0].charCodeAt(0) ^ 0xff);
      envelope.data = btoa(bytes.join(''));

      await expect(cryptoService.decrypt(JSON.stringify(envelope))).rejects.toThrow();
    });

    it('encodes compactly, not as a byte array', async () => {
      await cryptoService.setupPin('123456');
      // 100 KB of photo-like base64. An Array.from(...).toString() encoding
      // would inflate this ~4x and threaten the localStorage quota.
      const payload = 'A'.repeat(100_000);
      const sealed = await cryptoService.encrypt(payload);
      expect(sealed.length).toBeLessThan(payload.length * 1.5);
    });
  });
});
