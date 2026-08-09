// Local-only vault. A random 256-bit DEK encrypts every record; the DEK is
// stored twice over, wrapped once by a key derived from the PIN and once by a
// key derived from the 160-bit recovery code. Changing the PIN re-wraps the
// DEK rather than re-encrypting records, so it is instant.
//
// The DEK lives in memory for the session only and is never persisted. There
// is no recovery path beyond the recovery code by design: nothing leaves this
// device, so there is no server to ask.

import { toBase64, fromBase64 } from './base64';
import { generateDek, wrapDek, unwrapDek, readVault, writeVault } from './vault';
import { generateRecoveryCode, normalizeRecoveryCode } from './recoveryCode';
import { VAULT_STORAGE_KEY, type VaultDescriptor } from './vaultTypes';

// Legacy v1 keys. Retained so isSetup() and the migration can detect old vaults.
export const LEGACY_SALT_KEY = 'secure_health_salt';
export const LEGACY_VALIDATION_KEY = 'secure_health_validation';

// A backup must carry these or the restored ciphertext is undecryptable.
// None is secret: the salt is public by design, the v1 validation token is
// itself encrypted, and the vault descriptor holds only wrapped keys.
export const VAULT_KEYS = [VAULT_STORAGE_KEY, LEGACY_SALT_KEY, LEGACY_VALIDATION_KEY];

// In-memory only; lost on reload, so every session starts at the PIN prompt.
let sessionDek: CryptoKey | null = null;

const requireUnlocked = (action: string): CryptoKey => {
  if (!sessionDek) throw new Error(`Vault is locked; cannot ${action}.`);
  return sessionDek;
};

export const cryptoService = {
  /** Creates the vault and returns the recovery code. Shown once, never stored. */
  setupPin: async (pin: string): Promise<string> => {
    const dek = await generateDek();
    const recoveryCode = generateRecoveryCode();

    const descriptor: VaultDescriptor = {
      v: 2,
      slots: {
        pin: await wrapDek(dek, pin),
        recovery: await wrapDek(dek, normalizeRecoveryCode(recoveryCode)),
      },
    };
    writeVault(descriptor);

    // Setup leaves the vault open so the first session can write immediately.
    sessionDek = dek;
    return recoveryCode;
  },

  unlock: async (pin: string): Promise<boolean> => {
    const slot = readVault()?.slots.pin;
    if (!slot) return false;
    try {
      sessionDek = await unwrapDek(slot, pin);
      return true;
    } catch {
      return false; // wrong PIN
    }
  },

  unlockWithRecovery: async (code: string): Promise<boolean> => {
    const slot = readVault()?.slots.recovery;
    if (!slot) return false;
    try {
      sessionDek = await unwrapDek(slot, normalizeRecoveryCode(code));
      return true;
    } catch {
      return false; // wrong code
    }
  },

  // Re-wraps the DEK only. Records are never touched, so this stays instant
  // even with megabytes of medication photos stored.
  changePin: async (newPin: string): Promise<void> => {
    const dek = requireUnlocked('change the PIN');
    const descriptor = readVault();
    if (!descriptor) throw new Error('No vault to update.');
    writeVault({ ...descriptor, slots: { ...descriptor.slots, pin: await wrapDek(dek, newPin) } });
  },

  regenerateRecoveryCode: async (): Promise<string> => {
    const dek = requireUnlocked('regenerate the recovery code');
    const descriptor = readVault();
    if (!descriptor) throw new Error('No vault to update.');
    const code = generateRecoveryCode();
    writeVault({
      ...descriptor,
      slots: { ...descriptor.slots, recovery: await wrapDek(dek, normalizeRecoveryCode(code)) },
    });
    return code;
  },

  lock: (): void => {
    sessionDek = null;
  },

  isUnlocked: (): boolean => sessionDek !== null,

  // The legacy check is included so a v1 user is not dropped into setup mode
  // and left unable to reach their data.
  isSetup: (): boolean =>
    readVault()?.slots.pin !== undefined || !!localStorage.getItem(LEGACY_VALIDATION_KEY),

  encrypt: async (plaintext: string): Promise<string> => {
    const dek = requireUnlocked('encrypt');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const sealed = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, dek, new TextEncoder().encode(plaintext),
    );
    return JSON.stringify({ v: 2, iv: toBase64(iv), data: toBase64(new Uint8Array(sealed)) });
  },

  // Throws on a wrong key or tampered payload -- GCM authenticates, so this
  // never silently returns garbage. Callers must treat a throw as "do not
  // overwrite what is on disk".
  decrypt: async (sealed: string): Promise<string> => {
    const dek = requireUnlocked('decrypt');
    const envelope = JSON.parse(sealed);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.iv) }, dek, fromBase64(envelope.data),
    );
    return new TextDecoder().decode(plaintext);
  },
};
