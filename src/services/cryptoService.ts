// Local-only vault. The AES-256-GCM key is derived from the user's PIN via
// PBKDF2 and held in memory for the session only -- it is never persisted.
// There is no recovery path by design: lose the PIN and the data is
// permanently unreadable, which is what the PinPad "NO RECOVERY" notice means.

import { toBase64, fromBase64 } from './base64';

const SALT_KEY = 'secure_health_salt';
const VALIDATION_KEY = 'secure_health_validation';

// A backup must carry these or the restored ciphertext is undecryptable: a new
// PIN generates a new salt, hence a different key. Neither is secret -- the
// salt is public by design and the validation token is itself encrypted.
export const VAULT_KEYS = [SALT_KEY, VALIDATION_KEY];

// In-memory only. Cleared by lock() and lost on reload, so every session
// starts at the PIN prompt.
let sessionKey: CryptoKey | null = null;

export const cryptoService = {
  // Derive an AES-GCM key from the PIN. 100k PBKDF2 iterations over SHA-256.
  deriveKey: async (pin: string, salt: Uint8Array): Promise<CryptoKey> => {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(pin),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  },

  // Setup a new PIN
  setupPin: async (pin: string): Promise<void> => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    // Store salt strictly for derivation (not secret)
    localStorage.setItem(SALT_KEY, Array.from(salt).toString());

    // Create a validation token to check login success without storing PIN
    const key = await cryptoService.deriveKey(pin, salt);
    const validationData = new TextEncoder().encode("VALID");
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedValidation = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      validationData
    );

    // Store IV and encrypted validation token
    localStorage.setItem(VALIDATION_KEY, JSON.stringify({
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encryptedValidation))
    }));

    // Setup leaves the vault open so the first session can write immediately.
    sessionKey = key;
  },

  // Validate PIN
  unlock: async (pin: string): Promise<boolean> => {
    const saltStr = localStorage.getItem(SALT_KEY);
    const validationStr = localStorage.getItem(VALIDATION_KEY);

    if (!saltStr || !validationStr) return false;

    try {
      const salt = new Uint8Array(saltStr.split(',').map(Number));
      const validation = JSON.parse(validationStr);
      const iv = new Uint8Array(validation.iv);
      const data = new Uint8Array(validation.data);

      const key = await cryptoService.deriveKey(pin, salt);

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        data
      );

      const result = new TextDecoder().decode(decrypted);
      if (result !== "VALID") return false;

      sessionKey = key;
      return true;
    } catch {
      return false; // Decryption failed = Wrong PIN
    }
  },

  // Drop the in-memory key. Data on disk stays encrypted and unreadable.
  lock: (): void => {
    sessionKey = null;
  },

  isUnlocked: (): boolean => sessionKey !== null,

  isSetup: (): boolean => {
    return !!localStorage.getItem(VALIDATION_KEY);
  },

  encrypt: async (plaintext: string): Promise<string> => {
    if (!sessionKey) throw new Error('Vault is locked; cannot encrypt.');

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const sealed = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      sessionKey,
      new TextEncoder().encode(plaintext)
    );

    return JSON.stringify({
      v: 1,
      iv: toBase64(iv),
      data: toBase64(new Uint8Array(sealed)),
    });
  },

  // Throws on a wrong key or tampered payload -- GCM authenticates, so this
  // never silently returns garbage. Callers must treat a throw as "do not
  // overwrite what is on disk".
  decrypt: async (sealed: string): Promise<string> => {
    if (!sessionKey) throw new Error('Vault is locked; cannot decrypt.');

    const envelope = JSON.parse(sealed);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.iv) },
      sessionKey,
      fromBase64(envelope.data)
    );

    return new TextDecoder().decode(plaintext);
  },
};
