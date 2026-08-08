import { cryptoService } from './cryptoService';

// Records written before encryption existed are plain JSON arrays. Records
// written since are envelopes produced by cryptoService.encrypt. Telling them
// apart lets the first unlock after the update migrate transparently.
export const isEncrypted = (raw: string): boolean => {
  try {
    const parsed = JSON.parse(raw);
    return (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      (parsed.v === 1 || parsed.v === 2) &&
      typeof parsed.iv === 'string' &&
      typeof parsed.data === 'string'
    );
  } catch {
    return false;
  }
};

/**
 * Read a value written by saveSecure, transparently upgrading pre-encryption
 * records.
 *
 * Throws if the vault is locked or the payload fails authentication. That is
 * deliberate: callers persist whatever this returns, so answering "no data"
 * on a failed read would overwrite intact records with an empty list.
 */
export const loadSecure = async <T>(key: string, fallback: T): Promise<T> => {
  const raw = localStorage.getItem(key);
  if (raw === null || raw === '') return fallback;

  if (!isEncrypted(raw)) {
    // Legacy plaintext. Returned as-is; the caller's next save seals it.
    return JSON.parse(raw) as T;
  }

  return JSON.parse(await cryptoService.decrypt(raw)) as T;
};

// Split from the write so callers can encrypt, then discard the result if a
// newer save has superseded it, rather than racing stale data onto disk.
export const sealSecure = async (value: unknown): Promise<string> =>
  cryptoService.encrypt(JSON.stringify(value));

export const commitSealed = (key: string, sealed: string): void => {
  localStorage.setItem(key, sealed);
};

export const saveSecure = async (key: string, value: unknown): Promise<void> => {
  commitSealed(key, await sealSecure(value));
};
