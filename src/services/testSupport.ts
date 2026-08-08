import { toBase64 } from './base64';
import { LEGACY_SALT_KEY, LEGACY_VALIDATION_KEY } from './cryptoService';

/**
 * Recreates a v1 vault byte-for-byte as the pre-DEK cryptoService wrote it:
 * a PIN-derived key at 100k PBKDF2 iterations, an encrypted "VALID" token
 * stored as number arrays, and records sealed as base64 v1 envelopes.
 *
 * Test-only. Imported by migrateVault.test.ts and App.test.tsx.
 */
export const seedV1Vault = async (
  pin: string,
  records: Record<string, unknown>,
): Promise<void> => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(LEGACY_SALT_KEY, Array.from(salt).toString());

  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), { name: 'PBKDF2' }, false, ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    material, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'],
  );

  const seal = async (value: unknown) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(value)),
    );
    return JSON.stringify({ v: 1, iv: toBase64(iv), data: toBase64(new Uint8Array(data)) });
  };

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const validation = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode('VALID'),
  );
  localStorage.setItem(LEGACY_VALIDATION_KEY, JSON.stringify({
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(validation)),
  }));

  for (const [k, v] of Object.entries(records)) localStorage.setItem(k, await seal(v));
};
