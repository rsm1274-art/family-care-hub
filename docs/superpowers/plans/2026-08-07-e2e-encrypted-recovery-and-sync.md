# End-to-End Encrypted Recovery & Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Family Care Hub users a recovery path for a forgotten PIN and multi-device recoverable data, without ever letting the server read a medical record.

**Architecture:** Records stop being encrypted directly by a PIN-derived key. A random 256-bit Data Encryption Key (DEK) encrypts all records; the DEK is stored several times over, each copy wrapped by a different Key Encryption Key (KEK). `KEK_pin` is derived from the 6-digit PIN and never leaves the device. `KEK_recovery` is derived from a 160-bit recovery code shown once at setup, and its wrapped copy is safe to sync. Firestore stores record ciphertext plus the recovery slot only, so a short PIN is never remotely brute-forceable.

**Tech Stack:** TypeScript, React 19, Vite 6, Web Crypto (PBKDF2 + AES-GCM), Firebase Auth + Firestore, vitest + @testing-library/react, happy-dom.

## Global Constraints

- The server must never be able to decrypt a record. No plaintext, no DEK, and no PIN-wrapped material may be written to Firestore.
- `KEK_pin` material (the `pin` slot) is **device-local only**. A 6-digit PIN is ~20 bits of entropy and is brute-forceable in about a minute on one GPU if its wrapped DEK is ever obtainable offline.
- PBKDF2-SHA256 at **600,000 iterations** for all new KEK derivations (current OWASP guidance). The legacy v1 vault used 100,000; migration must not silently keep the old figure.
- All random values come from `crypto.getRandomValues`. Never `Math.random`.
- AES-GCM only, 256-bit keys, a fresh 12-byte IV per encryption. Never reuse an IV under the same key.
- All binary values are stored base64, never `Array.from(bytes).toString()`. Medication photos are already base64; a byte-array encoding inflates payloads ~4x against a ~5MB `localStorage` quota.
- A failed decrypt must **throw**, never return a fallback. Callers persist what they read, so answering "no data" on a failed read overwrites intact records. See `src/App.test.tsx` → "does not overwrite records it failed to decrypt".
- Every envelope and vault descriptor carries a numeric `v` field. Never change a stored shape without bumping it and providing a migration.
- Existing behaviour that must not regress: `npm test` (28 tests) and `npm run build` (`tsc -b && vite build`) both pass.

## Phase Boundaries

The three phases are sequentially dependent, not independent subsystems, so they share one plan. Each phase still ends with working, shippable software and is a natural review-and-stop point:

- **Phase 1 (Tasks 1–5)** — DEK/KEK vault + v1→v2 migration. Ships local encryption with instant PIN change. No Firebase.
- **Phase 2 (Tasks 6–8)** — Recovery code generation, display, and unlock-by-recovery. Ships forgotten-PIN recovery. Still no Firebase.
- **Phase 3 (Tasks 9–12)** — Firebase Auth, Firestore schema and rules, encrypted sync.

## File Structure

| File | Responsibility |
|---|---|
| `src/services/vaultTypes.ts` (create) | Shared vault/envelope types and version constants. No logic. |
| `src/services/base64.ts` (create) | `toBase64` / `fromBase64`, extracted from `cryptoService` so vault and sync can share them. |
| `src/services/recoveryCode.ts` (create) | Generate, format, and normalize the 160-bit recovery code. |
| `src/services/vault.ts` (create) | DEK generation, KEK derivation, slot wrap/unwrap, descriptor read/write. |
| `src/services/migrateVault.ts` (create) | One-way v1 → v2 upgrade. |
| `src/services/cryptoService.ts` (modify) | Session DEK holder. Public surface stays `setupPin`/`unlock`/`lock`/`isUnlocked`/`isSetup`/`encrypt`/`decrypt`, plus new `changePin`/`unlockWithRecovery`. |
| `src/services/secureStorage.ts` (modify) | Unchanged API; `isEncrypted` accepts v1 and v2 envelopes. |
| `src/components/RecoveryCodeModal.tsx` (create) | Shows the code once, requires explicit confirmation. |
| `src/components/RecoverAccess.tsx` (create) | Recovery-code entry and new-PIN flow. |
| `src/services/sync/firebaseApp.ts` (create) | Firebase initialization from env vars. |
| `src/services/sync/vaultSync.ts` (create) | Push/pull of ciphertext + recovery slot. |
| `firestore.rules` (create) | Per-user access rules. |

---

## Phase 1 — DEK/KEK Vault

### Task 1: Extract base64 helpers and shared types

**Files:**
- Create: `src/services/base64.ts`
- Create: `src/services/vaultTypes.ts`
- Modify: `src/services/cryptoService.ts` (remove its private `toBase64`/`fromBase64`, import instead)
- Test: `src/services/base64.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `toBase64(bytes: Uint8Array): string`
  - `fromBase64(value: string): Uint8Array`
  - `type Envelope = { v: 1 | 2; iv: string; data: string }`
  - `type VaultSlot = { salt: string; iv: string; wrappedDek: string; iterations: number }`
  - `type SlotName = 'pin' | 'recovery'`
  - `type VaultDescriptor = { v: 2; slots: Partial<Record<SlotName, VaultSlot>> }`
  - `const VAULT_STORAGE_KEY = 'fch_vault'`
  - `const PBKDF2_ITERATIONS = 600000`

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/base64.test.ts
import { describe, it, expect } from 'vitest';
import { toBase64, fromBase64 } from './base64';

describe('base64', () => {
  it('round-trips bytes', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255]);
    expect(Array.from(fromBase64(toBase64(bytes)))).toEqual([0, 1, 127, 128, 255]);
  });

  it('round-trips an empty array', () => {
    expect(fromBase64(toBase64(new Uint8Array([])))).toHaveLength(0);
  });

  it('handles payloads larger than the argument limit', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(200_000));
    expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes));
  });

  it('encodes compactly rather than as a byte array', () => {
    const bytes = new Uint8Array(1000);
    expect(toBase64(bytes).length).toBeLessThan(bytes.length * 1.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/base64.test.ts`
Expected: FAIL — `Failed to resolve import "./base64"`.

- [ ] **Step 3: Create the modules**

```typescript
// src/services/base64.ts
export const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  // Chunked to stay under the spread-argument limit on large payloads.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
};

export const fromBase64 = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};
```

```typescript
// src/services/vaultTypes.ts
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
```

- [ ] **Step 4: Point cryptoService at the shared helpers**

In `src/services/cryptoService.ts`, delete the local `toBase64` and `fromBase64` definitions and add at the top:

