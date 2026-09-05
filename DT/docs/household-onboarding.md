# Getting Your Household Onto Family Care Hub

Family Care Hub runs entirely on one computer at a time — nothing is stored in
the cloud, and it doesn't talk to other computers on its own. Sharing records
between computers is a deliberate action: export a backup file, then import it
somewhere else.

## How it works

- **Every install is its own copy.** It keeps a family database and photos on
  its own disk, independent of any other computer running the app.
- **Everyone gets their own login** (username + password) inside a shared
  **household**. Everyone logged into that household on that computer sees the
  same people, medications, and documents.
- To bring your records to another computer, **export** a backup file on one
  and **import** it on the other.

## Step 1 — Set up the app

1. Install Family Care Hub from the installer and launch it.
2. First-time setup takes about a minute while the local database is created.
3. When the sign-in screen appears, pick **New Household**:
   - Household name — e.g. *The Millers*
   - Your name, a username, and a password (8+ characters)
4. You're in. Add your first family member profiles and medications.

> The person who creates the household is its admin. There is no password
> recovery in v1 — store your password somewhere safe (a password manager or a
> note in a drawer — your call, it never leaves your computer).

## Step 2 — Add another login on the same computer (optional)

If more than one person uses this computer and wants their own login for the
same household: open **Settings** (gear icon) → **Household & Account** to
find the 8-character **invite code**. On the sign-in screen they choose
**Join**, enter the code, and create their own username and password.

## Step 3 — Move records to another computer

Use this whenever a family member needs the same records on their own
computer (a sibling's laptop, a new PC, etc.):

1. On the computer that has the records, open **Settings → Data & Backup** and
   click the **Download** icon on the dashboard. It saves a
   `FamilyCare_Backup_....json` file containing every person, medication,
   document, and photo.
2. Move that file to the other computer (USB stick, email to yourself, a
   shared drive — whatever's easiest).
3. On the other computer, set up Family Care Hub (Step 1) if you haven't
   already, then go to **Settings → Data & Backup → Import Backup File** and
   pick the file.

This is a one-way copy, not live sync — edits made after the export don't
travel automatically. Re-export and re-import whenever you want to catch
someone else up.

## Bringing in data from the old web app

If you used the old Family Care Hub website (the one with the PIN):

1. On the device where the old app has your data, open it and press the
   **Download** (backup) icon — it saves a `FamilyCare_Backup_....json` file.
2. Move that file to any computer with the new app.
3. In the new app: **Settings → Data & Backup → Import Backup File**, pick the
   file. People, medications, and label photos are added to your household.

## Ongoing habits

- **Backups**: press the Download icon on the dashboard after big changes and
  keep a copy somewhere other than this computer (cloud drive or USB stick).
  The app's own data lives in `%APPDATA%\Family Care Hub` — back that folder
  up too if you want a belt-and-suspenders copy.
- **Keeping siblings' copies in sync**: since each install is independent,
  agree on who's the "source of truth" and re-export/re-import after changes,
  or just accept that each computer's copy may drift a little between syncs.
