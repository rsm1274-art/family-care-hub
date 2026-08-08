import { toBase64, fromBase64 } from './base64';
import {
  PBKDF2_ITERATIONS, VAULT_STORAGE_KEY,
  type VaultDescriptor, type VaultSlot,
} from './vaultTypes';

/** Extractable so it can be re-wrapped into new slots on PIN change. */
export const generateDek = (): Promise<CryptoKey> =>
  crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

export const deriveKek = async (
  secret: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> => {
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'PBKDF2' }, false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
};

export const wrapDek = async (dek: CryptoKey, secret: string): Promise<VaultSlot> => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const kek = await deriveKek(secret, salt, PBKDF2_ITERATIONS);
  const raw = await crypto.subtle.exportKey('raw', dek);
  const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, raw);

  return {
    salt: toBase64(salt),
    iv: toBase64(iv),
    wrappedDek: toBase64(new Uint8Array(wrapped)),
    iterations: PBKDF2_ITERATIONS,
  };
};

/** Throws on a wrong secret or tampered slot -- GCM authenticates. */
export const unwrapDek = async (slot: VaultSlot, secret: string): Promise<CryptoKey> => {
  const kek = await deriveKek(secret, fromBase64(slot.salt), slot.iterations);
  const raw = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(slot.iv) },
    kek,
    fromBase64(slot.wrappedDek),
  );
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
};

export const readVault = (): VaultDescriptor | null => {
  const raw = localStorage.getItem(VAULT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.v === 2 && typeof parsed.slots === 'object' ? (parsed as VaultDescriptor) : null;
  } catch {
    return null;
  }
};

export const writeVault = (descriptor: VaultDescriptor): void => {
  localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(descriptor));
};
