# Family Care Hub — Session Handoff & Project State

**Last Updated:** September 19, 2026
**Active Branch:** `claude/gallant-darwin-uxtn1h`
**Repository:** [`rsm1274-art/family-care-hub`](https://github.com/rsm1274-art/family-care-hub)

---

## 1. Project Overview

Family Care Hub is a **local-first** app for family caregivers to securely
store and quickly retrieve critical medical profiles, medications, insurance
cards, and emergency-responder QR summaries. It is a single PWA: React +
TypeScript + Vite + Tailwind CSS, with AES-256-GCM / PBKDF2 client-side vault
encryption in browser storage.

The previous `DT/` Electron + Express + Prisma + embedded-Postgres desktop
app has been **removed**. It was an unrelated, unmaintained parallel
implementation that contradicted this app's "no server" model; the PWA
already installs and runs offline on desktop via the browser.

---

## 2. v2.0: Cloud Sync (bring-your-own-storage)

Multi-caregiver shared access was the one gap in the local-only v1 model. v2
closes it **without introducing a backend this project operates**: each
family links their own Google Drive account, and the app writes the same
already-encrypted ciphertext it writes to `localStorage` into a folder in
that account. See `README.md` → "Cloud sync" for user-facing details and
setup.

- `src/services/cloudSync/types.ts` — `CloudProvider` interface (pluggable;
  Google Drive is the first implementation, others can follow the same
  shape).
- `src/services/cloudSync/googleDrive.ts` — Google Drive implementation via
  Google Identity Services (OAuth token client) + Drive REST API, scoped to
  `drive.file` (only files this app creates, not the whole Drive).
- `src/services/cloudSync/syncService.ts` — orchestration: `connect`,
  `disconnect`, `pushAll` (writes sealed ciphertext after every local save),
  `pullNewer` (pulls remote files newer than this device's last sync, run
  before decrypting on unlock/connect).
- Wired into `App.tsx`'s existing save effect and `loadRecords`, and into a
  new "Sync Across Caregivers" section in `Settings.tsx`.
- Requires `VITE_GOOGLE_CLIENT_ID` at build time (a deployer-owned Google
  Cloud OAuth client ID). Unset, the feature is simply not offered — no
  behavior change from v1.

**Also done:** the invite/DEK-sharing flow. Without it, two caregivers each
running `setupPin()` independently would generate two different random DEKs,
and ciphertext synced between their devices would be undecryptable on the
other end -- syncing files alone was not enough for real multi-caregiver
access. `cryptoService.createInvite()` wraps the live DEK with a fresh
one-time code and drops it (as `fch_invite` in the shared Drive folder);
`cryptoService.joinWithInvite()` unwraps it and re-wraps the *same* DEK under
the joining device's own new PIN and recovery code, so every caregiver's
device shares one DEK from then on. UI: Settings → "Invite Another
Caregiver" (`InviteCodeModal`) on the inviting side, and "Joining a caregiver
who already set this up?" on the PIN-setup screen → `JoinVaultModal` on the
joining side.

**Not yet done:** iCloud / OneDrive / Dropbox providers (the interface
supports them; only Drive is implemented). The joining caregiver's Google
account must already have the "Family Care Hub Data" Drive folder shared
with them (via Drive's own sharing UI) before their invite code will find
`fch_invite` there -- the app does not (and, as a bring-your-own-storage
design, should not) attempt to automate that share itself.

---

## 3. Repository & Workspace Map

```
family-care-hub/
├── HANDOFF.md                       # This handoff file
├── README.md                        # PWA overview, security claims & local dev
├── package.json                     # Scripts and dependencies
├── vite.config.ts / tsconfig.json   # Vite & TypeScript build configs
├── public/                          # PWA manifest, service worker & app icons
└── src/                             # PWA Frontend Source
    ├── App.tsx                      # Root state machine, forms & backup/sync wiring
    ├── types.ts                     # Data models (Person, Medication, Document)
    ├── vite-env.d.ts                # VITE_GOOGLE_CLIENT_ID env typing
    ├── components/                  # PinPad, Dashboard, PersonDetail, Scanner, Settings, Terms
    └── services/
        ├── cryptoService.ts, vault.ts, vaultTypes.ts, secureStorage.ts
        ├── migrateVault.ts, recoveryCode.ts, shareExport.ts, base64.ts
        └── cloudSync/               # Bring-your-own-cloud sync (v2.0)
            ├── types.ts
            ├── googleDrive.ts
            └── syncService.ts
```

---

## 4. Development & Build Commands

```bash
npm install              # Install dependencies
npm run dev              # Start Vite dev server on http://localhost:5173
npm test                 # Run vitest suite
npm run build             # Typecheck (tsc) and compile production bundle
npm run lint              # ESLint
```

Cloud sync only activates when `VITE_GOOGLE_CLIENT_ID` is set (see README).

---

## 5. Next Session Roadmap & Recommendations

Two of the four items from the previous handoff are done:

- **Sync errors are no longer silent or blocking.** A failed push/pull, a
  failed connect, or a failed invite creation now sets a dismissible
  `syncNotice` banner (bottom-right, same visual pattern as the existing
  backup-reminder toast) instead of `console.error`-only or a blocking
  `alert()`. `CloudProvider.deleteFile` was added to support this work's
  sibling item below and is also usable for future cleanup needs.
- **The invite is now retired after use.** `handleJoinVault` in `App.tsx`
  deletes `fch_invite` from the shared Drive folder (best-effort, via the
  new `CloudProvider.deleteFile`) immediately after a successful join, so it
  cannot be replayed by someone who later gets both folder access and the
  out-of-band code.

Two remain, and both need something from the project owner rather than more
code:

1. **iCloud provider — needs a decision, not just code.** CloudKit JS
   requires the *deploying* developer to register an Apple Developer Program
   membership ($99/year) to create the CloudKit container the web app talks
   to -- unlike Google Cloud OAuth credentials, which are free. That is a
   real ongoing cost for whoever hosts this app, which conflicts with the
   "no cost to me, ever" constraint this design was built around. Do not
   implement iCloud until the project owner decides whether to accept that
   cost, drop iCloud, or look at OneDrive/Dropbox instead (both have free
   app-registration tiers, closer to Google's).
2. **Manual end-to-end test — needs a real Google Cloud OAuth client ID.**
   This cannot be exercised in CI or by an agent without one: create a
   Google Cloud project, an OAuth 2.0 Web application client ID (see
   README → "Cloud sync" for the exact steps), set `VITE_GOOGLE_CLIENT_ID`,
   and test two devices/accounts: one invites the other via the new flow,
   confirm a record added on one appears on the other after unlock, and
   confirm revoking Drive folder access on Google's side actually cuts the
   second device off.
