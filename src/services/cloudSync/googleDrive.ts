import type { CloudProvider, CloudFile } from './types';

// drive.file: this app can only see files/folders it created itself, not the
// caregiver's whole Drive. No Google-side review of a "sensitive" scope is
// needed, and a caregiver auditing app permissions sees the narrowest grant
// that still does the job.
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = 'Family Care Hub Data';
const FOLDER_ID_CACHE_KEY = 'fch_drive_folder_id';
const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

type TokenClient = {
  requestAccessToken: (opts?: { prompt?: string }) => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

let scriptLoadPromise: Promise<void> | null = null;
const loadGisScript = (): Promise<void> => {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!scriptLoadPromise) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GIS_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity Services.'));
      document.head.appendChild(script);
    });
  }
  return scriptLoadPromise;
};

// Held in memory only -- like the vault's DEK, it should not outlive the tab.
// GIS tokens expire in ~1 hour; reconnecting is a one-tap action in Settings.
let accessToken: string | null = null;
let folderId: string | null = localStorage.getItem(FOLDER_ID_CACHE_KEY);

const authedFetch = (input: string, init: RequestInit = {}): Promise<Response> => {
  if (!accessToken) throw new Error('Google Drive is not connected.');
  return fetch(input, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${accessToken}` },
  });
};

const findFolder = async (): Promise<string | null> => {
  const q = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`,
  );
  const res = await authedFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&spaces=drive`,
  );
  if (!res.ok) throw new Error(`Drive folder lookup failed: ${res.status}`);
  const body = await res.json();
  return body.files?.[0]?.id ?? null;
};

const createFolder = async (): Promise<string> => {
  const res = await authedFetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  if (!res.ok) throw new Error(`Drive folder creation failed: ${res.status}`);
  const body = await res.json();
  return body.id;
};

const ensureFolder = async (): Promise<string> => {
  if (folderId) return folderId;
  const found = await findFolder();
  const id = found ?? (await createFolder());
  folderId = id;
  localStorage.setItem(FOLDER_ID_CACHE_KEY, id);
  return id;
};

const findFile = async (name: string): Promise<{ id: string; modifiedTime: string } | null> => {
  const parent = await ensureFolder();
  const q = encodeURIComponent(`name='${name}' and '${parent}' in parents and trashed=false`);
  const res = await authedFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,modifiedTime)&spaces=drive`,
  );
  if (!res.ok) throw new Error(`Drive file lookup failed: ${res.status}`);
  const body = await res.json();
  return body.files?.[0] ?? null;
};

export const createGoogleDriveProvider = (clientId: string): CloudProvider => {
  let tokenClient: TokenClient | null = null;

  return {
    id: 'google-drive',
    label: 'Google Drive',

    isConnected: () => accessToken !== null,

    connect: async () => {
      await loadGisScript();
      if (!window.google) throw new Error('Google Identity Services did not load.');

      if (!tokenClient) {
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: DRIVE_SCOPE,
          // Replaced by the promise executor below on each connect() call.
          callback: () => {},
        });
      }

      await new Promise<void>((resolve, reject) => {
        // initTokenClient's callback is reassigned per-call so each connect()
        // settles its own promise rather than a stale one from a prior call.
        (tokenClient as unknown as { callback: (r: { access_token?: string; error?: string }) => void }).callback =
          (resp) => {
            if (resp.error || !resp.access_token) {
              reject(new Error(resp.error ?? 'Google Drive authorization was not granted.'));
              return;
            }
            accessToken = resp.access_token;
            resolve();
          };
        tokenClient!.requestAccessToken({ prompt: '' });
      });
    },

    disconnect: async () => {
      accessToken = null;
    },

    listFiles: async (): Promise<CloudFile[]> => {
      const parent = await ensureFolder();
      const res = await authedFetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${parent}' in parents and trashed=false`)}&fields=files(name,modifiedTime)&spaces=drive`,
      );
      if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
      const body = await res.json();
      return (body.files ?? []) as CloudFile[];
    },

    readFile: async (name: string): Promise<string | null> => {
      const file = await findFile(name);
      if (!file) return null;
      const res = await authedFetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
      );
      if (!res.ok) throw new Error(`Drive read failed: ${res.status}`);
      return res.text();
    },

    writeFile: async (name: string, content: string): Promise<void> => {
      const parent = await ensureFolder();
      const existing = await findFile(name);

      if (existing) {
        const res = await authedFetch(
          `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`,
          { method: 'PATCH', headers: { 'Content-Type': 'application/octet-stream' }, body: content },
        );
        if (!res.ok) throw new Error(`Drive update failed: ${res.status}`);
        return;
      }

      const boundary = 'fch-drive-boundary';
      const metadata = JSON.stringify({ name, parents: [parent] });
      const body =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
        `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n${content}\r\n` +
        `--${boundary}--`;

      const res = await authedFetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body },
      );
      if (!res.ok) throw new Error(`Drive create failed: ${res.status}`);
    },

    deleteFile: async (name: string): Promise<void> => {
      const existing = await findFile(name);
      if (!existing) return;
      const res = await authedFetch(`https://www.googleapis.com/drive/v3/files/${existing.id}`, {
        method: 'DELETE',
      });
      if (!res.ok && res.status !== 404) throw new Error(`Drive delete failed: ${res.status}`);
    },
  };
};
