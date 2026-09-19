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

**Not yet done:** iCloud / OneDrive / Dropbox providers (the interface
supports them; only Drive is implemented), and a proper DEK re-wrap-per-
caregiver flow -- today all caregivers on a shared Drive folder use the same
device PIN model per device, which is fine for a household but not yet a
distinct "invite a caregiver" flow.

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

1. Add an iCloud (CloudKit JS) `CloudProvider` implementation as the second
   supported provider (README lists it as a v2.0 goal for iPhone-only
   families).
2. Design a real "invite a caregiver" flow: a setup code plus a per-caregiver
   wrapped DEK, rather than relying on caregivers sharing one PIN's worth of
   trust through a shared Drive folder.
3. Surface sync status/errors in the UI beyond `alert()` — a small
   "last synced" indicator in Settings, matching the existing "Last backup"
   pattern.
4. Manual end-to-end test: two devices, same Google account (or a shared
   Drive folder across two accounts), confirm a record added on one appears
   on the other after unlock.
