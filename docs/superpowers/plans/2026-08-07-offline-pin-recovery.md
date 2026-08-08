# Offline PIN Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Family Care Hub users a recovery path for a forgotten PIN, with every byte of medical data staying on the user's own device and no backend of any kind.

**Architecture:** Records stop being encrypted directly by a PIN-derived key. A random 256-bit Data Encryption Key (DEK) encrypts all records; the DEK is stored twice over, each copy wrapped by a different Key Encryption Key (KEK). `KEK_pin` is derived from the 6-digit PIN; `KEK_recovery` is derived from a 160-bit recovery code shown once at setup. Forgetting the PIN means unwrapping the DEK with the recovery code and re-wrapping it under a new PIN. Because the DEK is only ever re-wrapped, changing a PIN never touches a record.

**Tech Stack:** TypeScript, React 19, Vite 6, Web Crypto (PBKDF2 + AES-GCM), vitest + @testing-library/react, happy-dom. **No backend, no network calls, no new runtime dependencies.**

> **Scope note:** An earlier draft of this plan carried a third phase adding Firebase Auth + Firestore sync. It was cut deliberately. PIN recovery needs no server — the recovery code wraps a second DEK copy stored beside the first — and holding no user data avoids breach-notification exposure (including the FTC Health Breach Notification Rule, which covers consumer health apps outside HIPAA), special-category data handling, and BAA questions entirely. The tradeoff is accepted and addressed in Task 9: with no cloud copy, a lost device means lost data unless the user has exported an encrypted backup.

## Global Constraints

- **No data leaves the device.** No network calls, no telemetry, no analytics, no remote logging. If a task seems to need a server, it is out of scope.
- A 6-digit PIN is ~20 bits of entropy and is brute-forceable in roughly a minute on one GPU by anyone holding the device. This is inherent and not solved here; it is why no wrapped-DEK material may ever be transmitted or uploaded.
- PBKDF2-SHA256 at **600,000 iterations** for all new KEK derivations (current OWASP guidance). The legacy v1 vault used 100,000; migration must not silently keep the old figure.
- All random values come from `crypto.getRandomValues`. Never `Math.random`.
- AES-GCM only, 256-bit keys, a fresh 12-byte IV per encryption. Never reuse an IV under the same key.
- All binary values are stored base64, never `Array.from(bytes).toString()`. Medication photos are already base64; a byte-array encoding inflates payloads ~4x against a ~5MB `localStorage` quota.
- A failed decrypt must **throw**, never return a fallback. Callers persist what they read, so answering "no data" on a failed read overwrites intact records. See `src/App.test.tsx` → "does not overwrite records it failed to decrypt".
- Every envelope and vault descriptor carries a numeric `v` field. Never change a stored shape without bumping it and providing a migration.
- Existing behaviour that must not regress: `npm test` (28 tests) and `npm run build` (`tsc -b && vite build`) both pass.

## Phase Boundaries

The two phases are sequentially dependent, not independent subsystems, so they share one plan. Each ends with working, shippable software and is a natural review-and-stop point:

- **Phase 1 (Tasks 1–5)** — DEK/KEK vault + v1→v2 migration. Ships stronger local encryption and instant PIN change. No user-visible feature yet.
- **Phase 2 (Tasks 6–10)** — Recovery code generation, display, unlock-by-recovery, backup prominence, and honest documentation. Ships forgotten-PIN recovery.

## File Structure

| File | Responsibility |
|---|---|
| `src/services/vaultTypes.ts` (create) | Shared vault/envelope types and version constants. No logic. |
| `src/services/base64.ts` (create) | `toBase64` / `fromBase64`, extracted from `cryptoService` so `vault` can share them. |
| `src/services/recoveryCode.ts` (create) | Generate, format, and normalize the 160-bit recovery code. |
| `src/services/vault.ts` (create) | DEK generation, KEK derivation, slot wrap/unwrap, descriptor read/write. |
| `src/services/migrateVault.ts` (create) | One-way v1 → v2 upgrade. |
| `src/services/testSupport.ts` (create) | `seedV1Vault` helper shared by the migration and App tests. |
| `src/services/cryptoService.ts` (modify) | Session DEK holder. Public surface stays `setupPin`/`unlock`/`lock`/`isUnlocked`/`isSetup`/`encrypt`/`decrypt`, plus new `changePin`/`unlockWithRecovery`/`regenerateRecoveryCode`. |
| `src/services/secureStorage.ts` (modify) | Unchanged API; `isEncrypted` accepts v1 and v2 envelopes. |
| `src/components/RecoveryCodeModal.tsx` (create) | Shows the code once, requires explicit confirmation. |
| `src/components/RecoverAccess.tsx` (create) | Recovery-code entry and new-PIN flow. |
| `src/components/Settings.tsx` (modify) | Backup prominence and staleness warning (Task 9). |
| `README.md` (modify) | Correct the security claims (Task 10). |

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
import type { VaultDescriptor } from './vaultTypes';

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

