# Handoff — Family Care Hub

**Written:** 2026-08-07
**Repo:** `C:\Users\rober\Desktop\carehub\family-care-hub` (`github.com/rsm1274-art/family-care-hub`)

---

## TL;DR

The broken GitHub Pages deploy is **fixed and live**. Since then, medical records
have been encrypted at rest and given a PIN-recovery path, all built locally and
**deliberately not pushed**. There are **12 unpushed commits** across two branches
and one **production bug fix that the live site needs**.

Nothing is half-finished. Every branch is green: `npm test` 77 passing,
`npm run build` exit 0.

---

## Current state

```
origin/main   9bb634b  Scope emergency QR to the active person     <- what is deployed
main          aad3b37  (3 commits ahead of origin, unpushed)
feat/vault-dek-kek  03ec958  (11 commits ahead of main, checked out)
```

Working tree is clean. Currently on `feat/vault-dek-kek`.

### Unpushed on `main` (3)

| Commit | What |
|---|---|
| `411c729` | Encrypt medical records at rest (superseded in part by the branch) |
| `e40793f` | Original implementation plan (superseded by `aad3b37`) |
| `aad3b37` | Plan pivoted to offline-only, Firebase dropped |

### Unpushed on `feat/vault-dek-kek` (11)

Phase 1 — DEK/KEK vault: `1ce7a08`, `1501d46`, `adc9888`, `e2c04c0`, `027aa4d`
Phase 2 — recovery UX: `58f4177`, `c04bbdc`, `bedfbd2`, `7d09543`, `11c3a33`
Out of plan: `03ec958` (service worker deploy fix)

---

## ⚠️ Read before pushing anything

### 1. `03ec958` fixes a bug the live site currently has

The deployed service worker (`family-care-hub-v2`) is **cache-first on
navigations**, and `index.html` names content-hashed assets. After the next
deploy, the cached shell will point at asset hashes that no longer exist,
GitHub Pages will answer with its 404 page, and the browser will refuse it on
MIME grounds. Result: **a white screen for every returning user, on every
deploy**, until they clear site data.

Observed directly: after a rebuild, the preview requested `index-DqegOyje.js`
and `index-nlz9rCsd.js` from earlier builds and logged
`Expected a JavaScript-or-Wasm module script but the server responded with a
MIME type of "text/html"`.

`03ec958` makes navigations network-first (cache fallback offline), keeps
cache-first for content-addressed assets, adds `skipWaiting`, and bumps to `v3`
so the activate handler evicts the poisoned caches.

**If you push only one thing, push this.** It is independent of the crypto work
and could be cherry-picked onto `main` alone.

### 2. The crypto work is a one-way data migration

Merging `feat/vault-dek-kek` means any existing user's records get sealed to
their current PIN on next unlock, and they are shown a recovery code once. There
is no way back: the v1 → v2 migration deletes the legacy keys after re-encrypting.

The migration is all-or-nothing and heavily tested, but it has **never run
against real user data**. If anyone is actually using the deployed app, consider
having them export a backup first.

### 3. `e40793f` is superseded

`aad3b37` rewrote that plan. Both are on `main`. Squashing the two doc commits
was offered and declined-by-omission; do it if you prefer a clean history.

---

## What was built, and why

### The security problem that started it

`cryptoService` derived a correct AES-256-GCM key from the PIN via PBKDF2 — and
then used it **only to encrypt the literal string `"VALID"`** as a login check.
Actual medical records went to `localStorage` as plain `JSON.stringify`. The PIN
was a UI gate, not encryption. Anyone with devtools read everything.

### The architecture now

```
DEK (random 256-bit)  --encrypts-->  all records
 |
 +-- wrapped by KEK_pin       = PBKDF2(PIN, salt, 600k)
 +-- wrapped by KEK_recovery  = PBKDF2(160-bit recovery code, salt, 600k)
```

Records are encrypted by the DEK. The DEK is stored twice, each copy wrapped by a
different key. Consequences worth knowing:

- **Changing a PIN re-wraps 32 bytes**, it does not re-encrypt records. Instant
  regardless of how many medication photos are stored.
- **Recovery works with no server.** That is why Firebase was dropped — see below.
- The session DEK lives in memory only, cleared by `lock()`, never persisted.

### Why there is no backend

The user has Firebase available and asked whether keeping only ID/PIN data there
would dodge HIPAA. Short answer recorded in the plan: **HIPAA attaches based on
who your users are, not where the bytes live.** Families managing their own
records are not covered entities, so it never applied; it *could* apply if this
is ever sold to schools, daycares or agencies (the README used to name "schools"
as a caregiver role).

The stronger argument for local-only turned out to be the **FTC Health Breach
Notification Rule**, expanded in 2024 to cover consumer health apps *outside*
HIPAA. Holding no user data avoids it entirely.

And the decisive technical point: **PIN recovery needs no backend at all.** The
recovery code wraps a second DEK copy stored beside the first. Firebase would
have bought multi-device sync, nothing more.

Also note: a 6-digit PIN is ~20 bits, brute-forceable in about a minute on one
GPU. That is survivable while the wrapped key never leaves the device. It is why
uploading the PIN slot was ruled out even in the Firebase design.

---

## Key files