```typescript
import { toBase64, fromBase64 } from './base64';
```

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — 32 tests (28 existing + 4 new). The existing crypto tests still pass because behaviour is unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/services/base64.ts src/services/base64.test.ts src/services/vaultTypes.ts src/services/cryptoService.ts
git commit -m "refactor: extract base64 helpers and shared vault types"
```

---

### Task 2: Recovery code generation and normalization

**Files:**
- Create: `src/services/recoveryCode.ts`
- Test: `src/services/recoveryCode.test.ts`

**Interfaces:**
- Consumes: `toBase64` (unused here, but `base64.ts` must exist for module resolution in later tasks).
- Produces:
  - `generateRecoveryCode(): string` — returns 32 Crockford-base32 chars grouped as `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX` (160 bits).
  - `normalizeRecoveryCode(input: string): string` — strips separators, uppercases, maps Crockford aliases (`I`/`L`→`1`, `O`→`0`), returns 32 chars.
  - `isValidRecoveryCode(input: string): boolean`

Crockford base32 is used because it excludes `I`, `L`, `O`, `U` — the characters users misread when copying a code off paper.

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/recoveryCode.test.ts
import { describe, it, expect } from 'vitest';
import { generateRecoveryCode, normalizeRecoveryCode, isValidRecoveryCode } from './recoveryCode';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

describe('recoveryCode', () => {
  it('formats as 8 groups of 4', () => {
    expect(generateRecoveryCode()).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){7}$/);
  });

  it('uses only Crockford base32 characters', () => {
    const code = generateRecoveryCode().replace(/-/g, '');
    for (const ch of code) expect(ALPHABET).toContain(ch);
  });

  it('does not repeat across calls', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateRecoveryCode()));
    expect(codes.size).toBe(50);
  });

  it('normalizes separators, case, and Crockford aliases', () => {
    const canonical = normalizeRecoveryCode('ABCD-EFGH-JKMN-PQRS-TVWX-YZ01-2345-6789');
    expect(normalizeRecoveryCode('abcd efgh jkmn pqrs tvwx yz01 2345 6789')).toBe(canonical);
    // I and L read as 1, O reads as 0.
    expect(normalizeRecoveryCode('IBCD-EFGH-JKMN-PQRS-TVWX-YZO1-2345-6789'))
      .toBe(normalizeRecoveryCode('1BCD-EFGH-JKMN-PQRS-TVWX-YZ01-2345-6789'));
  });

  it('round-trips its own output', () => {
    const code = generateRecoveryCode();
    expect(normalizeRecoveryCode(code)).toBe(code.replace(/-/g, ''));
    expect(isValidRecoveryCode(code)).toBe(true);
  });

  it('rejects wrong-length or out-of-alphabet input', () => {
    expect(isValidRecoveryCode('TOO-SHORT')).toBe(false);
    expect(isValidRecoveryCode('')).toBe(false);
    // U is excluded from Crockford base32.
    expect(isValidRecoveryCode('UBCD-EFGH-JKMN-PQRS-TVWX-YZ01-2345-6789')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/recoveryCode.test.ts`
Expected: FAIL — `Failed to resolve import "./recoveryCode"`.

- [ ] **Step 3: Implement**

```typescript
// src/services/recoveryCode.ts

// Crockford base32: no I, L, O or U, which are the characters users misread
// when transcribing a code from paper.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_CHARS = 32; // 32 chars x 5 bits = 160 bits of entropy
const GROUP = 4;

export const generateRecoveryCode = (): string => {
  // One random byte per character, rejection-free: 256 is not a multiple of 32,
  // so mask to 5 bits instead of taking a biased modulo.
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_CHARS));
  let out = '';
  for (let i = 0; i < CODE_CHARS; i++) out += ALPHABET[bytes[i] & 0x1f];

  const groups: string[] = [];
  for (let i = 0; i < out.length; i += GROUP) groups.push(out.slice(i, i + GROUP));
  return groups.join('-');
};

export const normalizeRecoveryCode = (input: string): string =>
  input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');

export const isValidRecoveryCode = (input: string): boolean => {
  const normalized = normalizeRecoveryCode(input);
  if (normalized.length !== CODE_CHARS) return false;
  return [...normalized].every((ch) => ALPHABET.includes(ch));
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/recoveryCode.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/recoveryCode.ts src/services/recoveryCode.test.ts
git commit -m "feat: add 160-bit Crockford base32 recovery codes"
```

---

### Task 3: Vault key wrapping

**Files:**
- Create: `src/services/vault.ts`
- Test: `src/services/vault.test.ts`

**Interfaces:**
- Consumes: `toBase64`/`fromBase64` (Task 1), `VaultSlot`/`VaultDescriptor`/`SlotName`/`VAULT_STORAGE_KEY`/`PBKDF2_ITERATIONS` (Task 1).
- Produces:
  - `generateDek(): Promise<CryptoKey>` — extractable AES-GCM 256 key.
  - `deriveKek(secret: string, salt: Uint8Array, iterations: number): Promise<CryptoKey>`
  - `wrapDek(dek: CryptoKey, secret: string): Promise<VaultSlot>`
  - `unwrapDek(slot: VaultSlot, secret: string): Promise<CryptoKey>` — throws on wrong secret.
  - `readVault(): VaultDescriptor | null`
  - `writeVault(descriptor: VaultDescriptor): void`

The DEK must be created **extractable** so it can be re-wrapped into new slots on PIN change. That is the whole point of the indirection: re-wrapping a 32-byte key is instant, whereas re-keying every record and photo is not.

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/vault.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateDek, wrapDek, unwrapDek, readVault, writeVault,
} from './vault';
import { VAULT_STORAGE_KEY, PBKDF2_ITERATIONS } from './vaultTypes';

const exportKey = async (key: CryptoKey) =>
  Array.from(new Uint8Array(await crypto.subtle.exportKey('raw', key)));

