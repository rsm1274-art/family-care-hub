/**
 * Pluggable "bring your own cloud" sync. A provider stores opaque named blobs
 * (already-encrypted ciphertext from cryptoService) in a folder the caregiver
 * owns and can share with other caregivers via that provider's own sharing
 * UI. No content is ever readable by the provider or by anyone operating
 * this app -- there is no backend here to see it.
 */
export type CloudFile = {
  name: string;
  /** ISO 8601 timestamp of the provider's last-modified time for this file. */
  modifiedTime: string;
};

export interface CloudProvider {
  readonly id: string;
  readonly label: string;
  isConnected(): boolean;
  /** Starts the provider's own OAuth consent flow. */
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listFiles(): Promise<CloudFile[]>;
  /** Returns null if the file does not exist in the linked folder. */
  readFile(name: string): Promise<string | null>;
  writeFile(name: string, content: string): Promise<void>;
  /** No-op if the file does not exist. */
  deleteFile(name: string): Promise<void>;
}