| File | Role |
|---|---|
| `src/services/vault.ts` | DEK generation, KEK derivation, slot wrap/unwrap |
| `src/services/cryptoService.ts` | Session DEK, setup/unlock/changePin/recovery |
| `src/services/migrateVault.ts` | All-or-nothing v1 → v2 upgrade |
| `src/services/secureStorage.ts` | load/save; **throws on failed decrypt, never falls back** |
| `src/services/recoveryCode.ts` | 160-bit Crockford base32 codes |
| `src/services/testSupport.ts` | `seedV1Vault` — recreates a v1 vault for tests |
| `src/components/RecoveryCodeModal.tsx` | Shows the code once, gated on confirmation |
| `src/components/RecoverAccess.tsx` | Code entry → new PIN → fresh code |
| `public/service-worker.js` | Network-first navigations, cache-first assets |
| `docs/superpowers/plans/2026-08-07-offline-pin-recovery.md` | The plan, fully executed |

---

## Invariants — do not break these

1. **A failed decrypt must throw, never return a fallback.** Callers persist what
   they read, so answering "no data" on a failed read overwrites intact records
   with an empty list. Guarded by `App.test.tsx` → "does not overwrite records it
   failed to decrypt", and by `cryptoService.lock()` in the unlock error path.
   The `lock()` call is the load-bearing part, not the `return`.

2. **Backups must carry `VAULT_KEYS`.** Without the vault descriptor, a restored
   backup lands in setup mode and a new PIN derives a different key that cannot
   read the restored ciphertext. Tested both ways in `secureStorage.test.ts`.

3. **The migration is all-or-nothing.** Everything decrypts into memory before
   anything is written. Verified by mutation — making the read loop skip failures
   makes the test fail.

4. **Navigations stay network-first** in the service worker. See the bug above.

5. **No network calls anywhere.** No telemetry, no analytics, no remote logging.

---

## Open items

### Needs a product decision

**Role-based access and one-time links are fake.** The app still renders "Parent
Access" / "Babysitter Access" buttons that only fire an `alert()`, and a Share
Access button producing `btoa(personId:timestamp)` — reversible, no expiry, no
single-use enforcement, pointing at `familycarehub.com` which has no backend.

The README no longer claims these are secure (`11c3a33` deleted those claims),
but **the UI still implies they work**. A single-use expiring link is *not
implementable* without a server. Options: delete the features, build a backend,
or redesign as a self-contained encrypted QR payload with a viewer-enforced
expiry (weaker than it sounds).

This is the main thing blocking a confident ship.

### Known and accepted

- **2 lint errors**, both pre-existing and untouched:
  `react-hooks/set-state-in-effect` in `PinPad.tsx:122` (PIN auto-submit in an
  effect) and `Scanner.tsx:47` (camera start on mount). Both need behavioural
  refactors of auth/camera paths with no manual test coverage. Lint is
  deliberately **not** gating CI — `tsc -b` is the regression guard that matters.
- **PWA icons load from `cdn-icons-png.flaticon.com`.** An offline-first app
  whose icon needs a third-party CDN. Worth vendoring into `public/`.
- **Tailwind via CDN** (`cdn.tailwindcss.com`) with a console warning that it
  should not be used in production.
- **Test suite takes ~30s**, up from ~3s. That is PBKDF2 at 600k iterations doing
  real work across many `setupPin` calls, not a regression.

### Not started

Longer PIN / passphrase support. A 6-digit PIN is the ceiling on resistance to
anyone holding the device. Raising it is a UX decision.

---

## Working notes for whoever picks this up

- **Verify claims by mutation.** Three times this session a test passed while
  proving nothing. Break the code deliberately, confirm the test fails, restore.
  The v1-lockout, all-or-nothing, and backup-staleness tests were all validated
  this way; the first version of the decrypt-failure test was *not* discriminating
  and had to be rewritten.
- **PowerShell mangles UTF-8.** `Get-Content`/`Set-Content` round-trips
  double-encoded 55 characters in the plan document, and added a BOM to
  `src/index.tsx`. Use `[System.IO.File]::ReadAllText/WriteAllText` with an
  explicit encoding, or `git checkout --` to recover.
- **`crypto.getRandomValues` caps at 65,536 bytes** per call. Fill larger buffers
  in slices.
- **The in-app Browser pane was not displayed**, so screenshots and coordinate
  clicks did not work all session. `get_page_text`, `read_console_messages`,
  `read_network_requests` and `javascript_tool` all worked fine — that is how the
  service worker bug was found.
- Commit messages in this branch are long on purpose; they carry the reasoning
  that would otherwise be lost. `git log` is the design record.

---

## Suggested next steps

1. Decide on RBAC / one-time links — the only true blocker.
2. Cherry-pick `03ec958` to `main` and push it, even if the crypto work waits.
   The live site regresses on its next deploy without it.
3. Merge `feat/vault-dek-kek` into `main` when ready; run `npm test`,
   `npm run build`, then push and watch the `Deploy Vite App` run go green.
4. Manually exercise the real app once before shipping: create a PIN, confirm the
   recovery modal, add a person, reload, unlock, then use "Forgot your PIN?" with
   the saved code. The 77 tests cover the logic but nobody has clicked through it.
