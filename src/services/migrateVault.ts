import { fromBase64 } from './base64';
import { generateDek, wrapDek, writeVault, readVault } from './vault';
import { generateRecoveryCode, normalizeRecoveryCode } from './recoveryCode';
import { cryptoService, LEGACY_SALT_KEY, LEGACY_VALIDATION_KEY } from './cryptoService';
import { isEncrypted } from './secureStorage';
import type { VaultDescriptor } from './vaultTypes';

export const needsMigration = (): boolean =>
  !!localStorage.getItem(LEGACY_VALIDATION_KEY) && readVault()?.slots.pin === undefined;

const deriveV1Key = async (pin: string): Promise<CryptoKey> => {
  const saltStr = localStorage.getItem(LEGACY_SALT_KEY);
  if (!saltStr) throw new Error('No legacy salt; cannot migrate.');
  const salt = new Uint8Array(saltStr.split(',').map(Number));

  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), { name: 'PBKDF2' }, false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
};

/**
 * All-or-nothing v1 -> v2 upgrade. Everything is decrypted into memory before
 * anything is written; a partial migration would strand records under a key
 * that is about to be discarded.
 */
export const migrateToV2 = async (pin: string, recordKeys: string[]): Promise<string> => {
  const v1Key = await deriveV1Key(pin);

  // Verify the PIN first so a wrong PIN is a clean throw before any mutation.
  const validationRaw = localStorage.getItem(LEGACY_VALIDATION_KEY);
  if (!validationRaw) throw new Error('No legacy vault to migrate.');
  const validation = JSON.parse(validationRaw);
  const check = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(validation.iv) },
    v1Key,
    new Uint8Array(validation.data),
  );
  if (new TextDecoder().decode(check) !== 'VALID') throw new Error('Incorrect PIN.');

  // Phase 1: read everything. Any failure here aborts before a single write.
  const plaintext = new Map<string, string>();
  for (const key of recordKeys) {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === '') continue;

    if (!isEncrypted(raw)) {
      plaintext.set(key, raw); // never encrypted; carry across as-is
      continue;
    }
    const envelope = JSON.parse(raw);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.iv) },
      v1Key,
      fromBase64(envelope.data),
    );
    plaintext.set(key, new TextDecoder().decode(decrypted));
  }

  // Phase 2: build the new vault.
  const dek = await generateDek();
  const recoveryCode = generateRecoveryCode();
  const descriptor: VaultDescriptor = {
    v: 2,
    slots: {
      pin: await wrapDek(dek, pin),
      recovery: await wrapDek(dek, normalizeRecoveryCode(recoveryCode)),
    },
  };

  // Phase 3: commit. The vault goes first, so a crash mid-write leaves a
  // usable key and re-encryptable records rather than records with no key.
  writeVault(descriptor);
  cryptoService.lock();
  if (!(await cryptoService.unlock(pin))) throw new Error('Migration produced an unusable vault.');

  for (const [key, value] of plaintext) {
    localStorage.setItem(key, await cryptoService.encrypt(value));
  }

  localStorage.removeItem(LEGACY_VALIDATION_KEY);
  localStorage.removeItem(LEGACY_SALT_KEY);

  return recoveryCode;
};
