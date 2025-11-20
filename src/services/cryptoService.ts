// This service simulates the Zero-Knowledge architecture using Web Crypto API.
// In a real implementation, this would wrap the Key derivation logic.

const SALT_KEY = 'secure_health_salt';
const VALIDATION_KEY = 'secure_health_validation';

export const cryptoService = {
  // Derive a key from the PIN (PBKDF2 simulation of Argon2)
  deriveKey: async (pin: string, salt: Uint8Array): Promise<CryptoKey> => {
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      encoder.encode(pin),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );

    return window.crypto.subtle.deriveKey(
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
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    // Store salt strictly for derivation (not secret)
    localStorage.setItem(SALT_KEY, Array.from(salt).toString());

    // Create a validation token to check login success without storing PIN
    const key = await cryptoService.deriveKey(pin, salt);
    const validationData = new TextEncoder().encode("VALID");
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    const encryptedValidation = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      validationData
    );

    // Store IV and encrypted validation token
    localStorage.setItem(VALIDATION_KEY, JSON.stringify({
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encryptedValidation))
    }));
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

      const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        data
      );

      const result = new TextDecoder().decode(decrypted);
      return result === "VALID";
    } catch (e) {
      return false; // Decryption failed = Wrong PIN
    }
  },

  isSetup: (): boolean => {
    return !!localStorage.getItem(VALIDATION_KEY);
  }
};