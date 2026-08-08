export const VAULT_STORAGE_KEY = 'fch_vault';

// OWASP guidance for PBKDF2-SHA256. The v1 vault used 100_000.
export const PBKDF2_ITERATIONS = 600000;

/** v1: sealed directly by a PIN-derived key. v2: sealed by the DEK. */
export type Envelope = { v: 1 | 2; iv: string; data: string };

export type VaultSlot = {
  salt: string;
  iv: string;
  wrappedDek: string;
  iterations: number;
};

export type SlotName = 'pin' | 'recovery';

export type VaultDescriptor = {
  v: 2;
  slots: Partial<Record<SlotName, VaultSlot>>;
};