describe('vault', () => {
  beforeEach(() => localStorage.clear());

  it('generates a 256-bit AES-GCM key', async () => {
    expect(await exportKey(await generateDek())).toHaveLength(32);
  });

  it('generates a different DEK each time', async () => {
    expect(await exportKey(await generateDek()))
      .not.toEqual(await exportKey(await generateDek()));
  });

  it('unwraps to the identical DEK with the right secret', async () => {
    const dek = await generateDek();
    const slot = await wrapDek(dek, '123456');
    expect(await exportKey(await unwrapDek(slot, '123456'))).toEqual(await exportKey(dek));
  });

  it('throws on the wrong secret', async () => {
    const slot = await wrapDek(await generateDek(), '123456');
    await expect(unwrapDek(slot, '654321')).rejects.toThrow();
  });

  it('records the iteration count and a fresh salt per slot', async () => {
    const dek = await generateDek();
    const a = await wrapDek(dek, '123456');
    const b = await wrapDek(dek, '123456');
    expect(a.iterations).toBe(PBKDF2_ITERATIONS);
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
  });

  it('wraps one DEK into two slots that both unwrap to it', async () => {
    const dek = await generateDek();
    const pin = await wrapDek(dek, '123456');
    const recovery = await wrapDek(dek, 'ABCDEFGHJKMNPQRSTVWXYZ0123456789');
    expect(await exportKey(await unwrapDek(pin, '123456')))
      .toEqual(await exportKey(await unwrapDek(recovery, 'ABCDEFGHJKMNPQRSTVWXYZ0123456789')));
  });

  it('does not leak the secret into the slot', async () => {
    const slot = await wrapDek(await generateDek(), '123456');
    expect(JSON.stringify(slot)).not.toContain('123456');
  });

  it('reads back what it writes, and null when absent', () => {
    expect(readVault()).toBeNull();
    const descriptor = { v: 2 as const, slots: {} };
    writeVault(descriptor);
    expect(readVault()).toEqual(descriptor);
    expect(localStorage.getItem(VAULT_STORAGE_KEY)).toBeTruthy();
  });

  it('returns null for a corrupt descriptor rather than throwing', () => {
    localStorage.setItem(VAULT_STORAGE_KEY, 'not json');
    expect(readVault()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/vault.test.ts`
Expected: FAIL — `Failed to resolve import "./vault"`.

- [ ] **Step 3: Implement**

```typescript
// src/services/vault.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/vault.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/vault.ts src/services/vault.test.ts
git commit -m "feat: add DEK/KEK vault with multi-slot key wrapping"
```

---

### Task 4: Rebuild cryptoService on the vault

**Files:**
- Modify: `src/services/cryptoService.ts` (full rewrite of the session/setup/unlock logic)
- Modify: `src/services/cryptoService.test.ts` (extend; all existing assertions must keep passing)
- Modify: `src/services/secureStorage.ts` (`isEncrypted` accepts v1 and v2)

**Interfaces:**
- Consumes: everything from Tasks 1 and 3.
- Produces:
  - `setupPin(pin: string): Promise<string>` — **returns the recovery code**, creating both slots. Breaking change: was `Promise<void>`.
  - `unlock(pin: string): Promise<boolean>`
  - `unlockWithRecovery(code: string): Promise<boolean>`
  - `changePin(newPin: string): Promise<void>` — requires unlocked; re-wraps the `pin` slot only.
  - `regenerateRecoveryCode(): Promise<string>` — requires unlocked; replaces the `recovery` slot.
  - `lock(): void`, `isUnlocked(): boolean`, `isSetup(): boolean`
  - `encrypt(plaintext: string): Promise<string>` — emits `v: 2`.
  - `decrypt(sealed: string): Promise<string>`
  - `getRecoverySlot(): VaultSlot | null` — used by Phase 3 sync.

`isSetup()` must return true for a v1 vault too, or existing users get dropped into setup mode and lose their data. It therefore checks the v2 descriptor **or** the legacy `secure_health_validation` key.

- [ ] **Step 1: Write the failing tests (append to `cryptoService.test.ts`)**

```typescript
import { readVault } from './vault';

describe('vault-backed key management', () => {
  beforeEach(() => {
    localStorage.clear();
    cryptoService.lock();
  });

  it('setupPin returns a recovery code and creates both slots', async () => {
    const code = await cryptoService.setupPin('123456');
    expect(code).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){7}$/);
    const vault = readVault()!;
    expect(vault.slots.pin).toBeTruthy();
    expect(vault.slots.recovery).toBeTruthy();
  });

  it('unlocks with the recovery code', async () => {
    const code = await cryptoService.setupPin('123456');
    await cryptoService.encrypt('x');
    cryptoService.lock();
    await expect(cryptoService.unlockWithRecovery(code)).resolves.toBe(true);
    expect(cryptoService.isUnlocked()).toBe(true);
  });

  it('accepts a recovery code in any formatting', async () => {
    const code = await cryptoService.setupPin('123456');
    cryptoService.lock();
    await expect(cryptoService.unlockWithRecovery(code.toLowerCase().replace(/-/g, ' ')))
      .resolves.toBe(true);
  });

  it('rejects a wrong recovery code', async () => {
    await cryptoService.setupPin('123456');
    cryptoService.lock();
    await expect(cryptoService.unlockWithRecovery('ABCD-EFGH-JKMN-PQRS-TVWX-YZ01-2345-6789'))
      .resolves.toBe(false);
    expect(cryptoService.isUnlocked()).toBe(false);
  });

  // The payoff of the DEK indirection.
  it('changes the PIN without re-encrypting records', async () => {
    await cryptoService.setupPin('123456');
    const sealed = await cryptoService.encrypt('allergies: penicillin');

    await cryptoService.changePin('999999');
    cryptoService.lock();

    expect(await cryptoService.unlock('999999')).toBe(true);
    // The ciphertext written under the old PIN is still readable, untouched.
    await expect(cryptoService.decrypt(sealed)).resolves.toBe('allergies: penicillin');
  });

  it('rejects the old PIN after a change', async () => {
    await cryptoService.setupPin('123456');
    await cryptoService.changePin('999999');
    cryptoService.lock();
    expect(await cryptoService.unlock('123456')).toBe(false);
  });

  it('leaves the recovery code working after a PIN change', async () => {
    const code = await cryptoService.setupPin('123456');
    await cryptoService.changePin('999999');
    cryptoService.lock();
    expect(await cryptoService.unlockWithRecovery(code)).toBe(true);
  });

  it('invalidates the old recovery code when regenerating', async () => {
    const first = await cryptoService.setupPin('123456');
    const second = await cryptoService.regenerateRecoveryCode();
    expect(second).not.toBe(first);
    cryptoService.lock();
    expect(await cryptoService.unlockWithRecovery(first)).toBe(false);
    expect(await cryptoService.unlockWithRecovery(second)).toBe(true);
  });

  it('refuses changePin and regenerate while locked', async () => {
    await cryptoService.setupPin('123456');
    cryptoService.lock();
    await expect(cryptoService.changePin('999999')).rejects.toThrow(/locked/i);
    await expect(cryptoService.regenerateRecoveryCode()).rejects.toThrow(/locked/i);
  });

  it('never writes the PIN or the recovery code to storage', async () => {
    const code = await cryptoService.setupPin('123456');
    const dump = JSON.stringify(localStorage);
    expect(dump).not.toContain('123456');
    expect(dump).not.toContain(code.replace(/-/g, ''));
  });

  it('emits v2 envelopes', async () => {
    await cryptoService.setupPin('123456');
    expect(JSON.parse(await cryptoService.encrypt('x')).v).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/cryptoService.test.ts`
Expected: FAIL — `cryptoService.unlockWithRecovery is not a function`.

- [ ] **Step 3: Rewrite `cryptoService.ts`**

```typescript
// src/services/cryptoService.ts
import { toBase64, fromBase64 } from './base64';
import { generateDek, wrapDek, unwrapDek, readVault, writeVault } from './vault';
import { generateRecoveryCode, normalizeRecoveryCode } from './recoveryCode';
import type { VaultDescriptor, VaultSlot } from './vaultTypes';

// Legacy v1 keys. Retained so isSetup() and the migration can detect old vaults.
export const LEGACY_SALT_KEY = 'secure_health_salt';
export const LEGACY_VALIDATION_KEY = 'secure_health_validation';

export const VAULT_KEYS = ['fch_vault', LEGACY_SALT_KEY, LEGACY_VALIDATION_KEY];

// In-memory only; lost on reload, so every session starts at the PIN prompt.
let sessionDek: CryptoKey | null = null;

const requireUnlocked = (action: string): CryptoKey => {
  if (!sessionDek) throw new Error(`Vault is locked; cannot ${action}.`);
  return sessionDek;
};

export const cryptoService = {
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
      return false;
    }
  },

  unlockWithRecovery: async (code: string): Promise<boolean> => {
    const slot = readVault()?.slots.recovery;
    if (!slot) return false;
    try {
      sessionDek = await unwrapDek(slot, normalizeRecoveryCode(code));
      return true;
    } catch {
      return false;
    }
  },

  // Re-wraps the DEK only. Records are never touched, so this is instant even
  // with megabytes of medication photos stored.
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

  getRecoverySlot: (): VaultSlot | null => readVault()?.slots.recovery ?? null,

  lock: (): void => {
    sessionDek = null;
  },

  isUnlocked: (): boolean => sessionDek !== null,

  // Legacy check included so a v1 user is not dropped into setup mode.
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

  decrypt: async (sealed: string): Promise<string> => {
    const dek = requireUnlocked('decrypt');
    const envelope = JSON.parse(sealed);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.iv) }, dek, fromBase64(envelope.data),
    );
    return new TextDecoder().decode(plaintext);
  },
};
```

- [ ] **Step 4: Widen `isEncrypted` in `secureStorage.ts`**

Replace the return expression so both envelope versions are recognised:

```typescript
    return (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      (parsed.v === 1 || parsed.v === 2) &&
      typeof parsed.iv === 'string' &&
      typeof parsed.data === 'string'
    );
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS. Note two existing tests need updating because `setupPin` now returns a code and the vault shape changed: the "never writes the PIN to storage" assertion still holds, but `App.test.tsx` seeds vaults via `setupPin` and remains valid. If any assertion references `secure_health_validation`, update it to `readVault()`.

- [ ] **Step 6: Commit**

```bash
git add src/services/cryptoService.ts src/services/cryptoService.test.ts src/services/secureStorage.ts
git commit -m "feat: rebuild cryptoService on DEK/KEK vault with recovery and PIN change"
```

---

### Task 5: Migrate v1 vaults to v2

**Files:**
- Create: `src/services/migrateVault.ts`
- Create: `src/services/migrateVault.test.ts`
- Modify: `src/App.tsx` (call the migration inside `handleUnlock`)

**Interfaces:**
- Consumes: Tasks 1, 3, 4.
- Produces:
  - `needsMigration(): boolean` — true when a legacy validation token exists and no v2 pin slot does.
  - `migrateToV2(pin: string, recordKeys: string[]): Promise<string>` — returns the new recovery code. Derives the v1 key, decrypts each record, generates a DEK, re-encrypts under it, writes the v2 descriptor, and removes the legacy keys. Throws without mutating anything if the PIN is wrong or any record fails to decrypt.

The migration must be **all-or-nothing**. Decrypt every record into memory first; only then write. A partial migration would leave some records sealed under a discarded key.

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/migrateVault.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { needsMigration, migrateToV2 } from './migrateVault';
import { cryptoService, LEGACY_SALT_KEY, LEGACY_VALIDATION_KEY } from './cryptoService';
import { readVault } from './vault';
import { toBase64 } from './base64';

const KEY = 'fch_secure_people';
const PEOPLE = [{ id: '1', name: 'Ada', allergies: 'penicillin' }];

/** Recreates a v1 vault exactly as the pre-DEK cryptoService wrote it. */
const seedV1Vault = async (pin: string, records: Record<string, unknown>) => {
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
    iv: Array.from(iv), data: Array.from(new Uint8Array(validation)),
  }));

  for (const [k, v] of Object.entries(records)) localStorage.setItem(k, await seal(v));
};