### Task 9: Make the encrypted backup prominent

**Files:**
- Modify: `src/components/Settings.tsx`
- Modify: `src/App.tsx` (record and expose the last-backup timestamp)
- Create: `src/components/Settings.test.tsx`

**Interfaces:**
- Consumes: `cryptoService` (Task 4).
- Produces: `const LAST_BACKUP_KEY = 'fch_last_backup'` exported from `src/App.tsx`.

With no cloud copy, an exported backup is the **only** thing standing between a dropped phone and permanently lost medical records. The existing backup button is buried in Settings with no indication of whether it has ever been used. This task makes the gap visible.

Requirements:
1. `handleBackup` writes `localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString())` after a successful export.
2. Settings shows "Last backup: <relative time>" or "You have never backed up".
3. When there is no backup, or the last one is older than 30 days, show a warning-styled callout with the `AlertTriangle` icon reading: "Your data lives only on this device. If you lose it, these records cannot be recovered. Export a backup."
4. The callout is not dismissible — it disappears only by taking a backup.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/Settings.test.tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Settings } from './Settings';
import { LAST_BACKUP_KEY } from '../App';

const NOOP = () => {};
const SETTINGS = { theme: 'dark' as const, highContrast: false, largeText: false };

const renderSettings = () =>
  render(
    <Settings
      settings={SETTINGS}
      onUpdate={NOOP}
      onBack={NOOP}
      onBackup={NOOP}
      onShowTerms={NOOP}
    />,
  );

