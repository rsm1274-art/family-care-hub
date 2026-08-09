<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Family Care Hub

A local-first app for caregivers to keep critical medical information for the
people they look after, available fast in an emergency.

**Everything stays on your device.** There is no server, no account, and no
sync. Nothing you enter is transmitted anywhere.

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
