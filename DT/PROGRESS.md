# Family Care Hub — Migration Progress

Snapshot from the working session on **2026-07-02** (PWA → Electron + local
PostgreSQL + Tailscale). Use this to resume development.

## 2026-09-04 — Architecture pivot: dropped Tailscale host/client networking

Decided the multi-computer "host" (network-exposed server) + "client" (remote
connect) model wasn't worth the liability of one person's computer becoming
the family's always-on server. Replaced it with: **every install is fully
local and independent**; moving records between computers is a deliberate
export → import of a backup file (people, medications, documents, and photos,
with images embedded as base64). Postgres stays as the local database engine
(not swapped to SQLite — kept as the lower-risk option).

Changed: `packages/electron-shell/src/main.ts` (no more `AppMode`, server
always binds `127.0.0.1`), `SetupWizard.tsx` (single local-setup flow, no
host/client choice), `packages/server/src/routes/backup.ts` (new
`GET /export` / `POST /import` full-household routes alongside the existing
legacy-PWA import), `docs/household-onboarding.md` (rewritten), and
`docs/tailscale-setup.md` (deleted). M5 and the two-machine Tailscale test
below are **no longer applicable** — see the updated remaining-work list.

## Where things stand

| Milestone | Status |
|---|---|
| M1 Workspace restructure | ✅ Done, committed |
| M2 API server + Prisma schema | ✅ Done, committed, 35-check API suite passed |
| M3 Frontend swap to API | ✅ Done, committed, full browser journey verified |
| M4 Electron shell + bundled Postgres | ✅ Done, committed, host mode verified in dev Electron |
| M5 Setup wizard (host/client + connection test) | ⛔ Superseded 2026-09-04 — replaced by local-only setup + export/import backup |
| M7 Legacy backup import | ✅ Done (endpoint in M2, UI in M3), verified through real file-input flow |
| M8 Packaging + docs | 🟡 ~95% — unpacked build verified; **NSIS installer built & installed locally 2026-07-03, smoke-tested OK**; docs written; clean-VM test still to do |

## Repo layout (npm workspaces)

- `packages/renderer` — the React app (was `family-care-hub/`, whose nested git
  repo was absorbed; old GitHub repo still holds pre-migration history)
- `packages/server` — Express 5 + Prisma API. Auth = bcrypt + 30-day JWT,
  households joined by invite code. Images on disk under `IMAGES_DIR`, served
  by ownership-checked `/api/images/:personId/:filename` (accepts `?token=`).
  `POST /api/backup/import-legacy` takes the old PWA backup JSON unchanged.
  `src/migrate.ts` applies `prisma/migrations/*.sql` at startup when
  `RUN_MIGRATIONS=1` (packaged app has no Prisma CLI).
- `packages/shared-types` — DTOs used by server + renderer (build before
  typechecking others).
- `packages/electron-shell` — Electron main/preload. Host mode: starts
  PostgreSQL 17 via `embedded-postgres` (data in `%APPDATA%\Family Care Hub\pgdata`)
  and forks the server bundle on `0.0.0.0:4000`; JWT secret + PG password
  generated once into electron-store config. Client mode: spawns nothing.
- `docs/tailscale-setup.md`, `docs/household-onboarding.md` — end-user guides.

## Dev commands

```bash
# dev database (Docker):
cd packages/server && docker compose up -d      # Postgres on :5544
cp .env.example .env                            # if missing (gitignored)
npm run dev            # API on :4000 (tsx watch)

# renderer:
npm run dev:renderer   # vite; respects PORT env (Docker owns :3000 on this machine)

# full build + packaged exe (unpacked, no installer):
npm run build:all
npm run bundle --workspace packages/server      # esbuild -> packages/server/bundle/index.js
cd packages/electron-shell && npx electron-builder --win --dir -c.directories.output=release2

# installer (NSIS) once ready:
npm run dist:win       # root script
```

## What remains (in order)

1. ~~**Build the NSIS installer** and run it once locally~~ ✅ Done 2026-07-03:
   `npm run dist:win` → `release/Family Care Hub Setup 1.0.0.exe` (131 MB).
   Silent install (`/S`) to `%LOCALAPPDATA%\Programs\Family Care Hub` (483 MB),
   all extraResources present (server bundle, Prisma engine, PG binaries,
   renderer). Installed exe smoke-tested: PG 17.9 up, API on 0.0.0.0:4000,
   styled login screen rendered, clean exit. Note: `Start-Process` on the
   installer gives "Access is denied" — invoke the exe directly instead.