describe('migrateVault', () => {
  beforeEach(() => {
    localStorage.clear();
    cryptoService.lock();
  });

  it('detects a v1 vault', async () => {
    expect(needsMigration()).toBe(false);
    await seedV1Vault('123456', { [KEY]: PEOPLE });
    expect(needsMigration()).toBe(true);
  });

  it('migrates records and returns a recovery code', async () => {
    await seedV1Vault('123456', { [KEY]: PEOPLE });

    const code = await migrateToV2('123456', [KEY]);
    expect(code).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){7}$/);

    expect(readVault()!.slots.pin).toBeTruthy();
    expect(localStorage.getItem(LEGACY_VALIDATION_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_SALT_KEY)).toBeNull();
    expect(needsMigration()).toBe(false);

    expect(JSON.parse(localStorage.getItem(KEY)!).v).toBe(2);
    expect(cryptoService.isUnlocked()).toBe(true);
    expect(JSON.parse(await cryptoService.decrypt(localStorage.getItem(KEY)!))).toEqual(PEOPLE);
  });

  it('unlocks with the new recovery code afterwards', async () => {
    await seedV1Vault('123456', { [KEY]: PEOPLE });
    const code = await migrateToV2('123456', [KEY]);
    cryptoService.lock();
    expect(await cryptoService.unlockWithRecovery(code)).toBe(true);
  });

  it('leaves everything untouched when the PIN is wrong', async () => {
    await seedV1Vault('123456', { [KEY]: PEOPLE });
    const before = localStorage.getItem(KEY);

    await expect(migrateToV2('654321', [KEY])).rejects.toThrow();

    expect(localStorage.getItem(KEY)).toBe(before);
    expect(localStorage.getItem(LEGACY_VALIDATION_KEY)).toBeTruthy();
    expect(readVault()).toBeNull();
  });

  it('is all-or-nothing when one record is corrupt', async () => {
    await seedV1Vault('123456', { [KEY]: PEOPLE, 'fch_secure_meds': [] });
    localStorage.setItem('fch_secure_meds', JSON.stringify({ v: 1, iv: 'AAAA', data: 'AAAA' }));
    const before = localStorage.getItem(KEY);

    await expect(migrateToV2('123456', [KEY, 'fch_secure_meds'])).rejects.toThrow();

    expect(localStorage.getItem(KEY)).toBe(before);
    expect(readVault()).toBeNull();
  });

  it('migrates pre-encryption plaintext records too', async () => {
    await seedV1Vault('123456', {});
    localStorage.setItem(KEY, JSON.stringify(PEOPLE)); // never encrypted at all

    await migrateToV2('123456', [KEY]);

    expect(JSON.parse(localStorage.getItem(KEY)!).v).toBe(2);
    expect(JSON.parse(await cryptoService.decrypt(localStorage.getItem(KEY)!))).toEqual(PEOPLE);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/migrateVault.test.ts`
Expected: FAIL — `Failed to resolve import "./migrateVault"`.

- [ ] **Step 3: Implement**

```typescript
// src/services/migrateVault.ts
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

  // Verifying the PIN first turns a wrong PIN into a clean throw.
  const validationRaw = localStorage.getItem(LEGACY_VALIDATION_KEY);
  if (!validationRaw) throw new Error('No legacy vault to migrate.');
  const validation = JSON.parse(validationRaw);
  const check = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(validation.iv) },
    v1Key,
    new Uint8Array(validation.data),
  );
  if (new TextDecoder().decode(check) !== 'VALID') throw new Error('Incorrect PIN.');

  // Phase 1: read everything.
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

  // Phase 3: commit. Vault first, so a crash mid-write leaves a usable vault
  // and re-encryptable records rather than records with no key at all.
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/migrateVault.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Verify the whole suite and the build**

