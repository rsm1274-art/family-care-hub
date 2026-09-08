# Family Care Hub — Session Handoff & Project State

**Last Updated:** September 7, 2026  
**Active Branch:** `main`  
**Repository:** [`rsm1274-art/family-care-hub`](https://github.com/rsm1274-art/family-care-hub)

---

## 1. Project Overview

Family Care Hub is a **zero-knowledge, local-first** application built for family caregivers to securely store and quickly retrieve critical medical profiles, medications, insurance cards, and emergency responder QR summaries without relying on central cloud servers.

The repository contains two sibling implementations designed to interoperate via JSON export/import:
1. **Mobile / Web PWA (`/`)**: React + TypeScript + Vite + Tailwind CSS with AES-256-GCM / PBKDF2 client-side vault encryption in browser storage.
2. **Desktop Application (`DT/`)**: Electron + Express + Prisma + embedded local PostgreSQL 17 database packaged with NSIS installer.

---

## 2. Recent Updates & Completed Work

### 📱 Mobile PWA Hardening & Usability
* **Storage Protection**: Integrated the Web Persistent Storage API (`checkStoragePersistence` & `requestPersistentStorage`) on unlock/setup to prevent mobile browsers (iOS Safari / Android Chrome) from evicting records under storage pressure.
* **Storage Status UI**: Added persistent storage status indicators under **Settings $\rightarrow$ Data Security & Backup**.
* **Native Web Share Sheet**: Implemented `downloadOrShareFile()` using `navigator.share({ files: [...] })` with fallback to standard downloads. Caregivers can save backups directly to **iCloud Drive**, **Google Drive**, **Files**, or **AirDrop** in 1 tap.
* **Post-Edit Backup Reminders**: Added a non-intrusive floating toast that prompts the caregiver to save an updated backup whenever people, medications, or documents are added/edited/imported.
* **Test Suite**: 89/89 passing unit & integration tests covering crypto, migration, vault serialization, and export sharing.

### 💻 Desktop App (`DT/`) Backup Automation
* **Automated On-Exit Backups**: Electron's `before-quit` lifecycle automatically exports a full household database snapshot (including photos) to:  
  `%USERPROFILE%\Documents\Family Care Hub Backups\FamilyCare_AutoBackup_YYYY-MM-DD_HHmmss.json`
* **Rolling Backup Retention**: Retains the last 10 auto-backups and prunes older automated snapshots.
* **Internal Loopback Export**: Added `/api/internal/auto-export` in Express to support zero-token host-level snapshots.
* **Explorer Integration**: Added an **"Open Backups Folder"** button in Desktop Settings using Electron IPC (`fch:open-backups-folder` $\rightarrow$ `shell.openPath`).

---

## 3. Repository & Workspace Map

```
family-care-hub/
├── HANDOFF.md                       # This handoff file
├── README.md                        # PWA overview, security claims & local dev
├── package.json                     # Root PWA scripts and dependencies
├── vite.config.ts / tsconfig.json   # Vite & TypeScript build configs
├── public/                          # PWA manifest, service worker & app icons
├── src/                             # PWA Frontend Source
│   ├── App.tsx                      # Root state machine, forms & backup wiring
│   ├── types.ts                     # PWA data models (Person, Medication, Document)
│   ├── components/                  # PinPad, Dashboard, PersonDetail, Scanner, Settings, Terms
│   └── services/                    # Crypto, secureStorage, shareExport, vault, recoveryCode
│
└── DT/                              # Desktop App (npm workspaces)
    ├── package.json                 # Workspaces config (electron-shell, renderer, server, shared-types)
    ├── PROGRESS.md                  # Desktop architecture & milestone tracker
    ├── CaregiverPainPoints.md       # Caregiver UX rationale & requirements
    ├── docs/                        # Household onboarding & setup guides
    └── packages/
        ├── electron-shell/          # Electron main process, embedded Postgres 17 launcher, IPC
        ├── renderer/                # Desktop React frontend UI
        ├── server/                  # Express 5 + Prisma API (routes: auth, people, meds, docs, backup)
        └── shared-types/            # Shared TypeScript DTOs across server & renderer
```

---

## 4. Development & Build Commands

### Mobile PWA (Root)
```bash
npm install              # Install dependencies
npm run dev              # Start Vite dev server on http://localhost:5173
npm test                 # Run vitest suite (89 tests)
npm run build            # Typecheck (tsc) and compile production bundle
```

### Desktop Application (`DT/`)
```bash
# In DT/ directory:
npm run build:all        # Build shared-types, server, renderer, and electron-shell
npm run dev:server       # Start Express API on :4000 (watch mode)
npm run dev:renderer     # Start Vite desktop renderer
npm run electron         # Launch dev Electron window
npm run dist:win         # Build packaged Windows installer (.exe in release/)
```

---

## 5. Next Session Roadmap & Recommendations

1. **Clean-VM Installer Smoke Test**: Test the packaged Windows installer (`Family Care Hub Setup 1.0.0.exe`) on a clean Windows VM to confirm embedded Postgres initialization, first-time setup, and shutdown backup creation.
2. **Mobile $\leftrightarrow$ Desktop Share File Round-Trip**: Test exporting a person record with medication and document photos from Mobile PWA, importing into Desktop, and vice-versa.
3. **Optional Quick-Lock PIN Screen**: Consider adding a manual "Lock Now" button on the Dashboard for immediate screen locking without closing the browser.
4. **Offline Styling Bundling**: Ensure all Tailwind utilities are fully bundled in the desktop renderer so the UI renders styled even when the PC has zero internet connectivity.