2. **Clean Windows VM test** of the installer: install → wizard → host mode →
   create household → add person/med/photo → quit/relaunch (data persists).
3. ~~Real two-machine Tailscale test~~ ❌ No longer applicable — networking
   between installs was removed 2026-09-04. Replaced by: **export/import
   round-trip test** — add a person with a medication photo and a document on
   one install, export, import into a second install, confirm everything
   (including both photos) arrives correctly.
4. ~~**App icon**~~ ✅ Done 2026-07-03: heart + EKG pulse badge matching the
   login-screen branding, generated programmatically (PIL script) into
   `packages/electron-shell/build/icon.ico` (multi-size) + `icon.png`;
   `win.icon` set in electron-builder config. Installer rebuilt with it —
   no more default-icon warning.
5. **Retire GitHub Pages** for `rsm1274-art/family-care-hub` once the Electron
   app ships (per plan).
6. Nice-to-haves deferred: quick-lock PIN screen, offline Tailwind (renderer
   currently loads Tailwind from CDN — works, but the UI is unstyled without
   internet; consider vendoring it before shipping), image lazy-loading if
   photo counts grow.

## Gotchas / decisions made during packaging

- **`asar` is disabled** in electron-builder config: `embedded-postgres`
  resolves its `postgres.exe`/`initdb.exe` via ESM paths that break inside
  asar. Disabling asar was the reliable fix; app is ~480 MB unpacked (PG
  binaries dominate).
- **Prisma engine in packaged app**: the server is an esbuild bundle
  (`packages/server/bundle/index.js`); `query_engine-windows.dll.node` +
  `schema.prisma` are copied by extraResources to `resources/server/` — one of
  Prisma's engine search paths. `PRISMA_QUERY_ENGINE_LIBRARY` env alone was
  NOT honored by Prisma 6.19.
- **electron-store config and pgdata must live/die together**: the config
  (`%APPDATA%\Family Care Hub\family-care-hub.json`) holds the generated PG
  password. Deleting the config but keeping `pgdata` ⇒ P1000 auth failures.
  (This happened during testing; fix was deleting pgdata too.)
- **embedded-postgres emits a harmless `done is not a function` unhandled
  rejection during shutdown** on Windows (their exit hook). Cosmetic.
- **Port 4000 collisions during testing**: stopping the `npx tsx` dev server
  via the harness can orphan the actual node child holding :4000 — check
  `netstat -ano | findstr :4000` before blaming the Electron build.
- **Port 3000 is owned by Docker Desktop** on this machine; vite dev uses a
  PORT env override instead.
- `release/` and `release2/` are both in .gitignore (verified 2026-07-03).
  The old Defender lock on `release/` cleared; the NSIS build now outputs to
  the default `release/` dir.
- Local test residue: `%APPDATA%\Family Care Hub\` contains a config
  (`{"mode":"host"}`) and a pgdata with throwaway test households
  (`packaged.test` etc.). Delete the whole folder for a truly fresh start.
- Dev-mode Electron smoke testing: `FCH_SMOKE_TEST=<png path>` env makes the
  app screenshot itself and quit (`FCH_SMOKE_WAIT_MS` to tune); dev server
  entry override via `FCH_SERVER_ENTRY`; renderer URL via
  `ELECTRON_RENDERER_URL`.

## Verification already performed (don't redo unless code changed)

- API: 35-check suite (scratchpad script) — auth, cross-household scoping
  (reads/writes/images all 404), path traversal, legacy import w/ images,
  cascade deletes.
- Browser: register → add person → add med → photo upload + rehydration →
  reload → settings/invite code → logout → login. Zero console errors.
- Legacy import via the actual Settings file-input flow (synthetic
  `FamilyCare_Backup_*.json` matching the old export exactly).
- Dev Electron host mode AND packaged unpacked exe: PG 17.9 initdb, migration
  runner, API on 0.0.0.0:4000, register/login against embedded DB, clean
  shutdown releasing ports.
- NSIS installer (2026-07-03): silent install, all resources present in
  `%LOCALAPPDATA%\Programs\Family Care Hub`, installed exe boots host mode
  against existing pgdata (WAL recovery OK), login screen renders, exit 0.