Run: `npm test && npm run build`
Expected: all tests PASS, build exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/services/migrateVault.ts src/services/migrateVault.test.ts
git commit -m "feat: migrate v1 PIN-derived vaults to v2 DEK/KEK"
```

---

## Phase 2 — Recovery UX

### Task 6: Recovery code modal

**Files:**
- Create: `src/components/RecoveryCodeModal.tsx`
- Create: `src/components/RecoveryCodeModal.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks; takes the code as a prop.
- Produces: `RecoveryCodeModal: React.FC<{ code: string; onConfirmed: () => void }>`

Requirements: display the code in a monospace block; a "Copy" button using `navigator.clipboard.writeText`; a "Download as text file" button; a checkbox reading "I have saved this code somewhere safe"; the Continue button stays disabled until the checkbox is ticked. `onConfirmed` fires only on Continue. There is no dismiss-without-confirming path — losing this code with a forgotten PIN means permanent data loss.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/RecoveryCodeModal.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { RecoveryCodeModal } from './RecoveryCodeModal';

const CODE = 'ABCD-EFGH-JKMN-PQRS-TVWX-YZ01-2345-6789';

describe('RecoveryCodeModal', () => {
  afterEach(cleanup);

  it('shows the code', () => {
    render(<RecoveryCodeModal code={CODE} onConfirmed={() => {}} />);
    expect(screen.getByText(CODE)).toBeTruthy();
  });

  it('keeps Continue disabled until the box is ticked', () => {
    const onConfirmed = vi.fn();
    render(<RecoveryCodeModal code={CODE} onConfirmed={onConfirmed} />);

    const button = screen.getByRole('button', { name: /continue/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onConfirmed).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });

  it('copies the code to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    render(<RecoveryCodeModal code={CODE} onConfirmed={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith(CODE);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/RecoveryCodeModal.test.tsx`
Expected: FAIL — cannot resolve `./RecoveryCodeModal`.

- [ ] **Step 3: Implement the component**

Build it with the existing Tailwind tokens used elsewhere in the app (`bg-surface`, `text-mainText`, `text-mutedText`, `border-borderColor`, `bg-accent`, `text-danger`). Structure:

```tsx
// src/components/RecoveryCodeModal.tsx
import React, { useState } from 'react';
import { ShieldCheck, Copy, Download } from 'lucide-react';

interface RecoveryCodeModalProps {
  code: string;
  onConfirmed: () => void;
}

export const RecoveryCodeModal: React.FC<RecoveryCodeModalProps> = ({ code, onConfirmed }) => {
  const [saved, setSaved] = useState(false);

  const handleDownload = () => {
    const blob = new Blob([`Family Care Hub recovery code\n\n${code}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'FamilyCareHub_RecoveryCode.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <div className="w-full max-w-md rounded-lg border border-borderColor bg-surface p-6">
        <div className="mb-4 flex items-center gap-2 text-mainText">
          <ShieldCheck className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold">Save your recovery code</h2>
        </div>

        <p className="mb-4 text-sm text-mutedText">
          This is the only way back into your data if you forget your PIN. We cannot
          recover it for you. Store it somewhere safe and separate from this device.
        </p>

        <div className="mb-4 select-all rounded border border-borderColor bg-primary p-3 text-center font-mono text-sm tracking-wider text-mainText">
          {code}
        </div>

        <div className="mb-4 flex gap-2">
          <button
            onClick={() => navigator.clipboard.writeText(code)}
            className="flex flex-1 items-center justify-center gap-2 rounded border border-borderColor py-2 text-sm text-mainText"
          >
            <Copy className="h-4 w-4" /> Copy
          </button>
          <button
            onClick={handleDownload}
            className="flex flex-1 items-center justify-center gap-2 rounded border border-borderColor py-2 text-sm text-mainText"
          >
            <Download className="h-4 w-4" /> Download
          </button>
        </div>

        <label className="mb-4 flex items-start gap-2 text-sm text-mainText">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-1" />
          I have saved this code somewhere safe
        </label>

        <button
          onClick={onConfirmed}
          disabled={!saved}
          className="w-full rounded bg-accent py-2 font-bold text-white disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/RecoveryCodeModal.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/RecoveryCodeModal.tsx src/components/RecoveryCodeModal.test.tsx
git commit -m "feat: add recovery code modal with save confirmation"
```

---

### Task 7: Recovery entry screen

**Files:**
- Create: `src/components/RecoverAccess.tsx`
- Create: `src/components/RecoverAccess.test.tsx`

**Interfaces:**
- Consumes: `cryptoService.unlockWithRecovery`, `cryptoService.changePin`, `cryptoService.regenerateRecoveryCode` (Task 4); `isValidRecoveryCode` (Task 2).
- Produces: `RecoverAccess: React.FC<{ onRecovered: (newRecoveryCode: string) => void; onCancel: () => void }>`

Flow: paste or type the code → validate format client-side before attempting → `unlockWithRecovery` → on success prompt for a new 6-digit PIN → `changePin(newPin)` → `regenerateRecoveryCode()` (the old code was just typed into a field and may sit in clipboard history) → hand the new code to `onRecovered` so `App` can show the modal.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/RecoverAccess.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { RecoverAccess } from './RecoverAccess';
import { cryptoService } from '../services/cryptoService';

describe('RecoverAccess', () => {
  let code: string;

  beforeEach(async () => {
    localStorage.clear();
    cryptoService.lock();
    code = await cryptoService.setupPin('123456');
    cryptoService.lock();
  });
  afterEach(cleanup);

  it('rejects a malformed code without attempting an unlock', () => {
    render(<RecoverAccess onRecovered={() => {}} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText(/recovery code/i), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText(/doesn't look like a valid/i)).toBeTruthy();
  });

  it('rejects a well-formed but wrong code', async () => {
    render(<RecoverAccess onRecovered={() => {}} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText(/recovery code/i), {
      target: { value: 'ABCD-EFGH-JKMN-PQRS-TVWX-YZ01-2345-6789' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => expect(screen.getByText(/did not match/i)).toBeTruthy());
  });

  it('recovers, sets a new PIN, and issues a fresh code', async () => {
    const onRecovered = vi.fn();
    render(<RecoverAccess onRecovered={onRecovered} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText(/recovery code/i), { target: { value: code } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(screen.getByLabelText(/new pin/i)).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/new pin/i), { target: { value: '999999' } });
    fireEvent.click(screen.getByRole('button', { name: /set pin/i }));

    await waitFor(() => expect(onRecovered).toHaveBeenCalled());

    const issued = onRecovered.mock.calls[0][0] as string;
    expect(issued).not.toBe(code);

    cryptoService.lock();
    expect(await cryptoService.unlock('999999')).toBe(true);
    expect(await cryptoService.unlockWithRecovery(code)).toBe(false);
    expect(await cryptoService.unlockWithRecovery(issued)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/RecoverAccess.test.tsx`
Expected: FAIL — cannot resolve `./RecoverAccess`.

- [ ] **Step 3: Implement**

Two-stage component with `stage: 'code' | 'pin'`. Stage `code`: labelled `<input>` for the recovery code, `isValidRecoveryCode` guard showing "That doesn't look like a valid recovery code.", then `unlockWithRecovery` showing "That code did not match." on false. Stage `pin`: labelled `<input>` for the new PIN, require exactly 6 digits, then:

```typescript
await cryptoService.changePin(newPin);
// The old code was typed into a field and may persist in clipboard history,
// so it is retired as part of recovery rather than left valid.
const issued = await cryptoService.regenerateRecoveryCode();
onRecovered(issued);
```

Use the same Tailwind tokens as `RecoveryCodeModal`. Wire `onCancel` to a "Back" button.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/RecoverAccess.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/RecoverAccess.tsx src/components/RecoverAccess.test.tsx
git commit -m "feat: add recovery code entry and PIN reset flow"
```

---

### Task 8: Wire recovery into App and PinPad

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/PinPad.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: Tasks 4–7.
- Produces: no new exports. `PinPadProps` becomes:

```typescript
interface PinPadProps {
  /** `wasSetup` is true when this call created the vault, so App knows to
   *  surface the recovery code rather than treating it as a normal unlock. */
  onUnlock: (pin: string, wasSetup: boolean) => void;
  onForgotPin: () => void;
}
```

`PinPad` must also stop calling `cryptoService.setupPin` itself. `setupPin` now
returns the recovery code, and `PinPad` has nowhere to put it. Move the call into
`App.handleUnlock`, which branches on `wasSetup`.

Changes:
1. `PinPad` renders a "Forgot your PIN?" link below the keypad calling `onForgotPin`.
2. `App` gains `recoveryCode: string | null` and `showRecovery: boolean` state.
3. `App.handleUnlock` calls `needsMigration()` first; if true it runs `migrateToV2(pin, [STORAGE_KEY_PEOPLE, STORAGE_KEY_MEDS])` and shows the returned code in `RecoveryCodeModal`. **This means `PinPad` must pass the entered PIN to `onUnlock`** — change `onUnlock: () => void` to `onUnlock: (pin: string) => void` and update the call site in `handleSubmit`.
4. First-time setup shows the modal with the code returned by `setupPin`.
5. `showRecovery` renders `RecoverAccess`.

- [ ] **Step 1: Write the failing test (append to `App.test.tsx`)**

```typescript
it('shows the recovery code after first-time setup', async () => {
  localStorage.clear();
  cryptoService.lock();

  render(<App />);
  enterPin(PIN); // create
  enterPin(PIN); // confirm

  await waitFor(() => expect(screen.getByText(/save your recovery code/i)).toBeTruthy(), {
    timeout: 5000,
  });
  expect(screen.getByText(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){7}$/)).toBeTruthy();
});

it('migrates a v1 vault on unlock and surfaces a recovery code', async () => {
  // seedV1Vault is the helper from migrateVault.test.ts; extract it to
  // src/services/testSupport.ts in this task and import it in both files.
  await seedV1Vault(PIN, { [STORAGE_KEY_PEOPLE]: [ADA] });

  render(<App />);
  enterPin(PIN);

  await waitFor(() => expect(screen.getByText(/save your recovery code/i)).toBeTruthy(), {
    timeout: 5000,
  });
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY_PEOPLE)!).v).toBe(2);
});