describe('Settings backup prominence', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('warns when no backup has ever been taken', () => {
    renderSettings();
    expect(screen.getByText(/never backed up/i)).toBeTruthy();
    expect(screen.getByText(/cannot be recovered/i)).toBeTruthy();
  });

  it('warns when the last backup is older than 30 days', () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(LAST_BACKUP_KEY, old);
    renderSettings();
    expect(screen.getByText(/cannot be recovered/i)).toBeTruthy();
  });

  it('shows no warning after a recent backup', () => {
    localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
    renderSettings();
    expect(screen.queryByText(/cannot be recovered/i)).toBeNull();
    expect(screen.getByText(/last backup/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Settings.test.tsx`
Expected: FAIL — `LAST_BACKUP_KEY` is not exported from `../App`, and no warning text exists.

- [ ] **Step 3: Implement**

In `src/App.tsx`, add the export and stamp it on a successful backup:

```typescript
export const LAST_BACKUP_KEY = 'fch_last_backup';
```

At the end of `handleBackup`, after `document.body.removeChild(link)`:

```typescript
localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
```

In `src/components/Settings.tsx`, above the existing backup button:

```tsx
const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
const backupAgeDays = lastBackup
  ? (Date.now() - new Date(lastBackup).getTime()) / 86_400_000
  : Infinity;
const backupIsStale = backupAgeDays > 30;

{backupIsStale && (
  <div className="mb-4 flex gap-3 rounded-lg border border-danger/40 bg-danger/10 p-3">
    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
    <p className="text-sm text-mainText">
      Your data lives only on this device. If you lose it, these records cannot be
      recovered. Export a backup.
    </p>
  </div>
)}

<p className="mb-2 text-sm text-mutedText">
  {lastBackup
    ? `Last backup: ${new Date(lastBackup).toLocaleDateString()}`
    : 'You have never backed up'}
</p>
```

Import `AlertTriangle` from `lucide-react` and `LAST_BACKUP_KEY` from `../App`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/Settings.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 5: Verify the mutation is caught**

Temporarily change `backupAgeDays > 30` to `false`. Re-run: the first two tests must fail. Restore. A staleness warning that cannot be observed to fire is not a warning.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/Settings.tsx src/components/Settings.test.tsx
git commit -m "feat: warn when the only copy of the data has no recent backup"
```

---

### Task 10: Correct the README security claims

**Files:**
- Modify: `README.md`

**Interfaces:** none.

The README describes an app that does not exist. Several claims were false before this work and stay false after it; shipping recovery without fixing them means users make safety decisions on bad information. Each bullet below is either corrected to match the code or deleted.

- [ ] **Step 1: Replace the false claims**

| Current claim | Reality | Action |
|---|---|---|
| "Local Storage Encryption … AES" | True only after Phase 1 | Keep, and state that the key derives from the PIN via PBKDF2 |
| "Encryption keys … not exposed" | True — memory only, never persisted | Keep, reword to say the key exists only while unlocked |
| "Role-Based Access Control", "Granular Permissions" | `handleRoleBasedAccess` is an `alert()` | **Delete** |
| "One-Time Access Links … expire after a single use" | `btoa()` of `id:timestamp`, reversible, no expiry, no backend | **Delete** |
| "QR Code Sharing … without compromising security" | QR embeds plaintext name, DOB, medications, contact | Rewrite: the QR is deliberately unencrypted for emergency responders and should only be shown to people trusted with that data |
| "Lock Screen Widget" | Does not exist | **Delete** |
| "Tamper Detection … alerts users if data has been modified" | AES-GCM detects tampering but the app only refuses to open; there is no alerting | Rewrite: modified data fails to decrypt and the app refuses to proceed rather than showing corrupted records |
| "Encrypted backups" | True after `411c729` | Keep |
| "Encryption in Transit … HTTPS" | Nothing is transmitted | **Delete** |
| "No Cloud Storage" | True, and now a deliberate design choice | Keep, strengthen |
| "PINs are hashed and never stored directly" | Not hashed — used to derive a key that unwraps the DEK | Rewrite accurately |
| "Regular Security Audits" | No audit has occurred | **Delete** |

- [ ] **Step 2: Add the recovery and data-loss sections**

```markdown
### Recovery
- **Recovery code**: A 160-bit code is issued once when you set your PIN. It is the
  only way back in if you forget the PIN. We cannot reissue or reset it — there is
  no server and no account, so there is nobody to ask.
- **Changing your PIN** re-wraps the encryption key, not your records, so it is
  instant regardless of how many photos you have stored.

### What this app cannot protect you from
- **Losing the device.** Records exist only here. Export an encrypted backup and
  keep it somewhere else; that is the only disaster recovery available.
- **Losing both the PIN and the recovery code.** The data is unrecoverable by
  design. This is the cost of nobody else holding your key.
- **Someone who has both your unlocked device and your PIN.** A 6-digit PIN is
  short by design for one-handed use in an emergency; it is not a defence against
  a determined attacker who physically holds your device.
```

- [ ] **Step 3: Remove the AI Studio scaffolding**

Delete the "Run and deploy your AI Studio app" heading, the `ai.studio` link, and the `GEMINI_API_KEY` setup step at the top of the file. That key was removed from `vite.config.ts` and the service it belonged to was deleted.

- [ ] **Step 4: Verify**

Read the finished README top to bottom against `src/`. Every security claim must map to code you can point at. If you cannot point at it, delete the claim.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: correct security claims to match what the code does"
```

---

## Out of Scope

Tracked but deliberately excluded, since none is needed for PIN recovery:

- **Cloud sync of any kind.** Cut on purpose — see the scope note at the top. Reintroducing it reopens breach-notification and data-handling questions that holding no user data avoids entirely.
- **One-time access links / RBAC.** `generateOneTimeAccessLink` returns reversible `btoa()` with no expiry, pointing at a domain with no backend, and `handleRoleBasedAccess` is an `alert()`. **A single-use, expiring link is not implementable with no server** — there is nothing to record that a token was spent. Task 10 deletes the README claims rather than pretending otherwise. If the feature is wanted, the honest offline version is a self-contained encrypted QR payload with an embedded expiry the recipient's viewer enforces, which is weaker than it sounds and deserves its own design.
- **The two `react-hooks/set-state-in-effect` lint errors** in `PinPad.tsx` and `Scanner.tsx`. Both need behavioural refactors of the unlock and camera paths.
- **Longer PIN / passphrase support.** A 6-digit PIN is ~20 bits and is the ceiling on how well anything here resists an attacker who physically holds the device. Raising it is a UX decision, not a bug fix.

## A note on HIPAA

Not a task, recorded so nobody re-derives it later. HIPAA binds **covered entities** and their business associates. A family storing its own medical information is neither, so HIPAA does not attach to this app in personal use — and that was already true when the data was local, so removing cloud sync did not change it.

It could attach if the app is ever sold or provided to schools, daycares, home-health agencies, or clinics acting as covered entities. The README currently names "schools" as a caregiver role, which is exactly the framing that invites the question.

Separately, and more likely to be relevant: the **FTC Health Breach Notification Rule** was expanded in 2024 to cover consumer health apps that fall *outside* HIPAA. Holding no user data is the cleanest way to stay clear of it, which is a large part of why Phase 3 was cut.

None of this is legal advice; it is context for whoever picks the plan up. Get counsel before going commercial.
