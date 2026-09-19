<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Family Care Hub

A local-first app for caregivers to keep critical medical information for the
people they look after, available fast in an emergency.

**Everything stays on your device by default.** There is no server and no
account required. If you turn on cloud sync (below), your own cloud storage
account -- never one we operate -- is what carries data between your devices.

---

## Run Locally

**Prerequisites:** Node.js 20+

```bash
npm install
npm run dev
```

Other scripts: `npm test` (vitest), `npm run build` (typecheck + build),
`npm run lint`.

The dev server binds to localhost. For testing on a phone on your own network,
opt in per run with `npm run dev -- --host`.

---

## Cloud sync (optional, bring-your-own-storage)

Multiple caregivers can share the same records by linking a cloud storage
account they already have. There is no backend operated by this project:
every record is encrypted on-device (same AES-256-GCM vault described below)
*before* it is written to the cloud, so the storage provider -- and anyone
deploying this app -- only ever sees ciphertext.

Currently implemented: **Google Drive** (`src/services/cloudSync/googleDrive.ts`),
via the narrow `drive.file` scope, which only grants access to a folder this
app creates -- not your whole Drive. The `CloudProvider` interface in
`src/services/cloudSync/types.ts` is written so other providers (iCloud,
OneDrive, Dropbox) can be added the same way.

To enable it in your own deployment:

1. Create a Google Cloud project and an OAuth 2.0 **Web application** client
   ID (Google Cloud Console → APIs & Services → Credentials). Add your
   deployed origin (and `http://localhost:5173` for local dev) under
   "Authorized JavaScript origins".
2. Set `VITE_GOOGLE_CLIENT_ID` to that client ID when building (e.g. in a
   `.env` file, or as a build-time environment variable in your host's
   settings).
3. Without that variable set, the cloud sync section in Settings does not
   appear -- the app behaves exactly as the fully local version.

To add a second caregiver:

1. Share the "Family Care Hub Data" folder Drive creates with their Google
   account, using Drive's own sharing.
2. In Settings, tap **Invite Another Caregiver**. You'll get a one-time
   invite code -- share it with them directly (text, call, in person), not
   through Drive or anywhere public.
3. On their device, at PIN setup, they tap **"Joining a caregiver who
   already set this up?"**, connect the same shared Drive folder, and enter
   the code, then choose their own PIN.

This step matters, not just the folder share: without it, their device would
generate its own random encryption key and be unable to read your records at
all, even with the ciphertext file sitting right there. The invite code is
what makes the two devices use the same key.

---

## Security

Claims below describe what the code actually does. Anything the app does not
implement is not listed.

### Encryption at rest
- Records are encrypted with **AES-256-GCM** before being written to
  `localStorage`.
- A random 256-bit data key encrypts your records. That key is itself
  encrypted twice over: once with a key derived from your PIN, once with a key
  derived from your recovery code. Key derivation is **PBKDF2-SHA256 at 600,000
  iterations**.
- The data key exists **only in memory while the app is unlocked**. It is never
  written to disk. Closing or reloading the app discards it.
- Your PIN is never stored, in any form. It is used to derive a key, and that
  key either unwraps the data key or it does not.

### Recovery
- A **160-bit recovery code** is issued once, when you first set your PIN. It is
  the only way back into your data if you forget the PIN. It cannot be reissued
  or reset — there is no server and no account, so there is nobody to ask.
- Using the recovery code retires it and issues a new one, because the old code
  has just been typed into a field.
- **Changing your PIN** re-encrypts only the data key, not your records, so it
  is instant no matter how many photos you have stored.

### Integrity
- AES-GCM is authenticated: records that have been altered outside the app fail
  to decrypt. The app then refuses to open rather than showing you corrupted or
  partial medical information, and it leaves the stored data untouched.

### Backups
- The export is **encrypted** — it is the same ciphertext, plus the wrapped keys
  needed to open it. It is safe to keep on a cloud drive or USB stick.
- A restored backup opens only with the PIN that was in use when it was taken.

### Cloud sync
- If enabled, the same ciphertext already written to `localStorage` is copied
  to a folder in **your own** cloud storage account. Nothing is decrypted
  before it leaves the device, and nothing is decrypted by the storage
  provider or by whoever is hosting this app -- the DEK never leaves your
  devices' memory.
- Whoever can sign in to that cloud account, or that you share the folder
  with, can read (still-encrypted) copies of your records and could delete
  them. Treat access to that account with the same care as the device itself.

### Emergency QR code
- The emergency QR encodes the selected person's name, date of birth,
  medications and emergency contact **in plain text, unencrypted and
  deliberately so** — it is meant to be readable by a paramedic with any phone.
- Treat it like a printed medical card. Show it only to people you are willing
  to hand that information to.

---

## What this app cannot protect you from

- **Losing the device.** Your records exist only here. Export an encrypted
  backup and keep it somewhere else; that is the only disaster recovery
  available.
- **Losing both the PIN and the recovery code.** The data is then unrecoverable,
  by design. That is the cost of nobody else holding your key.
- **Someone who has both your device and your PIN.** A 6-digit PIN is short on
  purpose, for one-handed use under stress. It is not a defence against a
  determined attacker who physically holds your device.

---

## Disclaimer

Family Care Hub is built to keep your data private, but you should still follow
basic precautions: choose a PIN that is not your birthday, keep your device
locked, and store your recovery code somewhere separate from the device.

This app has not undergone an independent security audit.