it('offers a forgot-PIN route to recovery', async () => {
  await cryptoService.setupPin(PIN);
  cryptoService.lock();

  render(<App />);
  fireEvent.click(screen.getByText(/forgot your pin/i));
  expect(screen.getByLabelText(/recovery code/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — no "save your recovery code" text.

- [ ] **Step 3: Extract the v1 seeding helper**

Move `seedV1Vault` out of `migrateVault.test.ts` into `src/services/testSupport.ts`, export it, and import it from both test files. Add `src/services/testSupport.ts` to the vitest `include` exclusion if it trips the "no tests found" check — it has no tests of its own, so it will simply not be collected.

- [ ] **Step 4: Implement the wiring**

In `PinPad.tsx`, apply the `PinPadProps` interface from the Interfaces block above, then rewrite `handleSubmit`'s two branches. The setup branch no longer calls `setupPin` — it only confirms the two entries match and hands the PIN up:

```typescript
if (isSetupMode) {
  if (!confirmPin) {
    setConfirmPin(pin);
    setPin('');
    setLoading(false);
    return;
  }
  if (pin !== confirmPin) {
    setError("PINs do not match. Try again.");
    setConfirmPin(null);
    setPin('');
    return;
  }
  setIsSetupMode(false);
  onUnlock(pin, true);   // App calls setupPin and shows the recovery code
} else {
  if (await cryptoService.unlock(pin)) {
    onUnlock(pin, false);
  } else {
    setError("Invalid PIN.");
    setPin('');
  }
}
```

Add below the keypad:

```tsx
<button onClick={onForgotPin} className="mt-4 text-sm text-mutedText underline">
  Forgot your PIN?
</button>
```

In `App.tsx`, add the two state values and rewrite `handleUnlock` to cover all three entry paths. `App` owns the `setupPin` call now, because `setupPin` returns the recovery code and `PinPad` has nowhere to put it:

```typescript
const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
const [showRecovery, setShowRecovery] = useState(false);

const handleUnlock = async (pin: string, wasSetup: boolean) => {
  if (wasSetup) {
    setRecoveryCode(await cryptoService.setupPin(pin));
  } else if (needsMigration()) {
    try {
      setRecoveryCode(await migrateToV2(pin, [STORAGE_KEY_PEOPLE, STORAGE_KEY_MEDS]));
    } catch (e) {
      console.error('Migration failed', e);
      cryptoService.lock();
      alert('Your data could not be upgraded and has been left untouched.');
      return;
    }
  }

  // ...existing load logic, unchanged, including the decrypt-failure guard...
};
```

Render both overlays:

```tsx
{recoveryCode && (
  <RecoveryCodeModal code={recoveryCode} onConfirmed={() => setRecoveryCode(null)} />
)}
{showRecovery && (
  <RecoverAccess
    onRecovered={(c) => { setShowRecovery(false); setRecoveryCode(c); }}
    onCancel={() => setShowRecovery(false)}
  />
)}
```

and pass `onForgotPin={() => setShowRecovery(true)}` to `PinPad`.

- [ ] **Step 5: Run the full suite and build**

Run: `npm test && npm run build`
Expected: all PASS, build exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/PinPad.tsx src/App.test.tsx src/services/testSupport.ts src/services/migrateVault.test.ts
git commit -m "feat: wire recovery code and v1 migration into the unlock flow"
```

---

## Phase 3 — Firebase Encrypted Sync

### Task 9: Firebase project setup and env wiring

**Files:**
- Create: `src/services/sync/firebaseApp.ts`
- Create: `.env.example`
- Modify: `.gitignore` (add `.env.local`)
- Modify: `README.md` (setup section)

**Interfaces:**
- Produces: `getFirebase(): { app: FirebaseApp; auth: Auth; db: Firestore } | null` — returns `null` when env vars are absent, so the app still runs fully offline and the existing tests need no Firebase mock.

- [ ] **Step 1: Install dependencies**

```bash
npm install firebase
```

- [ ] **Step 2: Create `.env.example`**

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```

Add `.env.local` to `.gitignore`. Note the Firebase web API key is not a secret — it identifies the project, and Firestore rules plus App Check are what actually enforce access.

- [ ] **Step 3: Implement `firebaseApp.ts`**

```typescript
// src/services/sync/firebaseApp.ts
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

let cached: { app: FirebaseApp; auth: Auth; db: Firestore } | null | undefined;

export const getFirebase = () => {
  if (cached !== undefined) return cached;

  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  // Absent config means offline-only mode; sync is simply unavailable.
  if (!config.apiKey || !config.projectId) {
    cached = null;
    return cached;
  }

  const app = initializeApp(config);
  cached = { app, auth: getAuth(app), db: getFirestore(app) };
  return cached;
};
```

- [ ] **Step 4: Verify the build still passes without env vars**

Run: `npm test && npm run build`
Expected: all PASS, build exit 0, and `getFirebase()` returns `null`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/services/sync/firebaseApp.ts .env.example .gitignore README.md
git commit -m "feat: add optional Firebase initialization"
```

---

### Task 10: Firestore schema and security rules

**Files:**
- Create: `firestore.rules`
- Create: `firestore.indexes.json`
- Create: `firebase.json`

**Schema** — one document per user:

```
users/{uid}/vault/state
  {
    v: 2,
    recoverySlot: { salt, iv, wrappedDek, iterations },   // safe: 160-bit secret
    records: {
      people:      { v: 2, iv, data },                    // ciphertext only
      medications: { v: 2, iv, data }
    },
    updatedAt: <server timestamp>
  }
```

The `pin` slot is deliberately absent. Uploading it would expose a ~20-bit secret to offline attack.

- [ ] **Step 1: Write the rules**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/vault/{document} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId
                         // The PIN slot must never be persisted server-side:
                         // a 6-digit PIN is offline-brute-forceable in minutes.
                         && (!request.resource.data.keys().hasAny(['pinSlot']));
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 2: Test the rules locally**

```bash
npx firebase emulators:start --only firestore
```

Verify manually: an unauthenticated read of `users/abc/vault/state` is denied; a read as uid `abc` succeeds; a read as uid `xyz` is denied; a write containing a `pinSlot` field is denied.

- [ ] **Step 3: Deploy the rules**

```bash
npx firebase deploy --only firestore:rules
```

- [ ] **Step 4: Enable App Check**

In the Firebase console, register the site with reCAPTCHA v3 and set Firestore to enforce App Check. This stops the public API key being used to hammer the backend from elsewhere.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules firestore.indexes.json firebase.json
git commit -m "feat: add Firestore schema and per-user security rules"
```

---

### Task 11: Vault sync

**Files:**
- Create: `src/services/sync/vaultSync.ts`
- Create: `src/services/sync/vaultSync.test.ts`

**Interfaces:**
- Consumes: `getFirebase` (Task 9); `cryptoService.getRecoverySlot` (Task 4); `readVault`/`writeVault`/`unwrapDek` (Task 3).
- Produces:
  - `pushVault(uid: string, records: Record<string, string>): Promise<void>` — uploads ciphertext plus the recovery slot. **Throws if any value is not a v2 envelope**, as a last line of defence against uploading plaintext.
  - `pullVault(uid: string): Promise<{ recoverySlot: VaultSlot; records: Record<string, string>; updatedAt: number } | null>`
  - `restoreFromCloud(uid: string, recoveryCode: string, newPin: string): Promise<void>` — pulls, unwraps the DEK with the code, writes a local v2 vault with a fresh `pin` slot, and stores the record ciphertext.

Mock `firebase/firestore` in the test with `vi.mock`; this task tests the guard logic and the restore path, not Firestore itself.

- [ ] **Step 1: Write the failing test**

```typescript
// src/services/sync/vaultSync.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { pushVault, restoreFromCloud } from './vaultSync';
import { cryptoService } from '../cryptoService';
import { readVault } from '../vault';

const store = new Map<string, unknown>();
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, path: string) => ({ path }),
  getDoc: async (ref: { path: string }) => ({
    exists: () => store.has(ref.path),
    data: () => store.get(ref.path),
  }),
  setDoc: async (ref: { path: string }, data: unknown) => { store.set(ref.path, data); },
  serverTimestamp: () => Date.now(),
  getFirestore: () => ({}),
}));
vi.mock('./firebaseApp', () => ({ getFirebase: () => ({ app: {}, auth: {}, db: {} }) }));

describe('vaultSync', () => {
  beforeEach(() => {
    localStorage.clear();
    store.clear();
    cryptoService.lock();
  });

  it('refuses to upload anything that is not a v2 envelope', async () => {
    await cryptoService.setupPin('123456');
    await expect(
      pushVault('uid-1', { people: JSON.stringify([{ name: 'Ada' }]) }),
    ).rejects.toThrow(/envelope/i);
  });

  it('never uploads the pin slot', async () => {
    await cryptoService.setupPin('123456');
    await pushVault('uid-1', { people: await cryptoService.encrypt('[]') });
    expect(JSON.stringify([...store.values()])).not.toContain('pinSlot');
  });

  it('restores onto a clean device with the recovery code', async () => {
    const code = await cryptoService.setupPin('123456');
    const sealed = await cryptoService.encrypt(JSON.stringify([{ name: 'Ada' }]));
    await pushVault('uid-1', { people: sealed });

    localStorage.clear();          // simulate a new device
    cryptoService.lock();

    await restoreFromCloud('uid-1', code, '555555');

    expect(readVault()!.slots.pin).toBeTruthy();
    expect(await cryptoService.unlock('555555')).toBe(true);
    expect(JSON.parse(await cryptoService.decrypt(localStorage.getItem('fch_secure_people')!)))
      .toEqual([{ name: 'Ada' }]);
  });

  it('rejects restore with a wrong recovery code', async () => {
    await cryptoService.setupPin('123456');
    await pushVault('uid-1', { people: await cryptoService.encrypt('[]') });
    localStorage.clear();
    cryptoService.lock();

    await expect(
      restoreFromCloud('uid-1', 'ABCD-EFGH-JKMN-PQRS-TVWX-YZ01-2345-6789', '555555'),
    ).rejects.toThrow();
    expect(readVault()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/sync/vaultSync.test.ts`
Expected: FAIL — cannot resolve `./vaultSync`.

- [ ] **Step 3: Implement**

Key guard in `pushVault`, before any network call:

```typescript
for (const [name, value] of Object.entries(records)) {
  let envelope: unknown;
  try { envelope = JSON.parse(value); } catch { throw new Error(`Record "${name}" is not a v2 envelope.`); }
  const e = envelope as { v?: number; iv?: string; data?: string };
  if (e?.v !== 2 || typeof e.iv !== 'string' || typeof e.data !== 'string') {
    throw new Error(`Record "${name}" is not a v2 envelope; refusing to upload.`);
  }
}
```

`restoreFromCloud` pulls the doc, calls `unwrapDek(recoverySlot, normalizeRecoveryCode(code))` (which throws on a wrong code, before anything is written), then `writeVault({ v: 2, slots: { pin: await wrapDek(dek, newPin), recovery: recoverySlot } })` and writes each record to `localStorage`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/sync/vaultSync.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/sync/vaultSync.ts src/services/sync/vaultSync.test.ts
git commit -m "feat: add encrypted vault sync with plaintext upload guard"
```

---

### Task 12: Sign-in, sync UI, and README correction

**Files:**
- Modify: `src/components/Settings.tsx` (sync section)
- Modify: `src/App.tsx` (push after save when signed in)
- Modify: `README.md`

**Interfaces:**
- Consumes: Tasks 9–11.
- Produces: no new exports.

Behaviour: Settings gains a "Cloud sync" section — signed out shows a sign-in button; signed in shows the account email, last-synced time, "Sync now", and "Restore on this device". `App` calls `pushVault` after a successful save when a user is signed in, debounced ~2s so a burst of edits produces one write. Sync failures must surface but never block local saving; local storage stays the source of truth.

- [ ] **Step 1: Correct the README**

The current claims are now wrong in both directions. Replace the "No Cloud Storage" bullet:

```markdown
### Privacy by Design
- **End-to-end encrypted sync**: Records are encrypted on your device with a key
  derived from your PIN. Only ciphertext is ever uploaded. Neither we nor Google
  can read your medical data.
- **Your PIN never leaves your device.** The cloud copy of your key is protected
  by your 160-bit recovery code, not by your 6-digit PIN.
- **Recovery code**: Issued once at setup. It is the only way back into your data
  if you forget your PIN, and it cannot be reissued without it.
```

Also correct the claims that were never true: "Regular Security Audits", the one-time-link and QR guarantees, and tamper detection. Delete any the code does not implement.

- [ ] **Step 2: Implement sign-in and the sync panel**

Use `signInWithPopup` + `GoogleAuthProvider`, or `signInWithEmailAndPassword`. Firebase Auth here establishes *identity only* — it never gates decryption. A user who signs in without the recovery code on a fresh device sees ciphertext they cannot read, which is the intended zero-knowledge behaviour and must be explained in the UI copy.

- [ ] **Step 3: Manual verification**

- Sign in on device A, add a person, confirm a Firestore write containing no plaintext (inspect the document in the console).
- Sign in on device B, use "Restore on this device", enter the recovery code, set a new PIN, confirm the record appears.
- Confirm the Firestore document contains no `pinSlot` field.
- Sign out and confirm the app still works fully offline.

- [ ] **Step 4: Run the full suite and build**

Run: `npm test && npm run build && npm run lint`
Expected: tests PASS, build exit 0. Lint still reports the 2 known pre-existing `set-state-in-effect` errors in PinPad and Scanner unless they are fixed separately.

- [ ] **Step 5: Commit**

```bash
git add src/components/Settings.tsx src/App.tsx README.md
git commit -m "feat: add cloud sync UI and correct README security claims"
```

---

## Out of Scope

Tracked but deliberately excluded, since neither is needed for recovery or sync:

- **One-time access links / RBAC.** `generateOneTimeAccessLink` still returns reversible `btoa()` with no expiry, and `handleRoleBasedAccess` is an `alert()`. With a backend these become implementable for the first time — a Cloud Function minting single-use tokens against a short-lived, separately-wrapped subset key — but that is its own plan.
- **The two `react-hooks/set-state-in-effect` lint errors** in `PinPad.tsx` and `Scanner.tsx`.
- **HIPAA.** Storing medical records in Firestore raises Business Associate Agreement questions if this is ever used by a covered entity. Firebase is HIPAA-eligible under a BAA on Google Cloud, but not on the Spark plan. Personal family use is not covered by HIPAA at all.
