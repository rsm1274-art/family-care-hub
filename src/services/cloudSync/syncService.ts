import type { CloudProvider } from './types';

// Which cloud file each local record last synced from/to, so pullNewer only
// re-downloads when the cloud copy has actually moved on.
const syncedAtKey = (key: string): string => `${key}__synced_at`;

let provider: CloudProvider | null = null;

export const cloudSync = {
  getProvider: (): CloudProvider | null => provider,
  isConnected: (): boolean => provider !== null && provider.isConnected(),

  connect: async (next: CloudProvider): Promise<void> => {
    await next.connect();
    provider = next;
  },

  disconnect: async (): Promise<void> => {
    if (provider) await provider.disconnect();
    provider = null;
  },

  /** Pushes already-sealed ciphertext. Best-effort: callers decide how to surface a failure. */
  pushAll: async (entries: Record<string, string>): Promise<void> => {
    if (!provider) return;
    await Promise.all(
      Object.entries(entries).map(async ([key, sealed]) => {
        await provider!.writeFile(key, sealed);
        localStorage.setItem(syncedAtKey(key), new Date().toISOString());
      }),
    );
  },

  /**
   * Pulls cloud copies newer than what this device last synced, writing them
   * into localStorage under their own key so the next loadSecure() picks them
   * up. Returns the keys that were updated.
   */
  pullNewer: async (keys: string[]): Promise<string[]> => {
    if (!provider) return [];
    const remoteFiles = await provider.listFiles();
    const updated: string[] = [];

    for (const key of keys) {
      const remote = remoteFiles.find((f) => f.name === key);
      if (!remote) continue;

      const lastSynced = localStorage.getItem(syncedAtKey(key));
      if (lastSynced && new Date(remote.modifiedTime) <= new Date(lastSynced)) continue;

      const content = await provider.readFile(key);
      if (content === null) continue;

      localStorage.setItem(key, content);
      localStorage.setItem(syncedAtKey(key), remote.modifiedTime);
      updated.push(key);
    }

    return updated;
  },
};
